/**
 * Translation utilities for DNA sequences.
 * Provides codon table and translation functions for CDS annotations.
 */

/**
 * Standard genetic code - all 64 codons mapped to amino acids.
 * Uses single-letter amino acid codes with '*' for stop codons.
 */
export const CODON_TABLE = {
  // Phenylalanine (F)
  'TTT': 'F', 'TTC': 'F',
  // Leucine (L)
  'TTA': 'L', 'TTG': 'L', 'CTT': 'L', 'CTC': 'L', 'CTA': 'L', 'CTG': 'L',
  // Isoleucine (I)
  'ATT': 'I', 'ATC': 'I', 'ATA': 'I',
  // Methionine (M) - also start codon
  'ATG': 'M',
  // Valine (V)
  'GTT': 'V', 'GTC': 'V', 'GTA': 'V', 'GTG': 'V',
  // Serine (S)
  'TCT': 'S', 'TCC': 'S', 'TCA': 'S', 'TCG': 'S', 'AGT': 'S', 'AGC': 'S',
  // Proline (P)
  'CCT': 'P', 'CCC': 'P', 'CCA': 'P', 'CCG': 'P',
  // Threonine (T)
  'ACT': 'T', 'ACC': 'T', 'ACA': 'T', 'ACG': 'T',
  // Alanine (A)
  'GCT': 'A', 'GCC': 'A', 'GCA': 'A', 'GCG': 'A',
  // Tyrosine (Y)
  'TAT': 'Y', 'TAC': 'Y',
  // Stop codons (*)
  'TAA': '*', 'TAG': '*', 'TGA': '*',
  // Histidine (H)
  'CAT': 'H', 'CAC': 'H',
  // Glutamine (Q)
  'CAA': 'Q', 'CAG': 'Q',
  // Asparagine (N)
  'AAT': 'N', 'AAC': 'N',
  // Lysine (K)
  'AAA': 'K', 'AAG': 'K',
  // Aspartic acid (D)
  'GAT': 'D', 'GAC': 'D',
  // Glutamic acid (E)
  'GAA': 'E', 'GAG': 'E',
  // Cysteine (C)
  'TGT': 'C', 'TGC': 'C',
  // Tryptophan (W)
  'TGG': 'W',
  // Arginine (R)
  'CGT': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R', 'AGA': 'R', 'AGG': 'R',
  // Glycine (G)
  'GGT': 'G', 'GGC': 'G', 'GGA': 'G', 'GGG': 'G'
}

/**
 * Start codons (initiator codons).
 * ATG is the standard eukaryotic start codon.
 */
export const START_CODONS = new Set(['ATG'])

// Three-letter amino acid codes
export const AA_THREE_LETTER = {
  A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys',
  E: 'Glu', Q: 'Gln', G: 'Gly', H: 'His', I: 'Ile',
  L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe', P: 'Pro',
  S: 'Ser', T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val',
  '*': 'Stop'
}

/**
 * Stop codons (termination codons).
 */
export const STOP_CODONS = new Set(['TAA', 'TAG', 'TGA'])

/**
 * Translate a DNA sequence to amino acids.
 *
 * @param {string} sequence - DNA sequence (can be uppercase or lowercase)
 * @param {number} [frame=0] - Reading frame (0, 1, or 2)
 * @returns {Array<{codon: string, aminoAcid: string, position: number, isStart: boolean, isStop: boolean}>}
 */
export function translate(sequence, frame = 0) {
  const result = []
  const upperSeq = sequence.toUpperCase()

  // Start from the frame offset and read in groups of 3
  for (let i = frame; i + 3 <= upperSeq.length; i += 3) {
    const codon = upperSeq.slice(i, i + 3)
    const aminoAcid = CODON_TABLE[codon] || '?'

    result.push({
      codon,
      aminoAcid,
      position: i,
      isStart: START_CODONS.has(codon),
      isStop: STOP_CODONS.has(codon)
    })
  }

  return result
}
