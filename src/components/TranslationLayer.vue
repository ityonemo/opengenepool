<script setup>
import { computed, inject, watch, ref } from 'vue'
import { useTranslation } from '../composables/useTranslation.js'
import { AA_THREE_LETTER } from '../utils/translation.js'

const props = defineProps({
  /** Array of CDS Annotation objects to translate */
  annotations: {
    type: Array,
    default: () => []
  },
  /** Height of the translation row in pixels */
  height: {
    type: Number,
    default: 18
  },
  /** Map of lineIndex -> Map of annotationId -> deltaY from AnnotationLayer */
  annotationDeltaYByLine: {
    type: Map,
    default: () => new Map()
  }
})

// Inject from parent SequenceEditor
const editorState = inject('editorState')
const graphics = inject('graphics')
const showTranslation = inject('showTranslation', ref(true))

// Minimum codon width (3 bases) needed to display amino acid letter (~8px for 12px font)
const MIN_CODON_WIDTH = 8

// Display visibility - show only when user wants it AND zoom level allows readable text
const visible = computed(() => {
  if (!showTranslation.value) return false
  const codonWidth = 3 * graphics.metrics.value.charWidth
  return codonWidth >= MIN_CODON_WIDTH
})

// Amino acid background colors (from codon table)
// Colors extracted from ~/codon_table/codon.svg
const AA_COLORS = {
  // Aromatic: Medium green
  W: '#66CC66', Y: '#66CC66', F: '#66CC66',
  // Hydrophobic/aliphatic: Light green
  L: '#99FF99', A: '#99FF99', V: '#99FF99', I: '#99FF99', M: '#99FF99',
  // Acidic + Cysteine: Orange/salmon
  E: '#FF9999', D: '#FF9999', C: '#FF9999',
  // Polar uncharged: Light magenta
  T: '#FFAAFF', N: '#FFAAFF', S: '#FFAAFF', Q: '#FFAAFF',
  // Basic/positively charged: Light purple
  K: '#BBBBFF', R: '#BBBBFF', H: '#BBBBFF',
  // Special structure: Yellow
  G: '#FFFF99', P: '#FFFF99',
  // Stop codon - medium grey (50% lighter than #444444)
  '*': '#A2A2A2'
}

// Get background color for an amino acid
function getAminoAcidColor(aminoAcid) {
  return AA_COLORS[aminoAcid] || '#FFFFFF'
}

// Get codon box width (3 bases)
const codonWidth = computed(() => 3 * graphics.metrics.value.charWidth)

// Chevron dimensions (quarter letter)
const notchProtrusion = computed(() => graphics.metrics.value.charWidth / 4)  // Nose protrudes 0.25
const tailExtension = computed(() => graphics.metrics.value.charWidth / 4)    // Tail extends back 0.25

// Generate chevron path for a codon box
// orientation: 1 = plus strand (chevron points right), -1 = minus strand (chevron points left)
// showTail: if true, extend the tail corners outward like a banner's swallowtail
// showNotch: if true, show the chevron nose; if false, square edge
function getChevronPath(x, width, h, orientation, showTail, showNotch) {
  const nose = showNotch ? notchProtrusion.value : 0
  const tail = showTail ? tailExtension.value : 0

  if (orientation === 1) {
    // Plus strand: chevron points right (nose on right edge, tail on left)
    // Fork indent recessed by tail amount to receive previous codon's nose
    const forkIndent = showTail ? tail : 0
    return `M ${x - tail} 0 ` +                // top-left corner (extended if showTail)
           `L ${x + width} 0 ` +               // top-right edge
           `L ${x + width + nose} ${h / 2} ` + // nose point (protrudes if showNotch)
           `L ${x + width} ${h} ` +            // bottom-right edge
           `L ${x - tail} ${h} ` +             // bottom-left corner (extended if showTail)
           `L ${x + forkIndent} ${h / 2} ` +   // middle-left (recessed to receive nose)
           `Z`
  } else {
    // Minus strand: chevron points left (nose on left edge, tail on right)
    // Fork indent recessed by tail amount to receive previous codon's nose
    const forkIndent = showTail ? tail : 0
    return `M ${x} 0 ` +                       // top-left edge
           `L ${x + width + tail} 0 ` +        // top-right corner (extended if showTail)
           `L ${x + width - forkIndent} ${h / 2} ` + // middle-right (recessed to receive nose)
           `L ${x + width + tail} ${h} ` +     // bottom-right corner (extended if showTail)
           `L ${x} ${h} ` +                    // bottom-left edge
           `L ${x - nose} ${h / 2} ` +         // nose point (protrudes if showNotch)
           `Z`
  }
}

// Get line boundaries for clipping
const lineLeft = computed(() => graphics.metrics.value.lmargin)
const lineRight = computed(() => graphics.metrics.value.lmargin + editorState.zoomLevel.value * graphics.metrics.value.charWidth)

// Get slice box (already clipped to line by sliceCodon)
function getSliceBox(element) {
  // Slices have pre-computed bounds
  if (element.sliceLeft !== undefined) {
    return {
      x: element.sliceLeft,
      width: element.sliceWidth
    }
  }

  // Fallback for elements without slice info
  const halfCodon = codonWidth.value / 2
  let left = element.x - halfCodon
  let right = element.x + halfCodon

  // Clip to line boundaries
  left = Math.max(left, lineLeft.value)
  right = Math.min(right, lineRight.value)

  return {
    x: left,
    width: Math.max(0, right - left)
  }
}

// Ref wrapper for annotations (useTranslation expects a ref)
const annotationsRef = ref([])
watch(() => props.annotations, (newAnnotations) => {
  annotationsRef.value = newAnnotations
}, { immediate: true })

// Use translation composable for layout calculations
const { elementsByLine: rawElementsByLine } = useTranslation(editorState, graphics, annotationsRef)

/**
 * Slice a codon into chunks at break points (line boundaries, segment boundaries).
 * Each slice is rendered as an independent unit with walled edges at breaks.
 *
 * @param {Object} elem - The codon element from useTranslation
 * @param {number} lineWidth - Width of a line in pixels
 * @returns {Array} Array of slice objects, each assigned to a line
 */
function sliceCodon(elem, lineWidth) {
  const slices = []
  const m = graphics.metrics.value
  const halfCodon = codonWidth.value / 2
  const isPlus = elem.orientation === 1

  // Calculate codon bounds in pixel space (absolute, not relative to line)
  const codonLeft = elem.x - halfCodon
  const codonRight = elem.x + halfCodon

  // Collect all break points within the codon (in pixel x coordinates)
  // Break points create walls - places where we split the codon
  const breakPoints = []

  // Add segment split if present (convert from offset to absolute x)
  if (elem.segmentSplitOffset !== null) {
    const splitX = elem.x + elem.segmentSplitOffset * m.charWidth
    if (splitX > codonLeft && splitX < codonRight) {
      breakPoints.push({ x: splitX, type: 'segment' })
    }
  }

  // Add line boundaries that fall within the codon
  // Find which lines this codon spans
  const leftLine = Math.floor((codonLeft - lineLeft.value) / lineWidth)
  const rightLine = Math.floor((codonRight - lineLeft.value) / lineWidth)

  for (let line = leftLine; line < rightLine; line++) {
    const lineBoundaryX = lineLeft.value + (line + 1) * lineWidth
    if (lineBoundaryX > codonLeft && lineBoundaryX < codonRight) {
      breakPoints.push({ x: lineBoundaryX, type: 'line' })
    }
  }

  // Sort break points by x position
  breakPoints.sort((a, b) => a.x - b.x)

  // Create slices between break points
  // Start with codon left edge, end with codon right edge
  const edges = [codonLeft, ...breakPoints.map(bp => bp.x), codonRight]

  for (let i = 0; i < edges.length - 1; i++) {
    const sliceLeft = edges[i]
    const sliceRight = edges[i + 1]
    const sliceCenter = (sliceLeft + sliceRight) / 2
    const sliceWidth = sliceRight - sliceLeft

    // Determine which line this slice belongs to
    const sliceLineIndex = Math.floor((sliceCenter - lineLeft.value) / lineWidth)

    // Determine if edges are at breaks (walls)
    const isFirstSlice = i === 0
    const isLastSlice = i === edges.length - 2
    const leftIsBreak = !isFirstSlice  // left edge is a break point
    const rightIsBreak = !isLastSlice  // right edge is a break point

    // Map left/right to leading/trailing based on strand
    // Plus: leading=right, trailing=left
    // Minus: leading=left, trailing=right
    let wallLeading, wallTrailing

    if (isPlus) {
      // Leading edge is right, trailing is left
      wallTrailing = leftIsBreak || elem.isFirstCodon || (elem.numSegments > 1 && elem.isSegmentStart && isFirstSlice)
      wallLeading = rightIsBreak || elem.isLastCodon || (elem.numSegments > 1 && elem.isSegmentEnd && isLastSlice)
    } else {
      // Leading edge is left, trailing is right
      wallLeading = leftIsBreak || elem.isLastCodon || (elem.numSegments > 1 && elem.isSegmentEnd && isFirstSlice)
      wallTrailing = rightIsBreak || elem.isFirstCodon || (elem.numSegments > 1 && elem.isSegmentStart && isLastSlice)
    }

    // Calculate x position relative to line
    const lineStartX = lineLeft.value + sliceLineIndex * lineWidth
    const xInLine = sliceCenter - lineStartX + lineLeft.value

    slices.push({
      ...elem,
      x: xInLine,
      sliceLeft: sliceLeft - lineStartX + lineLeft.value,
      sliceRight: sliceRight - lineStartX + lineLeft.value,
      sliceWidth,
      lineIndex: sliceLineIndex,
      showNotch: !wallLeading,
      showTail: !wallTrailing,
      isMainSlice: isFirstSlice || (sliceCenter >= elem.x - 1 && sliceCenter <= elem.x + 1),
      // Remove the old segmentSplitOffset since we've handled it by slicing
      segmentSplitOffset: null
    })
  }

  return slices
}

// Process all codons into slices, grouped by line
const elementsByLine = computed(() => {
  const result = new Map()
  const lineWidth = editorState.zoomLevel.value * graphics.metrics.value.charWidth

  for (const [lineIndex, elements] of rawElementsByLine.value) {
    for (const elem of elements) {
      const slices = sliceCodon(elem, lineWidth)

      for (const slice of slices) {
        if (!result.has(slice.lineIndex)) {
          result.set(slice.lineIndex, [])
        }
        result.get(slice.lineIndex).push(slice)
      }
    }
  }

  return result
})

// Lines that have translation elements
const lines = computed(() => {
  return Array.from(elementsByLine.value.keys()).sort((a, b) => a - b)
})

// Get y position for a line (translation sits just above the sequence)
function getLineY(lineIndex) {
  return graphics.getLineY(lineIndex)
}

// Get deltaY for a specific annotation on a specific line
function getAnnotationDeltaY(lineIndex, annotationId) {
  const lineMap = props.annotationDeltaYByLine.get(lineIndex)
  if (lineMap) {
    return lineMap.get(annotationId) ?? 0
  }
  return 0
}

// Group elements by annotation ID for border rendering
function getAnnotationGroups(elements) {
  const groups = new Map()
  for (const elem of elements) {
    if (!groups.has(elem.annotationId)) {
      groups.set(elem.annotationId, [])
    }
    groups.get(elem.annotationId).push(elem)
  }
  return groups
}

// Get bounding box for a group of elements (using clipped bounds)
function getGroupBounds(elements) {
  let minX = Infinity
  let maxX = -Infinity
  for (const elem of elements) {
    const box = getSliceBox(elem)
    if (box.width > 0) {
      minX = Math.min(minX, box.x)
      maxX = Math.max(maxX, box.x + box.width)
    }
  }
  if (minX === Infinity) return { x: 0, width: 0 }
  return { x: minX, width: maxX - minX }
}

const emit = defineEmits(['hover', 'click'])

// Get three-letter amino acid name
function getAaName(aa) {
  return AA_THREE_LETTER[aa] || aa
}

// Handle hover events - emit to parent like AnnotationLayer does
function handleMouseEnter(event, element) {
  const aaName = getAaName(element.aminoAcid)
  const aaLabel = element.aminoAcid === '*' ? 'Stop' : `${aaName}${element.aaIndex}`
  const tooltipText = `${element.geneName}: ${aaLabel} [${element.codon}]`

  emit('hover', {
    event,
    element,
    tooltipText,
    entering: true
  })
}

function handleMouseLeave(event, element) {
  emit('hover', {
    event,
    element,
    entering: false
  })
}

function handleClick(event, element) {
  event.stopPropagation()  // Prevent bubbling to SVG mousedown
  emit('click', {
    event,
    element,
    codonStart: element.codonStart,
    codonEnd: element.codonEnd
  })
}

// Expose show and visible for parent to bind to
defineExpose({ showTranslation, visible })
</script>

<template>
  <g v-if="visible" class="translation-layer">
    <!-- Render translations for each line -->
    <g
      v-for="lineIndex in lines"
      :key="`line-${lineIndex}`"
      :transform="`translate(0, ${getLineY(lineIndex)})`"
    >
      <!-- Each annotation group positioned at its annotation's deltaY -->
      <g
        v-for="[annotationId, groupElements] in getAnnotationGroups(elementsByLine.get(lineIndex))"
        :key="`group-${annotationId}`"
        :transform="`translate(0, ${getAnnotationDeltaY(lineIndex, annotationId)})`"
      >
        <!-- Border rect for the group -->
        <rect
          :x="getGroupBounds(groupElements).x"
          :y="-height"
          :width="getGroupBounds(groupElements).width"
          :height="height"
          class="aa-group-border"
        />
        <!-- Each slice of an amino acid (slices created at line/segment breaks) -->
        <g
          v-for="(element, elemIndex) in groupElements"
          :key="`aa-${element.annotationId}-${element.aaIndex}-${elemIndex}`"
          :class="{ 'aa-element': element.isMainSlice }"
          @mouseenter="element.isMainSlice && handleMouseEnter($event, element)"
          @mouseleave="element.isMainSlice && handleMouseLeave($event, element)"
          @click="element.isMainSlice && handleClick($event, element)"
        >
          <!-- Slice path (walled edges at breaks, chevrons elsewhere) -->
          <path
            :d="getChevronPath(getSliceBox(element).x, getSliceBox(element).width, height, element.orientation, element.showTail, element.showNotch)"
            :fill="getAminoAcidColor(element.aminoAcid)"
            :transform="`translate(0, ${-height})`"
            class="aa-chevron"
          />
          <!-- Amino acid letter (only on main slice, not secondary slices) -->
          <text
            v-if="element.isMainSlice && element.aminoAcid !== '*'"
            :x="element.x"
            :y="-height / 2 + 1"
            text-anchor="middle"
            dominant-baseline="middle"
            class="translation-text"
          >{{ element.aminoAcid }}</text>
          <!-- Stop sign for stop codons (red octagon) -->
          <g
            v-if="element.isMainSlice && element.aminoAcid === '*'"
            :transform="`translate(${element.x}, ${-height / 2})`"
          >
            <polygon
              points="-2,-5 2,-5 5,-2 5,2 2,5 -2,5 -5,2 -5,-2"
              fill="#CC0000"
              stroke="white"
              stroke-width="1"
              class="stop-sign"
            />
          </g>
        </g>
      </g>
    </g>
  </g>
</template>

<style scoped>
.translation-layer {
  pointer-events: none;
}

/* Border around each annotation's translation group */
.aa-group-border {
  fill: none;
  stroke: black;
  stroke-width: 0.5px;
}

/* Amino acid background box (for overflow elements) */
.aa-box {
  stroke: black;
  stroke-width: 0.5px;
}

/* Amino acid chevron (for main elements) */
.aa-chevron {
  stroke: black;
  stroke-width: 0.5px;
}

/* Amino acid text - black */
.translation-text {
  font-family: "Lucida Console", Monaco, monospace;
  font-size: 12px;
  fill: black;
  user-select: none;
  pointer-events: none;
}

/* Interactive amino acid elements */
.aa-element {
  pointer-events: all;
  cursor: pointer;
}

.aa-element:hover .aa-chevron {
  filter: brightness(0.9);
}

</style>
