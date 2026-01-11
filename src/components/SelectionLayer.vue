<script setup>
import { computed, inject, ref } from 'vue'
import { useSelection } from '../composables/useSelection.js'
import { GraphicsSpan } from '../composables/useGraphics.js'
import { Orientation } from '../utils/dna.js'

const props = defineProps({
  /** Handle radius in pixels */
  handleRadius: {
    type: Number,
    default: 5
  }
})

const emit = defineEmits(['select', 'contextmenu', 'merge'])

// Inject from parent SequenceEditor
const editorState = inject('editorState')
const graphics = inject('graphics')
const eventBus = inject('eventBus', null)

// Use selection composable
const selection = useSelection(editorState, graphics, eventBus)

// Handle drag state
const draggedHandle = ref(null) // { rangeIndex, type: 'start'|'end' }
const dragLimits = ref({ low: 0, high: 0 })

// Pending drag for overlapping handles (direction-based selection)
const pendingDrag = ref(null) // { startX, touchPoint, handles: [{rangeIndex, type}, ...] }

// Compute selection paths for rendering
const selectionPaths = computed(() => {
  if (!selection.isSelected.value || !selection.domain.value) return []

  const paths = []
  const ranges = selection.domain.value.ranges
  const zoom = editorState.zoomLevel.value
  const m = graphics.metrics.value
  const lineHeight = graphics.lineHeight.value

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i]
    const gSpan = new GraphicsSpan(range, zoom)

    if (gSpan.fragments.length === 0) continue

    const fragments = gSpan.fragments
    const firstFrag = fragments[0]
    const lastFrag = fragments[fragments.length - 1]

    // Calculate pixel positions
    const x1 = m.lmargin + firstFrag.start * m.charWidth
    const x2 = m.lmargin + lastFrag.end * m.charWidth

    // Get the extra height for annotations above each line
    const firstLineExtra = graphics.lineExtraHeight.value.get(firstFrag.line) || 0
    const lastLineExtra = graphics.lineExtraHeight.value.get(lastFrag.line) || 0
    const topMargin = editorState.settings.value.linetopmargin || 0

    // y1 is the top of the row (including annotation space and top margin)
    // getLineY returns the baseline position (after topMargin + extra height), so subtract both
    const y1 = graphics.getLineY(firstFrag.line) - firstLineExtra - topMargin
    const y2 = graphics.getLineY(lastFrag.line) + lineHeight

    let pathD
    if (fragments.length === 1) {
      // Single line - simple rectangle
      pathD = `M ${x1},${y1} H ${x2} V ${y2} H ${x1} Z`
    } else {
      // Multi-line - wrap around path
      const rightEdge = m.lmargin + m.lineWidth
      const leftEdge = m.lmargin
      const startLineBottom = graphics.getLineY(firstFrag.line) + lineHeight
      const lastLineTop = graphics.getLineY(lastFrag.line) - lastLineExtra - topMargin

      pathD = `M ${x1},${y1} ` +
              `H ${rightEdge} ` +
              `V ${lastLineTop} ` +
              `H ${x2} ` +
              `V ${y2} ` +
              `H ${leftEdge} ` +
              `V ${startLineBottom} ` +
              `H ${x1} Z`
    }

    // Handle positions - at the very top of the selection
    const handleStartX = x1
    const handleStartY = y1  // Top of the selection (includes margin)
    const handleEndX = x2
    const handleEndY = graphics.getLineY(lastFrag.line) - lastLineExtra - topMargin  // Top of the last line's row

    paths.push({
      index: i,
      path: pathD,
      cssClass: getCssClass(range),
      handleStart: { x: handleStartX, y: handleStartY },
      handleEnd: { x: handleEndX, y: handleEndY },
      range
    })
  }

  return paths
})

// Compute merge bubbles for touching range pairs
const mergeBubbles = computed(() => {
  if (!selection.isSelected.value || !selection.domain.value) return []

  const ranges = selection.domain.value.ranges
  if (ranges.length < 2) return []

  const bubbles = []
  const m = graphics.metrics.value
  const zoom = editorState.zoomLevel.value
  const topMargin = editorState.settings.value.linetopmargin || 0

  // Scan pairwise for touching ends
  for (let i = 0; i < ranges.length - 1; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      let touchPoint = null
      let startRange = null
      let endRange = null

      if (ranges[i].start === ranges[j].end) {
        // ranges[j] ends where ranges[i] starts
        touchPoint = ranges[i].start
        startRange = j
        endRange = i
      } else if (ranges[i].end === ranges[j].start) {
        // ranges[i] ends where ranges[j] starts
        touchPoint = ranges[i].end
        startRange = i
        endRange = j
      }

      if (touchPoint !== null) {
        // Calculate position for bubble
        const lineIndex = Math.floor(touchPoint / zoom)
        const linePos = touchPoint % zoom
        const x = m.lmargin + linePos * m.charWidth
        const lineExtra = graphics.lineExtraHeight.value.get(lineIndex) || 0
        const y = graphics.getLineY(lineIndex) - lineExtra - topMargin - 12  // Above the selection

        bubbles.push({
          x,
          y,
          startRangeIndex: startRange,
          endRangeIndex: endRange
        })
      }
    }
  }

  return bubbles
})

// Merge two touching ranges
function handleMerge(bubble) {
  const ranges = selection.domain.value.ranges
  const startRange = ranges[bubble.startRangeIndex]
  const endRange = ranges[bubble.endRangeIndex]

  // Use orientation from the longer range
  const newOrientation = startRange.length >= endRange.length
    ? startRange.orientation
    : endRange.orientation

  // Extend the start range to cover both
  startRange.end = endRange.end
  startRange.orientation = newOrientation

  // Remove the end range
  ranges.splice(bubble.endRangeIndex, 1)

  // Trigger reactivity
  selection.domain.value = selection.domain.value

  emit('merge', { ranges: selection.domain.value.ranges })
}

// CSS class based on orientation and range length
function getCssClass(range) {
  // Zero-width selections (cursors) are always black
  if (range.start === range.end) {
    return 'selection cursor'
  }
  switch (range.orientation) {
    case Orientation.PLUS: return 'selection plus'
    case Orientation.MINUS: return 'selection minus'
    default: return 'selection undirected'
  }
}

function getHandleCssClass(range) {
  // Zero-width selections (cursors) are always black
  if (range.start === range.end) {
    return 'sel_handle cursor'
  }
  switch (range.orientation) {
    case Orientation.PLUS: return 'sel_handle plus'
    case Orientation.MINUS: return 'sel_handle minus'
    default: return 'sel_handle undirected'
  }
}

// Generate a "post-it tab arrow" path - rounded rectangle on top, triangle pointing down
// x, y is the junction between the rectangle and triangle
function getTrianglePath(x, y, width = 10, height = 8) {
  const halfWidth = width / 2
  const radius = 2  // Corner radius for rounded top
  const rectHeight = width  // Square: height equals width

  // Start at top-left corner (after radius), go clockwise
  const top = y - rectHeight
  const left = x - halfWidth
  const right = x + halfWidth
  const bottom = y + height  // Triangle tip

  return `M ${left + radius},${top} ` +           // Start after top-left radius
         `H ${right - radius} ` +                  // Top edge
         `Q ${right},${top} ${right},${top + radius} ` +  // Top-right corner
         `V ${y} ` +                               // Right edge down to triangle junction
         `L ${x},${bottom} ` +                     // Right side of triangle to tip
         `L ${left},${y} ` +                       // Left side of triangle from tip
         `V ${top + radius} ` +                    // Left edge up to corner
         `Q ${left},${top} ${left + radius},${top} ` +  // Top-left corner
         `Z`
}

// Handle dragging
function startHandleDrag(event, rangeIndex, handleType) {
  if (event.button !== 0) return // Left click only
  event.preventDefault()
  event.stopPropagation()

  const range = selection.domain.value.ranges[rangeIndex]
  const handlePos = handleType === 'start' ? range.start : range.end

  // Check for other handles at the same position (touching ranges)
  const ranges = selection.domain.value.ranges
  const overlappingHandles = [{ rangeIndex, type: handleType }]

  for (let i = 0; i < ranges.length; i++) {
    if (i === rangeIndex) continue
    const r = ranges[i]
    if (r.start === handlePos) {
      overlappingHandles.push({ rangeIndex: i, type: 'start' })
    }
    if (r.end === handlePos) {
      overlappingHandles.push({ rangeIndex: i, type: 'end' })
    }
  }

  if (overlappingHandles.length > 1) {
    // Multiple handles at same position - wait for direction
    pendingDrag.value = {
      startX: event.clientX,
      touchPoint: handlePos,
      handles: overlappingHandles
    }
    window.addEventListener('mousemove', handlePendingDragMove)
    window.addEventListener('mouseup', handlePendingDragEnd)
  } else {
    // Single handle - proceed normally
    beginDrag(rangeIndex, handleType)
  }
}

// Handle pending drag to determine direction for overlapping handles
function handlePendingDragMove(event) {
  if (!pendingDrag.value) return

  const deltaX = event.clientX - pendingDrag.value.startX
  const threshold = 3 // pixels before deciding direction

  if (Math.abs(deltaX) < threshold) return

  const draggingLeft = deltaX < 0
  const { handles, touchPoint } = pendingDrag.value
  const ranges = selection.domain.value.ranges

  let chosenHandle
  if (draggingLeft) {
    // Dragging left: use the end handle of the left range
    chosenHandle = handles.find(h => {
      const r = ranges[h.rangeIndex]
      return h.type === 'end' && r.end === touchPoint
    })
  } else {
    // Dragging right: use the start handle of the right range
    chosenHandle = handles.find(h => {
      const r = ranges[h.rangeIndex]
      return h.type === 'start' && r.start === touchPoint
    })
  }

  if (!chosenHandle) chosenHandle = handles[0]

  // Clean up pending state
  window.removeEventListener('mousemove', handlePendingDragMove)
  window.removeEventListener('mouseup', handlePendingDragEnd)
  pendingDrag.value = null

  // Begin actual drag and process this move
  beginDrag(chosenHandle.rangeIndex, chosenHandle.type)
  handleDragMove(event)
}

function handlePendingDragEnd() {
  window.removeEventListener('mousemove', handlePendingDragMove)
  window.removeEventListener('mouseup', handlePendingDragEnd)
  pendingDrag.value = null
}

// Begin the actual drag operation
function beginDrag(rangeIndex, handleType) {
  const range = selection.domain.value.ranges[rangeIndex]
  const seqLen = editorState.sequenceLength.value

  // The anchor is the opposite end - this stays fixed during drag
  const anchor = handleType === 'start' ? range.end : range.start

  // Remember the original orientation and whether we started on left or right of anchor
  const originalOrientation = range.orientation
  const startedLeftOfAnchor = (handleType === 'start') ? (range.start < anchor) : (range.end < anchor)
  const wasZeroWidth = range.start === range.end

  draggedHandle.value = { rangeIndex, type: handleType }

  // Calculate drag limits (constrained by other ranges and sequence bounds)
  let low = 0
  let high = seqLen

  // Constrain by other ranges (but allow crossing the anchor)
  const ranges = selection.domain.value.ranges
  for (let i = 0; i < ranges.length; i++) {
    if (i === rangeIndex) continue
    const r = ranges[i]

    // Find the closest boundary on each side of the anchor
    if (r.end <= anchor && r.end > low) {
      low = r.end
    }
    if (r.start >= anchor && r.start < high) {
      high = r.start
    }
  }

  dragLimits.value = { low, high, anchor, originalOrientation, startedLeftOfAnchor, wasZeroWidth }

  window.addEventListener('mousemove', handleDragMove)
  window.addEventListener('mouseup', handleDragEnd)
}

function handleDragMove(event) {
  if (!draggedHandle.value) return

  const svg = document.querySelector('.editor-svg')
  if (!svg) return

  const rect = svg.getBoundingClientRect()
  const y = event.clientY - rect.top
  const x = event.clientX - rect.left

  // Convert to sequence position
  const lineIndex = graphics.pixelToLineIndex(y, editorState.lineCount.value)
  const linePos = graphics.pixelToLinePosition(x)
  let pos = editorState.lineToPosition(lineIndex, linePos)

  // Clamp to limits
  pos = Math.max(dragLimits.value.low, Math.min(pos, dragLimits.value.high))

  // Update the range - always maintain start <= end
  const { rangeIndex } = draggedHandle.value
  const range = selection.domain.value.ranges[rangeIndex]
  const { anchor, originalOrientation, startedLeftOfAnchor, wasZeroWidth } = dragLimits.value

  // Set start and end based on position relative to anchor
  range.start = Math.min(anchor, pos)
  range.end = Math.max(anchor, pos)

  // Determine if we've crossed the anchor
  const nowLeftOfAnchor = pos < anchor
  const nowRightOfAnchor = pos > anchor

  // Zero-width means neutral orientation
  if (pos === anchor) {
    range.orientation = Orientation.NONE
  } else if (wasZeroWidth) {
    // Started from zero-width cursor: orientation based on drag direction
    if (nowRightOfAnchor) {
      range.orientation = Orientation.PLUS
    } else {
      range.orientation = Orientation.MINUS
    }
  } else {
    // Normal case: flip orientation only when crossing the anchor
    const crossed = (startedLeftOfAnchor && nowRightOfAnchor) || (!startedLeftOfAnchor && nowLeftOfAnchor)

    if (crossed) {
      // Crossed the anchor: flip orientation
      range.orientation = originalOrientation === Orientation.PLUS ? Orientation.MINUS : Orientation.PLUS
    } else {
      // Haven't crossed: keep original orientation
      range.orientation = originalOrientation
    }
  }

  // Trigger reactivity
  selection.domain.value = selection.domain.value
}

function handleDragEnd() {
  draggedHandle.value = null
  window.removeEventListener('mousemove', handleDragMove)
  window.removeEventListener('mouseup', handleDragEnd)

  // Emit select event
  if (selection.isSelected.value) {
    emit('select', {
      ranges: selection.domain.value.ranges
    })
  }
}

// Selection path click handler
function handlePathClick(event, rangeIndex) {
  // Select this range as active
  // Could emit event for context menu, etc.
}

function handlePathContextMenu(event, rangeIndex) {
  event.preventDefault()
  emit('contextmenu', {
    event,
    rangeIndex,
    range: selection.domain.value.ranges[rangeIndex]
  })
}

// Expose for parent component
defineExpose({
  selection
})
</script>

<template>
  <g class="selection-layer">
    <!-- Selection paths -->
    <g v-for="sel in selectionPaths" :key="`sel-${sel.index}`">
      <!-- Selection fill path -->
      <path
        :d="sel.path"
        :class="sel.cssClass"
        @click="handlePathClick($event, sel.index)"
        @contextmenu="handlePathContextMenu($event, sel.index)"
      />

      <!-- Start handle - soft triangle pointing down -->
      <path
        :d="getTrianglePath(sel.handleStart.x, sel.handleStart.y)"
        :class="getHandleCssClass(sel.range)"
        @mousedown="startHandleDrag($event, sel.index, 'start')"
      />

      <!-- End handle - soft triangle pointing down -->
      <path
        :d="getTrianglePath(sel.handleEnd.x, sel.handleEnd.y)"
        :class="getHandleCssClass(sel.range)"
        @mousedown="startHandleDrag($event, sel.index, 'end')"
      />

      <!-- Tag for multi-range selection -->
      <g
        v-if="selectionPaths.length > 1"
        :transform="`translate(${sel.handleStart.x}, ${sel.handleStart.y - 15})`"
        class="sel_tag"
      >
        <rect
          x="-8"
          y="-8"
          width="16"
          height="16"
          rx="2"
          class="sel_tag_box"
        />
        <text
          x="0"
          y="0"
          dominant-baseline="middle"
          text-anchor="middle"
          class="sel_tag_text"
        >
          {{ sel.index + 1 }}
        </text>
      </g>
    </g>

    <!-- Merge bubbles for touching ranges -->
    <g
      v-for="(bubble, idx) in mergeBubbles"
      :key="`merge-${idx}`"
      :transform="`translate(${bubble.x}, ${bubble.y})`"
      class="merge_bubble"
      @click="handleMerge(bubble)"
    >
      <rect
        x="-24"
        y="-8"
        width="48"
        height="16"
        rx="2"
        class="merge_bubble_box"
      />
      <text
        x="0"
        y="0"
        dominant-baseline="middle"
        text-anchor="middle"
        class="merge_bubble_text"
      >
        merge?
      </text>
    </g>
  </g>
</template>

<style scoped>
.selection-layer {
  pointer-events: none;
}

/* Selection paths */
.selection {
  pointer-events: all;
  cursor: pointer;
}

.selection.plus {
  fill: rgba(0, 255, 0, 0.3);
  stroke: rgba(0, 128, 0, 1);
  stroke-width: 2px;
  stroke-linejoin: round;
}

.selection.minus {
  fill: rgba(255, 0, 0, 0.3);
  stroke: rgba(255, 0, 0, 1);
  stroke-width: 2px;
  stroke-linejoin: round;
}

.selection.undirected {
  fill: rgba(192, 192, 192, 0.3);
  stroke: rgba(64, 64, 64, 1);
  stroke-width: 2px;
  stroke-linejoin: round;
}

.selection.cursor {
  fill: rgba(0, 0, 0, 0.3);
  stroke: rgba(0, 0, 0, 1);
  stroke-width: 2px;
  stroke-linejoin: round;
}

/* Selection handles */
.sel_handle {
  pointer-events: all;
  cursor: col-resize;
  opacity: 0.8;
  transition: opacity 0.15s;
}

.sel_handle:hover {
  opacity: 1;
}

.sel_handle.plus {
  fill: rgba(200, 200, 200, 1);
  stroke: rgba(0, 128, 0, 1);
  stroke-width: 2px;
}

.sel_handle.minus {
  fill: rgba(200, 200, 200, 1);
  stroke: rgba(255, 0, 0, 1);
  stroke-width: 2px;
}

.sel_handle.undirected {
  fill: rgba(200, 200, 200, 1);
  stroke: rgba(64, 64, 64, 1);
  stroke-width: 2px;
}

.sel_handle.cursor {
  fill: rgba(200, 200, 200, 1);
  stroke: rgba(0, 0, 0, 1);
  stroke-width: 2px;
}

/* Selection tags */
.sel_tag {
  pointer-events: none;
}

.sel_tag_box {
  fill: white;
  stroke: black;
  stroke-width: 1px;
}

.sel_tag_text {
  font-family: "Lucida Console", Monaco, monospace;
  font-size: 10px;
  fill: black;
}

/* Merge bubbles */
.merge_bubble {
  pointer-events: all;
  cursor: pointer;
}

.merge_bubble_box {
  fill: #ffffcc;
  stroke: #666;
  stroke-width: 1px;
  transition: fill 0.15s;
}

.merge_bubble:hover .merge_bubble_box {
  fill: #ffff99;
}

.merge_bubble_text {
  font-family: Arial, sans-serif;
  font-size: 11px;
  fill: #333;
  pointer-events: none;
}
</style>
