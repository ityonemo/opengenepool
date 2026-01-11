import { describe, it, expect } from 'bun:test'
import {
  reverseComplement,
  Range,
  Span,
  Orientation
} from './dna.js'

/**
 * FENCED COORDINATE SYSTEM
 *
 * This module uses a fenced (0-based, half-open) coordinate system:
 *
 *   Sequence:    A  T  C  G  A  T
 *   Position:   0  1  2  3  4  5  6
 *               |  |  |  |  |  |  |
 *               └──┴──┴──┴──┴──┴──┘
 *
 * - Positions are "fences" between bases (or at the edges)
 * - Range [start, end) includes bases from position `start` up to but NOT including `end`
 * - A cursor is represented as Range(pos, pos) with length 0
 *
 * Examples for a sequence of length 6:
 *   0..0   → cursor at start (length 0)
 *   0..1   → first base only (length 1)
 *   0..6   → full sequence (length 6)
 *   6..6   → cursor at end (length 0)
 *   2..4   → bases at positions 2 and 3 (length 2)
 *   (0..6) → full sequence, minus strand
 *
 * GenBank (1-based) conversion is handled by the LiveView interface,
 * NOT by this module. All coordinates here are fenced/0-based.
 */

describe('reverseComplement', () => {
  it('complements standard bases', () => {
    expect(reverseComplement('A')).toBe('T')
    expect(reverseComplement('T')).toBe('A')
    expect(reverseComplement('C')).toBe('G')
    expect(reverseComplement('G')).toBe('C')
  })

  it('reverses the sequence', () => {
    expect(reverseComplement('ATCG')).toBe('CGAT')
  })

  it('preserves case', () => {
    expect(reverseComplement('AtCg')).toBe('cGaT')
  })

  it('handles IUPAC ambiguity codes', () => {
    // RYSWKM reversed is MKWSYR, then complemented: M->K, K->M, W->W, S->S, Y->R, R->Y
    expect(reverseComplement('RYSWKM')).toBe('KMWSRY')
  })

  it('handles wildcards', () => {
    expect(reverseComplement('NXnx')).toBe('xnXN')
  })

  it('handles empty string', () => {
    expect(reverseComplement('')).toBe('')
  })
})

describe('Range', () => {
  describe('constructor', () => {
    it('creates a range with start, end, and orientation', () => {
      const range = new Range(10, 20, Orientation.PLUS)
      expect(range.start).toBe(10)
      expect(range.end).toBe(20)
      expect(range.orientation).toBe(Orientation.PLUS)
    })

    it('defaults to plus strand orientation', () => {
      const range = new Range(10, 20)
      expect(range.orientation).toBe(Orientation.PLUS)
    })

    it('throws on negative positions', () => {
      expect(() => new Range(-1, 10)).toThrow('non-negative')
      expect(() => new Range(0, -1)).toThrow('non-negative')
    })

    it('throws when end < start', () => {
      expect(() => new Range(20, 10)).toThrow('end must be >= start')
    })
  })

  describe('parse', () => {
    it('parses fenced range notation', () => {
      const range = Range.parse('10..20')
      expect(range.start).toBe(10)
      expect(range.end).toBe(20)
      expect(range.orientation).toBe(Orientation.PLUS)
    })

    it('parses cursor position (start equals end)', () => {
      const range = Range.parse('15..15')
      expect(range.start).toBe(15)
      expect(range.end).toBe(15)
      expect(range.length).toBe(0)
    })

    it('parses single number as cursor position', () => {
      const range = Range.parse('15')
      expect(range.start).toBe(15)
      expect(range.end).toBe(15)
      expect(range.length).toBe(0)
    })

    it('parses minus strand notation with parentheses', () => {
      const range = Range.parse('(10..20)')
      expect(range.start).toBe(10)
      expect(range.end).toBe(20)
      expect(range.orientation).toBe(Orientation.MINUS)
    })

    it('parses unoriented notation with brackets', () => {
      const range = Range.parse('[10..20]')
      expect(range.start).toBe(10)
      expect(range.end).toBe(20)
      expect(range.orientation).toBe(Orientation.NONE)
    })

    it('handles whitespace', () => {
      const range = Range.parse('  10..20  ')
      expect(range.start).toBe(10)
      expect(range.end).toBe(20)
    })

    // Document fenced coordinate semantics
    it('correctly represents full sequence selection', () => {
      // For a sequence of length 100, full selection is 0..100
      const range = Range.parse('0..100')
      expect(range.start).toBe(0)
      expect(range.end).toBe(100)
      expect(range.length).toBe(100)
    })

    it('correctly represents single base selection', () => {
      // First base is 0..1, second base is 1..2, etc.
      const first = Range.parse('0..1')
      expect(first.length).toBe(1)
      expect(first.contains(0)).toBe(true)
      expect(first.contains(1)).toBe(false)

      const second = Range.parse('1..2')
      expect(second.length).toBe(1)
      expect(second.contains(0)).toBe(false)
      expect(second.contains(1)).toBe(true)
    })
  })

  describe('length', () => {
    it('returns the number of base pairs', () => {
      expect(new Range(10, 20).length).toBe(10)
      expect(new Range(0, 100).length).toBe(100)
      expect(new Range(5, 5).length).toBe(0)
    })
  })

  describe('contains', () => {
    const range = new Range(10, 20)

    it('checks if a position is contained', () => {
      expect(range.contains(10)).toBe(true)
      expect(range.contains(15)).toBe(true)
      expect(range.contains(19)).toBe(true)
      expect(range.contains(20)).toBe(false) // half-open
      expect(range.contains(9)).toBe(false)
    })

    it('checks if another range is contained', () => {
      expect(range.contains(new Range(10, 20))).toBe(true)
      expect(range.contains(new Range(12, 18))).toBe(true)
      expect(range.contains(new Range(5, 15))).toBe(false)
      expect(range.contains(new Range(15, 25))).toBe(false)
    })
  })

  describe('overlaps', () => {
    const range = new Range(10, 20)

    it('detects overlapping ranges', () => {
      expect(range.overlaps(new Range(15, 25))).toBe(true)
      expect(range.overlaps(new Range(5, 15))).toBe(true)
      expect(range.overlaps(new Range(12, 18))).toBe(true)
    })

    it('detects non-overlapping ranges', () => {
      expect(range.overlaps(new Range(0, 10))).toBe(false)
      expect(range.overlaps(new Range(20, 30))).toBe(false)
    })
  })

  describe('extract', () => {
    const sequence = 'ATCGATCGATCG'

    it('extracts subsequence for plus strand', () => {
      const range = new Range(0, 4, Orientation.PLUS)
      expect(range.extract(sequence)).toBe('ATCG')
    })

    it('extracts and reverse complements for minus strand', () => {
      const range = new Range(0, 4, Orientation.MINUS)
      expect(range.extract(sequence)).toBe('CGAT')
    })
  })

  describe('shift', () => {
    it('creates a new shifted range', () => {
      const range = new Range(10, 20, Orientation.MINUS)
      const shifted = range.shift(5)

      expect(shifted.start).toBe(15)
      expect(shifted.end).toBe(25)
      expect(shifted.orientation).toBe(Orientation.MINUS)
      // Original unchanged
      expect(range.start).toBe(10)
    })
  })

  describe('flip', () => {
    it('creates a range with flipped orientation', () => {
      const plus = new Range(10, 20, Orientation.PLUS)
      expect(plus.flip().orientation).toBe(Orientation.MINUS)

      const minus = new Range(10, 20, Orientation.MINUS)
      expect(minus.flip().orientation).toBe(Orientation.PLUS)
    })
  })

  describe('toString', () => {
    it('formats plus strand ranges', () => {
      expect(new Range(10, 20).toString()).toBe('10..20')
    })

    it('formats minus strand ranges with parentheses', () => {
      expect(new Range(10, 20, Orientation.MINUS).toString()).toBe('(10..20)')
    })

    it('formats unoriented ranges with brackets', () => {
      expect(new Range(10, 20, Orientation.NONE).toString()).toBe('[10..20]')
    })

    it('formats single positions', () => {
      expect(new Range(15, 15).toString()).toBe('15')
    })
  })

})

describe('Span', () => {
  describe('constructor', () => {
    it('creates an empty span', () => {
      const span = new Span()
      expect(span.length).toBe(0)
    })

    it('creates a span from ranges', () => {
      const span = new Span([new Range(0, 10), new Range(20, 30)])
      expect(span.length).toBe(2)
    })
  })

  describe('parse', () => {
    it('parses single fenced range', () => {
      const span = Span.parse('10..20')
      expect(span.length).toBe(1)
      expect(span.ranges[0].start).toBe(10)
      expect(span.ranges[0].end).toBe(20)
    })

    it('parses multiple ranges joined with +', () => {
      const span = Span.parse('10..20 + 30..40')
      expect(span.length).toBe(2)
      expect(span.ranges[0].start).toBe(10)
      expect(span.ranges[0].end).toBe(20)
      expect(span.ranges[1].start).toBe(30)
      expect(span.ranges[1].end).toBe(40)
    })

    it('parses mixed orientations', () => {
      const span = Span.parse('0..10 + (20..30)')
      expect(span.length).toBe(2)
      expect(span.ranges[0].orientation).toBe(Orientation.PLUS)
      expect(span.ranges[1].orientation).toBe(Orientation.MINUS)
    })
  })

  describe('totalLength', () => {
    it('sums the lengths of all ranges', () => {
      const span = new Span([new Range(0, 10), new Range(20, 30)])
      expect(span.totalLength).toBe(20)
    })
  })

  describe('bounds', () => {
    it('returns the bounding range', () => {
      const span = new Span([new Range(10, 20), new Range(40, 50)])
      const bounds = span.bounds
      expect(bounds.start).toBe(10)
      expect(bounds.end).toBe(50)
    })

    it('handles empty span', () => {
      const span = new Span()
      const bounds = span.bounds
      expect(bounds.start).toBe(0)
      expect(bounds.end).toBe(0)
    })
  })

  describe('orientation', () => {
    it('returns dominant orientation based on length', () => {
      const span = new Span([
        new Range(0, 100, Orientation.PLUS),
        new Range(200, 210, Orientation.MINUS)
      ])
      expect(span.orientation).toBe(Orientation.PLUS)
    })
  })

  describe('contains', () => {
    it('returns true if position is in any range', () => {
      const span = new Span([new Range(10, 20), new Range(30, 40)])
      expect(span.contains(15)).toBe(true)
      expect(span.contains(35)).toBe(true)
    })

    it('returns false if position is not in any range', () => {
      const span = new Span([new Range(10, 20), new Range(30, 40)])
      expect(span.contains(5)).toBe(false)
      expect(span.contains(25)).toBe(false)
      expect(span.contains(45)).toBe(false)
    })

    it('handles empty span', () => {
      const span = new Span()
      expect(span.contains(10)).toBe(false)
    })
  })
})
