<script setup>
import { computed, inject, watch } from 'vue'
import { Orientation } from '../utils/dna.js'
import { useAnnotations, generateArrowPath } from '../composables/useAnnotations.js'

const props = defineProps({
  /** Array of Annotation objects to render */
  annotations: {
    type: Array,
    default: () => []
  },
  /** Vertical offset from top of each line */
  offsetY: {
    type: Number,
    default: 0
  },
  /** Height of annotation bars */
  height: {
    type: Number,
    default: 16
  },
  /** Whether to show captions on annotations */
  showCaptions: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['click', 'contextmenu', 'hover'])

// Inject from parent SequenceEditor
const editorState = inject('editorState')
const graphics = inject('graphics')
const eventBus = inject('eventBus', null)
// Annotation colors from localStorage (provided by SequenceEditor)
const annotationColors = inject('annotationColors', null)

// Default colors used when not provided via inject (e.g., in tests)
const DEFAULT_COLORS = {
  gene: '#4CAF50',
  CDS: '#2196F3',
  promoter: '#FF9800',
  terminator: '#F44336',
  misc_feature: '#9E9E9E',
  rep_origin: '#9C27B0',
  origin: '#9C27B0',
  primer_bind: '#00BCD4',
  protein_bind: '#795548',
  regulatory: '#FFEB3B',
  source: '#B0BEC5',
  _default: '#607D8B'
}

// Get color for an annotation type from persisted colors or defaults
function getTypeColor(type) {
  const colors = annotationColors?.value || DEFAULT_COLORS
  return colors[type] || colors._default
}

// Use annotations composable for layout calculations
const annotationsComposable = useAnnotations(editorState, graphics, eventBus)

// Watch for annotation prop changes
watch(() => props.annotations, (newAnnotations) => {
  annotationsComposable.setAnnotations(newAnnotations)
}, { immediate: true })

// Settings for arrow path generation
const blockWidth = 8
const arrowEdge = 2

// Calculate text x position - nudge right for minus strand arrows
function getCaptionX(element) {
  const baseOffset = 4
  // If this fragment has a left-pointing arrow (minus strand at start), nudge text right
  if (element.fragment.orientation === Orientation.MINUS && element.fragment.isStart) {
    return element.left + blockWidth + baseOffset
  }
  return element.left + baseOffset
}

// Check if caption fits within the arrow
// Estimates ~7px per character for 12px font, plus padding for arrow points
function captionFits(element) {
  const caption = element.fragment.caption
  if (!caption) return false

  const arrowWidth = element.right - element.left
  const estimatedTextWidth = caption.length * 7  // ~7px per char at 12px font
  const padding = 8  // padding on both sides

  // Account for arrow point taking up space
  let availableWidth = arrowWidth - padding
  if (element.fragment.orientation === Orientation.PLUS && element.fragment.isEnd) {
    availableWidth -= blockWidth  // right arrow takes space
  }
  if (element.fragment.orientation === Orientation.MINUS && element.fragment.isStart) {
    availableWidth -= blockWidth  // left arrow takes space
  }

  return estimatedTextWidth <= availableWidth
}

// Use the composable's laid-out elements (with collision detection applied)
const elementsByLine = computed(() => {
  return annotationsComposable.getElementsByLine.value
})

// Lines that have annotations
const lines = computed(() => {
  return Array.from(elementsByLine.value.keys()).sort((a, b) => a - b)
})

// For backward compatibility - expose fragments
const fragments = computed(() => {
  const allFragments = []
  for (const elements of elementsByLine.value.values()) {
    for (const elem of elements) {
      allFragments.push(elem.fragment)
    }
  }
  return allFragments
})

const fragmentsByLine = computed(() => {
  const byLine = new Map()
  for (const [line, elements] of elementsByLine.value) {
    byLine.set(line, elements.map(e => e.fragment))
  }
  return byLine
})

// Calculate x position for a fragment
function getFragmentX(fragment) {
  return graphics.metrics.value.lmargin + fragment.start * graphics.metrics.value.charWidth
}

// Calculate width for a fragment
function getFragmentWidth(fragment) {
  return fragment.width * graphics.metrics.value.charWidth
}

// Get y position for a line
function getLineY(lineIndex) {
  return graphics.getLineY(lineIndex)
}

// Generate tooltip text for an annotation fragment
function getTooltipText(fragment) {
  const parts = []
  const ann = fragment.annotation

  // Add caption/name
  if (fragment.caption) {
    parts.push(fragment.caption)
  }

  // Add type if different from caption
  if (fragment.type && fragment.type !== fragment.caption) {
    parts.push(`[${fragment.type}]`)
  }

  // Add position info
  if (ann && ann.span) {
    parts.push(ann.span.toString())
  }

  // Add all metadata from annotation data (except translation which is too long)
  if (ann && ann.data) {
    const entries = Object.entries(ann.data).filter(([key]) => key !== 'translation')
    if (entries.length > 0) {
      parts.push('') // blank line before metadata
      for (const [key, value] of entries) {
        // Format the value (handle arrays, truncate long values)
        let displayValue = Array.isArray(value) ? value.join(', ') : String(value)
        if (displayValue.length > 100) {
          displayValue = displayValue.substring(0, 100) + '...'
        }
        parts.push(`${key}: ${displayValue}`)
      }
    }
  }

  return parts.join('\n')
}

// Generate full arrow-shaped path for fragment (like original)
function getFullArrowPath(fragment) {
  const x = getFragmentX(fragment)
  const width = getFragmentWidth(fragment)
  const h = props.height

  // Determine if this fragment should show directional arrow
  let orientation = Orientation.NONE
  if (fragment.orientation === Orientation.PLUS && fragment.isEnd) {
    orientation = Orientation.PLUS
  } else if (fragment.orientation === Orientation.MINUS && fragment.isStart) {
    orientation = Orientation.MINUS
  }

  return generateArrowPath({
    left: x,
    right: x + width,
    height: h,
    blockWidth,
    arrowEdge,
    orientation
  })
}

// Generate arrow path for directional annotations (legacy small arrow overlay)
function getArrowPath(fragment) {
  const x = getFragmentX(fragment)
  const width = getFragmentWidth(fragment)
  const h = props.height
  const arrowSize = Math.min(8, h / 2)

  if (fragment.orientation === Orientation.PLUS && fragment.isEnd) {
    // Arrow pointing right at end
    const endX = x + width
    return `M ${endX - arrowSize} 0 L ${endX} ${h / 2} L ${endX - arrowSize} ${h} L ${endX - arrowSize} 0`
  } else if (fragment.orientation === Orientation.MINUS && fragment.isStart) {
    // Arrow pointing left at start
    return `M ${x + arrowSize} 0 L ${x} ${h / 2} L ${x + arrowSize} ${h} L ${x + arrowSize} 0`
  }
  return null
}

// Event handlers
function handleClick(event, fragment) {
  event.stopPropagation()  // Prevent bubbling to SVG mousedown
  emit('click', { event, annotation: fragment.annotation, fragment })
}

function handleContextMenu(event, fragment) {
  event.preventDefault()
  emit('contextmenu', { event, annotation: fragment.annotation, fragment })
}

function handleMouseEnter(event, fragment) {
  emit('hover', { event, annotation: fragment.annotation, fragment, entering: true })
}

function handleMouseLeave(event, fragment) {
  emit('hover', { event, annotation: fragment.annotation, fragment, entering: false })
}

// Expose for testing
defineExpose({
  fragments,
  fragmentsByLine,
  getFragmentX,
  getFragmentWidth
})
</script>

<template>
  <g class="annotation-layer">
    <!-- Render annotations for each line -->
    <!-- Position at top of line so negative-Y arrows extend into space above -->
    <g
      v-for="lineIndex in lines"
      :key="`line-${lineIndex}`"
      :transform="`translate(0, ${getLineY(lineIndex)})`"
    >
      <!-- Each element on this line (with layout-computed deltaY) -->
      <g
        v-for="(element, elemIndex) in elementsByLine.get(lineIndex)"
        :key="`elem-${element.fragment.id}-${elemIndex}`"
        :class="['annotation-fragment', element.fragment.cssClass]"
        :transform="`translate(0, ${element.deltaY})`"
        @click="handleClick($event, element.fragment)"
        @contextmenu="handleContextMenu($event, element.fragment)"
        @mouseenter="handleMouseEnter($event, element.fragment)"
        @mouseleave="handleMouseLeave($event, element.fragment)"
      >
        <!-- Tooltip via SVG title element -->
        <title>{{ getTooltipText(element.fragment) }}</title>

        <!-- Use pre-computed arrow path from layout, color from localStorage -->
        <path
          :d="element.path"
          :fill="getTypeColor(element.fragment.type)"
          :opacity="0.7"
          class="annotation-path"
        />

        <!-- Caption text (only shown if it fits within the arrow) -->
        <text
          v-if="showCaptions && captionFits(element)"
          :x="getCaptionX(element)"
          :y="-height / 2"
          dominant-baseline="middle"
          class="annotation-caption"
        >
          {{ element.fragment.caption }}
        </text>
      </g>
    </g>
  </g>
</template>

<style scoped>
.annotation-layer {
  pointer-events: none;
}

.annotation-fragment {
  pointer-events: all;
  cursor: pointer;
}

.annotation-fragment:hover .annotation-path {
  opacity: 0.9;
}

/* Annotation path style - fill color comes from inline style (persisted to localStorage) */
.annotation-path {
  stroke: black;
  stroke-width: 1px;
}

/* Caption style - matches original */
.annotation-caption {
  font-family: Arial, sans-serif;
  font-size: 12px;
  fill: black;
  pointer-events: none;
  text-anchor: start;
  user-select: none;
}
</style>
