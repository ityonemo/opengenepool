import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useCircularGraphics } from './useCircularGraphics.js'

// Mock editor state
function createMockEditorState(sequenceLength = 1000) {
  return {
    sequenceLength: ref(sequenceLength),
    sequence: ref('A'.repeat(sequenceLength))
  }
}

describe('useCircularGraphics', () => {
  describe('initialization', () => {
    it('creates composable with default values', () => {
      const editorState = createMockEditorState()
      const graphics = useCircularGraphics(editorState)

      expect(graphics.centerX.value).toBe(250)
      expect(graphics.centerY.value).toBe(250)
      expect(graphics.backboneRadius.value).toBe(180)
    })

    it('computes viewBox dimensions', () => {
      const editorState = createMockEditorState()
      const graphics = useCircularGraphics(editorState)

      expect(graphics.viewBoxWidth.value).toBe(500)
      expect(graphics.viewBoxHeight.value).toBe(500)
      expect(graphics.viewBox.value).toBe('0 0 500 500')
    })
  })

  describe('coordinate conversion', () => {
    it('converts position to angle', () => {
      const editorState = createMockEditorState(1000)
      const graphics = useCircularGraphics(editorState)

      // Position 0 should be at top (-π/2)
      const angle0 = graphics.positionToAngle(0)
      expect(angle0).toBeCloseTo(-Math.PI / 2)

      // Position 250 should be at right (0)
      const angle250 = graphics.positionToAngle(250)
      expect(angle250).toBeCloseTo(0)
    })

    it('converts angle to position', () => {
      const editorState = createMockEditorState(1000)
      const graphics = useCircularGraphics(editorState)

      // Top (-π/2) should be position 0
      const pos0 = graphics.angleToPosition(-Math.PI / 2)
      expect(pos0).toBeCloseTo(0)

      // Right (0) should be position 250
      const pos250 = graphics.angleToPosition(0)
      expect(pos250).toBeCloseTo(250)
    })
  })

  describe('mouse to position', () => {
    it('converts mouse at top to position 0', () => {
      const editorState = createMockEditorState(1000)
      const graphics = useCircularGraphics(editorState)

      // Top of circle (above center)
      const pos = graphics.mouseToPosition(250, 70) // cx, cy - backboneRadius
      expect(pos).toBe(0)
    })

    it('converts mouse at right to quarter position', () => {
      const editorState = createMockEditorState(1000)
      const graphics = useCircularGraphics(editorState)

      // Right of circle
      const pos = graphics.mouseToPosition(430, 250) // cx + backboneRadius, cy
      expect(pos).toBe(250)
    })
  })

  describe('annotation row stacking', () => {
    it('calculates row radius for row 0', () => {
      const editorState = createMockEditorState()
      const graphics = useCircularGraphics(editorState)

      const radius = graphics.getRowRadius(0)
      // Should be backbone + half annotation height + padding
      expect(radius).toBeGreaterThan(graphics.backboneRadius.value)
    })

    it('calculates increasing radii for higher rows', () => {
      const editorState = createMockEditorState()
      const graphics = useCircularGraphics(editorState)

      const row0 = graphics.getRowRadius(0)
      const row1 = graphics.getRowRadius(1)
      const row2 = graphics.getRowRadius(2)

      expect(row1).toBeGreaterThan(row0)
      expect(row2).toBeGreaterThan(row1)
    })
  })

  describe('zoom', () => {
    it('has zoomScale initialized to 1.0', () => {
      const editorState = createMockEditorState()
      const graphics = useCircularGraphics(editorState)

      expect(graphics.zoomScale.value).toBe(1.0)
    })

    it('exposes zoom limits', () => {
      const editorState = createMockEditorState()
      const graphics = useCircularGraphics(editorState)

      expect(graphics.minBackboneRadius).toBe(50)
      expect(graphics.maxBackboneRadius.value).toBeGreaterThan(50)
    })

    it('scales backboneRadius with zoomScale', () => {
      const editorState = createMockEditorState()
      const graphics = useCircularGraphics(editorState)

      const baseRadius = graphics.backboneRadius.value
      graphics.zoomScale.value = 0.5
      expect(graphics.backboneRadius.value).toBeCloseTo(baseRadius * 0.5)

      graphics.zoomScale.value = 1.5
      expect(graphics.backboneRadius.value).toBeCloseTo(baseRadius * 1.5)
    })

    it('setZoom clamps to minBackboneRadius', () => {
      const editorState = createMockEditorState()
      const graphics = useCircularGraphics(editorState)

      // Try to zoom out so radius would be below minimum
      graphics.setZoom(0.1) // Would make radius ~18px, below 50px minimum
      expect(graphics.backboneRadius.value).toBeGreaterThanOrEqual(graphics.minBackboneRadius)
    })

    it('setZoom clamps to maxBackboneRadius', () => {
      const editorState = createMockEditorState()
      const graphics = useCircularGraphics(editorState)

      // Try to zoom in beyond the maximum
      graphics.setZoom(5.0) // Would make radius ~900px, above max
      expect(graphics.backboneRadius.value).toBeLessThanOrEqual(graphics.maxBackboneRadius.value)
    })

    it('setZoom updates zoomScale within limits', () => {
      const editorState = createMockEditorState()
      const graphics = useCircularGraphics(editorState)

      graphics.setZoom(1.2)
      expect(graphics.zoomScale.value).toBe(1.2)
    })
  })

  describe('tick marks', () => {
    it('generates tick marks at regular intervals', () => {
      const editorState = createMockEditorState(10000)
      const graphics = useCircularGraphics(editorState)

      const ticks = graphics.tickMarks.value
      expect(ticks.length).toBeGreaterThan(0)
      expect(ticks[0]).toHaveProperty('position')
      expect(ticks[0]).toHaveProperty('angle')
      expect(ticks[0]).toHaveProperty('label')
    })

    it('includes position 0 tick', () => {
      const editorState = createMockEditorState(10000)
      const graphics = useCircularGraphics(editorState)

      const ticks = graphics.tickMarks.value
      const zeroTick = ticks.find(t => t.position === 0)
      expect(zeroTick).toBeDefined()
    })
  })
})
