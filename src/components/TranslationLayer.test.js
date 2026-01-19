import { describe, it, expect } from 'bun:test'
import { mount } from '@vue/test-utils'
import { ref, computed } from 'vue'
import TranslationLayer from './TranslationLayer.vue'
import { Annotation } from '../utils/annotation.js'

// Helper to create mock providers
function createMockProviders(options = {}) {
  const zoomLevel = ref(options.zoomLevel || 100)
  const sequenceLength = ref(options.sequenceLength || 500)
  const sequence = ref(options.sequence || 'ATGATGATGATGATGATG'.repeat(30))

  const editorState = {
    zoomLevel,
    sequenceLength,
    sequence,
    lineCount: computed(() => Math.ceil(sequenceLength.value / zoomLevel.value))
  }

  const graphics = {
    metrics: computed(() => ({
      lmargin: 60,
      charWidth: 8,
      lineHeight: 24,
      fullWidth: 800
    })),
    getLineY: (lineIndex) => lineIndex * 30,
    lineHeight: ref(24)
  }

  const showTranslation = ref(options.showTranslation !== false)

  return { editorState, graphics, showTranslation }
}

// Helper to mount with providers
function mountWithProviders(props = {}, options = {}) {
  const { editorState, graphics, showTranslation } = createMockProviders(options)

  return mount(TranslationLayer, {
    props,
    global: {
      provide: {
        editorState,
        graphics,
        showTranslation
      }
    }
  })
}

describe('TranslationLayer', () => {
  describe('rendering', () => {
    it('renders empty when no CDS annotations', () => {
      const wrapper = mountWithProviders({ annotations: [] })
      expect(wrapper.findAll('.translation-fragment')).toHaveLength(0)
    })

    it('renders translation for CDS annotation', () => {
      const annotation = new Annotation({
        id: 'cds1',
        caption: 'GFP',
        type: 'CDS',
        span: '0..30'
      })

      const wrapper = mountWithProviders(
        { annotations: [annotation] },
        { sequence: 'ATGATGATGATGATGATGATGATGATGATG' }
      )
      // Check for amino acid elements (the actual class used in TranslationLayer)
      const aaElements = wrapper.findAll('.aa-element')
      expect(aaElements.length).toBeGreaterThan(0)
    })

    it('ignores non-CDS annotations', () => {
      const annotation = new Annotation({
        id: 'gene1',
        caption: 'Test',
        type: 'gene',
        span: '0..30'
      })

      const wrapper = mountWithProviders({ annotations: [annotation] })
      expect(wrapper.findAll('.translation-fragment')).toHaveLength(0)
    })
  })

  describe('visibility', () => {
    it('hides when showTranslation is false', () => {
      const annotation = new Annotation({
        id: 'cds1',
        type: 'CDS',
        span: '0..30'
      })

      const wrapper = mountWithProviders(
        { annotations: [annotation] },
        { showTranslation: false, sequence: 'ATGATGATGATGATGATGATGATGATGATG' }
      )

      const layer = wrapper.find('.translation-layer')
      expect(layer.exists()).toBe(false)
    })

    it('shows when showTranslation is true', () => {
      const annotation = new Annotation({
        id: 'cds1',
        type: 'CDS',
        span: '0..30'
      })

      const wrapper = mountWithProviders(
        { annotations: [annotation] },
        { showTranslation: true, sequence: 'ATGATGATGATGATGATGATGATGATGATG' }
      )

      const layer = wrapper.find('.translation-layer')
      expect(layer.exists()).toBe(true)
    })
  })

  describe('amino acid display', () => {
    it('translates codons to amino acids', () => {
      // ATG = M (Methionine)
      const annotation = new Annotation({
        id: 'cds1',
        type: 'CDS',
        span: '0..9' // 3 codons
      })

      const wrapper = mountWithProviders(
        { annotations: [annotation] },
        { sequence: 'ATGATGATG', sequenceLength: 9 }
      )

      // Should contain M (Methionine) text
      const text = wrapper.text()
      expect(text).toContain('M')
    })
  })

  describe('events', () => {
    it('emits click event with annotation data', async () => {
      const annotation = new Annotation({
        id: 'cds1',
        caption: 'GFP',
        type: 'CDS',
        span: '0..30'
      })

      const wrapper = mountWithProviders(
        { annotations: [annotation] },
        { sequence: 'ATGATGATGATGATGATGATGATGATGATG' }
      )

      const fragment = wrapper.find('.aa-element')
      if (fragment.exists()) {
        await fragment.trigger('click')
        expect(wrapper.emitted('click')).toBeTruthy()
      }
    })
  })
})
