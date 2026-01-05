<script setup>
import { ref, computed, onMounted, onUnmounted, provide, watch } from 'vue'
import { useEditorState } from '../composables/useEditorState.js'
import { useGraphics } from '../composables/useGraphics.js'

const props = defineProps({
  /** Initial zoom level (bases per line) */
  initialZoom: {
    type: Number,
    default: 100
  }
})

const emit = defineEmits(['select', 'contextmenu', 'ready'])

// Initialize composables
const editorState = useEditorState()
const graphics = useGraphics(editorState)

// Set initial zoom
editorState.setZoom(props.initialZoom)

// Provide state to child components
provide('editorState', editorState)
provide('graphics', graphics)

// Template refs
const containerRef = ref(null)
const svgRef = ref(null)
const measureRef = ref(null)

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

// Measure font metrics on mount
function measureFont() {
  if (!measureRef.value) return

  const bbox = measureRef.value.getBBox()
  if (bbox.width > 0) {
    // Measure width of 10 characters to get average
    graphics.setFontMetrics(bbox.width / 10, bbox.height)
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

function handleMouseDown(event, lineIndex) {
  if (event.button !== 0) return // Left click only

  const pos = getPositionFromEvent(event, lineIndex)
  if (pos === null) return

  isDragging.value = true
  dragStart.value = pos
  editorState.setSelection(pos, pos)

  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
}

function handleMouseMove(event) {
  if (!isDragging.value || dragStart.value === null) return

  // Find which line we're over
  const svgRect = svgRef.value.getBoundingClientRect()
  const y = event.clientY - svgRect.top
  const lineIndex = graphics.pixelToLineIndex(y, editorState.lineCount.value)

  const pos = getPositionFromEvent(event, lineIndex)
  if (pos !== null) {
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
}

function handleContextMenu(event, lineIndex) {
  event.preventDefault()

  const pos = getPositionFromEvent(event, lineIndex)
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
  graphics
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
      >
        <!-- Hidden text for measuring font metrics -->
        <text
          ref="measureRef"
          x="-1000"
          y="-1000"
          class="sequence-text"
        >AAAAAAAAAA</text>

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
          <g
            :transform="`translate(${graphics.metrics.value.lmargin}, 0)`"
            @mousedown="handleMouseDown($event, line.index)"
            @contextmenu="handleContextMenu($event, line.index)"
          >
            <!-- Text mode -->
            <text
              v-if="graphics.metrics.value.textMode"
              x="0"
              :y="graphics.lineHeight.value / 2"
              dominant-baseline="middle"
              class="sequence-text"
              :style="{ letterSpacing: `${graphics.metrics.value.charWidth - 8}px` }"
            >
              {{ line.text }}
            </text>

            <!-- Bar mode -->
            <rect
              v-else
              x="0"
              :y="graphics.lineHeight.value / 4"
              :width="(line.end - line.start) * graphics.metrics.value.charWidth"
              :height="graphics.lineHeight.value / 2"
              class="sequence-bar"
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
      </svg>
    </div>
  </div>
</template>

<style scoped>
.sequence-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: system-ui, -apple-system, sans-serif;
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
}

.sequence-line {
  cursor: text;
}

.position-label {
  font-family: monospace;
  font-size: 12px;
  fill: #888;
}

.sequence-text {
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
  fill: #333;
  user-select: none;
}

.sequence-bar {
  fill: #333;
}

.selection-highlight {
  fill: rgba(66, 133, 244, 0.3);
  pointer-events: none;
}

.empty-state {
  fill: #999;
  font-size: 16px;
}
</style>
