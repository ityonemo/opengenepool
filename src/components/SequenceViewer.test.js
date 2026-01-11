import { describe, it, expect, beforeEach } from 'bun:test'
import { mount } from '@vue/test-utils'
import SequenceViewer from './SequenceViewer.vue'
import { STORAGE_KEY } from '../composables/usePersistedZoom.js'

describe('SequenceViewer', () => {
  // Clear persisted zoom before each test so initialZoom prop takes effect
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
  })
  describe('initial state', () => {
    it('renders empty state when no sequence', () => {
      const wrapper = mount(SequenceViewer)
      expect(wrapper.text()).toContain('No sequence loaded')
    })

    it('has default zoom level of 100', () => {
      const wrapper = mount(SequenceViewer)
      expect(wrapper.vm.zoomLevel).toBe(100)
    })

    it('accepts custom initial zoom', () => {
      const wrapper = mount(SequenceViewer, {
        props: { initialZoom: 50 }
      })
      expect(wrapper.vm.zoomLevel).toBe(50)
    })
  })

  describe('setSequence', () => {
    it('loads a sequence via setSequence method', async () => {
      const wrapper = mount(SequenceViewer)

      wrapper.vm.setSequence('ATCGATCG')
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).not.toContain('No sequence loaded')
      expect(wrapper.text()).toContain('8 bp')
    })

    it('returns sequence via getSequence', () => {
      const wrapper = mount(SequenceViewer)
      const seq = 'ATCGATCG'

      wrapper.vm.setSequence(seq)

      expect(wrapper.vm.getSequence()).toBe(seq)
    })
  })

  describe('line display', () => {
    it('splits sequence into lines based on zoom level', async () => {
      const wrapper = mount(SequenceViewer, {
        props: { initialZoom: 4 }
      })

      wrapper.vm.setSequence('ATCGATCGATCG') // 12 bases
      await wrapper.vm.$nextTick()

      // 12 / 4 = 3 lines
      expect(wrapper.vm.lineCount).toBe(3)
      expect(wrapper.vm.lines).toHaveLength(3)
    })

    it('calculates line positions correctly', async () => {
      const wrapper = mount(SequenceViewer, {
        props: { initialZoom: 4 }
      })

      wrapper.vm.setSequence('ATCGATCGATCG')
      await wrapper.vm.$nextTick()

      const lines = wrapper.vm.lines
      expect(lines[0].position).toBe(1) // 1-based display
      expect(lines[1].position).toBe(5)
      expect(lines[2].position).toBe(9)
    })

    it('extracts correct text for each line', async () => {
      const wrapper = mount(SequenceViewer, {
        props: { initialZoom: 4 }
      })

      wrapper.vm.setSequence('ATCGATCGATCG')
      await wrapper.vm.$nextTick()

      const lines = wrapper.vm.lines
      expect(lines[0].text).toBe('ATCG')
      expect(lines[1].text).toBe('ATCG')
      expect(lines[2].text).toBe('ATCG')
    })

    it('handles partial last line', async () => {
      const wrapper = mount(SequenceViewer, {
        props: { initialZoom: 4 }
      })

      wrapper.vm.setSequence('ATCGATCGAT') // 10 bases
      await wrapper.vm.$nextTick()

      const lines = wrapper.vm.lines
      expect(lines).toHaveLength(3)
      expect(lines[2].text).toBe('AT') // Only 2 bases
    })
  })

  describe('zoom', () => {
    it('changes zoom level via setZoom', async () => {
      const wrapper = mount(SequenceViewer)
      wrapper.vm.setSequence('A'.repeat(1000))
      await wrapper.vm.$nextTick()

      wrapper.vm.setZoom(50)
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.zoomLevel).toBe(50)
      expect(wrapper.vm.lineCount).toBe(20) // 1000 / 50
    })

    it('shows text view at low zoom levels', async () => {
      const wrapper = mount(SequenceViewer, {
        props: { initialZoom: 100 }
      })
      wrapper.vm.setSequence('ATCGATCG')
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.showText).toBe(true)
    })

    it('shows bar view at high zoom levels', async () => {
      const wrapper = mount(SequenceViewer, {
        props: { initialZoom: 500 }
      })
      wrapper.vm.setSequence('A'.repeat(10000))
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.showText).toBe(false)
    })
  })

  describe('events', () => {
    it('emits contextmenu event on right-click', async () => {
      const wrapper = mount(SequenceViewer, {
        props: { initialZoom: 10 }
      })
      wrapper.vm.setSequence('ATCGATCGATCG')
      await wrapper.vm.$nextTick()

      const line = wrapper.find('.sequence-text')
      await line.trigger('contextmenu', { preventDefault: () => {} })

      expect(wrapper.emitted('contextmenu')).toBeTruthy()
    })
  })
})
