import { describe, it, expect } from 'vitest'
import {
  positionToAngle,
  angleToPosition,
  polarToCartesian,
  getArcPath,
  normalizeAngle
} from './circular.js'

describe('circular utilities', () => {
  describe('positionToAngle', () => {
    it('converts position 0 to -π/2 (top of circle)', () => {
      const angle = positionToAngle(0, 1000)
      expect(angle).toBeCloseTo(-Math.PI / 2)
    })

    it('converts quarter position to 0 (right side)', () => {
      const angle = positionToAngle(250, 1000)
      expect(angle).toBeCloseTo(0)
    })

    it('converts half position to π/2 (bottom)', () => {
      const angle = positionToAngle(500, 1000)
      expect(angle).toBeCloseTo(Math.PI / 2)
    })

    it('converts three-quarter position to π (left side)', () => {
      const angle = positionToAngle(750, 1000)
      expect(angle).toBeCloseTo(Math.PI)
    })

    it('converts end position to near -π/2 (almost back to top)', () => {
      const angle = positionToAngle(999, 1000)
      // Should be just before the top
      expect(angle).toBeCloseTo(-Math.PI / 2 + (2 * Math.PI * 999 / 1000))
    })
  })

  describe('angleToPosition', () => {
    it('converts -π/2 (top) to position 0', () => {
      const pos = angleToPosition(-Math.PI / 2, 1000)
      expect(pos).toBeCloseTo(0)
    })

    it('converts 0 (right side) to quarter position', () => {
      const pos = angleToPosition(0, 1000)
      expect(pos).toBeCloseTo(250)
    })

    it('converts π/2 (bottom) to half position', () => {
      const pos = angleToPosition(Math.PI / 2, 1000)
      expect(pos).toBeCloseTo(500)
    })

    it('converts π (left side) to three-quarter position', () => {
      const pos = angleToPosition(Math.PI, 1000)
      expect(pos).toBeCloseTo(750)
    })

    it('is inverse of positionToAngle', () => {
      const testPositions = [0, 100, 250, 500, 750, 999]
      for (const pos of testPositions) {
        const angle = positionToAngle(pos, 1000)
        const recovered = angleToPosition(angle, 1000)
        expect(recovered).toBeCloseTo(pos)
      }
    })
  })

  describe('normalizeAngle', () => {
    it('keeps angles in [0, 2π) unchanged', () => {
      expect(normalizeAngle(0)).toBeCloseTo(0)
      expect(normalizeAngle(Math.PI)).toBeCloseTo(Math.PI)
      expect(normalizeAngle(Math.PI / 2)).toBeCloseTo(Math.PI / 2)
    })

    it('normalizes negative angles', () => {
      expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo(3 * Math.PI / 2)
      expect(normalizeAngle(-Math.PI)).toBeCloseTo(Math.PI)
    })

    it('normalizes angles greater than 2π', () => {
      expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI)
      expect(normalizeAngle(4 * Math.PI)).toBeCloseTo(0)
    })
  })

  describe('polarToCartesian', () => {
    it('converts radius at angle 0 to right edge', () => {
      const { x, y } = polarToCartesian(100, 100, 50, 0)
      expect(x).toBeCloseTo(150)
      expect(y).toBeCloseTo(100)
    })

    it('converts radius at angle π/2 to bottom', () => {
      const { x, y } = polarToCartesian(100, 100, 50, Math.PI / 2)
      expect(x).toBeCloseTo(100)
      expect(y).toBeCloseTo(150)
    })

    it('converts radius at angle π to left edge', () => {
      const { x, y } = polarToCartesian(100, 100, 50, Math.PI)
      expect(x).toBeCloseTo(50)
      expect(y).toBeCloseTo(100)
    })

    it('converts radius at angle -π/2 to top', () => {
      const { x, y } = polarToCartesian(100, 100, 50, -Math.PI / 2)
      expect(x).toBeCloseTo(100)
      expect(y).toBeCloseTo(50)
    })
  })

  describe('getArcPath', () => {
    const seqLen = 1000
    const cx = 100
    const cy = 100
    const radius = 50
    const thickness = 10

    it('generates a valid SVG path string', () => {
      const path = getArcPath(0, 250, seqLen, cx, cy, radius, thickness)
      expect(typeof path).toBe('string')
      expect(path).toContain('M')
      expect(path).toContain('A')
    })

    it('handles quarter arc (90 degrees)', () => {
      const path = getArcPath(0, 250, seqLen, cx, cy, radius, thickness)
      // Should be a small arc (less than 180 degrees)
      expect(path).not.toContain('1,1')  // large-arc-flag should be 0
    })

    it('handles half arc (180 degrees)', () => {
      const path = getArcPath(0, 500, seqLen, cx, cy, radius, thickness)
      // At exactly 180 degrees, could go either way
      expect(path).toContain('A')
    })

    it('handles three-quarter arc (270 degrees)', () => {
      const path = getArcPath(0, 750, seqLen, cx, cy, radius, thickness)
      // Should be a large arc (more than 180 degrees)
      expect(path).toContain('A')
    })

    it('handles full wrap-around arc', () => {
      // An arc from position 750 to 250 wraps around through 0
      const path = getArcPath(750, 250, seqLen, cx, cy, radius, thickness, true)
      expect(path).toContain('A')
    })

    it('handles zero-length arc (returns empty string)', () => {
      const path = getArcPath(100, 100, seqLen, cx, cy, radius, thickness)
      expect(path).toBe('')
    })
  })
})
