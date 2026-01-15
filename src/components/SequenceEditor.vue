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
import InsertModal from './InsertModal.vue'

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
  },
  /** Whether the editor is read-only (disables editing, allows selection/copy) */
  readonly: {
    type: Boolean,
    default: false
  },
  /** Sequence metadata (molecule_type, definition, etc.) */
  metadata: {
    type: Object,
    default: () => ({})
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

// Valid DNA bases for input (IUPAC codes)
// A, T, C, G - standard bases
// N - any base
// R - purine (A/G), Y - pyrimidine (C/T)
// S - strong (G/C), W - weak (A/T)
// K - keto (G/T), M - amino (A/C)
// B - not A (C/G/T), D - not C (A/G/T), H - not G (A/C/T), V - not T (A/C/G)
const DNA_BASES = new Set([
  'A', 'T', 'C', 'G', 'N', 'R', 'Y', 'S', 'W', 'K', 'M', 'B', 'D', 'H', 'V',
  'a', 't', 'c', 'g', 'n', 'r', 'y', 's', 'w', 'k', 'm', 'b', 'd', 'h', 'v'
])

// Insert/replace modal state
const insertModalVisible = ref(false)
const insertModalText = ref('')
const insertModalIsReplace = ref(false)
const insertModalPosition = ref(0)

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

// Annotation filtering state with localStorage persistence
const HIDDEN_TYPES_KEY = 'opengenepool-hidden-annotation-types'
const DEFAULT_HIDDEN_TYPES = ['source']  // Hide source annotations by default

// Annotation colors with localStorage persistence
// These default colors match annotation.js ANNOTATION_COLORS.
// Colors are saved to localStorage so users can customize them in the future.
// When first loaded, defaults are written to localStorage if not present.
const COLORS_KEY = 'opengenepool-annotation-colors'
const DEFAULT_ANNOTATION_COLORS = {
  gene: '#4CAF50',           // green
  CDS: '#2196F3',            // blue
  promoter: '#FF9800',       // orange
  terminator: '#F44336',     // red
  misc_feature: '#9E9E9E',   // gray
  rep_origin: '#9C27B0',     // purple
  origin: '#9C27B0',         // purple (alias)
  primer_bind: '#00BCD4',    // cyan
  protein_bind: '#795548',   // brown
  regulatory: '#FFEB3B',     // yellow
  source: '#B0BEC5',         // light blue-gray
  _default: '#607D8B'        // default blue-gray for unknown types
}

function loadHiddenTypes() {
  const stored = localStorage.getItem(HIDDEN_TYPES_KEY)
  if (stored) {
    try {
      return new Set(JSON.parse(stored))
    } catch {
      return new Set(DEFAULT_HIDDEN_TYPES)
    }
  }
  return new Set(DEFAULT_HIDDEN_TYPES)
}

// Load annotation colors from localStorage.
// If no colors are stored, save the defaults to localStorage and return them.
// This ensures users always have a baseline that can be customized later.
function loadAnnotationColors() {
  const stored = localStorage.getItem(COLORS_KEY)
  if (stored) {
    try {
      // Merge with defaults to handle any new types added in future versions
      return { ...DEFAULT_ANNOTATION_COLORS, ...JSON.parse(stored) }
    } catch {
      // Corrupted data - reset to defaults
      localStorage.setItem(COLORS_KEY, JSON.stringify(DEFAULT_ANNOTATION_COLORS))
      return { ...DEFAULT_ANNOTATION_COLORS }
    }
  }
  // First load - save defaults to localStorage
  localStorage.setItem(COLORS_KEY, JSON.stringify(DEFAULT_ANNOTATION_COLORS))
  return { ...DEFAULT_ANNOTATION_COLORS }
}

const hiddenTypes = ref(loadHiddenTypes())
const annotationColors = ref(loadAnnotationColors())
const configPanelOpen = ref(false)

// Save colors to localStorage whenever they change
watch(annotationColors, (newColors) => {
  localStorage.setItem(COLORS_KEY, JSON.stringify(newColors))
}, { deep: true })

// Get color for an annotation type, falling back to default
function getTypeColor(type) {
  return annotationColors.value[type] || annotationColors.value._default
}

// Save to localStorage whenever hiddenTypes changes
watch(hiddenTypes, (newValue) => {
  localStorage.setItem(HIDDEN_TYPES_KEY, JSON.stringify([...newValue]))
}, { deep: true })

// Extract unique types from annotations for the filter UI
const annotationTypes = computed(() => {
  const types = new Set(props.annotations.map(a => a.type || 'misc_feature'))
  return [...types].sort()
})

// Convert plain annotation objects to Annotation class instances, filtering hidden types
const annotationInstances = computed(() => {
  return props.annotations
    .filter(ann => !hiddenTypes.value.has(ann.type || 'misc_feature'))
    .map(ann => {
      // If already an Annotation instance, return as-is
      if (ann instanceof Annotation) return ann
      // Convert plain object to Annotation
      return new Annotation(ann)
    })
})

// Metadata display helpers
const hasMetadata = computed(() => {
  const m = props.metadata
  return m && (m.molecule_type || m.definition)
})

const metadataModalOpen = ref(false)

function openMetadataModal() {
  metadataModalOpen.value = true
}

function closeMetadataModal() {
  metadataModalOpen.value = false
}

// Annotation filter handlers
function toggleAnnotationType(type) {
  const newSet = new Set(hiddenTypes.value)
  if (newSet.has(type)) {
    newSet.delete(type)
  } else {
    newSet.add(type)
  }
  hiddenTypes.value = newSet
}

function showAllTypes() {
  hiddenTypes.value = new Set()
}

function hideAllTypes() {
  hiddenTypes.value = new Set(annotationTypes.value)
}

function isTypeHidden(type) {
  return hiddenTypes.value.has(type)
}

// Provide state to child components
provide('editorState', editorState)
provide('graphics', graphics)
provide('eventBus', eventBus)
provide('annotationColors', annotationColors)  // Colors persisted to localStorage

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
    const firstRange = domain.ranges[0]
    const isZeroLength = firstRange.start === firstRange.end

    // Insert sequence option for zero-length selections (cursor position)
    if (isZeroLength && !props.readonly) {
      items.push({
        label: 'Insert sequence...',
        action: () => {
          insertModalIsReplace.value = false
          insertModalPosition.value = firstRange.start
          insertModalText.value = ''
          insertModalVisible.value = true
        }
      })
      items.push({ separator: true })
    }

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

// Handle clicks on SVG background (null space) - clears selection
function handleBackgroundClick(event) {
  if (event.button !== 0) return // Left click only
  const selection = selectionLayerRef.value?.selection
  if (selection) {
    selection.unselect()
  }
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

function handleAnnotationContextMenu(data) {
  // Show the same context menu as selection
  const items = buildContextMenuItems({
    source: 'annotation',
    annotation: data.annotation
  })
  contextMenuItems.value = items
  contextMenuX.value = data.event.clientX
  contextMenuY.value = data.event.clientY
  contextMenuVisible.value = true

  // Also emit for parent components
  emit('annotation-contextmenu', data)
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

// Insert/Replace modal functions
function showInsertModal(initialChar) {
  // Get selection from the SelectionLayer
  const sel = selectionLayerRef.value?.selection
  const domain = sel?.domain?.value
  const range = domain?.ranges?.[0]

  // Check if there's a selection (range) or just a cursor position (zero-width)
  insertModalIsReplace.value = range && range.start !== range.end
  insertModalPosition.value = range?.start ?? 0
  insertModalText.value = initialChar
  insertModalVisible.value = true
}

function handleInsertSubmit(text) {
  insertModalVisible.value = false
  if (text) {
    if (insertModalIsReplace.value) {
      // Replace selection with new text
      editorState.deleteSelection()
    }
    // Insert the text
    for (const char of text) {
      editorState.insertAtCursor(char)
    }
    emit('edit', {
      type: insertModalIsReplace.value ? 'replace' : 'insert',
      text: text
    })
  }
  // Return focus to editor
  svgRef.value?.focus()
}

function handleInsertCancel() {
  insertModalVisible.value = false
  // Return focus to editor
  svgRef.value?.focus()
}

function focusSvg() {
  svgRef.value?.focus()
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
        if (props.readonly) return
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

  // DNA base input - show modal (disabled in readonly mode)
  if (DNA_BASES.has(key) && !props.readonly) {
    event.preventDefault()
    showInsertModal(key.toUpperCase())
    return
  }

  // Editing keys (disabled in readonly mode)
  switch (key) {
    case 'Backspace':
      if (props.readonly) break
      event.preventDefault()
      if (editorState.cursor.value > 0 || editorState.selection.value) {
        editorState.backspace()
        emit('edit', { type: 'backspace' })
      }
      break

    case 'Delete':
      if (props.readonly) break
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

    case 'Escape':
      event.preventDefault()
      // Clear selection when Escape is pressed
      const escSelection = selectionLayerRef.value?.selection
      if (escSelection) {
        escSelection.unselect()
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

// Click outside handler for config panel
function handleClickOutside(event) {
  if (configPanelOpen.value) {
    const container = containerRef.value?.querySelector('.config-container')
    if (container && !container.contains(event.target)) {
      configPanelOpen.value = false
    }
  }
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

  // Set up click-outside handler for config panel
  document.addEventListener('click', handleClickOutside)

  emit('ready')

  onUnmounted(() => {
    resizeObserver.disconnect()
    document.removeEventListener('click', handleClickOutside)
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
        <button
          v-if="hasMetadata"
          class="info-button"
          @click="openMetadataModal"
          title="Sequence info"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"/>
          </svg>
        </button>
      </span>

      <!-- Spacer to push config to right -->
      <div class="toolbar-spacer"></div>

      <!-- Help button with selection instructions tooltip -->
      <button
        class="help-button"
        title="Selection Controls:
• Click: Set cursor / clear selection
• Click+Drag: Select range
• Shift+Click: Extend selection
• Ctrl+Click: Add range
• Escape: Clear selection
• Drag handles: Resize selection"
      >?</button>

      <!-- Config gear -->
      <div class="config-container">
        <button class="config-button" @click.stop="configPanelOpen = !configPanelOpen" title="Settings">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97s-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1s.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z" fill="currentColor"/>
          </svg>
        </button>

        <!-- Dropdown panel -->
        <div v-if="configPanelOpen" class="config-panel" @click.stop>
          <div class="config-header">Annotations</div>
          <div v-if="annotationTypes.length > 0" class="config-types">
            <label v-for="type in annotationTypes" :key="type" class="type-row">
              <input type="checkbox" :checked="!isTypeHidden(type)" @change="toggleAnnotationType(type)">
              <!-- Color swatch uses persisted colors from localStorage -->
              <svg class="type-swatch" viewBox="0 0 14 14" width="14" height="14">
                <rect
                  x="0" y="0" width="14" height="14" rx="2"
                  :fill="getTypeColor(type)"
                  stroke="black"
                  stroke-width="1"
                />
              </svg>
              <span class="type-name">{{ type }}</span>
            </label>
          </div>
          <div v-else class="config-empty">No annotations</div>
          <div v-if="annotationTypes.length > 0" class="config-actions">
            <button @click="showAllTypes">Show All</button>
            <button @click="hideAllTypes">Hide All</button>
          </div>
        </div>
      </div>
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
        @click="focusSvg"
        @selectstart.prevent
        @dragstart.prevent
        @contextmenu.prevent
        onselectstart="return false"
        ondragstart="return false"
      >
        <!-- Background rect to capture clicks on null space (clears selection) -->
        <rect
          x="0"
          y="0"
          :width="graphics.metrics.value.fullWidth"
          :height="svgHeight"
          class="svg-background"
          @mousedown="handleBackgroundClick"
        />

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
          @contextmenu="handleAnnotationContextMenu"
          @hover="emit('annotation-hover', $event)"
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

    <!-- Insert/Replace Modal -->
    <InsertModal
      :visible="insertModalVisible"
      :initial-text="insertModalText"
      :is-replace="insertModalIsReplace"
      :position="insertModalPosition"
      @submit="handleInsertSubmit"
      @cancel="handleInsertCancel"
    />

    <!-- Metadata Modal -->
    <div v-if="metadataModalOpen" class="modal-overlay" @click="closeMetadataModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Sequence Information</h3>
          <button class="modal-close" @click="closeMetadataModal">&times;</button>
        </div>
        <div class="modal-body">
          <dl class="metadata-list">
            <template v-if="props.metadata?.molecule_type">
              <dt>Type</dt>
              <dd>{{ props.metadata.molecule_type }}<template v-if="props.metadata?.circular !== undefined"> — {{ props.metadata.circular ? 'circular' : 'linear' }}</template></dd>
            </template>
            <template v-if="props.metadata?.definition">
              <dt>Definition</dt>
              <dd>{{ props.metadata.definition }}</dd>
            </template>
            <template v-if="props.metadata?.accession">
              <dt>Accession</dt>
              <dd>{{ props.metadata.accession }}</dd>
            </template>
            <template v-if="props.metadata?.version">
              <dt>Version</dt>
              <dd>{{ props.metadata.version }}</dd>
            </template>
            <template v-if="props.metadata?.organism">
              <dt>Organism</dt>
              <dd>{{ props.metadata.organism }}</dd>
            </template>
            <template v-if="props.metadata?.source">
              <dt>Source</dt>
              <dd>{{ props.metadata.source }}</dd>
            </template>
            <template v-if="props.metadata?.locus_name">
              <dt>Locus</dt>
              <dd>{{ props.metadata.locus_name }}</dd>
            </template>
          </dl>
          <!-- References section -->
          <template v-if="props.metadata?.references && props.metadata.references.length > 0">
            <h4 class="references-header">References</h4>
            <!-- Complete references (have authors, title, journal, and pubmed) -->
            <div class="references-list">
              <template v-for="(ref, index) in props.metadata.references" :key="index">
                <div v-if="ref.authors && ref.title && ref.journal && ref.pubmed" class="reference-item">
                  <div class="ref-title">{{ ref.title }}</div>
                  <div class="ref-authors">{{ ref.authors }}</div>
                  <div class="ref-journal">{{ ref.journal }}</div>
                  <div class="ref-pubmed">
                    <a :href="`https://pubmed.ncbi.nlm.nih.gov/${ref.pubmed}/`" target="_blank" rel="noopener noreferrer">
                      PubMed: {{ ref.pubmed }}
                    </a>
                  </div>
                </div>
              </template>
            </div>
            <!-- Incomplete references in collapsible "more" section -->
            <details v-if="props.metadata.references.some(ref => !(ref.authors && ref.title && ref.journal && ref.pubmed))" class="references-more">
              <summary>more</summary>
              <div class="references-list">
                <template v-for="(ref, index) in props.metadata.references" :key="'more-' + index">
                  <div v-if="!(ref.authors && ref.title && ref.journal && ref.pubmed)" class="reference-item">
                    <div v-if="ref.title" class="ref-title">{{ ref.title }}</div>
                    <div v-if="ref.authors" class="ref-authors">{{ ref.authors }}</div>
                    <div v-if="ref.journal" class="ref-journal">{{ ref.journal }}</div>
                    <div v-if="ref.pubmed" class="ref-pubmed">
                      <a :href="`https://pubmed.ncbi.nlm.nih.gov/${ref.pubmed}/`" target="_blank" rel="noopener noreferrer">
                        PubMed: {{ ref.pubmed }}
                      </a>
                    </div>
                  </div>
                </template>
              </div>
            </details>
          </template>
        </div>
      </div>
    </div>
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

/* Invisible background to capture clicks on null space */
.svg-background {
  fill: transparent;
  pointer-events: all;
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

/* Config panel styles */
.toolbar-spacer {
  flex: 1;
}

.help-button {
  background: none;
  border: 1px solid #ddd;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: help;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-weight: bold;
  font-size: 14px;
  margin-right: 8px;
}

.help-button:hover {
  background: #eee;
  color: #333;
}

.config-container {
  position: relative;
}

.config-button {
  background: none;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  color: #666;
}

.config-button:hover {
  background: #eee;
  color: #333;
}

.config-panel {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  min-width: 180px;
  z-index: 100;
}

.config-header {
  padding: 8px 12px;
  font-weight: 600;
  border-bottom: 1px solid #eee;
}

.config-types {
  padding: 8px 12px;
  max-height: 300px;
  overflow-y: auto;
}

.config-empty {
  padding: 8px 12px;
  color: #999;
  font-size: 13px;
}

.type-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  cursor: pointer;
}

.type-row input[type="checkbox"] {
  margin: 0;
}

/* Color swatch - fill color comes from inline style (persisted to localStorage) */
.type-swatch {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.type-name {
  flex: 1;
  font-size: 13px;
}

.config-actions {
  padding: 8px 12px;
  border-top: 1px solid #eee;
  display: flex;
  gap: 8px;
}

.config-actions button {
  flex: 1;
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #f8f8f8;
  cursor: pointer;
}

.config-actions button:hover {
  background: #eee;
}

/* Info button in toolbar */
.info-button {
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #666;
  margin-left: 6px;
  vertical-align: middle;
}

.info-button:hover {
  color: #333;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  line-height: 1;
}

.modal-close:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
}

.metadata-list {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 16px;
}

.metadata-list dt {
  font-weight: 600;
  color: #555;
}

.metadata-list dd {
  margin: 0;
  color: #333;
  word-break: break-word;
}

/* References styles */
.references-header {
  margin: 20px 0 12px 0;
  font-size: 16px;
  color: #333;
  border-top: 1px solid #eee;
  padding-top: 16px;
}

.references-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.reference-item {
  padding: 12px;
  background: #f8f8f8;
  border-radius: 6px;
}

.ref-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.ref-authors {
  color: #555;
  font-size: 13px;
  margin-bottom: 4px;
}

.ref-journal {
  color: #666;
  font-size: 13px;
  font-style: italic;
}

.ref-pubmed {
  margin-top: 4px;
  font-size: 13px;
}

.ref-pubmed a {
  color: #2563eb;
  text-decoration: none;
}

.ref-pubmed a:hover {
  text-decoration: underline;
}

.references-more {
  margin-top: 12px;
}

.references-more summary {
  cursor: pointer;
  color: #666;
  font-size: 13px;
}

.references-more summary:hover {
  color: #333;
}

.references-more .references-list {
  margin-top: 12px;
}
</style>
