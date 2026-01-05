/**
 * DNA utility functions and classes.
 * Ported from OpenGenePool DNA.js to ES6 modules.
 */

/**
 * Reverse complement of a DNA sequence.
 * Handles IUPAC ambiguity codes and preserves case.
 * @param {string} sequence - The DNA sequence to reverse complement
 * @returns {string} The reverse complement
 */
export function reverseComplement(sequence) {
  const complementMap = {
    // Standard bases
    'a': 't', 't': 'a', 'c': 'g', 'g': 'c',
    'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C',
    // Wildcards
    'n': 'n', 'x': 'x', 'N': 'N', 'X': 'X',
    // IUPAC two-letter codes
    'r': 'y', 'y': 'r', 'm': 'k', 'k': 'm', 's': 's', 'w': 'w',
    'R': 'Y', 'Y': 'R', 'M': 'K', 'K': 'M', 'S': 'S', 'W': 'W',
    // IUPAC three-letter codes
    'h': 'd', 'd': 'h', 'b': 'v', 'v': 'b',
    'H': 'D', 'D': 'H', 'B': 'V', 'V': 'B'
  }

  let result = ''
  for (let i = sequence.length - 1; i >= 0; i--) {
    const base = sequence[i]
    result += complementMap[base] || base
  }
  return result
}

/**
 * Orientation constants for DNA strands
 */
export const Orientation = {
  MINUS: -1,
  NONE: 0,
  PLUS: 1
}

/**
 * A Range represents a contiguous region of DNA.
 * Uses 0-based, half-open coordinates (like array slicing).
 */
export class Range {
  /**
   * @param {number} start - Start position (0-based, inclusive)
   * @param {number} end - End position (0-based, exclusive)
   * @param {number} [orientation=1] - Strand orientation (-1, 0, or 1)
   */
  constructor(start, end, orientation = Orientation.PLUS) {
    if (start < 0 || end < 0) {
      throw new Error('Range positions must be non-negative')
    }
    if (end < start) {
      throw new Error('Range end must be >= start')
    }

    this.start = start
    this.end = end
    this.orientation = orientation
  }

  /**
   * Parse a range from string notation.
   * Formats: "10..20", "(10..20)" (minus strand), "[10..20]" (both strands)
   * @param {string} str - The range string
   * @returns {Range}
   */
  static parse(str) {
    const trimmed = str.trim()
    let orientation = Orientation.PLUS
    let inner = trimmed

    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      orientation = Orientation.MINUS
      inner = trimmed.slice(1, -1)
    } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      orientation = Orientation.NONE
      inner = trimmed.slice(1, -1)
    }

    const parts = inner.split('..')
    const start = parseInt(parts[0], 10)
    const end = parts[1] !== undefined ? parseInt(parts[1], 10) : start

    if (isNaN(start) || isNaN(end)) {
      throw new Error(`Invalid range string: ${str}`)
    }

    return new Range(start, end, orientation)
  }

  /**
   * Length of this range in base pairs
   */
  get length() {
    return this.end - this.start
  }

  /**
   * Check if this range contains a position or another range.
   * @param {number|Range} target - Position or range to check
   * @returns {boolean}
   */
  contains(target) {
    if (target instanceof Range) {
      return target.start >= this.start && target.end <= this.end
    }
    return target >= this.start && target < this.end
  }

  /**
   * Check if this range overlaps with another range.
   * @param {Range} other - The other range
   * @returns {boolean}
   */
  overlaps(other) {
    return !(other.end <= this.start || other.start >= this.end)
  }

  /**
   * Extract the sequence from this range.
   * @param {string} sequence - The full DNA sequence
   * @returns {string} The extracted subsequence (reverse complemented if minus strand)
   */
  extract(sequence) {
    const sub = sequence.slice(this.start, this.end)
    return this.orientation === Orientation.MINUS ? reverseComplement(sub) : sub
  }

  /**
   * Create a new range shifted by an offset.
   * @param {number} offset - The amount to shift
   * @returns {Range}
   */
  shift(offset) {
    return new Range(this.start + offset, this.end + offset, this.orientation)
  }

  /**
   * Create a new range with flipped orientation.
   * @returns {Range}
   */
  flip() {
    return new Range(this.start, this.end, this.orientation * -1)
  }

  /**
   * String representation
   */
  toString() {
    const content = this.start === this.end ?
      `${this.start}` :
      `${this.start}..${this.end}`

    switch (this.orientation) {
      case Orientation.MINUS: return `(${content})`
      case Orientation.NONE: return `[${content}]`
      default: return content
    }
  }

  /**
   * GenBank-style representation (1-based)
   */
  toGenBank() {
    const content = `${this.start + 1}..${this.end}`
    return this.orientation === Orientation.MINUS ?
      `complement(${content})` : content
  }
}

/**
 * A Span is a collection of ranges (for complex annotations like joins).
 */
export class Span {
  /**
   * @param {Range[]} [ranges=[]] - Initial ranges
   */
  constructor(ranges = []) {
    this.ranges = [...ranges]
  }

  /**
   * Parse a span from string notation.
   * Format: "10..20 + 30..40" (multiple ranges joined)
   * @param {string} str - The span string
   * @returns {Span}
   */
  static parse(str) {
    const parts = str.split('+').map(s => s.trim()).filter(s => s)
    const ranges = parts.map(Range.parse)
    return new Span(ranges)
  }

  /**
   * Add a range to this span.
   * @param {Range} range
   */
  push(range) {
    this.ranges.push(range)
  }

  /**
   * Number of ranges in this span
   */
  get length() {
    return this.ranges.length
  }

  /**
   * Total base pairs covered by all ranges
   */
  get totalLength() {
    return this.ranges.reduce((sum, r) => sum + r.length, 0)
  }

  /**
   * Get the bounding range that encompasses all ranges.
   * @returns {Range}
   */
  get bounds() {
    if (this.ranges.length === 0) {
      return new Range(0, 0)
    }
    const start = Math.min(...this.ranges.map(r => r.start))
    const end = Math.max(...this.ranges.map(r => r.end))
    return new Range(start, end, Orientation.NONE)
  }

  /**
   * Determine the dominant orientation.
   * @returns {number}
   */
  get orientation() {
    let plusLength = 0
    let minusLength = 0

    for (const range of this.ranges) {
      if (range.orientation === Orientation.PLUS) {
        plusLength += range.length
      } else if (range.orientation === Orientation.MINUS) {
        minusLength += range.length
      }
    }

    return plusLength >= minusLength ? Orientation.PLUS : Orientation.MINUS
  }

  /**
   * String representation
   */
  toString() {
    return this.ranges.map(r => r.toString()).join(' + ')
  }

  /**
   * GenBank-style representation
   */
  toGenBank() {
    if (this.ranges.length === 1) {
      return this.ranges[0].toGenBank()
    }
    return `join(${this.ranges.map(r => r.toGenBank()).join(',')})`
  }
}
