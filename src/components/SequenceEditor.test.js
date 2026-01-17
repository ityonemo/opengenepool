import { describe, it, expect, beforeEach, mock } from 'bun:test'
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
      expect(labels[0].text()).toBe('0')
      expect(labels[1].text()).toBe('50')
      expect(labels[2].text()).toBe('100')
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

    it('can programmatically set selection via selection composable', async () => {
      const wrapper = mount(SequenceEditor)
      wrapper.vm.setSequence('ATCGATCGATCG')
      await wrapper.vm.$nextTick()

      // Get the selection composable from the SelectionLayer
      const selectionLayer = wrapper.findComponent({ name: 'SelectionLayer' })
      const selection = selectionLayer.vm.selection
      selection.select('2..8')
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

      // Get the selection composable from the SelectionLayer
      const selectionLayer = wrapper.findComponent({ name: 'SelectionLayer' })
      const selection = selectionLayer.vm.selection
      selection.select('10..40')
      await wrapper.vm.$nextTick()

      const highlight = wrapper.find('.selection-highlight')
      expect(highlight.exists()).toBe(true)
    })

    it('adds a new range with Ctrl+click+drag', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(200))
      await wrapper.vm.$nextTick()

      // Get the selection composable
      const selection = wrapper.vm.$refs?.selectionLayerRef?.selection
        || wrapper.findComponent({ name: 'SelectionLayer' }).vm.selection

      // Create initial selection at positions 10-20
      selection.select('10..20')
      await wrapper.vm.$nextTick()

      expect(selection.isSelected.value).toBe(true)
      expect(selection.domain.value.ranges).toHaveLength(1)
      expect(selection.domain.value.ranges[0].start).toBe(10)
      expect(selection.domain.value.ranges[0].end).toBe(20)

      // Ctrl+click at position 50 to add a new range
      selection.startSelection(50, true)
      await wrapper.vm.$nextTick()

      // Should now have 2 ranges
      expect(selection.domain.value.ranges).toHaveLength(2)
      expect(selection.domain.value.ranges[0].start).toBe(10)
      expect(selection.domain.value.ranges[0].end).toBe(20)
      expect(selection.domain.value.ranges[1].start).toBe(50)
      expect(selection.domain.value.ranges[1].end).toBe(50)

      // Simulate drag to position 70
      selection.updateSelection(70)
      await wrapper.vm.$nextTick()

      // Second range should now be 50-70
      expect(selection.domain.value.ranges[1].start).toBe(50)
      expect(selection.domain.value.ranges[1].end).toBe(70)
    })

    it('adds a new range via mouse events with Ctrl key', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(200))
      wrapper.vm.graphics.setContainerSize(1000, 600)
      await wrapper.vm.$nextTick()

      // Get the selection composable
      const selection = wrapper.findComponent({ name: 'SelectionLayer' }).vm.selection

      // Create initial selection at positions 10-20
      selection.select('10..20')
      await wrapper.vm.$nextTick()

      expect(selection.isSelected.value).toBe(true)
      expect(selection.domain.value.ranges).toHaveLength(1)

      // Find the sequence overlay and trigger Ctrl+mousedown
      const overlay = wrapper.find('.sequence-overlay')

      await overlay.trigger('mousedown', {
        button: 0,
        ctrlKey: true,
        clientX: 500,  // Somewhere in the middle
        clientY: 20
      })
      await wrapper.vm.$nextTick()

      // Check if a new range was added
      expect(selection.domain.value.ranges.length).toBeGreaterThanOrEqual(2)
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
    it('opens insert modal on DNA base keypress', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('ATCG')
      wrapper.vm.editorState.setCursor(2)
      await wrapper.vm.$nextTick()

      await wrapper.find('.editor-svg').trigger('keydown', { key: 'G' })
      await wrapper.vm.$nextTick()

      // Modal should open with the pressed key as initial text
      expect(wrapper.find('.modal-overlay').exists()).toBe(true)
      expect(wrapper.find('.modal-input').element.value).toBe('G')
    })

    it('handles backspace with selection', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('ATCGATCG')
      await wrapper.vm.$nextTick()

      // Select positions 2..4 (indices 2,3 = 'CG')
      const selectionLayer = wrapper.findComponent({ name: 'SelectionLayer' })
      selectionLayer.vm.selection.select('2..4')
      await wrapper.vm.$nextTick()

      await wrapper.find('.editor-svg').trigger('keydown', { key: 'Backspace' })
      // 'ATCGATCG' with positions 2-4 deleted = 'AT' + 'ATCG' = 'ATATCG'
      expect(wrapper.vm.getSequence()).toBe('ATATCG')
    })

    it('backspace does nothing without selection', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('ATCG')
      wrapper.vm.editorState.setCursor(2)
      await wrapper.vm.$nextTick()

      await wrapper.find('.editor-svg').trigger('keydown', { key: 'Backspace' })
      // No change - backspace only works with non-zero selection
      expect(wrapper.vm.getSequence()).toBe('ATCG')
    })

    it('handles delete key with selection', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('ATCGATCG')
      await wrapper.vm.$nextTick()

      // Select positions 1..3 (indices 1,2 = 'TC')
      const selectionLayer = wrapper.findComponent({ name: 'SelectionLayer' })
      selectionLayer.vm.selection.select('1..3')
      await wrapper.vm.$nextTick()

      await wrapper.find('.editor-svg').trigger('keydown', { key: 'Delete' })
      // 'ATCGATCG' with positions 1-3 deleted = 'A' + 'GATCG' = 'AGATCG'
      expect(wrapper.vm.getSequence()).toBe('AGATCG')
    })

    it('delete does nothing without selection', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('ATCG')
      wrapper.vm.editorState.setCursor(1)
      await wrapper.vm.$nextTick()

      await wrapper.find('.editor-svg').trigger('keydown', { key: 'Delete' })
      // No change - delete only works with non-zero selection
      expect(wrapper.vm.getSequence()).toBe('ATCG')
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

    it('emits edit event when modal submits', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('ATCG')
      wrapper.vm.editorState.setCursor(2)
      await wrapper.vm.$nextTick()

      // Open modal with a DNA key
      await wrapper.find('.editor-svg').trigger('keydown', { key: 'G' })
      await wrapper.vm.$nextTick()

      // Submit the modal
      await wrapper.find('.btn-submit').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('edit')).toBeTruthy()
    })
  })

  describe('insert modal', () => {
    it('opens modal on DNA base keypress', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('ATCGATCG')
      await wrapper.vm.$nextTick()

      await wrapper.find('.editor-svg').trigger('keydown', { key: 'A' })
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    })

    it('closes modal on cancel', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('ATCGATCG')
      await wrapper.vm.$nextTick()

      await wrapper.find('.editor-svg').trigger('keydown', { key: 'A' })
      await wrapper.vm.$nextTick()

      await wrapper.find('.btn-cancel').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    })

    it('does not open modal when readonly', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100, readonly: true }
      })
      wrapper.vm.setSequence('ATCGATCG')
      await wrapper.vm.$nextTick()

      await wrapper.find('.editor-svg').trigger('keydown', { key: 'A' })
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    })

    it('does not open modal when multiple ranges are selected', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(200))
      await wrapper.vm.$nextTick()

      // Get the selection composable and create multiple ranges
      const selection = wrapper.findComponent({ name: 'SelectionLayer' }).vm.selection
      selection.select('10..20')
      await wrapper.vm.$nextTick()

      // Add a second range
      selection.startSelection(50, true)
      await wrapper.vm.$nextTick()

      // Verify we have 2 ranges
      expect(selection.domain.value.ranges).toHaveLength(2)

      // Try to open modal with DNA key
      await wrapper.find('.editor-svg').trigger('keydown', { key: 'A' })
      await wrapper.vm.$nextTick()

      // Modal should NOT open
      expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    })
  })

  describe('context menu', () => {
    it('shows "Replace sequence with..." for single range selection', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(200))
      await wrapper.vm.$nextTick()

      // Create a single selection
      const selection = wrapper.findComponent({ name: 'SelectionLayer' }).vm.selection
      selection.select('10..20')
      await wrapper.vm.$nextTick()

      expect(selection.domain.value.ranges).toHaveLength(1)

      // Trigger context menu on sequence overlay
      const overlay = wrapper.find('.sequence-overlay')
      await overlay.trigger('contextmenu', { clientX: 100, clientY: 20 })
      await wrapper.vm.$nextTick()

      // Context menu should be visible with Replace option
      expect(wrapper.find('.context-menu').exists()).toBe(true)
      const menuText = wrapper.find('.context-menu').text()
      expect(menuText).toContain('Replace sequence with...')
    })

    it('does not show "Replace sequence with..." for multiple range selection', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(200))
      await wrapper.vm.$nextTick()

      // Create multiple ranges
      const selection = wrapper.findComponent({ name: 'SelectionLayer' }).vm.selection
      selection.select('10..20')
      await wrapper.vm.$nextTick()

      selection.startSelection(50, true)
      await wrapper.vm.$nextTick()

      expect(selection.domain.value.ranges).toHaveLength(2)

      // Trigger context menu on sequence overlay
      const overlay = wrapper.find('.sequence-overlay')
      await overlay.trigger('contextmenu', { clientX: 100, clientY: 20 })
      await wrapper.vm.$nextTick()

      // Context menu should be visible but without Replace option
      expect(wrapper.find('.context-menu').exists()).toBe(true)
      const menuText = wrapper.find('.context-menu').text()
      expect(menuText).not.toContain('Replace sequence with...')
    })

    it('shows "Delete sequence" for non-zero-length selection', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(200))
      await wrapper.vm.$nextTick()

      // Create a selection
      const selection = wrapper.findComponent({ name: 'SelectionLayer' }).vm.selection
      selection.select('10..20')
      await wrapper.vm.$nextTick()

      // Trigger context menu
      const overlay = wrapper.find('.sequence-overlay')
      await overlay.trigger('contextmenu', { clientX: 100, clientY: 20 })
      await wrapper.vm.$nextTick()

      const menuText = wrapper.find('.context-menu').text()
      expect(menuText).toContain('Delete sequence')
    })

    it('hides edit options when readonly is true', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100, readonly: true }
      })
      wrapper.vm.setSequence('A'.repeat(200))
      await wrapper.vm.$nextTick()

      // Create a selection
      const selection = wrapper.findComponent({ name: 'SelectionLayer' }).vm.selection
      selection.select('10..20')
      await wrapper.vm.$nextTick()

      // Trigger context menu
      const overlay = wrapper.find('.sequence-overlay')
      await overlay.trigger('contextmenu', { clientX: 100, clientY: 20 })
      await wrapper.vm.$nextTick()

      const menuText = wrapper.find('.context-menu').text()
      expect(menuText).not.toContain('Delete sequence')
      expect(menuText).not.toContain('Replace sequence with...')
      // Copy should still be available
      expect(menuText).toContain('Copy selection')
    })

    it('hides "Insert sequence..." when readonly is true', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { initialZoom: 100, readonly: true }
      })
      wrapper.vm.setSequence('A'.repeat(200))
      await wrapper.vm.$nextTick()

      // Create a zero-length selection (cursor)
      const selection = wrapper.findComponent({ name: 'SelectionLayer' }).vm.selection
      selection.select('10..10')
      await wrapper.vm.$nextTick()

      // Trigger context menu
      const overlay = wrapper.find('.sequence-overlay')
      await overlay.trigger('contextmenu', { clientX: 100, clientY: 20 })
      await wrapper.vm.$nextTick()

      const menuText = wrapper.find('.context-menu').text()
      expect(menuText).not.toContain('Insert sequence...')
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

  describe('annotation adjustment on insert', () => {
    // Helper to set up insertion at a specific position
    async function setupInsertAtPosition(wrapper, position) {
      // Create a zero-width selection (cursor) at the desired position
      const selectionLayer = wrapper.findComponent({ name: 'SelectionLayer' })
      const selection = selectionLayer.vm.selection
      selection.select(`${position}..${position}`)
      await wrapper.vm.$nextTick()

      // Open the insert modal via keypress (DNA base triggers modal)
      const svg = wrapper.find('svg.editor-svg')
      await svg.trigger('keydown', { key: 'A' })
      await wrapper.vm.$nextTick()
    }

    it('emits annotations-update when inserting text inside an annotation', async () => {
      const annotations = [
        { id: 'ann1', caption: 'Test', type: 'gene', span: '10..50' }
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(100))
      await wrapper.vm.$nextTick()

      // Set up insert at position 20 (inside annotation 10..50)
      await setupInsertAtPosition(wrapper, 20)

      // Submit 5 characters via the modal
      const insertModal = wrapper.findComponent({ name: 'InsertModal' })
      insertModal.vm.$emit('submit', 'ATCGA')
      await wrapper.vm.$nextTick()

      // Check that annotations-update was emitted
      const emitted = wrapper.emitted('annotations-update')
      expect(emitted).toBeTruthy()
      expect(emitted.length).toBe(1)

      // Annotation should expand: start stays 10, end becomes 55 (50 + 5)
      const updatedAnnotations = emitted[0][0]
      expect(updatedAnnotations[0].span).toBe('10..55')
    })

    it('shifts annotation right when inserting before it', async () => {
      const annotations = [
        { id: 'ann1', caption: 'Test', type: 'gene', span: '20..40' }
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(100))
      await wrapper.vm.$nextTick()

      // Set up insert at position 5 (before annotation starts at 20)
      await setupInsertAtPosition(wrapper, 5)

      const insertModal = wrapper.findComponent({ name: 'InsertModal' })
      insertModal.vm.$emit('submit', 'GGG')  // 3 characters
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('annotations-update')
      expect(emitted).toBeTruthy()

      // Both start and end should shift: 20+3=23, 40+3=43
      const updatedAnnotations = emitted[0][0]
      expect(updatedAnnotations[0].span).toBe('23..43')
    })

    it('does not modify annotation when inserting after it', async () => {
      const annotations = [
        { id: 'ann1', caption: 'Test', type: 'gene', span: '10..20' }
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(100))
      await wrapper.vm.$nextTick()

      // Set up insert at position 50 (after annotation ends at 20)
      await setupInsertAtPosition(wrapper, 50)

      const insertModal = wrapper.findComponent({ name: 'InsertModal' })
      insertModal.vm.$emit('submit', 'TTTT')  // 4 characters
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('annotations-update')
      expect(emitted).toBeTruthy()

      // Annotation should remain unchanged
      const updatedAnnotations = emitted[0][0]
      expect(updatedAnnotations[0].span).toBe('10..20')
    })

    it('handles multiple annotations correctly', async () => {
      const annotations = [
        { id: 'ann1', caption: 'Before', type: 'gene', span: '5..15' },
        { id: 'ann2', caption: 'Contains', type: 'promoter', span: '20..40' },
        { id: 'ann3', caption: 'After', type: 'terminator', span: '50..60' }
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(100))
      await wrapper.vm.$nextTick()

      // Set up insert at position 25 (inside ann2, after ann1, before ann3)
      await setupInsertAtPosition(wrapper, 25)

      const insertModal = wrapper.findComponent({ name: 'InsertModal' })
      insertModal.vm.$emit('submit', 'CC')  // 2 characters
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('annotations-update')
      expect(emitted).toBeTruthy()

      const updatedAnnotations = emitted[0][0]

      // ann1 (5..15): insertion at 25, both start and end < 25, so unchanged
      expect(updatedAnnotations[0].span).toBe('5..15')

      // ann2 (20..40): insertion at 25, start < 25 (unchanged), end > 25 (becomes 42)
      expect(updatedAnnotations[1].span).toBe('20..42')

      // ann3 (50..60): insertion at 25, both start and end > 25, both shift
      expect(updatedAnnotations[2].span).toBe('52..62')
    })

    it('expands annotation when inserting at its start position', async () => {
      const annotations = [
        { id: 'ann1', caption: 'Test', type: 'gene', span: '10..30' }
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(100))
      await wrapper.vm.$nextTick()

      // Set up insert at position 10 (exactly at annotation start)
      await setupInsertAtPosition(wrapper, 10)

      const insertModal = wrapper.findComponent({ name: 'InsertModal' })
      insertModal.vm.$emit('submit', 'AAA')  // 3 characters
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('annotations-update')
      expect(emitted).toBeTruthy()

      // start=10, not > 10, so stays 10; end=30 > 10, so becomes 33
      // Result: annotation expands to include inserted text
      const updatedAnnotations = emitted[0][0]
      expect(updatedAnnotations[0].span).toBe('10..33')
    })

    it('does not expand annotation when inserting at its end position', async () => {
      const annotations = [
        { id: 'ann1', caption: 'Test', type: 'gene', span: '10..30' }
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(100))
      await wrapper.vm.$nextTick()

      // Set up insert at position 30 (exactly at annotation end)
      await setupInsertAtPosition(wrapper, 30)

      const insertModal = wrapper.findComponent({ name: 'InsertModal' })
      insertModal.vm.$emit('submit', 'GGG')  // 3 characters
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('annotations-update')
      expect(emitted).toBeTruthy()

      // start=10, not > 30, unchanged; end=30, not > 30, unchanged
      // Result: annotation stays the same (insert is at boundary, not inside)
      const updatedAnnotations = emitted[0][0]
      expect(updatedAnnotations[0].span).toBe('10..30')
    })

    it('handles join spans with multiple ranges', async () => {
      const annotations = [
        { id: 'ann1', caption: 'Joined', type: 'CDS', span: '10..20 + 40..60' }
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(100))
      await wrapper.vm.$nextTick()

      // Set up insert at position 30 (between the two ranges)
      await setupInsertAtPosition(wrapper, 30)

      const insertModal = wrapper.findComponent({ name: 'InsertModal' })
      insertModal.vm.$emit('submit', 'AAAA')  // 4 characters
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('annotations-update')
      expect(emitted).toBeTruthy()

      const updatedAnnotations = emitted[0][0]
      // First range (10..20): start and end both < 30, unchanged
      // Second range (40..60): start and end both > 30, both shift by 4
      expect(updatedAnnotations[0].span).toBe('10..20 + 44..64')
    })

    it('INTEGRATION: inserting inside annotation preserves start position and expands end', async () => {
      // This test reproduces the reported bug where inserting at position X+2 inside
      // annotation X..Y resulted in X+1..Y+4 instead of the correct X..Y+4
      //
      // Scenario from user report:
      // - Annotation at 230..247 (17 bases)
      // - Insert 4 chars "ATCG" at position 231 (1 base into the annotation)
      // - Expected: 230..251 (start unchanged, end = 247 + 4)
      // - Bug was: 231..252 (start incorrectly shifted by 1)

      const annotations = [
        { id: 'ann_test', caption: 'TestAnnotation', type: 'gene', span: '230..247' }
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      // Need enough sequence to contain the annotation
      wrapper.vm.setSequence('A'.repeat(500))
      await wrapper.vm.$nextTick()

      // Verify initial annotation state
      const annotationLayer = wrapper.findComponent({ name: 'AnnotationLayer' })
      const initialFragments = annotationLayer.vm.fragments
      const initialFragment = initialFragments.find(f => f.annotation.id === 'ann_test')
      expect(initialFragment).toBeTruthy()
      expect(initialFragment.annotation.span.ranges[0].start).toBe(230)
      expect(initialFragment.annotation.span.ranges[0].end).toBe(247)

      // Set up insert at position 231 (inside annotation, 1 base after start)
      await setupInsertAtPosition(wrapper, 231)

      // Submit 4 characters via the modal
      const insertModal = wrapper.findComponent({ name: 'InsertModal' })
      insertModal.vm.$emit('submit', 'ATCG')
      await wrapper.vm.$nextTick()

      // Check that annotations-update was emitted with correct coordinates
      const emitted = wrapper.emitted('annotations-update')
      expect(emitted).toBeTruthy()
      expect(emitted.length).toBe(1)

      const updatedAnnotations = emitted[0][0]
      const updatedSpan = updatedAnnotations[0].span

      // CRITICAL: Start position must stay at 230 (not shift to 231)
      // End position should be 247 + 4 = 251
      expect(updatedSpan).toBe('230..251')

      // Also verify the rendered annotation fragment position is correct
      await wrapper.vm.$nextTick()
      const updatedFragments = annotationLayer.vm.fragments
      const updatedFragment = updatedFragments.find(f => f.annotation.id === 'ann_test')
      expect(updatedFragment).toBeTruthy()
      expect(updatedFragment.annotation.span.ranges[0].start).toBe(230)
      expect(updatedFragment.annotation.span.ranges[0].end).toBe(251)
    })

    it('INTEGRATION: inserting at exact start position expands annotation', async () => {
      // Insert at the exact start position should expand the annotation
      const annotations = [
        { id: 'ann_test', caption: 'TestAnnotation', type: 'gene', span: '100..150' }
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(300))
      await wrapper.vm.$nextTick()

      // Insert at position 100 (exact start)
      await setupInsertAtPosition(wrapper, 100)

      const insertModal = wrapper.findComponent({ name: 'InsertModal' })
      insertModal.vm.$emit('submit', 'GGG')
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('annotations-update')
      expect(emitted).toBeTruthy()

      // Start stays 100, end becomes 150 + 3 = 153
      expect(emitted[0][0][0].span).toBe('100..153')
    })

    it('INTEGRATION: inserting 1 base before start shifts entire annotation', async () => {
      // Insert 1 base before annotation start should shift both start and end
      const annotations = [
        { id: 'ann_test', caption: 'TestAnnotation', type: 'gene', span: '100..150' }
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(300))
      await wrapper.vm.$nextTick()

      // Insert at position 99 (1 base before start)
      await setupInsertAtPosition(wrapper, 99)

      const insertModal = wrapper.findComponent({ name: 'InsertModal' })
      insertModal.vm.$emit('submit', 'TTT')
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('annotations-update')
      expect(emitted).toBeTruthy()

      // Both start and end shift by 3: 100+3=103, 150+3=153
      expect(emitted[0][0][0].span).toBe('103..153')
    })
  })

  describe('annotation adjustment on replace', () => {
    // Helper to set up replace mode at a specific selection range
    async function setupReplaceAtSelection(wrapper, start, end) {
      // Create selection
      const selectionLayer = wrapper.findComponent({ name: 'SelectionLayer' })
      const selection = selectionLayer.vm.selection
      selection.select(`${start}..${end}`)
      await wrapper.vm.$nextTick()

      // Simulate opening replace modal by typing a DNA base (which triggers showInsertModal)
      // This sets up insertModalIsReplace based on whether there's a non-zero selection
      const svg = wrapper.find('svg.editor-svg')
      await svg.trigger('keydown', { key: 'A' })
      await wrapper.vm.$nextTick()
    }

    it('updates selection to match replacement length', async () => {
      const wrapper = mount(SequenceEditor, {
        props: { annotations: [], initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(100))
      await wrapper.vm.$nextTick()

      // Select 7 bases (positions 10-17)
      await setupReplaceAtSelection(wrapper, 10, 17)

      // Replace with 3 characters
      const insertModal = wrapper.findComponent({ name: 'InsertModal' })
      insertModal.vm.$emit('submit', 'GGG')
      await wrapper.vm.$nextTick()

      // Selection should now be 3 bases (10-13)
      const selectionLayer = wrapper.findComponent({ name: 'SelectionLayer' })
      const selection = selectionLayer.vm.selection
      expect(selection.domain.value.ranges[0].start).toBe(10)
      expect(selection.domain.value.ranges[0].end).toBe(13)
    })

    it('shifts annotation after selection by net change', async () => {
      const annotations = [
        { id: 'ann1', caption: 'After', type: 'gene', span: '50..70' }
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(100))
      await wrapper.vm.$nextTick()

      // Select 10 bases (20-30), replace with 4 (net change: -6)
      await setupReplaceAtSelection(wrapper, 20, 30)

      const insertModal = wrapper.findComponent({ name: 'InsertModal' })
      insertModal.vm.$emit('submit', 'AAAA')
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('annotations-update')
      expect(emitted).toBeTruthy()

      // Annotation shifts left by 6: 50-6=44, 70-6=64
      const updatedAnnotations = emitted[0][0]
      expect(updatedAnnotations[0].span).toBe('44..64')
    })

    it('does not modify annotation before selection', async () => {
      const annotations = [
        { id: 'ann1', caption: 'Before', type: 'gene', span: '5..15' }
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(100))
      await wrapper.vm.$nextTick()

      // Select bases 30-40, replace with 2 chars
      await setupReplaceAtSelection(wrapper, 30, 40)

      const insertModal = wrapper.findComponent({ name: 'InsertModal' })
      insertModal.vm.$emit('submit', 'CC')
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('annotations-update')
      expect(emitted).toBeTruthy()

      // Annotation before selection is unchanged
      const updatedAnnotations = emitted[0][0]
      expect(updatedAnnotations[0].span).toBe('5..15')
    })

    it('shrinks annotation that spans across selection', async () => {
      const annotations = [
        { id: 'ann1', caption: 'Spanning', type: 'gene', span: '10..50' }
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(100))
      await wrapper.vm.$nextTick()

      // Select 20-30 (inside annotation), replace with 2 chars (net: -8)
      await setupReplaceAtSelection(wrapper, 20, 30)

      const insertModal = wrapper.findComponent({ name: 'InsertModal' })
      insertModal.vm.$emit('submit', 'TT')
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('annotations-update')
      expect(emitted).toBeTruthy()

      // Start stays 10, end shrinks: 50-8=42
      const updatedAnnotations = emitted[0][0]
      expect(updatedAnnotations[0].span).toBe('10..42')
    })

    it('expands annotation that spans across selection when replacement is longer', async () => {
      const annotations = [
        { id: 'ann1', caption: 'Spanning', type: 'gene', span: '10..50' }
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(100))
      await wrapper.vm.$nextTick()

      // Select 20-25 (5 bases inside annotation), replace with 15 chars (net: +10)
      await setupReplaceAtSelection(wrapper, 20, 25)

      const insertModal = wrapper.findComponent({ name: 'InsertModal' })
      insertModal.vm.$emit('submit', 'AAAAAGGGGGCCCCC')  // 15 chars
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('annotations-update')
      expect(emitted).toBeTruthy()

      // Start stays 10, end expands: 50+10=60
      const updatedAnnotations = emitted[0][0]
      expect(updatedAnnotations[0].span).toBe('10..60')
    })

    it('collapses annotation contained within selection to zero length', async () => {
      const annotations = [
        { id: 'ann1', caption: 'Inside', type: 'gene', span: '25..35' }
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(100))
      await wrapper.vm.$nextTick()

      // Select 20-40 (contains the entire annotation)
      await setupReplaceAtSelection(wrapper, 20, 40)

      const insertModal = wrapper.findComponent({ name: 'InsertModal' })
      insertModal.vm.$emit('submit', 'XXX')
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('annotations-update')
      expect(emitted).toBeTruthy()

      // Annotation collapses to zero length at selection start
      const updatedAnnotations = emitted[0][0]
      expect(updatedAnnotations[0].span).toBe('20')
    })

    it('truncates annotation that overlaps left side of selection', async () => {
      const annotations = [
        { id: 'ann1', caption: 'OverlapLeft', type: 'gene', span: '15..35' }
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(100))
      await wrapper.vm.$nextTick()

      // Select 30-50 (annotation starts before, ends inside selection)
      await setupReplaceAtSelection(wrapper, 30, 50)

      const insertModal = wrapper.findComponent({ name: 'InsertModal' })
      insertModal.vm.$emit('submit', 'AAAA')
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('annotations-update')
      expect(emitted).toBeTruthy()

      // Annotation truncated: start stays 15, end becomes 30 (selection start)
      const updatedAnnotations = emitted[0][0]
      expect(updatedAnnotations[0].span).toBe('15..30')
    })

    it('moves annotation that overlaps right side of selection', async () => {
      const annotations = [
        { id: 'ann1', caption: 'OverlapRight', type: 'gene', span: '25..45' }
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(100))
      await wrapper.vm.$nextTick()

      // Select 20-30 (annotation starts inside, ends after selection)
      // Replace 10 chars with 4 chars (net: -6)
      await setupReplaceAtSelection(wrapper, 20, 30)

      const insertModal = wrapper.findComponent({ name: 'InsertModal' })
      insertModal.vm.$emit('submit', 'GGGG')  // 4 chars
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('annotations-update')
      expect(emitted).toBeTruthy()

      // Start moves to after inserted text: 20+4=24
      // End shifts by net change: 45-6=39
      const updatedAnnotations = emitted[0][0]
      expect(updatedAnnotations[0].span).toBe('24..39')
    })

    it('handles multiple annotations with different overlap scenarios', async () => {
      const annotations = [
        { id: 'ann1', caption: 'Before', type: 'gene', span: '5..15' },
        { id: 'ann2', caption: 'Spanning', type: 'promoter', span: '25..55' },
        { id: 'ann3', caption: 'Inside', type: 'terminator', span: '35..45' },
        { id: 'ann4', caption: 'After', type: 'CDS', span: '70..90' }
      ]

      const wrapper = mount(SequenceEditor, {
        props: { annotations, initialZoom: 100 }
      })
      wrapper.vm.setSequence('A'.repeat(100))
      await wrapper.vm.$nextTick()

      // Select 30-50, replace 20 chars with 5 chars (net: -15)
      await setupReplaceAtSelection(wrapper, 30, 50)

      const insertModal = wrapper.findComponent({ name: 'InsertModal' })
      insertModal.vm.$emit('submit', 'XXXXX')  // 5 chars
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('annotations-update')
      expect(emitted).toBeTruthy()

      const updated = emitted[0][0]

      // ann1 (5..15): entirely before, unchanged
      expect(updated[0].span).toBe('5..15')

      // ann2 (25..55): spans selection, end shrinks by 15: 55-15=40
      expect(updated[1].span).toBe('25..40')

      // ann3 (35..45): contained in selection, collapses to start
      expect(updated[2].span).toBe('30')

      // ann4 (70..90): after selection, shifts by -15: 55..75
      expect(updated[3].span).toBe('55..75')
    })
  })

  describe('backend integration', () => {
    function createMockBackend() {
      return {
        insert: mock(() => {}),
        delete: mock(() => {}),
        annotationCreated: mock(() => {}),
        annotationChanged: mock(() => {}),
        annotationDeleted: mock(() => {}),
        titleChange: mock(() => {}),
        metadataInsert: mock(() => {}),
        metadataEdit: mock(() => {}),
        metadataDelete: mock(() => {}),
        onAck: mock((callback) => {
          // Store callback for manual triggering in tests
          createMockBackend._ackCallback = callback
          return () => {}
        }),
        onError: mock((callback) => {
          createMockBackend._errorCallback = callback
          return () => {}
        }),
        // Helpers for tests to trigger callbacks
        _ackCallback: null,
        _errorCallback: null,
      }
    }

    // Helper to set up insertion at a specific position
    async function setupInsertAtPosition(wrapper, position) {
      const selectionLayer = wrapper.findComponent({ name: 'SelectionLayer' })
      const selection = selectionLayer.vm.selection
      selection.select(`${position}..${position}`)
      await wrapper.vm.$nextTick()

      const svg = wrapper.find('svg.editor-svg')
      await svg.trigger('keydown', { key: 'A' })
      await wrapper.vm.$nextTick()
    }

    describe('insert operations', () => {
      it('calls backend.insert when user inserts via modal', async () => {
        const mockBackend = createMockBackend()
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCGATCG',
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        await setupInsertAtPosition(wrapper, 4)

        const insertModal = wrapper.findComponent({ name: 'InsertModal' })
        insertModal.vm.$emit('submit', 'GGG')
        await wrapper.vm.$nextTick()

        expect(mockBackend.insert).toHaveBeenCalledTimes(1)
        const call = mockBackend.insert.mock.calls[0][0]
        expect(call.position).toBe(4)
        expect(call.text).toBe('GGG')
        expect(call.id).toBeDefined()
        expect(typeof call.id).toBe('string')
      })

      it('calls backend.insert at beginning of sequence', async () => {
        const mockBackend = createMockBackend()
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCG',
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        await setupInsertAtPosition(wrapper, 0)

        const insertModal = wrapper.findComponent({ name: 'InsertModal' })
        insertModal.vm.$emit('submit', 'TTT')
        await wrapper.vm.$nextTick()

        expect(mockBackend.insert).toHaveBeenCalledTimes(1)
        const call = mockBackend.insert.mock.calls[0][0]
        expect(call.position).toBe(0)
        expect(call.text).toBe('TTT')
      })

      it('calls backend.insert at end of sequence', async () => {
        const mockBackend = createMockBackend()
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCG',
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        await setupInsertAtPosition(wrapper, 8)

        const insertModal = wrapper.findComponent({ name: 'InsertModal' })
        insertModal.vm.$emit('submit', 'CCC')
        await wrapper.vm.$nextTick()

        expect(mockBackend.insert).toHaveBeenCalledTimes(1)
        const call = mockBackend.insert.mock.calls[0][0]
        expect(call.position).toBe(8)
        expect(call.text).toBe('CCC')
      })

      it('generates unique IDs for each insert operation', async () => {
        const mockBackend = createMockBackend()
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCGATCGATCG',
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        // First insert
        await setupInsertAtPosition(wrapper, 4)
        let insertModal = wrapper.findComponent({ name: 'InsertModal' })
        insertModal.vm.$emit('submit', 'AAA')
        await wrapper.vm.$nextTick()

        // Second insert
        await setupInsertAtPosition(wrapper, 8)
        insertModal = wrapper.findComponent({ name: 'InsertModal' })
        insertModal.vm.$emit('submit', 'TTT')
        await wrapper.vm.$nextTick()

        expect(mockBackend.insert).toHaveBeenCalledTimes(2)
        const id1 = mockBackend.insert.mock.calls[0][0].id
        const id2 = mockBackend.insert.mock.calls[1][0].id
        expect(id1).not.toBe(id2)
      })

      it('applies insert locally (optimistic UI) before backend response', async () => {
        const mockBackend = createMockBackend()
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCG',
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        await setupInsertAtPosition(wrapper, 4)

        const insertModal = wrapper.findComponent({ name: 'InsertModal' })
        insertModal.vm.$emit('submit', 'GGG')
        await wrapper.vm.$nextTick()

        // Sequence should be updated immediately (optimistic UI)
        expect(wrapper.vm.getSequence()).toBe('ATCGGGGATCG')
      })
    })

    describe('delete operations', () => {
      it('calls backend.delete when user deletes selection via Backspace', async () => {
        const mockBackend = createMockBackend()
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCG',
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        // Select positions 2..5 (indices 2,3,4 = 'CGA')
        const selectionLayer = wrapper.findComponent({ name: 'SelectionLayer' })
        selectionLayer.vm.selection.select('2..5')
        await wrapper.vm.$nextTick()

        await wrapper.find('.editor-svg').trigger('keydown', { key: 'Backspace' })
        await wrapper.vm.$nextTick()

        expect(mockBackend.delete).toHaveBeenCalledTimes(1)
        const call = mockBackend.delete.mock.calls[0][0]
        expect(call.start).toBe(2)
        expect(call.end).toBe(5)
        expect(call.id).toBeDefined()
        expect(typeof call.id).toBe('string')
      })

      it('calls backend.delete when user deletes selection via Delete key', async () => {
        const mockBackend = createMockBackend()
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCG',
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        // Select positions 1..4
        const selectionLayer = wrapper.findComponent({ name: 'SelectionLayer' })
        selectionLayer.vm.selection.select('1..4')
        await wrapper.vm.$nextTick()

        await wrapper.find('.editor-svg').trigger('keydown', { key: 'Delete' })
        await wrapper.vm.$nextTick()

        expect(mockBackend.delete).toHaveBeenCalledTimes(1)
        const call = mockBackend.delete.mock.calls[0][0]
        expect(call.start).toBe(1)
        expect(call.end).toBe(4)
      })

      it('does not call backend.delete without a selection', async () => {
        const mockBackend = createMockBackend()
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCG',
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        // No selection, just trigger delete
        await wrapper.find('.editor-svg').trigger('keydown', { key: 'Delete' })
        await wrapper.vm.$nextTick()

        expect(mockBackend.delete).not.toHaveBeenCalled()
      })

      it('does not call backend.delete for zero-length selection (cursor)', async () => {
        const mockBackend = createMockBackend()
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCG',
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        // Zero-length selection (cursor at position 3)
        const selectionLayer = wrapper.findComponent({ name: 'SelectionLayer' })
        selectionLayer.vm.selection.select('3..3')
        await wrapper.vm.$nextTick()

        await wrapper.find('.editor-svg').trigger('keydown', { key: 'Backspace' })
        await wrapper.vm.$nextTick()

        expect(mockBackend.delete).not.toHaveBeenCalled()
      })

      it('applies delete locally (optimistic UI) before backend response', async () => {
        const mockBackend = createMockBackend()
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCG',
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        // Select positions 2..5 (delete 'CGA')
        const selectionLayer = wrapper.findComponent({ name: 'SelectionLayer' })
        selectionLayer.vm.selection.select('2..5')
        await wrapper.vm.$nextTick()

        await wrapper.find('.editor-svg').trigger('keydown', { key: 'Delete' })
        await wrapper.vm.$nextTick()

        // Sequence should be updated immediately
        expect(wrapper.vm.getSequence()).toBe('ATTCG')
      })

      it('clears selection after delete', async () => {
        const mockBackend = createMockBackend()
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCG',
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        const selectionLayer = wrapper.findComponent({ name: 'SelectionLayer' })
        selectionLayer.vm.selection.select('2..5')
        await wrapper.vm.$nextTick()

        expect(selectionLayer.vm.selection.isSelected.value).toBe(true)

        await wrapper.find('.editor-svg').trigger('keydown', { key: 'Delete' })
        await wrapper.vm.$nextTick()

        expect(selectionLayer.vm.selection.isSelected.value).toBe(false)
      })

      it('generates unique IDs for each delete operation', async () => {
        const mockBackend = createMockBackend()
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCGATCGATCG',
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        const selectionLayer = wrapper.findComponent({ name: 'SelectionLayer' })

        // First delete
        selectionLayer.vm.selection.select('2..4')
        await wrapper.vm.$nextTick()
        await wrapper.find('.editor-svg').trigger('keydown', { key: 'Delete' })
        await wrapper.vm.$nextTick()

        // Second delete
        selectionLayer.vm.selection.select('5..7')
        await wrapper.vm.$nextTick()
        await wrapper.find('.editor-svg').trigger('keydown', { key: 'Delete' })
        await wrapper.vm.$nextTick()

        expect(mockBackend.delete).toHaveBeenCalledTimes(2)
        const id1 = mockBackend.delete.mock.calls[0][0].id
        const id2 = mockBackend.delete.mock.calls[1][0].id
        expect(id1).not.toBe(id2)
      })

      it('emits multiple delete events for multi-range selection', async () => {
        const mockBackend = createMockBackend()
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCGATCGATCG',
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        // Create multi-range selection: 2..4 and 8..10 (use ' + ' separator)
        const selectionLayer = wrapper.findComponent({ name: 'SelectionLayer' })
        selectionLayer.vm.selection.select('2..4 + 8..10')
        await wrapper.vm.$nextTick()

        await wrapper.find('.editor-svg').trigger('keydown', { key: 'Delete' })
        await wrapper.vm.$nextTick()

        // Should emit two delete calls
        expect(mockBackend.delete).toHaveBeenCalledTimes(2)

        // Deletes happen from highest position first to avoid shifting issues
        // So 8..10 is deleted first, then 2..4
        const call1 = mockBackend.delete.mock.calls[0][0]
        const call2 = mockBackend.delete.mock.calls[1][0]

        expect(call1.start).toBe(8)
        expect(call1.end).toBe(10)
        expect(call2.start).toBe(2)
        expect(call2.end).toBe(4)
      })

      it('correctly deletes multi-range selection locally', async () => {
        const mockBackend = createMockBackend()
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCGATCGATCG', // 16 chars
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        // Select 2..4 (CG) and 8..10 (AT) using ' + ' separator
        const selectionLayer = wrapper.findComponent({ name: 'SelectionLayer' })
        selectionLayer.vm.selection.select('2..4 + 8..10')
        await wrapper.vm.$nextTick()

        await wrapper.find('.editor-svg').trigger('keydown', { key: 'Delete' })
        await wrapper.vm.$nextTick()

        // Original: ATCGATCGATCGATCG
        // ATCGATCGATCGATCG = A T C G A T C G A T C G A T C G
        //                    0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15
        // Delete 8..10 first (indices 8,9 = 'AT') -> ATCGATCGCGATCG (14 chars)
        // Delete 2..4 (indices 2,3 = 'CG') -> ATATCGCGATCG (12 chars)
        expect(wrapper.vm.getSequence()).toBe('ATATCGCGATCG')
      })
    })

    describe('pending edits tracking', () => {
      it('tracks pending edits after insert', async () => {
        const mockBackend = createMockBackend()
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCG',
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        await setupInsertAtPosition(wrapper, 4)

        const insertModal = wrapper.findComponent({ name: 'InsertModal' })
        insertModal.vm.$emit('submit', 'GGG')
        await wrapper.vm.$nextTick()

        // Access internal pending edits via component internals
        // The edit should be tracked as pending
        const editId = mockBackend.insert.mock.calls[0][0].id
        expect(editId).toBeDefined()
      })

      it('clears pending edit when onAck callback is triggered', async () => {
        let ackCallback = null
        const mockBackend = {
          insert: mock(() => {}),
          onAck: mock((cb) => {
            ackCallback = cb
            return () => {}
          }),
          onError: mock(() => () => {}),
        }

        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCG',
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        await setupInsertAtPosition(wrapper, 4)

        const insertModal = wrapper.findComponent({ name: 'InsertModal' })
        insertModal.vm.$emit('submit', 'GGG')
        await wrapper.vm.$nextTick()

        const editId = mockBackend.insert.mock.calls[0][0].id

        // Simulate server acknowledgment
        expect(ackCallback).toBeDefined()
        ackCallback(editId)
        await wrapper.vm.$nextTick()

        // Component should have processed the ack (no visible error)
        // The sequence should still be correct
        expect(wrapper.vm.getSequence()).toBe('ATCGGGGATCG')
      })

      it('handles onError callback', async () => {
        let errorCallback = null
        const mockBackend = {
          insert: mock(() => {}),
          onAck: mock(() => () => {}),
          onError: mock((cb) => {
            errorCallback = cb
            return () => {}
          }),
        }

        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCG',
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        await setupInsertAtPosition(wrapper, 4)

        const insertModal = wrapper.findComponent({ name: 'InsertModal' })
        insertModal.vm.$emit('submit', 'GGG')
        await wrapper.vm.$nextTick()

        const editId = mockBackend.insert.mock.calls[0][0].id

        // Simulate server error (should not throw)
        expect(errorCallback).toBeDefined()
        errorCallback(editId, 'Server error')
        await wrapper.vm.$nextTick()

        // Component should handle error gracefully
        expect(wrapper.vm.getSequence()).toBe('ATCGGGGATCG')
      })
    })

    describe('standalone mode (no backend)', () => {
      it('works without backend prop', async () => {
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCG'
          }
        })
        await wrapper.vm.$nextTick()

        await setupInsertAtPosition(wrapper, 4)

        const insertModal = wrapper.findComponent({ name: 'InsertModal' })
        insertModal.vm.$emit('submit', 'GGG')
        await wrapper.vm.$nextTick()

        // Should still work locally
        expect(wrapper.vm.getSequence()).toBe('ATCGGGGATCG')
      })

      it('emits edit event even without backend', async () => {
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCG'
          }
        })
        await wrapper.vm.$nextTick()

        await setupInsertAtPosition(wrapper, 4)

        const insertModal = wrapper.findComponent({ name: 'InsertModal' })
        insertModal.vm.$emit('submit', 'GGG')
        await wrapper.vm.$nextTick()

        const emitted = wrapper.emitted('edit')
        expect(emitted).toBeTruthy()
        expect(emitted[0][0]).toEqual({
          type: 'insert',
          position: 4,
          text: 'GGG'
        })
      })
    })

    describe('backend with annotations', () => {
      it('calls backend.insert and emits annotations-update', async () => {
        const mockBackend = createMockBackend()
        const annotations = [
          { id: 'ann1', caption: 'Gene', type: 'gene', span: '10..50' }
        ]
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'A'.repeat(100),
            annotations,
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        // Insert inside the annotation
        await setupInsertAtPosition(wrapper, 25)

        const insertModal = wrapper.findComponent({ name: 'InsertModal' })
        insertModal.vm.$emit('submit', 'TTTT')
        await wrapper.vm.$nextTick()

        // Backend should be called
        expect(mockBackend.insert).toHaveBeenCalledTimes(1)
        const call = mockBackend.insert.mock.calls[0][0]
        expect(call.position).toBe(25)
        expect(call.text).toBe('TTTT')

        // Annotations should be updated locally
        const emitted = wrapper.emitted('annotations-update')
        expect(emitted).toBeTruthy()
        // Annotation should expand: 10..50 -> 10..54 (4 chars inserted)
        expect(emitted[0][0][0].span).toBe('10..54')
      })

      it('calls backend.insert before annotation shifts it', async () => {
        const mockBackend = createMockBackend()
        const annotations = [
          { id: 'ann1', caption: 'Gene', type: 'gene', span: '20..40' }
        ]
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'A'.repeat(100),
            annotations,
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        // Insert before the annotation
        await setupInsertAtPosition(wrapper, 5)

        const insertModal = wrapper.findComponent({ name: 'InsertModal' })
        insertModal.vm.$emit('submit', 'GGG')
        await wrapper.vm.$nextTick()

        // Backend should be called
        expect(mockBackend.insert).toHaveBeenCalledTimes(1)
        const call = mockBackend.insert.mock.calls[0][0]
        expect(call.position).toBe(5)
        expect(call.text).toBe('GGG')

        // Annotation should shift: 20..40 -> 23..43
        const emitted = wrapper.emitted('annotations-update')
        expect(emitted).toBeTruthy()
        expect(emitted[0][0][0].span).toBe('23..43')
      })
    })

    describe('callback cleanup', () => {
      it('returns cleanup function from onAck', async () => {
        const cleanupFn = mock(() => {})
        const mockBackend = {
          insert: mock(() => {}),
          onAck: mock(() => cleanupFn),
          onError: mock(() => () => {}),
        }

        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCG',
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        expect(mockBackend.onAck).toHaveBeenCalledTimes(1)
        expect(typeof mockBackend.onAck.mock.calls[0][0]).toBe('function')

        // Unmount should trigger cleanup
        wrapper.unmount()
        expect(cleanupFn).toHaveBeenCalledTimes(1)
      })

      it('returns cleanup function from onError', async () => {
        const cleanupFn = mock(() => {})
        const mockBackend = {
          insert: mock(() => {}),
          onAck: mock(() => () => {}),
          onError: mock(() => cleanupFn),
        }

        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCG',
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        expect(mockBackend.onError).toHaveBeenCalledTimes(1)
        expect(typeof mockBackend.onError.mock.calls[0][0]).toBe('function')

        // Unmount should trigger cleanup
        wrapper.unmount()
        expect(cleanupFn).toHaveBeenCalledTimes(1)
      })
    })

    describe('multiple rapid inserts', () => {
      it('handles multiple inserts with unique IDs', async () => {
        const mockBackend = createMockBackend()
        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'A'.repeat(50),
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        // Rapid fire 3 inserts
        for (const pos of [10, 20, 30]) {
          await setupInsertAtPosition(wrapper, pos)
          const insertModal = wrapper.findComponent({ name: 'InsertModal' })
          insertModal.vm.$emit('submit', 'X')
          await wrapper.vm.$nextTick()
        }

        expect(mockBackend.insert).toHaveBeenCalledTimes(3)

        // All IDs should be unique
        const ids = mockBackend.insert.mock.calls.map(c => c[0].id)
        const uniqueIds = new Set(ids)
        expect(uniqueIds.size).toBe(3)
      })

      it('ignores prop updates while edits are pending', async () => {
        let ackCallback = null
        const mockBackend = {
          insert: mock(() => {}),
          onAck: mock((cb) => {
            ackCallback = cb
            return () => {}
          }),
          onError: mock(() => () => {}),
        }

        const wrapper = mount(SequenceEditor, {
          props: {
            sequence: 'ATCGATCG',
            backend: mockBackend
          }
        })
        await wrapper.vm.$nextTick()

        // Do an insert
        await setupInsertAtPosition(wrapper, 4)
        const insertModal = wrapper.findComponent({ name: 'InsertModal' })
        insertModal.vm.$emit('submit', 'GGG')
        await wrapper.vm.$nextTick()

        // Local sequence should be updated
        expect(wrapper.vm.getSequence()).toBe('ATCGGGGATCG')

        // Simulate a prop update from server (should be ignored while pending)
        await wrapper.setProps({ sequence: 'ATCGATCG' })
        await wrapper.vm.$nextTick()

        // Should still show optimistic update
        expect(wrapper.vm.getSequence()).toBe('ATCGGGGATCG')

        // After ack, prop updates would be accepted again
        const editId = mockBackend.insert.mock.calls[0][0].id
        ackCallback(editId)
        await wrapper.vm.$nextTick()
      })
    })
  })
})
