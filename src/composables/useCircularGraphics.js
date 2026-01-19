import { ref, computed } from 'vue'
import {
  positionToAngle as posToAngle,
  angleToPosition as angleToPos,
  mouseToPosition as mouseToPos,
  getRowRadius as calcRowRadius,
  polarToCartesian
} from '../utils/circular.js'

/**
 * Circular graphics composable for plasmid map rendering.
 *
 * Provides:
 * - Circle geometry (center, radius, viewBox)
 * - Coordinate conversion (position ↔ angle ↔ pixel)
 * - Annotation row stacking
 * - Tick mark generation
 *
 * @param {Object} editorState - Editor state composable
 * @param {Object} options - Configuration options
 * @param {Ref<number>} options.annotationRowCount - Number of annotation rows to accommodate
 * @returns {Object} Circular graphics API
 */
export function useCircularGraphics(editorState, options = {}) {
  const annotationRowCount = options.annotationRowCount || ref(0)

  // Annotation settings (fixed)
  const annotationHeight = ref(14)
  const annotationPadding = ref(4)       // Padding between annotation rows
  const annotationGap = ref(6)           // Gap between backbone and first annotation row
  const tickLength = ref(8)

  // Calculate space needed for annotations
  const annotationSpace = computed(() => {
    const rows = annotationRowCount.value || 0
    if (rows === 0) return 0
    return annotationGap.value + rows * annotationHeight.value + (rows - 1) * annotationPadding.value
  })

  // Fixed size for the circular view
  const viewBoxWidth = ref(500)
  const viewBoxHeight = ref(500)

  // Circle center (middle of viewBox)
  const centerX = computed(() => viewBoxWidth.value / 2)
  const centerY = computed(() => viewBoxHeight.value / 2)

  // Backbone radius - shrinks to accommodate annotation rows
  // Base radius minus space needed for annotations on the outside
  const baseBackboneRadius = 180
  const backboneRadius = computed(() => {
    return Math.max(80, baseBackboneRadius - annotationSpace.value / 2)
  })

  // ViewBox string for SVG
  const viewBox = computed(() =>
    `0 0 ${viewBoxWidth.value} ${viewBoxHeight.value}`
  )

  /**
   * Convert sequence position to angle.
   * @param {number} position
   * @returns {number} Angle in radians
   */
  function positionToAngle(position) {
    return posToAngle(position, editorState.sequenceLength.value)
  }

  /**
   * Convert angle to sequence position.
   * @param {number} angle - Angle in radians
   * @returns {number} Sequence position
   */
  function angleToPosition(angle) {
    return angleToPos(angle, editorState.sequenceLength.value)
  }

  /**
   * Convert mouse coordinates to sequence position.
   * @param {number} mouseX
   * @param {number} mouseY
   * @returns {number} Sequence position (integer)
   */
  function mouseToPosition(mouseX, mouseY) {
    return mouseToPos(
      mouseX,
      mouseY,
      centerX.value,
      centerY.value,
      editorState.sequenceLength.value
    )
  }

  /**
   * Get the radius for an annotation row.
   * Row 0 is closest to the backbone, higher rows are further out.
   * @param {number} rowIndex
   * @returns {number} Radius for this row
   */
  function getRowRadius(rowIndex) {
    // First row starts at backbone + gap + half annotation height
    // Subsequent rows add (annotationHeight + padding) for each row
    const baseOffset = backboneRadius.value + annotationGap.value + annotationHeight.value / 2
    return baseOffset + rowIndex * (annotationHeight.value + annotationPadding.value)
  }

  /**
   * Set the number of annotation rows (called after layout)
   */
  function setAnnotationRowCount(count) {
    if (annotationRowCount.value !== count) {
      annotationRowCount.value = count
    }
  }

  /**
   * Convert position and radius to Cartesian coordinates.
   * @param {number} position - Sequence position
   * @param {number} radius - Radius from center
   * @returns {{x: number, y: number}}
   */
  function positionToCartesian(position, radius) {
    const angle = positionToAngle(position)
    return polarToCartesian(centerX.value, centerY.value, radius, angle)
  }

  /**
   * Computed tick marks at regular intervals.
   */
  const tickMarks = computed(() => {
    const seqLen = editorState.sequenceLength.value
    if (!seqLen) return []

    // Determine tick interval based on sequence length
    let interval
    if (seqLen <= 1000) {
      interval = 100
    } else if (seqLen <= 5000) {
      interval = 500
    } else if (seqLen <= 20000) {
      interval = 1000
    } else if (seqLen <= 50000) {
      interval = 5000
    } else {
      interval = 10000
    }

    const ticks = []
    for (let pos = 0; pos < seqLen; pos += interval) {
      const angle = positionToAngle(pos)
      const innerPoint = polarToCartesian(
        centerX.value,
        centerY.value,
        backboneRadius.value - tickLength.value / 2,
        angle
      )
      const outerPoint = polarToCartesian(
        centerX.value,
        centerY.value,
        backboneRadius.value + tickLength.value / 2,
        angle
      )
      const labelPoint = polarToCartesian(
        centerX.value,
        centerY.value,
        backboneRadius.value - tickLength.value - 12,
        angle
      )

      // Format label
      let label
      if (pos === 0) {
        label = '0'
      } else if (pos >= 1000) {
        label = `${pos / 1000}k`
      } else {
        label = String(pos)
      }

      ticks.push({
        position: pos,
        angle,
        innerPoint,
        outerPoint,
        labelPoint,
        label,
        // Determine text anchor based on position on circle
        textAnchor: getTextAnchor(angle),
        dominantBaseline: getDominantBaseline(angle)
      })
    }

    return ticks
  })

  /**
   * Get text anchor based on angle (for tick labels).
   */
  function getTextAnchor(angle) {
    // Normalize angle to [0, 2π)
    let normalized = angle
    if (normalized < 0) normalized += 2 * Math.PI

    // Right side of circle: start
    // Left side: end
    // Top/bottom: middle
    if (normalized < Math.PI / 4 || normalized > 7 * Math.PI / 4) {
      return 'start' // right side
    } else if (normalized > 3 * Math.PI / 4 && normalized < 5 * Math.PI / 4) {
      return 'end' // left side
    }
    return 'middle'
  }

  /**
   * Get dominant baseline based on angle (for tick labels).
   */
  function getDominantBaseline(angle) {
    // Normalize angle to [0, 2π)
    let normalized = angle
    if (normalized < 0) normalized += 2 * Math.PI

    // Top: auto (text below)
    // Bottom: hanging (text above)
    if (normalized > Math.PI / 4 && normalized < 3 * Math.PI / 4) {
      return 'hanging' // bottom half
    } else if (normalized > 5 * Math.PI / 4 && normalized < 7 * Math.PI / 4) {
      return 'auto' // top half
    }
    return 'middle'
  }

  return {
    // Dimensions
    viewBoxWidth,
    viewBoxHeight,
    viewBox,

    // Circle geometry
    centerX,
    centerY,
    backboneRadius,

    // Annotation settings
    annotationHeight,
    annotationPadding,
    annotationGap,
    tickLength,

    // Tick marks
    tickMarks,

    // Coordinate conversion
    positionToAngle,
    angleToPosition,
    mouseToPosition,
    positionToCartesian,

    // Annotation stacking
    getRowRadius,
    setAnnotationRowCount,
    annotationRowCount
  }
}
