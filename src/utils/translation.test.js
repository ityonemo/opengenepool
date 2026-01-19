import { describe, it, expect } from 'vitest'
import {
  CODON_TABLE,
  START_CODONS,
  STOP_CODONS,
  translate
} from './translation.js'

describe('CODON_TABLE', () => {
  it('has all 64 codons', () => {
    expect(Object.keys(CODON_TABLE).length).toBe(64)
  })

  it('maps ATG to M (Methionine)', () => {
    expect(CODON_TABLE['ATG']).toBe('M')
  })

  it('maps stop codons to *', () => {
    expect(CODON_TABLE['TAA']).toBe('*')
    expect(CODON_TABLE['TAG']).toBe('*')
    expect(CODON_TABLE['TGA']).toBe('*')
  })

  it('maps some common codons correctly', () => {
    // Phenylalanine
    expect(CODON_TABLE['TTT']).toBe('F')
    expect(CODON_TABLE['TTC']).toBe('F')

    // Leucine
    expect(CODON_TABLE['TTA']).toBe('L')
    expect(CODON_TABLE['TTG']).toBe('L')
    expect(CODON_TABLE['CTT']).toBe('L')

    // Glycine
    expect(CODON_TABLE['GGT']).toBe('G')
    expect(CODON_TABLE['GGC']).toBe('G')
    expect(CODON_TABLE['GGA']).toBe('G')
    expect(CODON_TABLE['GGG']).toBe('G')
  })
})

describe('START_CODONS', () => {
  it('contains ATG', () => {
    expect(START_CODONS.has('ATG')).toBe(true)
  })

  it('has exactly 1 standard start codon', () => {
    expect(START_CODONS.size).toBe(1)
  })
})

describe('STOP_CODONS', () => {
  it('contains all three stop codons', () => {
    expect(STOP_CODONS.has('TAA')).toBe(true)
    expect(STOP_CODONS.has('TAG')).toBe(true)
    expect(STOP_CODONS.has('TGA')).toBe(true)
  })

  it('has exactly 3 stop codons', () => {
    expect(STOP_CODONS.size).toBe(3)
  })
})

describe('translate', () => {
  it('translates a simple sequence in frame 0', () => {
    // ATG = M, GGT = G, TAA = * (stop)
    const sequence = 'ATGGGTAA'
    const result = translate(sequence, 0)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      codon: 'ATG',
      aminoAcid: 'M',
      position: 0,
      isStart: true,
      isStop: false
    })
    expect(result[1]).toEqual({
      codon: 'GGT',
      aminoAcid: 'G',
      position: 3,
      isStart: false,
      isStop: false
    })
  })

  it('translates with frame 1 offset', () => {
    // Skip first base: TGG = W, GTA = V, A (incomplete)
    const sequence = 'ATGGGTA'
    const result = translate(sequence, 1)

    expect(result).toHaveLength(2)
    expect(result[0].codon).toBe('TGG')
    expect(result[0].aminoAcid).toBe('W')
    expect(result[0].position).toBe(1)
    expect(result[1].codon).toBe('GTA')
    expect(result[1].aminoAcid).toBe('V')
    expect(result[1].position).toBe(4)
  })

  it('translates with frame 2 offset', () => {
    // Skip first two bases: GGG = G, TAA = * (stop)
    const sequence = 'ATGGGTAA'
    const result = translate(sequence, 2)

    expect(result).toHaveLength(2)
    expect(result[0].codon).toBe('GGG')
    expect(result[0].aminoAcid).toBe('G')
    expect(result[0].position).toBe(2)
  })

  it('marks stop codons correctly', () => {
    const sequence = 'ATGTAA'
    const result = translate(sequence, 0)

    expect(result).toHaveLength(2)
    expect(result[1]).toEqual({
      codon: 'TAA',
      aminoAcid: '*',
      position: 3,
      isStart: false,
      isStop: true
    })
  })

  it('handles incomplete codons at end', () => {
    const sequence = 'ATGGG' // Only 1.66 codons
    const result = translate(sequence, 0)

    expect(result).toHaveLength(1)
    expect(result[0].codon).toBe('ATG')
  })

  it('handles empty sequence', () => {
    const result = translate('', 0)
    expect(result).toHaveLength(0)
  })

  it('handles sequence shorter than frame offset', () => {
    const result = translate('AT', 2)
    expect(result).toHaveLength(0)
  })

  it('handles lowercase input', () => {
    const sequence = 'atgggtaa'
    const result = translate(sequence, 0)

    expect(result).toHaveLength(2)
    expect(result[0].aminoAcid).toBe('M')
  })

  it('defaults to frame 0', () => {
    const sequence = 'ATGGGT'
    const result = translate(sequence)

    expect(result).toHaveLength(2)
    expect(result[0].position).toBe(0)
  })
})
