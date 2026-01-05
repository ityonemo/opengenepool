/**
 * OpenGenePool - DNA Sequence Editor
 * A Vue.js component library for viewing and editing DNA sequences.
 */

// Components
export { default as SequenceViewer } from './components/SequenceViewer.vue'

// Utilities
export {
  reverseComplement,
  Range,
  Span,
  Orientation
} from './utils/dna.js'
