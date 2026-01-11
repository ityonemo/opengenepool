<script setup>
import { ref, computed, onMounted, onUnmounted, provide, watch } from 'vue'
import { useEditorState } from '../composables/useEditorState.js'
import { useGraphics } from '../composables/useGraphics.js'
import { createEventBus } from '../composables/useEventBus.js'
import { usePersistedZoom } from '../composables/usePersistedZoom.js'
import { SelectionDomain } from '../composables/useSelection.js'
import { Annotation } from '../utils/annotation.js'
import { reverseComplement } from '../utils/dna.js'
import AnnotationLayer from './AnnotationLayer.vue'
import SelectionLayer from './SelectionLayer.vue'
import ContextMenu from './ContextMenu.vue'

const props = defineProps({
  /** DNA sequence string to display */
  sequence: {
    type: String,
    default: ''
  },
  /** Title for the sequence */
  title: {
    type: String,
    default: ''
  },
  /** Initial zoom level (bases per line) */
  initialZoom: {
    type: Number,
    default: 100
  },
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
  'ready',
  'edit',
  'annotation-click',
  'annotation-contextmenu',
  'annotation-hover'
])

// Valid DNA bases for input
const DNA_BASES = new Set(['A', 'T', 'C', 'G', 'a', 't', 'c', 'g', 'N', 'n'])

// Initialize composables
const editorState = useEditorState()
const graphics = useGraphics(editorState)
const eventBus = createEventBus()

// Set initial zoom from localStorage (fallback to prop)
const { getInitialZoom, saveZoom } = usePersistedZoom(props.initialZoom)
editorState.setZoom(getInitialZoom())

// Persist zoom changes to localStorage
watch(editorState.zoomLevel, (newZoom) => {
  saveZoom(newZoom)
})

// Watch for sequence prop changes to initialize/update the editor
watch(() => props.sequence, (newSeq) => {
  if (newSeq) {
    editorState.setSequence(newSeq, props.title)
    // Re-apply persisted zoom now that sequence is loaded (setZoom clamps based on length)
    editorState.setZoom(getInitialZoom())
  }
}, { immediate: true })

// Watch for title changes
watch(() => props.title, (newTitle) => {
  if (editorState.sequence.value) {
    editorState.title.value = newTitle
  }
})

// Convert plain annotation objects to Annotation class instances
const annotationInstances = computed(() => {
  return props.annotations.map(ann => {
    // If already an Annotation instance, return as-is
    if (ann instanceof Annotation) return ann
    // Convert plain object to Annotation
    return new Annotation(ann)
  })
})

// Provide state to child components
provide('editorState', editorState)
provide('graphics', graphics)
provide('eventBus', eventBus)

// Template refs
const containerRef = ref(null)
const svgRef = ref(null)
const measureRef = ref(null)
const selectionLayerRef = ref(null)

// Zoom levels for selector
const zoomLevels = [50, 75, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000]
const zoomStrings = ['50bp', '75bp', '100bp', '200bp', '500bp', '1kbp', '2kbp', '5kbp', '10kbp', '20kbp', '50kbp', '100kbp']

// Available zoom options based on sequence length
const availableZooms = computed(() => {
  const len = editorState.sequenceLength.value
  if (len === 0) return zoomLevels.map((z, i) => ({ value: z, label: zoomStrings[i] }))

  const options = []
  for (let i = 0; i < zoomLevels.length && zoomLevels[i] < len; i++) {
    options.push({ value: zoomLevels[i], label: zoomStrings[i] })
  }
  // Add "full" option
  options.push({ value: len, label: 'full' })
  return options
})

// SVG dimensions
const svgHeight = computed(() => {
  return graphics.getTotalHeight(editorState.lineCount.value)
})

// Cursor position helpers
const cursorLine = computed(() => {
  return editorState.positionToLine(editorState.cursor.value)
})

const cursorX = computed(() => {
  const posInLine = editorState.positionInLine(editorState.cursor.value)
  return graphics.metrics.value.lmargin + posInLine * graphics.metrics.value.charWidth
})

const cursorY = computed(() => {
  return graphics.getLineY(cursorLine.value)
})

// Measure font metrics on mount
function measureFont() {
  if (!measureRef.value) return

  const bbox = measureRef.value.getBBox()
  if (bbox.width > 0) {
    // Measure width of 50 characters to get average (matches OGP teststring)
    graphics.setFontMetrics(bbox.width / 50, bbox.height)
  }
}

// Handle container resize
function handleResize() {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  graphics.setContainerSize(rect.width, rect.height)
}

// Selection state
const isDragging = ref(false)
const dragStart = ref(null)

// Context menu state
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuItems = ref([])

// Build context menu items based on current context
function buildContextMenuItems(context) {
  const items = []
  const selection = selectionLayerRef.value?.selection
  const isSelected = selection?.isSelected.value
  const domain = selection?.domain.value

  // Selection actions
  if (isSelected && domain && domain.ranges.length > 0) {
    items.push({
      label: 'Copy selection',
      action: () => {
        handleCopy()
      }
    })
    items.push({
      label: 'Select none',
      action: () => {
        selection.unselect()
        editorState.clearSelection()
      }
    })
    items.push({ separator: true })

    // Selection-specific items when right-clicking on a selection
    if (context.source === 'selection' && context.range) {
      const range = context.range
      const rangeIndex = context.rangeIndex

      // Strand flip options
      if (range.orientation === 1 || range.orientation === -1) {
        items.push({
          label: 'Flip strand',
          action: () => selection.flip(rangeIndex)
        })
        items.push({
          label: 'Make undirected',
          action: () => selection.setOrientation(rangeIndex, 0)
        })
      } else {
        items.push({
          label: 'Set to plus strand',
          action: () => selection.setOrientation(rangeIndex, 1)
        })
        items.push({
          label: 'Set to minus strand',
          action: () => selection.setOrientation(rangeIndex, -1)
        })
      }

      // Multi-range operations
      if (domain.ranges.length > 1) {
        items.push({ separator: true })
        items.push({
          label: 'Delete this range',
          action: () => selection.deleteRange(rangeIndex)
        })
        if (rangeIndex > 0) {
          items.push({
            label: 'Move range up',
            action: () => selection.moveRange(rangeIndex, rangeIndex - 1)
          })
        }
        if (rangeIndex < domain.ranges.length - 1) {
          items.push({
            label: 'Move range down',
            action: () => selection.moveRange(rangeIndex, rangeIndex + 1)
          })
        }
      }

      items.push({ separator: true })
    }
  }

  // Always available
  items.push({
    label: 'Select all',
    action: () => {
      if (selection) {
        selection.select(`0..${editorState.sequenceLength.value}`)
      }
      editorState.setSelection(0, editorState.sequenceLength.value)
    }
  })

  return items
}

// Show context menu
function showContextMenu(event, context) {
  contextMenuItems.value = buildContextMenuItems(context)
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuVisible.value = true
}

// Hide context menu
function hideContextMenu() {
  contextMenuVisible.value = false
}

function handleMouseDown(event, lineIndex) {
  if (event.button !== 0) return // Left click only

  // Prevent native text selection
  event.preventDefault()
  clearNativeSelection()

  const pos = getPositionFromEvent(event, lineIndex)
  if (pos === null) return

  isDragging.value = true
  dragStart.value = pos

  // Get the SelectionLayer's selection composable
  const selection = selectionLayerRef.value?.selection

  // Shift-click extends existing selection to position
  if (event.shiftKey && selection?.isSelected.value) {
    selection.extendToPosition(pos)
    return  // Don't start a new drag
  } else if (event.ctrlKey && selection?.isSelected.value) {
    // Ctrl-click adds new range from current anchor
    selection.updateSelection(pos)
  } else {
    // Start new selection
    if (selection) {
      selection.startSelection(pos, event.ctrlKey)
    }
  }

  // Also update editorState for backward compatibility
  if (event.shiftKey && editorState.selection.value) {
    editorState.setSelection(editorState.selection.value.start, pos)
  } else {
    editorState.setSelection(pos, pos)
  }

  // Broadcast startselect event (for plugin communication)
  eventBus.emit('startselect', {
    line: lineIndex,
    linepos: editorState.positionInLine(pos),
    pos: pos,
    mode: event.shiftKey  // true = extend selection
  })

  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
}

function handleMouseMove(event) {
  if (!isDragging.value || dragStart.value === null) return

  // Clear any native text selection that the browser creates
  clearNativeSelection()

  // Find which line we're over
  const svgRect = svgRef.value.getBoundingClientRect()
  const y = event.clientY - svgRect.top
  const lineIndex = graphics.pixelToLineIndex(y, editorState.lineCount.value)

  const pos = getPositionFromEvent(event, lineIndex)
  if (pos !== null) {
    // Update SelectionLayer's selection
    const selection = selectionLayerRef.value?.selection
    if (selection) {
      selection.updateSelection(pos)
    }

    // Also update editorState for backward compatibility
    editorState.setSelection(dragStart.value, pos)
  }
}

function handleMouseUp() {
  isDragging.value = false
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)

  const sel = editorState.selection.value
  if (sel && sel.start !== sel.end) {
    emit('select', { ...sel, sequence: editorState.getSelectedSequence() })
  }

  // Also notify the SelectionLayer to end its drag
  if (selectionLayerRef.value?.selection) {
    selectionLayerRef.value.selection.endSelection()
  }
}

// Selection layer event handlers
function handleSelectionChange(data) {
  emit('select', data)
}

function handleSelectionContextMenu(data) {
  // Add selection-specific context menu items
  const items = buildContextMenuItems({
    source: 'selection',
    rangeIndex: data.rangeIndex,
    range: data.range
  })
  contextMenuItems.value = items
  contextMenuX.value = data.event.clientX
  contextMenuY.value = data.event.clientY
  contextMenuVisible.value = true
}

// Annotation click handler - select the annotation's span with its orientation
function handleAnnotationClick(data) {
  const { annotation, event } = data

  // Create a selection from the annotation's span
  const selection = selectionLayerRef.value?.selection
  if (selection && annotation.span) {
    if (event?.shiftKey) {
      // Shift-click extends existing selection to include annotation bounds
      const bounds = annotation.span.bounds
      selection.extendToPosition(bounds.start)
      selection.extendToPosition(bounds.end)
    } else if (event?.ctrlKey) {
      // Ctrl-click adds/merges annotation to existing selection
      const newDomain = new SelectionDomain(annotation.span)
      selection.extendSelection(newDomain)
    } else {
      // Regular click replaces selection with annotation
      const newDomain = new SelectionDomain(annotation.span)
      selection.select(newDomain)
    }
  }

  // Also emit for parent components
  emit('annotation-click', data)
}

function handleContextMenu(event, lineIndex) {
  event.preventDefault()

  const pos = getPositionFromEvent(event, lineIndex)
  const context = {
    line: lineIndex,
    linepos: pos !== null ? editorState.positionInLine(pos) : 0,
    pos: pos
  }

  // Broadcast contextmenu event (for plugin communication)
  eventBus.emit('contextmenu', context)

  // Show the context menu
  showContextMenu(event, context)

  emit('contextmenu', {
    event,
    position: pos,
    line: lineIndex,
    selection: editorState.selection.value
  })
}

function getPositionFromEvent(event, lineIndex) {
  if (!svgRef.value) return null

  const svgRect = svgRef.value.getBoundingClientRect()
  const x = event.clientX - svgRect.left
  const linePos = graphics.pixelToLinePosition(x)

  return editorState.lineToPosition(lineIndex, linePos)
}

// Zoom handling
function handleZoomChange(event) {
  editorState.setZoom(Number(event.target.value))
}

// Clear native browser text selection (SVG text selection is hard to disable via CSS)
function clearNativeSelection() {
  const selection = window.getSelection()
  if (selection) {
    selection.removeAllRanges()
  }
}

// Copy/Cut handlers
function getSelectedSequenceText() {
  // Get selection from SelectionLayer's domain
  const selection = selectionLayerRef.value?.selection
  const domain = selection?.domain?.value

  if (domain && domain.ranges && domain.ranges.length > 0) {
    const seq = editorState.sequence.value
    // Extract sequence for each range and concatenate
    return domain.ranges.map(range => {
      const slice = seq.slice(range.start, range.end)
      // Reverse complement if minus strand
      if (range.orientation === -1) {
        return reverseComplement(slice)
      }
      return slice
    }).join('')
  }

  // Fall back to editorState's simple selection
  return editorState.getSelectedSequence()
}

function handleCopy() {
  const selectedSeq = getSelectedSequenceText()
  if (selectedSeq) {
    navigator.clipboard.writeText(selectedSeq)
  }
}

function handleCut() {
  const selectedSeq = getSelectedSequenceText()
  if (selectedSeq) {
    navigator.clipboard.writeText(selectedSeq)
    editorState.deleteSelection()
    emit('edit', { type: 'cut', text: selectedSeq })
  }
}

// Keyboard handling
function handleKeyDown(event) {
  const key = event.key

  // Handle Ctrl/Cmd shortcuts first
  if (event.ctrlKey || event.metaKey) {
    switch (key.toLowerCase()) {
      case 'c':
        event.preventDefault()
        handleCopy()
        return
      case 'x':
        event.preventDefault()
        handleCut()
        return
      case 'a':
        event.preventDefault()
        const selection = selectionLayerRef.value?.selection
        if (selection) selection.selectAll()
        return
    }
  }

  // DNA base input
  if (DNA_BASES.has(key)) {
    event.preventDefault()
    editorState.insertAtCursor(key.toUpperCase())
    emit('edit', { type: 'insert', text: key.toUpperCase() })
    return
  }

  // Editing keys
  switch (key) {
    case 'Backspace':
      event.preventDefault()
      if (editorState.cursor.value > 0 || editorState.selection.value) {
        editorState.backspace()
        emit('edit', { type: 'backspace' })
      }
      break

    case 'Delete':
      event.preventDefault()
      if (editorState.cursor.value < editorState.sequenceLength.value || editorState.selection.value) {
        editorState.delete()
        emit('edit', { type: 'delete' })
      }
      break

    case 'ArrowLeft':
      event.preventDefault()
      editorState.setCursor(editorState.cursor.value - 1)
      if (!event.shiftKey) {
        editorState.clearSelection()
      }
      break

    case 'ArrowRight':
      event.preventDefault()
      editorState.setCursor(editorState.cursor.value + 1)
      if (!event.shiftKey) {
        editorState.clearSelection()
      }
      break

    case 'Home':
      event.preventDefault()
      editorState.setCursor(0)
      if (!event.shiftKey) {
        editorState.clearSelection()
      }
      break

    case 'End':
      event.preventDefault()
      editorState.setCursor(editorState.sequenceLength.value)
      if (!event.shiftKey) {
        editorState.clearSelection()
      }
      break
  }
}

// Public API
function setSequence(seq, title = '') {
  editorState.setSequence(seq, title)
}

function getSequence() {
  return editorState.sequence.value
}

function setZoom(level) {
  editorState.setZoom(level)
}

function getSelection() {
  return editorState.selection.value
}

// Lifecycle
onMounted(() => {
  handleResize()
  measureFont()

  // Set up resize observer
  const resizeObserver = new ResizeObserver(handleResize)
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }

  emit('ready')

  onUnmounted(() => {
    resizeObserver.disconnect()
  })
})

// Selection highlight helpers
function isLineSelected(line) {
  const sel = editorState.selection.value
  if (!sel) return false
  return sel.start < line.end && sel.end > line.start
}

function getSelectionX(line) {
  const sel = editorState.selection.value
  if (!sel) return 0
  const start = Math.max(sel.start, line.start)
  const linePos = start - line.start
  return graphics.metrics.value.lmargin + linePos * graphics.metrics.value.charWidth
}

function getSelectionWidth(line) {
  const sel = editorState.selection.value
  if (!sel) return 0
  const start = Math.max(sel.start, line.start)
  const end = Math.min(sel.end, line.end)
  return (end - start) * graphics.metrics.value.charWidth
}

// Expose public API
defineExpose({
  setSequence,
  getSequence,
  setZoom,
  getSelection,
  editorState,
  graphics,
  eventBus
})
</script>

<template>
  <div class="sequence-editor" ref="containerRef">
    <!-- Toolbar -->
    <div class="toolbar">
      <label class="zoom-control">
        Zoom:
        <select :value="editorState.zoomLevel.value" @change="handleZoomChange">
          <option
            v-for="opt in availableZooms"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </label>

      <span v-if="editorState.sequenceLength.value > 0" class="info">
        <strong>{{ editorState.title.value || 'Untitled' }}</strong>
        &mdash; {{ editorState.sequenceLength.value.toLocaleString() }} bp
      </span>
    </div>

    <!-- SVG Editor -->
    <div class="editor-container">
      <svg
        ref="svgRef"
        class="editor-svg"
        :width="graphics.metrics.value.fullWidth"
        :height="svgHeight"
        tabindex="0"
        @keydown="handleKeyDown"
        @selectstart.prevent
        @dragstart.prevent
        @contextmenu.prevent
        onselectstart="return false"
        ondragstart="return false"
      >
        <!-- Hidden text for measuring font metrics (50 chars like OGP) -->
        <text
          ref="measureRef"
          x="-1000"
          y="-1000"
          class="sequence-text"
        >aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa</text>

        <!-- Empty state -->
        <text
          v-if="editorState.sequenceLength.value === 0"
          :x="graphics.metrics.value.fullWidth / 2"
          y="50"
          text-anchor="middle"
          class="empty-state"
        >
          No sequence loaded
        </text>

        <!-- Sequence lines -->
        <g
          v-for="line in editorState.lines.value"
          :key="line.index"
          :transform="`translate(0, ${graphics.getLineY(line.index)})`"
          class="sequence-line"
        >
          <!-- Position label -->
          <text
            :x="graphics.metrics.value.lmargin - 8"
            :y="graphics.lineHeight.value / 2"
            text-anchor="end"
            dominant-baseline="middle"
            class="position-label"
          >
            {{ line.position }}
          </text>

          <!-- Sequence content (text or bar) -->
          <g :transform="`translate(${graphics.metrics.value.lmargin}, 0)`">
            <!-- Text mode -->
            <text
              v-if="graphics.metrics.value.textMode"
              x="0"
              :y="graphics.lineHeight.value / 2"
              dominant-baseline="middle"
              class="sequence-text"
              :style="{ letterSpacing: `${graphics.metrics.value.charWidth - graphics.metrics.value.blockWidth}px` }"
            >
              {{ line.text }}
            </text>

            <!-- Bar mode - thin bar above center (matches original proportions) -->
            <rect
              v-else
              x="0"
              :y="graphics.lineHeight.value * 3 / 8"
              :width="(line.end - line.start) * graphics.metrics.value.charWidth"
              :height="graphics.lineHeight.value / 4"
              class="sequence-bar"
            />

            <!-- Invisible overlay to capture mouse events and prevent text selection -->
            <rect
              x="0"
              y="0"
              :width="(line.end - line.start) * graphics.metrics.value.charWidth"
              :height="graphics.lineHeight.value"
              class="sequence-overlay"
              @mousedown="handleMouseDown($event, line.index)"
              @contextmenu="handleContextMenu($event, line.index)"
            />
          </g>

          <!-- Selection highlight -->
          <rect
            v-if="editorState.selection.value && isLineSelected(line)"
            :x="getSelectionX(line)"
            y="0"
            :width="getSelectionWidth(line)"
            :height="graphics.lineHeight.value"
            class="selection-highlight"
          />
        </g>

        <!-- Selection Layer (behind annotations) -->
        <SelectionLayer
          ref="selectionLayerRef"
          @select="handleSelectionChange"
          @contextmenu="handleSelectionContextMenu"
        />

        <!-- Annotation Layer -->
        <AnnotationLayer
          v-if="annotationInstances.length > 0"
          :annotations="annotationInstances"
          :show-captions="showAnnotationCaptions"
          :offset-y="graphics.lineHeight.value"
          @click="handleAnnotationClick"
          @contextmenu="emit('annotation-contextmenu', $event)"
          @hover="emit('annotation-hover', $event)"
        />

        <!-- Cursor -->
        <line
          v-if="editorState.sequenceLength.value > 0"
          class="cursor"
          :x1="cursorX"
          :y1="cursorY + 2"
          :x2="cursorX"
          :y2="cursorY + graphics.lineHeight.value - 2"
        />
      </svg>
    </div>

    <!-- Context Menu -->
    <ContextMenu
      :visible="contextMenuVisible"
      :x="contextMenuX"
      :y="contextMenuY"
      :items="contextMenuItems"
      @close="hideContextMenu"
    />
  </div>
</template>

<style scoped>
.sequence-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: system-ui, -apple-system, sans-serif;
  user-select: none;
}

.toolbar {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #ddd;
  background: #f8f8f8;
  align-items: center;
  flex-shrink: 0;
}

.zoom-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.zoom-control select {
  padding: 0.25rem 0.5rem;
  min-width: 80px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.info {
  color: #666;
}

.editor-container {
  flex: 1;
  overflow: auto;
  background: white;
}

.editor-svg {
  display: block;
  min-width: 100%;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
}

/* Prevent any SVG text from being selected by the browser */
.editor-svg text {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
}

.editor-svg text::selection {
  background: transparent;
}

.editor-svg text::-moz-selection {
  background: transparent;
}

.sequence-line {
  cursor: text;
}

.position-label {
  font-family: "Lucida Console", Monaco, monospace;
  font-size: 10px;
  fill: #888;
  text-anchor: end;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
}

.sequence-text {
  font-family: "Lucida Console", Monaco, monospace;
  font-size: 16px;
  fill: #000;
  pointer-events: none;
  text-anchor: start;
}

.sequence-overlay {
  fill: transparent;
  cursor: text;
}

/* Hide native browser text selection highlight */
.sequence-text::selection {
  background: transparent;
}

.sequence-text::-moz-selection {
  background: transparent;
}

.sequence-bar {
  fill: #333;
  stroke: #000;
  stroke-width: 1px;
}

/* Selection highlighting - matches original plugin_selection.css */
.selection-highlight {
  pointer-events: none;
}

.selection-highlight.plus {
  fill: rgba(0, 255, 0, 0.5);
  stroke: rgba(0, 128, 0, 1);
  stroke-width: 2px;
  stroke-linejoin: round;
}

.selection-highlight.minus {
  fill: rgba(255, 0, 0, 0.5);
  stroke: rgba(255, 0, 0, 1);
  stroke-width: 2px;
  stroke-linejoin: round;
}

.selection-highlight.undirected {
  fill: rgba(192, 192, 192, 0.5);
  stroke: rgba(0, 0, 0, 1);
  stroke-width: 2px;
  stroke-linejoin: round;
}

/* Default selection highlight (when no strand info) */
.selection-highlight {
  fill: rgba(66, 133, 244, 0.3);
}

/* Selection handles */
.sel_handle {
  cursor: col-resize;
}

.sel_handle.plus {
  fill: rgba(200, 200, 200, 1);
  stroke: rgba(0, 128, 0, 1);
}

.sel_handle.minus {
  fill: rgba(200, 200, 200, 1);
  stroke: rgba(255, 0, 0, 1);
}

.sel_handle.undirected {
  fill: rgba(200, 200, 200, 1);
  stroke: rgba(64, 64, 64, 1);
}

/* Selection tags */
.sel_tag_text {
  text-anchor: middle;
  fill: black;
  font-family: "Lucida Console", Monaco, monospace;
  font-size: 10px;
}

.sel_tag_box {
  fill: white;
  stroke: black;
  stroke-width: 1px;
}

.empty-state {
  fill: #999;
  font-size: 16px;
}

.cursor {
  stroke: #333;
  stroke-width: 2;
  pointer-events: none;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.editor-svg:focus {
  outline: 2px solid #4285f4;
  outline-offset: -2px;
}
</style>
