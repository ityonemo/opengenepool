import { describe, it, expect, beforeEach } from 'bun:test'
import { mount } from '@vue/test-utils'
import SequenceEditor from './SequenceEditor.vue'
import { Annotation } from '../utils/annotation.js'
import { STORAGE_KEY } from '../composables/usePersistedZoom.js'

describe('SequenceEditor', () => {
  // Clear persisted zoom before each test so initialZoom prop takes effect
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
  })
  describe('initial state', () => {
    it('renders empty state when no sequence', () => {
      const wrapper = mount(SequenceEditor)
      expect(wrapper.text()).toContain('No sequence loaded')
    })

    it('has default zoom level of 100 (clamped to 50 minimum without sequence)', () => {
      const wrapper = mount(SequenceEditor)
      // Without a sequence, zoom is clamped to minimum of 50
      expect(wrapper.vm.editorState.zoomLevel.value).toBe(50)
    })

    it('uses initial zoom when sequence supports it', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(500))
      await wrapper.vm.$nextTick()
      wrapper.vm.setZoom(100)
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.editorState.zoomLevel.value).toBe(100)
    })

    it('accepts custom initial zoom', () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 50 }
      })
      expect(wrapper.vm.editorState.zoomLevel.value).toBe(50)
    })

    it('emits ready event on mount', async () => {
      const wrapper = mount(SequenceEditor)
      await wrapper.vm.$nextTick()
      expect(wrapper.emitted('ready')).toBeTruthy()
    })
  })

  describe('setSequence', () => {
    it('loads a sequence via setSequence method', async () => {
      const wrapper = mount(SequenceEditor)

      wrapper.vm.setSequence('ATCGATCG', 'Test Sequence')
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).not.toContain('No sequence loaded')
      expect(wrapper.text()).toContain('8 bp')
      expect(wrapper.text()).toContain('Test Sequence')
    })

    it('returns sequence via getSequence', () => {
      const wrapper = mount(SequenceEditor)
      const seq = 'ATCGATCG'

      wrapper.vm.setSequence(seq)

      expect(wrapper.vm.getSequence()).toBe(seq)
    })
  })

  describe('SVG rendering', () => {
    it('renders SVG element', () => {
      const wrapper = mount(SequenceEditor)
      expect(wrapper.find('svg').exists()).toBe(true)
    })

    it('renders sequence lines when sequence is set', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 50 }
      })

      wrapper.vm.setSequence('A'.repeat(150))
      await wrapper.vm.$nextTick()

      // 150 / 50 = 3 lines
      const lines = wrapper.findAll('.sequence-line')
      expect(lines).toHaveLength(3)
    })

    it('renders position labels', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 50 }
      })

      wrapper.vm.setSequence('A'.repeat(150))
      await wrapper.vm.$nextTick()

      const labels = wrapper.findAll('.position-label')
      expect(labels).toHaveLength(3)
      expect(labels[0].text()).toBe('1')
      expect(labels[1].text()).toBe('51')
      expect(labels[2].text()).toBe('101')
    })
  })

  describe('zoom controls', () => {
    it('renders zoom selector', () => {
      const wrapper = mount(SequenceEditor)
      expect(wrapper.find('select').exists()).toBe(true)
    })

    it('changes zoom level when selector changes', async () => {
      const wrapper = mount(SequenceEditor)
      wrapper.vm.setSequence('A'.repeat(1000))
      await wrapper.vm.$nextTick()

      wrapper.vm.setZoom(200)
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.editorState.zoomLevel.value).toBe(200)
    })

    it('updates line count when zoom changes', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 50 }
      })
      wrapper.vm.setSequence('A'.repeat(500))
      await wrapper.vm.$nextTick()

      // At zoom 50, 500 bases = 10 lines
      expect(wrapper.vm.editorState.lineCount.value).toBe(10)

      wrapper.vm.setZoom(100)
      await wrapper.vm.$nextTick()

      // At zoom 100, 500 bases = 5 lines
      expect(wrapper.vm.editorState.lineCount.value).toBe(5)
    })
  })

  describe('selection', () => {
    it('getSelection returns null initially', () => {
      const wrapper = mount(SequenceEditor)
      expect(wrapper.vm.getSelection()).toBe(null)
    })

    it('can programmatically set selection via editorState', async () => {
      const wrapper = mount(SequenceEditor)
      wrapper.vm.setSequence('ATCGATCGATCG')
      await wrapper.vm.$nextTick()

      wrapper.vm.editorState.setSelection(2, 8)
      await wrapper.vm.$nextTick()

      const sel = wrapper.vm.getSelection()
      expect(sel).toEqual({ start: 2, end: 8 })
    })

    it('renders selection highlight when selection exists', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 50 }
      })
      wrapper.vm.setSequence('A'.repeat(100))
      await wrapper.vm.$nextTick()

      wrapper.vm.editorState.setSelection(10, 40)
      await wrapper.vm.$nextTick()

      const highlight = wrapper.find('.selection-highlight')
      expect(highlight.exists()).toBe(true)
    })
  })

  describe('text vs bar mode', () => {
    it('uses text mode at low zoom levels', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 50 }
      })
      // Force text mode by setting large container
      wrapper.vm.graphics.setContainerSize(1000, 600)
      wrapper.vm.setSequence('ATCGATCG')
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.graphics.metrics.value.textMode).toBe(true)
    })
  })

  describe('composables integration', () => {
    it('provides editorState to child components', () => {
      const wrapper = mount(SequenceEditor)
      expect(wrapper.vm.editorState).toBeDefined()
      expect(wrapper.vm.editorState.sequence).toBeDefined()
    })

    it('provides graphics to child components', () => {
      const wrapper = mount(SequenceEditor)
      expect(wrapper.vm.graphics).toBeDefined()
      expect(wrapper.vm.graphics.metrics).toBeDefined()
    })
  })

  describe('keyboard input', () => {
    it('inserts DNA bases on keypress', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('ATCG')
      wrapper.vm.editorState.setCursor(2)
      await wrapper.vm.$nextTick()

      await wrapper.find('.editor-svg').trigger('keydown', { key: 'G' })
      expect(wrapper.vm.getSequence()).toBe('ATGCG')
    })

    it('handles backspace', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('ATCG')
      wrapper.vm.editorState.setCursor(2)
      await wrapper.vm.$nextTick()

      await wrapper.find('.editor-svg').trigger('keydown', { key: 'Backspace' })
      expect(wrapper.vm.getSequence()).toBe('ACG')
    })

    it('handles delete key', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('ATCG')
      wrapper.vm.editorState.setCursor(1)
      await wrapper.vm.$nextTick()

      await wrapper.find('.editor-svg').trigger('keydown', { key: 'Delete' })
      expect(wrapper.vm.getSequence()).toBe('ACG')
    })

    it('moves cursor left with ArrowLeft', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('ATCG')
      wrapper.vm.editorState.setCursor(3)
      await wrapper.vm.$nextTick()

      await wrapper.find('.editor-svg').trigger('keydown', { key: 'ArrowLeft' })
      expect(wrapper.vm.editorState.cursor.value).toBe(2)
    })

    it('moves cursor right with ArrowRight', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('ATCG')
      wrapper.vm.editorState.setCursor(1)
      await wrapper.vm.$nextTick()

      await wrapper.find('.editor-svg').trigger('keydown', { key: 'ArrowRight' })
      expect(wrapper.vm.editorState.cursor.value).toBe(2)
    })

    it('ignores non-DNA characters', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('ATCG')
      wrapper.vm.editorState.setCursor(2)
      await wrapper.vm.$nextTick()

      await wrapper.find('.editor-svg').trigger('keydown', { key: 'X' })
      expect(wrapper.vm.getSequence()).toBe('ATCG') // unchanged
    })

    it('emits edit event when sequence changes', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('ATCG')
      wrapper.vm.editorState.setCursor(2)
      await wrapper.vm.$nextTick()

      await wrapper.find('.editor-svg').trigger('keydown', { key: 'G' })
      expect(wrapper.emitted('edit')).toBeTruthy()
    })
  })

  describe('cursor rendering', () => {
    it('renders cursor element when sequence exists', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('ATCGATCG')
      await wrapper.vm.$nextTick()

      const cursor = wrapper.find('.cursor')
      expect(cursor.exists()).toBe(true)
    })

    it('positions cursor at correct line', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 50 }
      })
      wrapper.vm.setSequence('A'.repeat(150))
      wrapper.vm.editorState.setCursor(75) // middle of second line
      await wrapper.vm.$nextTick()

      // Cursor should be on line 1 (75 / 50 = 1.5 -> line 1)
      const cursor = wrapper.find('.cursor')
      expect(cursor.exists()).toBe(true)
    })

    it('does not render cursor when no sequence', () => {
      const wrapper = mount(SequenceEditor)
      const cursor = wrapper.find('.cursor')
      expect(cursor.exists()).toBe(false)
    })
  })

  describe('annotations', () => {
    it('renders AnnotationLayer when annotations provided', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })

      wrapper.vm.setSequence('A'.repeat(500))
      await wrapper.vm.$nextTick()

      const annotation = new Annotation({
        id: 'ann1',
        caption: 'GFP',
        type: 'gene',
        span: '10..50'
      })

      await wrapper.setProps({ annotations: [annotation] })
      await wrapper.vm.$nextTick()

      const layer = wrapper.findComponent({ name: 'AnnotationLayer' })
      expect(layer.exists()).toBe(true)
    })

    it('does not render AnnotationLayer when no annotations', async () => {
      const wrapper = mount(SequenceEditor, {
        props: {
          initialZoom: 100,
          annotations: []
        }
      })

      wrapper.vm.setSequence('A'.repeat(500))
      await wrapper.vm.$nextTick()

      const layer = wrapper.findComponent({ name: 'AnnotationLayer' })
      expect(layer.exists()).toBe(false)
    })

    it('passes showAnnotationCaptions prop to AnnotationLayer', async () => {
      const annotation = new Annotation({
        id: 'ann1',
        caption: 'GFP',
        type: 'gene',
        span: '10..60'
      })

      const wrapper = mount(SequenceEditor, {
        props: {
          initialZoom: 100,
          annotations: [annotation],
          showAnnotationCaptions: false
        }
      })

      wrapper.vm.setSequence('A'.repeat(500))
      await wrapper.vm.$nextTick()

      const layer = wrapper.findComponent({ name: 'AnnotationLayer' })
      expect(layer.props('showCaptions')).toBe(false)
    })

    it('emits annotation-click event', async () => {
      const annotation = new Annotation({
        id: 'ann1',
        caption: 'GFP',
        type: 'gene',
        span: '10..50'
      })

      const wrapper = mount(SequenceEditor, {
        props: {
          initialZoom: 100,
          annotations: [annotation]
        }
      })

      wrapper.vm.setSequence('A'.repeat(500))
      await wrapper.vm.$nextTick()

      const layer = wrapper.findComponent({ name: 'AnnotationLayer' })
      layer.vm.$emit('click', { annotation, fragment: {} })

      expect(wrapper.emitted('annotation-click')).toBeTruthy()
    })
  })

  describe('config panel', () => {
    const HIDDEN_TYPES_KEY = 'opengenepool-hidden-annotation-types'

    beforeEach(() => {
      localStorage.removeItem(HIDDEN_TYPES_KEY)
    })

    it('renders config gear button', () => {
      const wrapper = mount(SequenceEditor)
      expect(wrapper.find('.config-button').exists()).toBe(true)
    })

    it('config panel is hidden by default', () => {
      const wrapper = mount(SequenceEditor)
      expect(wrapper.find('.config-panel').exists()).toBe(false)
    })

    it('opens config panel when clicking gear button', async () => {
      const wrapper = mount(SequenceEditor)
      await wrapper.find('.config-button').trigger('click')
      expect(wrapper.find('.config-panel').exists()).toBe(true)
    })

    it('closes config panel when clicking gear button again', async () => {
      const wrapper = mount(SequenceEditor)
      await wrapper.find('.config-button').trigger('click')
      expect(wrapper.find('.config-panel').exists()).toBe(true)

      await wrapper.find('.config-button').trigger('click')
      expect(wrapper.find('.config-panel').exists()).toBe(false)
    })

    it('shows annotation types when annotations exist', async () => {
      const annotations = [
        new Annotation({ id: 'ann1', type: 'gene', span: '10..50' }),
        new Annotation({ id: 'ann2', type: 'promoter', span: '60..80' })
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations }
      })
      wrapper.vm.setSequence('A'.repeat(500))
      await wrapper.vm.$nextTick()

      await wrapper.find('.config-button').trigger('click')

      const typeNames = wrapper.findAll('.type-name')
      expect(typeNames.length).toBe(2)
      expect(typeNames.map(t => t.text()).sort()).toEqual(['gene', 'promoter'])
    })

    it('shows "No annotations" when no annotations exist', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { annotations: [] }
      })
      await wrapper.find('.config-button').trigger('click')
      expect(wrapper.find('.config-empty').text()).toBe('No annotations')
    })

    it('hides annotations when type is unchecked', async () => {
      const annotations = [
        new Annotation({ id: 'ann1', type: 'gene', span: '10..50' }),
        new Annotation({ id: 'ann2', type: 'promoter', span: '60..80' })
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(500))
      await wrapper.vm.$nextTick()

      // Initially both visible
      let layer = wrapper.findComponent({ name: 'AnnotationLayer' })
      expect(layer.props('annotations').length).toBe(2)

      // Open config and uncheck 'gene'
      await wrapper.find('.config-button').trigger('click')
      const checkboxes = wrapper.findAll('.type-row input[type="checkbox"]')
      const geneRow = wrapper.findAll('.type-row').find(r => r.text().includes('gene'))
      await geneRow.find('input[type="checkbox"]').trigger('change')

      await wrapper.vm.$nextTick()

      // Now only promoter should be visible
      layer = wrapper.findComponent({ name: 'AnnotationLayer' })
      expect(layer.props('annotations').length).toBe(1)
      expect(layer.props('annotations')[0].type).toBe('promoter')
    })

    it('Hide All button hides all annotation types', async () => {
      const annotations = [
        new Annotation({ id: 'ann1', type: 'gene', span: '10..50' }),
        new Annotation({ id: 'ann2', type: 'promoter', span: '60..80' })
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(500))
      await wrapper.vm.$nextTick()

      await wrapper.find('.config-button').trigger('click')
      await wrapper.find('.config-actions button:last-child').trigger('click')
      await wrapper.vm.$nextTick()

      // AnnotationLayer should not render when all types hidden
      const layer = wrapper.findComponent({ name: 'AnnotationLayer' })
      expect(layer.exists()).toBe(false)
    })

    it('Show All button shows all annotation types', async () => {
      const annotations = [
        new Annotation({ id: 'ann1', type: 'gene', span: '10..50' }),
        new Annotation({ id: 'ann2', type: 'promoter', span: '60..80' })
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(500))
      await wrapper.vm.$nextTick()

      // Hide all first
      await wrapper.find('.config-button').trigger('click')
      await wrapper.find('.config-actions button:last-child').trigger('click')
      await wrapper.vm.$nextTick()

      // Now show all
      await wrapper.find('.config-actions button:first-child').trigger('click')
      await wrapper.vm.$nextTick()

      const layer = wrapper.findComponent({ name: 'AnnotationLayer' })
      expect(layer.props('annotations').length).toBe(2)
    })

    it('hides source type by default', async () => {
      const annotations = [
        new Annotation({ id: 'ann1', type: 'source', span: '1..500' }),
        new Annotation({ id: 'ann2', type: 'gene', span: '10..50' })
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(500))
      await wrapper.vm.$nextTick()

      // source should be hidden by default, only gene visible
      const layer = wrapper.findComponent({ name: 'AnnotationLayer' })
      expect(layer.props('annotations').length).toBe(1)
      expect(layer.props('annotations')[0].type).toBe('gene')
    })

    it('persists hidden types to localStorage', async () => {
      const annotations = [
        new Annotation({ id: 'ann1', type: 'gene', span: '10..50' }),
        new Annotation({ id: 'ann2', type: 'promoter', span: '60..80' })
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(500))
      await wrapper.vm.$nextTick()

      // Hide gene type
      await wrapper.find('.config-button').trigger('click')
      const geneRow = wrapper.findAll('.type-row').find(r => r.text().includes('gene'))
      await geneRow.find('input[type="checkbox"]').trigger('change')
      await wrapper.vm.$nextTick()

      // Check localStorage
      const stored = JSON.parse(localStorage.getItem(HIDDEN_TYPES_KEY))
      expect(stored).toContain('gene')
    })

    it('loads hidden types from localStorage', async () => {
      // Pre-set localStorage to hide 'gene'
      localStorage.setItem(HIDDEN_TYPES_KEY, JSON.stringify(['gene']))

      const annotations = [
        new Annotation({ id: 'ann1', type: 'gene', span: '10..50' }),
        new Annotation({ id: 'ann2', type: 'promoter', span: '60..80' })
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(500))
      await wrapper.vm.$nextTick()

      // Gene should be hidden based on localStorage
      const layer = wrapper.findComponent({ name: 'AnnotationLayer' })
      expect(layer.props('annotations').length).toBe(1)
      expect(layer.props('annotations')[0].type).toBe('promoter')
    })

    it('renders color swatch for each annotation type', async () => {
      const annotations = [
        new Annotation({ id: 'ann1', type: 'promoter', span: '10..50' })
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations }
      })
      wrapper.vm.setSequence('A'.repeat(500))
      await wrapper.vm.$nextTick()

      await wrapper.find('.config-button').trigger('click')

      const swatch = wrapper.find('.type-swatch')
      expect(swatch.exists()).toBe(true)

      // Check that the rect has inline fill from persisted colors
      const rect = swatch.find('rect')
      expect(rect.exists()).toBe(true)

      // Promoter color should be orange (#FF9800)
      expect(rect.attributes('fill')).toBe('#FF9800')
    })
  })

  describe('color persistence', () => {
    const COLORS_KEY = 'opengenepool-annotation-colors'

    beforeEach(() => {
      localStorage.removeItem(COLORS_KEY)
    })

    it('saves default colors to localStorage on first load', async () => {
      const annotations = [
        new Annotation({ id: 'ann1', type: 'gene', span: '10..50' })
      ]

      // No colors in localStorage yet
      expect(localStorage.getItem(COLORS_KEY)).toBeNull()

      mount(SequenceEditor, {
        props: { annotations }
      })

      // After mount, defaults should be saved to localStorage
      const stored = JSON.parse(localStorage.getItem(COLORS_KEY))
      expect(stored).not.toBeNull()
      expect(stored.gene).toBe('#4CAF50')
      expect(stored.CDS).toBe('#2196F3')
      expect(stored.promoter).toBe('#FF9800')
      expect(stored._default).toBe('#607D8B')
    })

    it('loads colors from localStorage if present', async () => {
      // Pre-set custom colors in localStorage
      const customColors = {
        gene: '#FF0000',  // Red instead of green
        CDS: '#00FF00',   // Green instead of blue
        _default: '#000000'
      }
      localStorage.setItem(COLORS_KEY, JSON.stringify(customColors))

      const annotations = [
        new Annotation({ id: 'ann1', type: 'gene', span: '10..50' })
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations }
      })
      wrapper.vm.setSequence('A'.repeat(500))
      await wrapper.vm.$nextTick()

      // Check that annotation uses the custom color
      const layer = wrapper.findComponent({ name: 'AnnotationLayer' })
      const path = layer.find('.annotation-fragment path')
      expect(path.attributes('fill')).toBe('#FF0000')
    })

    it('merges stored colors with defaults for new types', async () => {
      // Pre-set only some colors (simulating an older version)
      const partialColors = {
        gene: '#FF0000'
        // Missing other types
      }
      localStorage.setItem(COLORS_KEY, JSON.stringify(partialColors))

      const annotations = [
        new Annotation({ id: 'ann1', type: 'promoter', span: '10..50' })
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations }
      })
      wrapper.vm.setSequence('A'.repeat(500))
      await wrapper.vm.$nextTick()

      // Promoter should use default color since it wasn't in stored colors
      const layer = wrapper.findComponent({ name: 'AnnotationLayer' })
      const path = layer.find('.annotation-fragment path')
      expect(path.attributes('fill')).toBe('#FF9800')
    })

    it('annotation layer uses default colors for unknown types', async () => {
      const annotations = [
        new Annotation({ id: 'ann1', type: 'unknown_custom_type', span: '10..50' })
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations }
      })
      wrapper.vm.setSequence('A'.repeat(500))
      await wrapper.vm.$nextTick()

      // Unknown type should use _default color
      const layer = wrapper.findComponent({ name: 'AnnotationLayer' })
      const path = layer.find('.annotation-fragment path')
      expect(path.attributes('fill')).toBe('#607D8B')
    })
  })

  describe('selection deselect behavior', () => {
    it('Escape key clears selection', async () => {
      const wrapper = mount(SequenceEditor)
      wrapper.vm.setSequence('ATCGATCGATCG')
      await wrapper.vm.$nextTick()

      // Create a selection via the selection layer
      const selectionLayer = wrapper.findComponent({ name: 'SelectionLayer' })
      const selection = selectionLayer.vm.selection
      selection.select('2..5')
      await wrapper.vm.$nextTick()

      expect(selection.isSelected.value).toBe(true)

      // Press Escape on the SVG
      const svg = wrapper.find('svg.editor-svg')
      await svg.trigger('keydown', { key: 'Escape' })

      expect(selection.isSelected.value).toBe(false)
    })

    it('clicking on SVG background clears selection', async () => {
      const wrapper = mount(SequenceEditor)
      wrapper.vm.setSequence('ATCGATCGATCG')
      await wrapper.vm.$nextTick()

      // Create a selection
      const selectionLayer = wrapper.findComponent({ name: 'SelectionLayer' })
      const selection = selectionLayer.vm.selection
      selection.select('2..5')
      await wrapper.vm.$nextTick()

      expect(selection.isSelected.value).toBe(true)

      // Click on the background rect (null space)
      const background = wrapper.find('.svg-background')
      await background.trigger('mousedown', { button: 0 })

      expect(selection.isSelected.value).toBe(false)
    })

    it('help button renders with tooltip', () => {
      const wrapper = mount(SequenceEditor)
      wrapper.vm.setSequence('ATCG')

      const helpButton = wrapper.find('.help-button')
      expect(helpButton.exists()).toBe(true)
      expect(helpButton.text()).toBe('?')

      // Check tooltip content
      const title = helpButton.attributes('title')
      expect(title).toContain('Click')
      expect(title).toContain('Escape')
      expect(title).toContain('Shift+Click')
      expect(title).toContain('Ctrl+Click')
    })
  })
})
