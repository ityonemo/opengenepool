import { ref, computed, shallowRef } from 'vue'

/**
 * Core editor state management.
 * Replaces the jQuery Editor class and plugin broadcast system.
 *
 * State lifecycle:
 * 1. Created (no sequence)
 * 2. Sequence loaded (has data)
 * 3. Ready (can render)
 */
export function useEditorState() {
  // Core data - shallowRef for large sequences to avoid deep reactivity
  const sequence = shallowRef('')
  const title = ref('')
  const annotations = shallowRef([])

  // Editor settings
  const zoomLevel = ref(100)  // bases per line
  const settings = ref({
    vmargin: 10,      // vertical margin
    lmargin: 60,      // left margin (for position numbers)
    rmargin: 20,      // right margin
    linepadding: 5,   // padding between lines
    contentpadding: 2 // padding between overlapping elements
  })

  // Selection state
  const selection = ref(null)  // { start, end } or null

  // Computed properties
  const sequenceLength = computed(() => sequence.value.length)

  const lineCount = computed(() => {
    if (sequenceLength.value === 0) return 0
    return Math.ceil(sequenceLength.value / zoomLevel.value)
  })

  const lines = computed(() => {
    const result = []
    const seq = sequence.value
    const zoom = zoomLevel.value

    for (let i = 0; i < lineCount.value; i++) {
      const start = i * zoom
      const end = Math.min(start + zoom, seq.length)
      result.push({
        index: i,
        start,
        end,
        text: seq.slice(start, end),
        position: start + 1  // 1-based position for display
      })
    }
    return result
  })

  // Actions
  function setSequence(seq, newTitle = '') {
    sequence.value = seq
    title.value = newTitle
    // Reset selection when sequence changes
    selection.value = null
  }

  function setZoom(level) {
    // Clamp to valid range
    const min = 50
    const max = Math.max(sequence.value.length, 50)
    zoomLevel.value = Math.max(min, Math.min(level, max))
  }

  function setSelection(start, end) {
    if (start === null || end === null) {
      selection.value = null
    } else {
      // Normalize so start <= end
      selection.value = {
        start: Math.min(start, end),
        end: Math.max(start, end)
      }
    }
  }

  function clearSelection() {
    selection.value = null
  }

  function getSelectedSequence() {
    if (!selection.value) return ''
    return sequence.value.slice(selection.value.start, selection.value.end)
  }

  // Position helpers
  function positionToLine(pos) {
    return Math.floor(pos / zoomLevel.value)
  }

  function positionInLine(pos) {
    return pos % zoomLevel.value
  }

  function lineToPosition(line, linePos = 0) {
    return line * zoomLevel.value + linePos
  }

  return {
    // State
    sequence,
    title,
    annotations,
    zoomLevel,
    settings,
    selection,

    // Computed
    sequenceLength,
    lineCount,
    lines,

    // Actions
    setSequence,
    setZoom,
    setSelection,
    clearSelection,
    getSelectedSequence,

    // Helpers
    positionToLine,
    positionInLine,
    lineToPosition
  }
}
