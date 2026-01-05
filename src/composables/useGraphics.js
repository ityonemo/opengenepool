import { ref, computed, watch } from 'vue'

/**
 * Graphics metrics and layout calculations.
 * Replaces the jQuery graphics plugin's metric and layout systems.
 *
 * Metrics are computed based on:
 * - Container dimensions (fullWidth, fullHeight)
 * - Zoom level (bases per line)
 * - Font metrics (derived from a reference character width)
 */
export function useGraphics(editorState) {
  // Container dimensions (set by component on mount/resize)
  const containerWidth = ref(800)
  const containerHeight = ref(600)

  // Font metrics (measured from actual rendered text)
  const charWidth = ref(8)    // width of a single character in pixels
  const lineHeight = ref(16)  // height of a line of text in pixels

  // Settings from editor state
  const settings = computed(() => editorState.settings.value)
  const zoomLevel = computed(() => editorState.zoomLevel.value)

  // Computed metrics
  const metrics = computed(() => {
    const zoom = zoomLevel.value
    const lmargin = settings.value.lmargin
    const rmargin = settings.value.rmargin

    // Calculate the width available for sequence display
    const availableWidth = containerWidth.value - lmargin - rmargin

    // Calculate character width based on zoom level
    // If text would fit, use actual character width
    // Otherwise, compress to fit
    const textWidth = zoom * charWidth.value
    const useTextMode = textWidth <= availableWidth

    const effectiveCharWidth = useTextMode
      ? charWidth.value
      : availableWidth / zoom

    const lineWidth = zoom * effectiveCharWidth

    return {
      fullWidth: containerWidth.value,
      fullHeight: containerHeight.value,
      lineWidth,
      lineHeight: lineHeight.value,
      charWidth: effectiveCharWidth,
      blockWidth: charWidth.value,  // original char width for zoom-independent elements
      textMode: useTextMode,  // whether to show text or bars
      lmargin,
      rmargin
    }
  })

  // Convert x pixel position to sequence position within a line
  function pixelToLinePosition(x) {
    const m = metrics.value
    const pos = (x - m.lmargin) / m.charWidth
    const clamped = Math.max(0, Math.min(pos, zoomLevel.value))
    return Math.round(clamped)
  }

  // Convert sequence position to x pixel position
  function linePositionToPixel(pos) {
    const m = metrics.value
    return m.lmargin + pos * m.charWidth
  }

  // Get the y position of a line (top of the line)
  function getLineY(lineIndex) {
    const s = settings.value
    return s.vmargin + lineIndex * (lineHeight.value + s.linepadding)
  }

  // Get total height needed for all lines
  function getTotalHeight(lineCount) {
    if (lineCount === 0) return 0
    const s = settings.value
    return s.vmargin * 2 + lineCount * lineHeight.value + (lineCount - 1) * s.linepadding
  }

  // Find which line a y position corresponds to
  function pixelToLineIndex(y, lineCount) {
    const s = settings.value
    const lineSpacing = lineHeight.value + s.linepadding

    const lineIndex = Math.floor((y - s.vmargin) / lineSpacing)
    return Math.max(0, Math.min(lineIndex, lineCount - 1))
  }

  // Convert pixel coordinates to sequence position
  function pixelToSequencePosition(x, y, lineCount) {
    const lineIndex = pixelToLineIndex(y, lineCount)
    const linePos = pixelToLinePosition(x)
    return editorState.lineToPosition(lineIndex, linePos)
  }

  // Update container dimensions (called on mount/resize)
  function setContainerSize(width, height) {
    containerWidth.value = width
    containerHeight.value = height
  }

  // Update font metrics (called after measuring actual text)
  function setFontMetrics(width, height) {
    charWidth.value = width
    lineHeight.value = height
  }

  return {
    // Refs for external updates
    containerWidth,
    containerHeight,
    charWidth,
    lineHeight,

    // Computed
    metrics,

    // Methods
    pixelToLinePosition,
    linePositionToPixel,
    getLineY,
    getTotalHeight,
    pixelToLineIndex,
    pixelToSequencePosition,
    setContainerSize,
    setFontMetrics
  }
}
