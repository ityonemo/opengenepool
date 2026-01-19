import { describe, it, expect, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useTranslation } from './useTranslation.js'
import { Annotation } from '../utils/annotation.js'

// Mock editorState
function createMockEditorState(sequence) {
  const zoomLevel = ref(100) // 100 bases per line
  return {
    sequence: ref(sequence),
    sequenceLength: ref(sequence.length),
    zoomLevel
  }
}

// Mock graphics with minimal required functionality
function createMockGraphics() {
  return {
    metrics: ref({
      lmargin: 50,
      charWidth: 8
    }),
    lineHeight: ref(16)
  }
}

describe('useTranslation', () => {
  let editorState
  let graphics

  beforeEach(() => {
    // Default sequence: ATG GGT AAA = M G K (9 bases)
    editorState = createMockEditorState('ATGGGTAAA')
    graphics = createMockGraphics()
  })

  describe('basic translation', () => {
    it('returns empty Map when no CDS annotations', () => {
      const { elementsByLine } = useTranslation(editorState, graphics, ref([]))

      expect(elementsByLine.value).toBeInstanceOf(Map)
      expect(elementsByLine.value.size).toBe(0)
    })

    it('translates a simple CDS annotation', () => {
      const annotations = ref([
        new Annotation({
          id: 'cds1',
          type: 'CDS',
          span: '0..9',
          caption: 'TestCDS'
        })
      ])

      const { elementsByLine } = useTranslation(editorState, graphics, annotations)

      // All on line 0 (100 bases per line, sequence is 9 bases)
      expect(elementsByLine.value.has(0)).toBe(true)
      const elements = elementsByLine.value.get(0)

      // Should have 3 amino acids: M, G, K
      expect(elements).toHaveLength(3)
      expect(elements[0].aminoAcid).toBe('M')
      expect(elements[0].isStart).toBe(true)
      expect(elements[1].aminoAcid).toBe('G')
      expect(elements[2].aminoAcid).toBe('K')
    })

    it('calculates x position centered on codon', () => {
      const annotations = ref([
        new Annotation({
          id: 'cds1',
          type: 'CDS',
          span: '0..9',
          caption: 'TestCDS'
        })
      ])

      const { elementsByLine } = useTranslation(editorState, graphics, annotations)
      const elements = elementsByLine.value.get(0)

      // First codon at position 0-2, center at 1.5 * charWidth + lmargin
      // lmargin = 50, charWidth = 8
      // First amino acid x = 50 + 1.5 * 8 = 62
      expect(elements[0].x).toBe(50 + 1.5 * 8)

      // Second codon at position 3-5, center at 4.5 * charWidth + lmargin
      expect(elements[1].x).toBe(50 + 4.5 * 8)

      // Third codon at position 6-8, center at 7.5 * charWidth + lmargin
      expect(elements[2].x).toBe(50 + 7.5 * 8)
    })

    it('includes annotationId in elements', () => {
      const annotations = ref([
        new Annotation({
          id: 'my-cds-id',
          type: 'CDS',
          span: '0..9',
          caption: 'TestCDS'
        })
      ])

      const { elementsByLine } = useTranslation(editorState, graphics, annotations)
      const elements = elementsByLine.value.get(0)

      expect(elements[0].annotationId).toBe('my-cds-id')
    })
  })

  describe('codon_start attribute', () => {
    it('uses codon_start attribute to set reading frame', () => {
      // Sequence: A TGG GTA AA
      // With codon_start=2, skip 1 base: TGG = W, GTA = V
      editorState = createMockEditorState('ATGGGTAAA')

      const annotations = ref([
        new Annotation({
          id: 'cds1',
          type: 'CDS',
          span: '0..9',
          caption: 'TestCDS',
          attributes: { codon_start: 2 } // GenBank 1-based, so frame = 1
        })
      ])

      const { elementsByLine } = useTranslation(editorState, graphics, annotations)
      const elements = elementsByLine.value.get(0)

      // TGG = W, GTA = V (skip first base)
      expect(elements).toHaveLength(2)
      expect(elements[0].aminoAcid).toBe('W')
      expect(elements[1].aminoAcid).toBe('V')
    })

    it('defaults to codon_start=1 (frame 0) when not specified', () => {
      const annotations = ref([
        new Annotation({
          id: 'cds1',
          type: 'CDS',
          span: '0..6', // ATG GGT
          caption: 'TestCDS'
        })
      ])

      const { elementsByLine } = useTranslation(editorState, graphics, annotations)
      const elements = elementsByLine.value.get(0)

      // Frame 0: ATG = M, GGT = G
      expect(elements[0].aminoAcid).toBe('M')
      expect(elements[1].aminoAcid).toBe('G')
    })
  })

  describe('minus strand', () => {
    it('reverse complements sequence for minus strand CDS', () => {
      // Minus strand CDS: extract, reverse complement, then translate
      // Sequence: ATGGGTAAA
      // Range (0..9) means 0..9 on minus strand
      // Extract 0..9: ATGGGTAAA
      // Reverse complement: TTTACCCGT → TTT ACC CCA T
      // Wait, let me recalculate:
      // ATGGGTAAA reverse complement:
      // Reverse: AAATGGGTA
      // Complement: TTTACCCGT → TTT ACC CGT
      // Actually: A→T, T→A, G→C, G→C, G→C, T→A, A→T, A→T, A→T
      // ATGGGTAAA → complement TACCCTATT, then reverse → TTATCCCTA
      // Hmm, let me be more careful:
      // reverseComplement reverses first, then complements
      // ATGGGTAAA → reverse → AAATGGGTA → complement → TTTACCCGT
      // Wait no, looking at the dna.js function, it does:
      // - iterate from end to start
      // - apply complement
      // So: A(8)→T, A(7)→T, A(6)→T, T(5)→A, G(4)→C, G(3)→C, G(2)→C, T(1)→A, A(0)→T
      // Result: TTTACCCGT
      // Not quite... let me check more carefully
      // ATGGGTAAA has length 9, indices 0-8
      // i=8: A → T
      // i=7: A → T
      // i=6: A → T
      // i=5: T → A
      // i=4: G → C
      // i=3: G → C
      // i=2: G → C (wait G at position 2 is actually G)
      // Let me spell out: A T G G G T A A A (positions 0-8)
      // Position: 0=A, 1=T, 2=G, 3=G, 4=G, 5=T, 6=A, 7=A, 8=A
      // Reverse complement iterates from 8 to 0:
      // 8:A→T, 7:A→T, 6:A→T, 5:T→A, 4:G→C, 3:G→C, 2:G→C, 1:T→A, 0:A→T
      // Result: TTTACCCCAT? No wait: T T T A C C C A T
      // Hmm that's 9 chars: TTTACCCAT
      // Let me just use a sequence that I know the reverse complement of
      // ATG → CAT (reverse complement)
      // So for sequence 'ATGGGTTAA' on minus strand:
      // Codons: CAT (M reverse), ... this is getting complicated

      // Let me use a simpler test case
      // Sequence on plus strand: CAT (0..3)
      // Reverse complement of CAT: ATG
      // So minus strand CDS of "CAT" should translate as M

      editorState = createMockEditorState('CATGGGTAA')

      const annotations = ref([
        new Annotation({
          id: 'cds1',
          type: 'CDS',
          span: '(0..3)', // Minus strand, CAT → rev comp → ATG = M
          caption: 'TestCDS'
        })
      ])

      const { elementsByLine } = useTranslation(editorState, graphics, annotations)
      const elements = elementsByLine.value.get(0)

      expect(elements).toHaveLength(1)
      expect(elements[0].aminoAcid).toBe('M')
    })
  })

  describe('multi-line splitting', () => {
    it('splits translation across multiple lines', () => {
      // Create a sequence that spans multiple lines
      // Zoom = 10 bases per line, sequence = 30 bases (3 lines)
      editorState.zoomLevel.value = 10
      editorState.sequence.value = 'ATGGGTAAAATGGGTAAAATGGGTAAAAAA' // 30 bases
      editorState.sequenceLength.value = 30

      const annotations = ref([
        new Annotation({
          id: 'cds1',
          type: 'CDS',
          span: '0..30',
          caption: 'TestCDS'
        })
      ])

      const { elementsByLine } = useTranslation(editorState, graphics, annotations)

      // Should have elements on multiple lines
      expect(elementsByLine.value.has(0)).toBe(true)
      expect(elementsByLine.value.has(1)).toBe(true)
      expect(elementsByLine.value.has(2)).toBe(true)

      // Line 0: positions 0-9, codons at 0, 3, 6, 9 (but 9 is incomplete on this line)
      // Actually codons are at: 0-2, 3-5, 6-8, 9-11...
      // Line 0 has positions 0-9, so complete codons: 0-2, 3-5, 6-8
      const line0 = elementsByLine.value.get(0)
      expect(line0.length).toBe(3)
    })
  })

  describe('multiple CDS annotations', () => {
    it('handles multiple non-overlapping CDS annotations', () => {
      editorState = createMockEditorState('ATGGGTAAAATGGGTAAA') // 18 bases

      const annotations = ref([
        new Annotation({
          id: 'cds1',
          type: 'CDS',
          span: '0..9', // ATG GGT AAA = M G K
          caption: 'CDS1'
        }),
        new Annotation({
          id: 'cds2',
          type: 'CDS',
          span: '9..18', // ATG GGT AAA = M G K
          caption: 'CDS2'
        })
      ])

      const { elementsByLine } = useTranslation(editorState, graphics, annotations)
      const elements = elementsByLine.value.get(0)

      // 6 amino acids total (3 from each CDS)
      expect(elements).toHaveLength(6)
    })
  })
})
