<script setup>
import { computed, inject, ref, watch } from 'vue'
import { Orientation } from '../utils/dna.js'
import { getArrowArcPath, getArcPath, getTextArcPath } from '../utils/circular.js'

const props = defineProps({
  /** Array of Annotation objects to render */
  annotations: {
    type: Array,
    default: () => []
  },
  /** Whether to show captions on annotations */
  showCaptions: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['click', 'contextmenu', 'hover'])

// Inject from parent
const editorState = inject('editorState')
const circularGraphics = inject('circularGraphics')
const annotationColors = inject('annotationColors', null)
const showAnnotations = inject('showAnnotations', ref(true))

// Default colors (same as AnnotationLayer.vue)
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

function getTypeColor(type) {
  const colors = annotationColors?.value || DEFAULT_COLORS
  return colors[type] || colors._default
}

/**
 * Compute row assignments for annotations (sequence-based collision detection).
 * This is separate from element rendering so we can report row count first.
 */
const annotationRowAssignments = computed(() => {
  const seqLen = editorState.sequenceLength.value
  if (!seqLen || props.annotations.length === 0) return { assignments: new Map(), rowCount: 0 }

  // Sort annotations by span length (widest first for greedy placement)
  const sorted = [...props.annotations].sort((a, b) => {
    const aLen = getSpanLength(a)
    const bLen = getSpanLength(b)
    return bLen - aLen
  })

  // Track rows for collision detection
  const rows = []
  const assignments = new Map()

  for (const annotation of sorted) {
    const span = annotation.span
    if (!span || !span.ranges || span.ranges.length === 0) continue

    const bounds = span.bounds
    const start = bounds.start
    const end = bounds.end

    // Find first row where this annotation doesn't overlap
    let placedRow = -1
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx]
      let hasOverlap = false

      for (const placed of row) {
        if (rangesOverlap(start, end, placed.start, placed.end)) {
          hasOverlap = true
          break
        }
      }

      if (!hasOverlap) {
        placedRow = rowIdx
        break
      }
    }

    // If no existing row works, create a new one
    if (placedRow === -1) {
      placedRow = rows.length
      rows.push([])
    }

    rows[placedRow].push({ start, end })
    assignments.set(annotation, placedRow)
  }

  return { assignments, rowCount: rows.length }
})

// Report row count to graphics for sizing
watch(() => annotationRowAssignments.value.rowCount, (rowCount) => {
  circularGraphics.setAnnotationRowCount(rowCount)
}, { immediate: true })

/**
 * Compute annotation elements for rendering.
 */
const annotationElements = computed(() => {
  const seqLen = editorState.sequenceLength.value
  if (!seqLen || props.annotations.length === 0) return []

  const cx = circularGraphics.centerX.value
  const cy = circularGraphics.centerY.value
  const thickness = circularGraphics.annotationHeight.value
  const { assignments } = annotationRowAssignments.value

  const elements = []

  for (const annotation of props.annotations) {
    const span = annotation.span
    if (!span || !span.ranges || span.ranges.length === 0) continue

    const placedRow = assignments.get(annotation)
    if (placedRow === undefined) continue

    // Calculate radius for this row
    const radius = circularGraphics.getRowRadius(placedRow)

    // Generate path for each range in the span
    for (const range of span.ranges) {
      // Determine arrow orientation
      let orientation = Orientation.NONE
      if (range.orientation === Orientation.PLUS) {
        orientation = Orientation.PLUS
      } else if (range.orientation === Orientation.MINUS) {
        orientation = Orientation.MINUS
      }

      // Get the origin offset for angle calculations
      const angleOffset = circularGraphics.originOffset.value

      // Generate path
      const path = getArrowArcPath(
        range.start,
        range.end,
        seqLen,
        cx,
        cy,
        radius,
        thickness,
        orientation,
        8,  // arrowLength
        angleOffset
      )

      if (!path) continue

      // Calculate label position (midpoint of arc)
      const midPos = (range.start + range.end) / 2
      const labelPoint = circularGraphics.positionToCartesian(midPos, radius)

      // Calculate label angle for rotation
      const labelAngle = circularGraphics.positionToAngle(midPos)
      // Convert to degrees, adjust so text is readable
      let rotationDeg = (labelAngle * 180 / Math.PI) + 90
      // Flip text on bottom half so it's not upside down
      const isBottomHalf = rotationDeg > 90 && rotationDeg < 270
      if (isBottomHalf) {
        rotationDeg += 180
      }

      // Generate text arc path for curved text
      const textPathId = `text-path-${annotation.id || elements.length}-${range.start}`
      const textArcPath = getTextArcPath(
        range.start,
        range.end,
        seqLen,
        cx,
        cy,
        radius,
        isBottomHalf,  // Reverse for bottom half so text reads correctly
        angleOffset
      )

      elements.push({
        annotation,
        range,
        path,
        row: placedRow,
        radius,
        color: getTypeColor(annotation.type),
        labelPoint,
        rotationDeg,
        caption: annotation.caption || '',
        textPathId,
        textArcPath,
        isBottomHalf
      })
    }
  }

  return elements
})

/**
 * Get the total span length of an annotation.
 */
function getSpanLength(annotation) {
  if (!annotation.span || !annotation.span.ranges) return 0
  return annotation.span.ranges.reduce((sum, r) => sum + (r.end - r.start), 0)
}

/**
 * Check if two ranges overlap.
 */
function rangesOverlap(start1, end1, start2, end2) {
  return start1 < end2 && end1 > start2
}

/**
 * Check if caption fits in the arc.
 */
function captionFits(element) {
  if (!element.caption) return false
  const arcLength = (element.range.end - element.range.start) / editorState.sequenceLength.value * 2 * Math.PI * element.radius
  const estimatedTextWidth = element.caption.length * 6 // ~6px per char at small font
  return estimatedTextWidth < arcLength - 10
}

// Event handlers
function handleClick(event, element) {
  event.stopPropagation()
  // Shift-click triggers context menu (Mac-friendly alternative to right-click)
  if (event.shiftKey) {
    handleContextMenu(event, element)
  } else {
    emit('click', { event, annotation: element.annotation })
  }
}

function handleContextMenu(event, element) {
  event.preventDefault()
  event.stopPropagation()
  emit('contextmenu', { event, annotation: element.annotation })
}

function handleMouseEnter(event, element) {
  emit('hover', { event, annotation: element.annotation, entering: true })
}

function handleMouseLeave(event, element) {
  emit('hover', { event, annotation: element.annotation, entering: false })
}
</script>

<template>
  <g v-if="showAnnotations" class="circular-annotation-layer">
    <!-- Define text paths for curved captions -->
    <defs>
      <path
        v-for="(element, idx) in annotationElements"
        :key="`def-${element.textPathId}`"
        :id="element.textPathId"
        :d="element.textArcPath"
        fill="none"
      />
    </defs>

    <g
      v-for="(element, idx) in annotationElements"
      :key="`ann-${element.annotation.id || idx}`"
      class="annotation"
      @click="handleClick($event, element)"
      @contextmenu="handleContextMenu($event, element)"
      @mouseenter="handleMouseEnter($event, element)"
      @mouseleave="handleMouseLeave($event, element)"
    >
      <!-- Annotation arc path -->
      <path
        :d="element.path"
        :fill="element.color"
        fill-opacity="0.7"
        stroke="black"
        stroke-width="1"
        class="annotation-path"
      />

      <!-- Caption along the arc -->
      <text
        v-if="showCaptions && captionFits(element)"
        class="annotation-caption"
      >
        <textPath
          :href="`#${element.textPathId}`"
          startOffset="50%"
          text-anchor="middle"
          dominant-baseline="middle"
        >
          {{ element.caption }}
        </textPath>
      </text>
    </g>
  </g>
</template>

<style scoped>
.circular-annotation-layer {
  pointer-events: none;
}

.annotation {
  pointer-events: all;
  cursor: pointer;
}

.annotation:hover .annotation-path {
  fill-opacity: 0.9;
}

.annotation-caption {
  font-family: Arial, sans-serif;
  font-size: 9px;
  fill: black;
  pointer-events: none;
}
</style>
