import { computed } from 'vue'
import { translate } from '../utils/translation.js'
import { reverseComplement, Orientation, Span } from '../utils/dna.js'

/**
 * Translation composable for rendering amino acid sequences.
 * Computes layout elements for CDS annotations translation display.
 *
 * @param {Object} editorState - Editor state composable
 * @param {Object} graphics - Graphics composable
 * @param {Ref<Annotation[]>} cdsAnnotations - Ref to array of CDS annotations
 * @returns {Object} Translation layout information
 */
export function useTranslation(editorState, graphics, cdsAnnotations) {
  /**
   * Computed: Generate translation elements for all CDS annotations.
   * Groups by line for rendering.
   */
  const elementsByLine = computed(() => {
    const byLine = new Map()

    if (!editorState.zoomLevel.value) return byLine
    if (!cdsAnnotations.value || cdsAnnotations.value.length === 0) return byLine

    const sequence = editorState.sequence.value
    const zoom = editorState.zoomLevel.value
    const m = graphics.metrics.value

    for (const annotation of cdsAnnotations.value) {
      // Only process CDS annotations
      if (annotation.type?.toUpperCase() !== 'CDS') continue

      // Parse the span
      const span = typeof annotation.span === 'string'
        ? Span.parse(annotation.span)
        : annotation.span

      if (!span || span.ranges.length === 0) continue

      // For simplicity, handle single-range CDS
      // TODO: Handle join() CDS with multiple ranges
      const range = span.ranges[0]
      const isMinus = range.orientation === Orientation.MINUS

      // Extract the CDS sequence
      let cdsSequence = sequence.slice(range.start, range.end)
      if (isMinus) {
        cdsSequence = reverseComplement(cdsSequence)
      }

      // Get reading frame from codon_start attribute (GenBank uses 1-based)
      const codonStart = annotation.attributes?.codon_start || 1
      const frame = codonStart - 1

      // Translate the sequence
      const aminoAcids = translate(cdsSequence, frame)

      // Convert each amino acid to an element with position info
      const lastAaIndex = aminoAcids.length - 1
      for (let aaIndex = 0; aaIndex < aminoAcids.length; aaIndex++) {
        const aa = aminoAcids[aaIndex]
        // Calculate the absolute position in the original sequence
        let absolutePos
        if (isMinus) {
          // For minus strand, positions go in reverse
          // aa.position is relative to the reverse-complemented sequence
          // Codon center in the reversed sequence: aa.position + 1.5 (middle of 3-base codon)
          // Map back to original: range.end - 1 - (aa.position + frame) = position of last base of codon
          // Actually, the center should be at: range.end - (aa.position + frame + 1.5)
          absolutePos = range.end - (aa.position + frame + 1.5)
        } else {
          // Plus strand: position is relative to range.start
          // Codon center: aa.position + 1.5 (middle of 3-base codon)
          absolutePos = range.start + aa.position + 1.5
        }

        // Calculate which line this element belongs to
        const lineIndex = Math.floor(absolutePos / zoom)

        // Calculate the position within the line
        const posInLine = absolutePos - (lineIndex * zoom)

        // Calculate x coordinate
        const x = m.lmargin + posInLine * m.charWidth

        // Get gene name from annotation (try gene attribute, then label, caption, product, name)
        const geneName = annotation.attributes?.gene ||
                         annotation.attributes?.label ||
                         annotation.caption ||
                         annotation.attributes?.product ||
                         annotation.name ||
                         'Unknown'

        // Calculate the absolute start/end positions of this codon
        // Note: aa.position already includes the frame offset
        let codonStart, codonEnd
        if (isMinus) {
          // For minus strand, the codon is at the end of the range, going backwards
          codonEnd = range.end - aa.position
          codonStart = codonEnd - 3
        } else {
          // For plus strand, codon starts at range.start + position
          codonStart = range.start + aa.position
          codonEnd = codonStart + 3
        }

        const element = {
          aminoAcid: aa.aminoAcid,
          isStart: aa.isStart,
          isStop: aa.isStop,
          x,
          lineIndex,
          annotationId: annotation.id,
          codon: aa.codon,
          orientation: isMinus ? -1 : 1,  // -1 for minus strand, 1 for plus strand
          isFirstCodon: aaIndex === 0,  // First codon in translation
          isLastCodon: aaIndex === lastAaIndex,  // Last codon in translation
          aaIndex: aaIndex + 1,  // 1-based amino acid index for display
          geneName,
          codonStart,  // Absolute position of codon start
          codonEnd     // Absolute position of codon end
        }

        if (!byLine.has(lineIndex)) {
          byLine.set(lineIndex, [])
        }
        byLine.get(lineIndex).push(element)
      }
    }

    return byLine
  })

  return {
    elementsByLine
  }
}
