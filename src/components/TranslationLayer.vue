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
  }
})

// Inject from parent SequenceEditor
const editorState = inject('editorState')
const graphics = inject('graphics')

// User intent (from config checkbox)
const show = ref(true)

// Minimum codon width (3 bases) needed to display amino acid letter (~8px for 12px font)
const MIN_CODON_WIDTH = 8

// Display visibility - show only when user wants it AND zoom level allows readable text
const visible = computed(() => {
  if (!show.value) return false
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

// Calculate clipped box for an element (clips to line boundaries)
function getClippedBox(element) {
  // Overflow elements have a specific width, not the full codon width
  if (element.isOverflow) {
    // Overflow on next line starts at left edge
    // Overflow on previous line ends at right edge
    const width = element.overflowWidth
    // Determine if this is left-edge or right-edge overflow based on x position
    if (element.x < (lineLeft.value + lineRight.value) / 2) {
      // Left edge overflow (from previous line's codon)
      return { x: lineLeft.value, width }
    } else {
      // Right edge overflow (from next line's codon)
      return { x: lineRight.value - width, width }
    }
  }

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

// Augment elements with overflow portions for codons spanning line breaks
const elementsByLine = computed(() => {
  const result = new Map()
  const zoom = editorState.zoomLevel.value
  const m = graphics.metrics.value
  const halfCodon = codonWidth.value / 2

  for (const [lineIndex, elements] of rawElementsByLine.value) {
    if (!result.has(lineIndex)) {
      result.set(lineIndex, [])
    }

    for (const elem of elements) {
      const rightEdge = elem.x + halfCodon
      const leftEdge = elem.x - halfCodon
      const hasRightOverflow = rightEdge > lineRight.value
      const hasLeftOverflow = leftEdge < lineLeft.value
      const isPlus = elem.orientation === 1

      // Check if nose/tail would protrude past line boundaries
      // (even if box doesn't overflow, the protrusion might)
      const noseProtrusion = notchProtrusion.value
      const tailExt = tailExtension.value
      const noseWouldProtrudeRight = rightEdge + noseProtrusion > lineRight.value
      const noseWouldProtrudeLeft = leftEdge - noseProtrusion < lineLeft.value
      const tailWouldProtrudeRight = rightEdge + tailExt > lineRight.value
      const tailWouldProtrudeLeft = leftEdge - tailExt < lineLeft.value

      // For plus strand: notch is on higher line (further along sequence)
      // For minus strand: notch is on lower line (further along in translation direction)

      // For banner tail:
      // Plus strand: tail on segment with LEFT edge (earlier line for splits)
      // Minus strand: tail on segment with RIGHT edge (later line for splits)

      // Add the main element
      let mainShowNotch
      let mainShowTail
      if (isPlus) {
        // Plus strand: show notch unless it would protrude past right edge or is last codon
        mainShowNotch = !noseWouldProtrudeRight && !elem.isLastCodon
        // Plus strand: show tail unless it would protrude past left edge or is first codon
        mainShowTail = !tailWouldProtrudeLeft && !elem.isFirstCodon
      } else {
        // Minus strand: show notch unless it would protrude past left edge or is last codon
        mainShowNotch = !noseWouldProtrudeLeft && !elem.isLastCodon
        // Minus strand: show tail unless it would protrude past right edge or is first codon
        mainShowTail = !tailWouldProtrudeRight && !elem.isFirstCodon
      }

      result.get(lineIndex).push({
        ...elem,
        isOverflow: false,
        showNotch: mainShowNotch,
        showTail: mainShowTail
      })

      // Check if this codon extends past the right edge (overflow to next line)
      if (hasRightOverflow) {
        const overflowWidth = rightEdge - lineRight.value
        const nextLine = lineIndex + 1
        if (!result.has(nextLine)) {
          result.set(nextLine, [])
        }
        // Overflow element is at left edge of next line
        // Plus strand: nose on right (into line), tail on left (at lineLeft - would protrude)
        // Minus strand: nose on left (at lineLeft - would protrude), tail on right (into line)
        // Also check if nose/tail would protrude past the far edge (lineRight)
        const overflowRight = lineLeft.value + overflowWidth
        const plusNoseOK = overflowRight + noseProtrusion <= lineRight.value
        const minusTailOK = overflowRight + tailExt <= lineRight.value
        result.get(nextLine).push({
          ...elem,
          x: lineLeft.value + overflowWidth / 2,
          isOverflow: true,
          overflowWidth,
          showNotch: isPlus && plusNoseOK && !elem.isLastCodon,
          showTail: !isPlus && !elem.isFirstCodon && minusTailOK
        })
      }

      // Check if this codon extends past the left edge (overflow from previous line)
      if (hasLeftOverflow) {
        const overflowWidth = lineLeft.value - leftEdge
        const prevLine = lineIndex - 1
        if (prevLine >= 0) {
          if (!result.has(prevLine)) {
            result.set(prevLine, [])
          }
          // Overflow element is at right edge of prev line
          // Plus strand: nose on right (at lineRight - would protrude), tail on left (into line)
          // Minus strand: nose on left (into line), tail on right (at lineRight - would protrude)
          // Also check if nose/tail would protrude past the far edge (lineLeft)
          const overflowLeft = lineRight.value - overflowWidth
          const minusNoseOK = overflowLeft - noseProtrusion >= lineLeft.value
          const plusTailOK = overflowLeft - tailExt >= lineLeft.value
          result.get(prevLine).push({
            ...elem,
            x: lineRight.value - overflowWidth / 2,
            isOverflow: true,
            overflowWidth,
            showNotch: !isPlus && minusNoseOK && !elem.isLastCodon,
            showTail: isPlus && !elem.isFirstCodon && plusTailOK
          })
        }
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
    const clipped = getClippedBox(elem)
    if (clipped.width > 0) {
      minX = Math.min(minX, clipped.x)
      maxX = Math.max(maxX, clipped.x + clipped.width)
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
defineExpose({ show, visible })
</script>

<template>
  <g v-if="visible" class="translation-layer">
    <!-- Render translations for each line -->
    <g
      v-for="lineIndex in lines"
      :key="`line-${lineIndex}`"
      :transform="`translate(0, ${getLineY(lineIndex)})`"
    >
      <!-- Border rect for each annotation group -->
      <rect
        v-for="[annotationId, groupElements] in getAnnotationGroups(elementsByLine.get(lineIndex))"
        :key="`border-${annotationId}`"
        :x="getGroupBounds(groupElements).x"
        :y="-height"
        :width="getGroupBounds(groupElements).width"
        :height="height"
        class="aa-group-border"
      />
      <!-- Each amino acid element on this line -->
      <g
        v-for="(element, elemIndex) in elementsByLine.get(lineIndex)"
        :key="`aa-${element.annotationId}-${elemIndex}`"
        :class="{ 'aa-element': !element.isOverflow }"
        @mouseenter="!element.isOverflow && handleMouseEnter($event, element)"
        @mouseleave="!element.isOverflow && handleMouseLeave($event, element)"
        @click="!element.isOverflow && handleClick($event, element)"
      >
        <!-- Chevron path (nose/tail controlled by showNotch/showTail) -->
        <path
          :d="getChevronPath(getClippedBox(element).x, getClippedBox(element).width, height, element.orientation, element.showTail, element.showNotch)"
          :fill="getAminoAcidColor(element.aminoAcid)"
          :transform="`translate(0, ${-height})`"
          class="aa-chevron"
        />
        <!-- Amino acid letter (only for main element, not overflow) -->
        <text
          v-if="!element.isOverflow && element.aminoAcid !== '*'"
          :x="element.x"
          :y="-height / 2 + 1"
          text-anchor="middle"
          dominant-baseline="middle"
          class="translation-text"
        >{{ element.aminoAcid }}</text>
        <!-- Stop sign for stop codons (red octagon) -->
        <g
          v-if="!element.isOverflow && element.aminoAcid === '*'"
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
