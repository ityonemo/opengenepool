import { describe, it, expect } from 'bun:test'
import { useEditorState } from './useEditorState.js'
import { useGraphics } from './useGraphics.js'

describe('useGraphics', () => {
  function createGraphics() {
    const editorState = useEditorState()
    const graphics = useGraphics(editorState)
    return { editorState, graphics }
  }

  describe('initial state', () => {
    it('has default container dimensions', () => {
      const { graphics } = createGraphics()
      expect(graphics.containerWidth.value).toBe(800)
      expect(graphics.containerHeight.value).toBe(600)
    })

    it('has default font metrics', () => {
      const { graphics } = createGraphics()
      expect(graphics.charWidth.value).toBe(8)
      expect(graphics.lineHeight.value).toBe(16)
    })
  })

  describe('metrics', () => {
    it('calculates line width in text mode', () => {
      const { editorState, graphics } = createGraphics()
      editorState.setSequence('A'.repeat(500))
      editorState.setZoom(50)  // 50 * 8 = 400, fits in 720 available
      graphics.setContainerSize(800, 600)
      graphics.setFontMetrics(8, 16)

      const m = graphics.metrics.value
      expect(m.textMode).toBe(true)
      expect(m.lineWidth).toBe(400)  // 50 * 8
      expect(m.charWidth).toBe(8)
    })

    it('calculates line width in bar mode (compressed)', () => {
      const { editorState, graphics } = createGraphics()
      editorState.setSequence('A'.repeat(500))
      editorState.setZoom(100)  // 100 * 8 = 800 > 720 available
      graphics.setContainerSize(800, 600)
      graphics.setFontMetrics(8, 16)

      const m = graphics.metrics.value
      expect(m.textMode).toBe(false)
      expect(m.lineWidth).toBe(720)  // compressed to available space
      expect(m.charWidth).toBe(7.2)  // 720 / 100
    })

    it('uses text mode when text fits', () => {
      const { editorState, graphics } = createGraphics()
      editorState.setSequence('A'.repeat(500))
      editorState.setZoom(50)
      graphics.setContainerSize(600, 400)
      graphics.setFontMetrics(8, 16)

      const m = graphics.metrics.value
      // 50 * 8 = 400 pixels for text
      // 600 - 60 (lmargin) - 20 (rmargin) = 520 available
      // 400 < 520, so text mode
      expect(m.textMode).toBe(true)
      expect(m.charWidth).toBe(8)
    })

    it('uses bar mode when text too wide', () => {
      const { editorState, graphics } = createGraphics()
      editorState.setSequence('A'.repeat(500))
      editorState.setZoom(200)
      graphics.setContainerSize(600, 400)
      graphics.setFontMetrics(8, 16)

      const m = graphics.metrics.value
      // 200 * 8 = 1600 pixels for text
      // 600 - 60 - 20 = 520 available
      // 1600 > 520, so bar mode with compressed char width
      expect(m.textMode).toBe(false)
      expect(m.charWidth).toBe(520 / 200)  // compressed to fit
      expect(m.lineWidth).toBe(520)
    })

    it('preserves blockWidth for zoom-independent elements', () => {
      const { editorState, graphics } = createGraphics()
      editorState.setSequence('A'.repeat(500))
      editorState.setZoom(200)
      graphics.setContainerSize(600, 400)
      graphics.setFontMetrics(8, 16)

      const m = graphics.metrics.value
      expect(m.blockWidth).toBe(8)  // original char width preserved
    })
  })

  describe('pixelToLinePosition', () => {
    it('converts x pixel to position within line', () => {
      const { editorState, graphics } = createGraphics()
      editorState.setSequence('A'.repeat(500))
      editorState.setZoom(50)  // use zoom 50 to stay in text mode
      graphics.setContainerSize(800, 600)
      graphics.setFontMetrics(8, 16)

      // lmargin is 60, so position 0 is at x=60
      expect(graphics.pixelToLinePosition(60)).toBe(0)
      expect(graphics.pixelToLinePosition(60 + 8)).toBe(1)
      expect(graphics.pixelToLinePosition(60 + 40)).toBe(5)
    })

    it('clamps to valid range', () => {
      const { editorState, graphics } = createGraphics()
      editorState.setSequence('A'.repeat(500))
      editorState.setZoom(50)
      graphics.setContainerSize(800, 600)
      graphics.setFontMetrics(8, 16)

      expect(graphics.pixelToLinePosition(0)).toBe(0)  // before lmargin
      expect(graphics.pixelToLinePosition(10000)).toBe(50)  // beyond line, clamped to zoom
    })
  })

  describe('linePositionToPixel', () => {
    it('converts position to x pixel', () => {
      const { editorState, graphics } = createGraphics()
      editorState.setSequence('A'.repeat(500))
      editorState.setZoom(50)  // use zoom 50 to stay in text mode
      graphics.setContainerSize(800, 600)
      graphics.setFontMetrics(8, 16)

      expect(graphics.linePositionToPixel(0)).toBe(60)  // lmargin
      expect(graphics.linePositionToPixel(1)).toBe(68)
      expect(graphics.linePositionToPixel(10)).toBe(140)
    })
  })

  describe('getLineY', () => {
    it('calculates y position for each line', () => {
      const { editorState, graphics } = createGraphics()
      editorState.setSequence('A'.repeat(500))

      // vmargin = 10, lineHeight = 16, linepadding = 5
      expect(graphics.getLineY(0)).toBe(10)
      expect(graphics.getLineY(1)).toBe(10 + 16 + 5)  // 31
      expect(graphics.getLineY(2)).toBe(10 + 2 * (16 + 5))  // 52
    })
  })

  describe('getTotalHeight', () => {
    it('returns 0 for no lines', () => {
      const { graphics } = createGraphics()
      expect(graphics.getTotalHeight(0)).toBe(0)
    })

    it('calculates total height for lines', () => {
      const { graphics } = createGraphics()
      // vmargin = 10, lineHeight = 16, linepadding = 5
      // 1 line: 10 + 16 + 10 = 36
      expect(graphics.getTotalHeight(1)).toBe(36)

      // 3 lines: 10 + 3*16 + 2*5 + 10 = 78
      expect(graphics.getTotalHeight(3)).toBe(78)
    })
  })

  describe('pixelToLineIndex', () => {
    it('finds line index from y position', () => {
      const { graphics } = createGraphics()
      // vmargin = 10, lineHeight = 16, linepadding = 5

      expect(graphics.pixelToLineIndex(15, 5)).toBe(0)
      expect(graphics.pixelToLineIndex(35, 5)).toBe(1)  // after first line
      expect(graphics.pixelToLineIndex(56, 5)).toBe(2)
    })

    it('clamps to valid range', () => {
      const { graphics } = createGraphics()

      expect(graphics.pixelToLineIndex(0, 5)).toBe(0)
      expect(graphics.pixelToLineIndex(1000, 5)).toBe(4)  // max is lineCount - 1
    })
  })

  describe('pixelToSequencePosition', () => {
    it('converts pixel coordinates to absolute sequence position', () => {
      const { editorState, graphics } = createGraphics()
      editorState.setSequence('A'.repeat(500))
      editorState.setZoom(50)  // use zoom 50 to stay in text mode
      graphics.setContainerSize(800, 600)
      graphics.setFontMetrics(8, 16)

      // Line 0, position 5 = absolute position 5
      expect(graphics.pixelToSequencePosition(60 + 40, 15, 10)).toBe(5)

      // Line 1, position 10 = absolute position 60 (50 + 10)
      expect(graphics.pixelToSequencePosition(60 + 80, 35, 10)).toBe(60)
    })
  })

  describe('setContainerSize', () => {
    it('updates container dimensions', () => {
      const { graphics } = createGraphics()
      graphics.setContainerSize(1024, 768)

      expect(graphics.containerWidth.value).toBe(1024)
      expect(graphics.containerHeight.value).toBe(768)
      expect(graphics.metrics.value.fullWidth).toBe(1024)
      expect(graphics.metrics.value.fullHeight).toBe(768)
    })
  })

  describe('setFontMetrics', () => {
    it('updates font metrics', () => {
      const { graphics } = createGraphics()
      graphics.setFontMetrics(10, 20)

      expect(graphics.charWidth.value).toBe(10)
      expect(graphics.lineHeight.value).toBe(20)
    })
  })
})
