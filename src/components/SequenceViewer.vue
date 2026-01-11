<script setup>
import { ref, computed, watch } from 'vue'
import { usePersistedZoom } from '../composables/usePersistedZoom.js'

const props = defineProps({
  /** Initial zoom level (bases per line) */
  initialZoom: {
    type: Number,
    default: 100
  }
})

const emit = defineEmits(['select', 'contextmenu'])

// Sequence is set via setSequence method, not props (for large sequences)
const sequence = ref('')

// Set initial zoom from localStorage (fallback to prop)
const { getInitialZoom, saveZoom } = usePersistedZoom(props.initialZoom)
const zoomLevel = ref(getInitialZoom())

// Persist zoom changes to localStorage
watch(zoomLevel, (newZoom) => {
  saveZoom(newZoom)
})

// Available zoom levels
const zoomLevels = [50, 75, 100, 200, 500, 1000, 2000, 5000, 10000]

// Computed properties
const lineCount = computed(() => {
  if (!sequence.value) return 0
  return Math.ceil(sequence.value.length / zoomLevel.value)
})

const lines = computed(() => {
  if (!sequence.value) return []
  const result = []
  for (let i = 0; i < lineCount.value; i++) {
    const start = i * zoomLevel.value
    const end = Math.min(start + zoomLevel.value, sequence.value.length)
    result.push({
      index: i,
      start,
      end,
      text: sequence.value.slice(start, end),
      position: start + 1 // 1-based for display
    })
  }
  return result
})

// Whether to show text or compressed bar view
const showText = computed(() => {
  // Show text when zoomed in enough (arbitrary threshold for now)
  return zoomLevel.value <= 200
})

// Available zoom options (filter to only those smaller than sequence length)
const availableZooms = computed(() => {
  if (!sequence.value) return zoomLevels
  return zoomLevels.filter(z => z < sequence.value.length)
})

// Methods exposed to parent (for server push pattern)
function setSequence(seq) {
  sequence.value = seq
}

function getSequence() {
  return sequence.value
}

function setZoom(level) {
  zoomLevel.value = level
}

// Selection handling
const selectionStart = ref(null)
const selectionEnd = ref(null)

function handleMouseDown(event, line) {
  const charIndex = getCharIndexFromEvent(event, line)
  if (charIndex !== null) {
    selectionStart.value = line.start + charIndex
    selectionEnd.value = selectionStart.value

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }
}

function handleMouseMove(event) {
  // Update selection end based on mouse position
  // This is simplified - would need proper position calculation
}

function handleMouseUp() {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)

  if (selectionStart.value !== null && selectionEnd.value !== null) {
    emit('select', {
      start: Math.min(selectionStart.value, selectionEnd.value),
      end: Math.max(selectionStart.value, selectionEnd.value)
    })
  }
}

function getCharIndexFromEvent(event, line) {
  // Simplified - would need proper character width calculation
  const target = event.target
  if (!target || !target.textContent) return null

  const rect = target.getBoundingClientRect()
  const x = event.clientX - rect.left
  const charWidth = rect.width / target.textContent.length
  const index = Math.floor(x / charWidth)

  return Math.max(0, Math.min(index, line.text.length - 1))
}

function handleContextMenu(event, line) {
  event.preventDefault()
  const charIndex = getCharIndexFromEvent(event, line)
  emit('contextmenu', {
    event,
    position: line.start + (charIndex || 0),
    line: line.index
  })
}

// Expose methods for parent component
defineExpose({
  setSequence,
  getSequence,
  setZoom
})
</script>

<template>
  <div class="sequence-viewer">
    <!-- Toolbar -->
    <div class="toolbar">
      <label>
        Zoom:
        <select v-model="zoomLevel">
          <option v-for="z in availableZooms" :key="z" :value="z">
            {{ z >= 1000 ? `${z/1000}kbp` : `${z}bp` }}
          </option>
          <option v-if="sequence" :value="sequence.length">full</option>
        </select>
      </label>
      <span v-if="sequence" class="info">
        {{ sequence.length.toLocaleString() }} bp
      </span>
    </div>

    <!-- Sequence display -->
    <div class="sequence-content">
      <div v-if="!sequence" class="empty-state">
        No sequence loaded
      </div>

      <div v-else class="lines">
        <div
          v-for="line in lines"
          :key="line.index"
          class="line"
        >
          <span class="position">{{ line.position }}</span>
          <span
            v-if="showText"
            class="sequence-text"
            @mousedown="handleMouseDown($event, line)"
            @contextmenu="handleContextMenu($event, line)"
          >{{ line.text }}</span>
          <div
            v-else
            class="sequence-bar"
            :style="{ width: `${(line.text.length / zoomLevel) * 100}%` }"
            @mousedown="handleMouseDown($event, line)"
            @contextmenu="handleContextMenu($event, line)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sequence-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: monospace;
}

.toolbar {
  display: flex;
  gap: 1rem;
  padding: 0.5rem;
  border-bottom: 1px solid #ccc;
  align-items: center;
}

.toolbar label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.info {
  color: #666;
}

.sequence-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.empty-state {
  color: #999;
  text-align: center;
  padding: 2rem;
}

.lines {
  display: flex;
  flex-direction: column;
}

.line {
  display: flex;
  align-items: center;
  padding: 2px 0;
}

.position {
  min-width: 80px;
  color: #666;
  text-align: right;
  padding-right: 1rem;
  font-size: 0.9em;
}

.sequence-text {
  letter-spacing: 0.1em;
  cursor: text;
  user-select: none;
}

.sequence-bar {
  height: 8px;
  background: #333;
  cursor: pointer;
}

/* Base coloring */
.sequence-text {
  /* Could add per-base coloring with more complex rendering */
}
</style>
