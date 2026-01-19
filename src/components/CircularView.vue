<script setup>
import { computed, inject, ref, provide } from 'vue'
import { useCircularGraphics } from '../composables/useCircularGraphics.js'
import CircularAnnotationLayer from './CircularAnnotationLayer.vue'
import CircularSelectionLayer from './CircularSelectionLayer.vue'

const props = defineProps({
  /** Array of Annotation objects to display */
  annotations: {
    type: Array,
    default: () => []
  },
  /** Whether to show annotation captions */
  showAnnotationCaptions: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits([
  'select',
  'contextmenu',
  'annotation-click',
  'annotation-contextmenu',
  'annotation-hover'
])

// Inject from parent SequenceEditor
const editorState = inject('editorState')
const eventBus = inject('eventBus', null)
const selection = inject('selection')
const annotationColors = inject('annotationColors', null)

// Create circular graphics
const circularGraphics = useCircularGraphics(editorState)

// Provide circular graphics to child components
provide('circularGraphics', circularGraphics)

// SVG ref for mouse coordinate calculation
const svgRef = ref(null)

// Backbone circle path (simple circle)
const backbonePath = computed(() => {
  const cx = circularGraphics.centerX.value
  const cy = circularGraphics.centerY.value
  const r = circularGraphics.backboneRadius.value
  // SVG circle as path (two arcs)
  return `M ${cx - r},${cy} A ${r},${r} 0 1,1 ${cx + r},${cy} A ${r},${r} 0 1,1 ${cx - r},${cy}`
})

// Title display position (center of circle)
const titlePosition = computed(() => ({
  x: circularGraphics.centerX.value,
  y: circularGraphics.centerY.value - 10
}))

// Length display position (below title)
const lengthPosition = computed(() => ({
  x: circularGraphics.centerX.value,
  y: circularGraphics.centerY.value + 10
}))

// Mouse handling
const isDragging = ref(false)
const dragStart = ref(null)
const lastDragPos = ref(null)
const isWrapped = ref(false)

function handleMouseDown(event) {
  if (event.button !== 0) return // Left click only
  event.preventDefault()

  // Check if click is in the "dead zone" (well inside backbone, clears selection)
  const coords = getCoordsFromEvent(event)
  if (coords) {
    const cx = circularGraphics.centerX.value
    const cy = circularGraphics.centerY.value
    const backboneRadius = circularGraphics.backboneRadius.value
    const dx = coords.x - cx
    const dy = coords.y - cy
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Dead zone: more than 20px inside the backbone (toward center)
    // Clicks near/on the backbone or outside it can start selections
    const deadZoneOuterRadius = backboneRadius - 20
    if (distance < deadZoneOuterRadius) {
      selection.unselect()
      return
    }
  }

  const pos = getPositionFromEvent(event)
  if (pos === null) return

  isDragging.value = true
  dragStart.value = pos
  lastDragPos.value = pos
  isWrapped.value = false

  // Shift-click extends existing selection
  if (event.shiftKey && selection.isSelected.value) {
    selection.extendToPosition(pos)
    return
  }

  // Start a new selection (or add range with Ctrl)
  selection.startSelection(pos, event.ctrlKey)

  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
}

function handleMouseMove(event) {
  if (!isDragging.value || dragStart.value === null) return

  const pos = getPositionFromEvent(event)
  if (pos === null) return

  const seqLen = editorState.sequenceLength.value
  const anchor = selection.anchor.value

  // Detect origin crossing: if position jumps by more than half the sequence
  if (lastDragPos.value !== null) {
    const delta = pos - lastDragPos.value
    if (Math.abs(delta) > seqLen / 2) {
      // We crossed the origin - toggle wrapped state
      isWrapped.value = !isWrapped.value

      const ranges = selection.domain.value.ranges
      const currentRange = ranges[ranges.length - 1]
      const originalOrientation = currentRange.orientation || 1

      if (isWrapped.value) {
        // Create second range for the wrap
        const wentClockwise = delta < 0

        if (wentClockwise) {
          // Selection goes from anchor clockwise past origin to pos
          // Range 1: anchor to seqLen, Range 2: 0 to pos
          currentRange.start = anchor
          currentRange.end = seqLen
          currentRange.orientation = originalOrientation

          ranges.push({
            start: 0,
            end: pos,
            orientation: originalOrientation
          })
        } else {
          // Selection goes from anchor counter-clockwise past origin to pos
          // Range 1: 0 to anchor, Range 2: pos to seqLen
          currentRange.start = 0
          currentRange.end = anchor
          currentRange.orientation = originalOrientation

          ranges.push({
            start: pos,
            end: seqLen,
            orientation: originalOrientation
          })
        }
      } else {
        // Unwrap: remove the second range
        if (ranges.length > 1) {
          ranges.pop()
        }
      }
    }
  }

  lastDragPos.value = pos

  // Update range(s) based on wrapped state
  if (isWrapped.value && selection.domain.value.ranges.length > 1) {
    const ranges = selection.domain.value.ranges
    const primaryRange = ranges[ranges.length - 2]
    const secondRange = ranges[ranges.length - 1]

    // Determine which direction we wrapped and update accordingly
    if (primaryRange.end === seqLen) {
      // Clockwise wrap: primary is anchor..seqLen, secondary is 0..pos
      secondRange.end = pos
    } else if (primaryRange.start === 0) {
      // Counter-clockwise wrap: primary is 0..anchor, secondary is pos..seqLen
      secondRange.start = pos
    }

    // Trigger reactivity
    selection.domain.value = selection.domain.value
  } else {
    // Non-wrapped: use standard selection update
    selection.updateSelection(pos)
  }
}

function handleMouseUp() {
  isDragging.value = false
  lastDragPos.value = null
  isWrapped.value = false
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)

  selection.endSelection()

  // Emit select event
  const domain = selection.domain.value
  if (domain && domain.ranges.length > 0) {
    emit('select', { ranges: domain.ranges })
  }
}

function handleContextMenu(event) {
  event.preventDefault()
  const pos = getPositionFromEvent(event)
  emit('contextmenu', { event, position: pos })
}

function getCoordsFromEvent(event) {
  if (!svgRef.value) return null

  const rect = svgRef.value.getBoundingClientRect()
  const vbWidth = circularGraphics.viewBoxWidth.value
  const vbHeight = circularGraphics.viewBoxHeight.value

  // With preserveAspectRatio="xMidYMid meet", the viewBox is scaled uniformly
  // and centered within the element
  const scaleX = vbWidth / rect.width
  const scaleY = vbHeight / rect.height
  const scale = Math.max(scaleX, scaleY)  // "meet" uses the larger scale (smaller rendered size)

  // Calculate the offset due to centering
  const renderedWidth = vbWidth / scale
  const renderedHeight = vbHeight / scale
  const offsetX = (rect.width - renderedWidth) / 2
  const offsetY = (rect.height - renderedHeight) / 2

  return {
    x: (event.clientX - rect.left - offsetX) * scale,
    y: (event.clientY - rect.top - offsetY) * scale
  }
}

function getPositionFromEvent(event) {
  const coords = getCoordsFromEvent(event)
  if (!coords) return null
  return circularGraphics.mouseToPosition(coords.x, coords.y)
}

// Event handlers for child components
function handleAnnotationClick(data) {
  emit('annotation-click', data)
}

function handleAnnotationContextMenu(data) {
  emit('annotation-contextmenu', data)
}

function handleAnnotationHover(data) {
  emit('annotation-hover', data)
}

function handleSelectionChange(data) {
  emit('select', data)
}

function handleSelectionContextMenu(data) {
  emit('contextmenu', data)
}

// Expose for parent
defineExpose({
  circularGraphics
})
</script>

<template>
  <svg
    ref="svgRef"
    class="circular-view"
    :viewBox="circularGraphics.viewBox.value"
    preserveAspectRatio="xMidYMid meet"
    @mousedown="handleMouseDown"
    @contextmenu="handleContextMenu"
  >
    <!-- Background for click handling -->
    <rect
      x="0"
      y="0"
      :width="circularGraphics.viewBoxWidth.value"
      :height="circularGraphics.viewBoxHeight.value"
      class="background"
    />

    <!-- Backbone circle -->
    <path
      :d="backbonePath"
      class="backbone"
    />

    <!-- Tick marks -->
    <g class="tick-marks">
      <g
        v-for="tick in circularGraphics.tickMarks.value"
        :key="tick.position"
        class="tick"
      >
        <!-- Tick line -->
        <line
          :x1="tick.innerPoint.x"
          :y1="tick.innerPoint.y"
          :x2="tick.outerPoint.x"
          :y2="tick.outerPoint.y"
          class="tick-line"
        />
        <!-- Tick label -->
        <text
          :x="tick.labelPoint.x"
          :y="tick.labelPoint.y"
          :text-anchor="tick.textAnchor"
          :dominant-baseline="tick.dominantBaseline"
          class="tick-label"
        >
          {{ tick.label }}
        </text>
      </g>
    </g>

    <!-- Selection layer (below annotations) -->
    <CircularSelectionLayer
      @select="handleSelectionChange"
      @contextmenu="handleSelectionContextMenu"
    />

    <!-- Annotation layer -->
    <CircularAnnotationLayer
      :annotations="annotations"
      :show-captions="showAnnotationCaptions"
      @click="handleAnnotationClick"
      @contextmenu="handleAnnotationContextMenu"
      @hover="handleAnnotationHover"
    />

    <!-- Center text (title and length) -->
    <text
      :x="titlePosition.x"
      :y="titlePosition.y"
      text-anchor="middle"
      dominant-baseline="middle"
      class="center-title"
    >
      {{ editorState.title.value || 'Untitled' }}
    </text>
    <text
      :x="lengthPosition.x"
      :y="lengthPosition.y"
      text-anchor="middle"
      dominant-baseline="middle"
      class="center-length"
    >
      {{ editorState.sequenceLength.value.toLocaleString() }} bp
    </text>
  </svg>
</template>

<style scoped>
.circular-view {
  width: 100%;
  height: 100%;
  user-select: none;
  -webkit-user-select: none;
}

.background {
  fill: white;
}

.backbone {
  fill: none;
  stroke: #333;
  stroke-width: 3;
}

.tick-marks {
  pointer-events: none;
}

.tick-line {
  stroke: #666;
  stroke-width: 1;
}

.tick-label {
  font-family: "Lucida Console", Monaco, monospace;
  font-size: 9px;
  fill: #666;
}

.center-title {
  font-family: Arial, sans-serif;
  font-size: 14px;
  font-weight: bold;
  fill: #333;
}

.center-length {
  font-family: Arial, sans-serif;
  font-size: 11px;
  fill: #666;
}
</style>
