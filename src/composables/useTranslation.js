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

      // Determine orientation from first range
      const isMinus = span.ranges[0].orientation === Orientation.MINUS

      // Build concatenated CDS sequence and position mapping
      // For plus strand: ranges are in 5' to 3' order
      // For minus strand: ranges are in 3' to 5' order (reverse for coding)
      const ranges = isMinus ? [...span.ranges].reverse() : span.ranges

      // Build position map: for each position in concatenated sequence,
      // store absolutePos to map back to original coordinates
      let cdsSequence = ''
      const positionMap = []  // positionMap[concatPos] = absolutePos in original sequence

      for (const range of ranges) {
        const rangeSeq = sequence.slice(range.start, range.end)
        for (let i = 0; i < rangeSeq.length; i++) {
          // Position in original sequence (before any reverse complement)
          positionMap.push(range.start + i)
        }
        cdsSequence += rangeSeq
      }

      // Reverse complement for minus strand
      if (isMinus) {
        cdsSequence = reverseComplement(cdsSequence)
      }

      // Get reading frame from codon_start attribute (GenBank uses 1-based)
      const codonStartAttr = annotation.attributes?.codon_start || 1
      const frame = codonStartAttr - 1

      // Translate the concatenated sequence
      const aminoAcids = translate(cdsSequence, frame)

      // Get gene name from annotation
      const geneName = annotation.attributes?.gene ||
                       annotation.attributes?.label ||
                       annotation.caption ||
                       annotation.attributes?.product ||
                       annotation.name ||
                       'Unknown'

      // Convert each amino acid to an element with position info
      const lastAaIndex = aminoAcids.length - 1
      for (let aaIndex = 0; aaIndex < aminoAcids.length; aaIndex++) {
        const aa = aminoAcids[aaIndex]

        // Calculate position in concatenated sequence (middle of codon)
        // aa.position is the start of the codon in the (possibly reverse-complemented) sequence
        const codonStartInConcat = aa.position
        const codonCenterInConcat = codonStartInConcat + 1.5

        // Map back to absolute position
        let absolutePos
        let codonStart, codonEnd
        const mapLen = positionMap.length

        if (isMinus) {
          // For minus strand after reverse complement:
          // Position i in rev-comp sequence came from position (mapLen - 1 - i) in original concat
          // Codon at rev-comp positions [p, p+2] came from concat positions [mapLen-1-p-2, mapLen-1-p]
          const concatCodonEnd = mapLen - 1 - codonStartInConcat
          const concatCodonStart = mapLen - 1 - (codonStartInConcat + 2)

          // Get absolute positions from position map
          const startIdx = Math.max(0, Math.min(concatCodonStart, mapLen - 1))
          const endIdx = Math.max(0, Math.min(concatCodonEnd, mapLen - 1))

          codonStart = positionMap[startIdx]
          codonEnd = positionMap[endIdx] + 1

          // Center position for display
          const concatCenter = mapLen - 1 - codonCenterInConcat
          const centerIdx = Math.max(0, Math.min(Math.floor(concatCenter), mapLen - 1))
          absolutePos = positionMap[centerIdx] + 0.5
        } else {
          // Plus strand: direct mapping
          const centerIdx = Math.min(Math.floor(codonCenterInConcat), mapLen - 1)
          absolutePos = positionMap[centerIdx] + 0.5

          // Codon boundaries
          codonStart = positionMap[Math.min(Math.floor(codonStartInConcat), mapLen - 1)]
          codonEnd = positionMap[Math.min(Math.floor(codonStartInConcat + 2), mapLen - 1)] + 1
        }

        // Calculate which line this element belongs to
        const lineIndex = Math.floor(absolutePos / zoom)

        // Calculate the position within the line
        const posInLine = absolutePos - (lineIndex * zoom)

        // Calculate x coordinate
        const x = m.lmargin + posInLine * m.charWidth

        const element = {
          aminoAcid: aa.aminoAcid,
          isStart: aa.isStart,
          isStop: aa.isStop,
          x,
          lineIndex,
          annotationId: annotation.id,
          codon: aa.codon,
          orientation: isMinus ? -1 : 1,
          isFirstCodon: aaIndex === 0,
          isLastCodon: aaIndex === lastAaIndex,
          aaIndex: aaIndex + 1,
          geneName,
          codonStart,
          codonEnd
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
