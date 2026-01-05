import { describe, it, expect, beforeEach } from 'bun:test'
import { mount } from '@vue/test-utils'
import SequenceEditor from './SequenceEditor.vue'

describe('SequenceEditor', () => {
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
})
