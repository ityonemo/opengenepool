import { describe, it, expect } from 'bun:test'
import { mount } from '@vue/test-utils'
import { ref, computed } from 'vue'
import CircularSelectionLayer from './CircularSelectionLayer.vue'
import { useEditorState } from '../composables/useEditorState.js'
import { useGraphics } from '../composables/useGraphics.js'
import { useSelection } from '../composables/useSelection.js'
import { useCircularGraphics } from '../composables/useCircularGraphics.js'
import { createEventBus } from '../composables/useEventBus.js'

describe('CircularSelectionLayer', () => {
  function createWrapper(options = {}) {
    const editorState = useEditorState()
    editorState.setSequence('A'.repeat(options.sequenceLength || 5000))
    editorState.setZoom(100)

    const graphics = useGraphics(editorState)
    graphics.setContainerSize(800, 600)

    const circularGraphics = useCircularGraphics(editorState)

    const eventBus = createEventBus()
    const selection = useSelection(editorState, graphics, eventBus)

    return mount(CircularSelectionLayer, {
      props: {
        thickness: options.thickness || 20
      },
      global: {
        provide: {
          editorState,
          circularGraphics,
          selection
        }
      }
    })
  }

  describe('rendering', () => {
    it('renders empty when no selection', () => {
      const wrapper = createWrapper()
      const paths = wrapper.findAll('.selection')
      expect(paths).toHaveLength(0)
    })

    it('renders selection arc when selected', async () => {
      const wrapper = createWrapper()
      const selection = wrapper.vm.selection

      selection.select('100..500')
      await wrapper.vm.$nextTick()

      const paths = wrapper.findAll('.selection')
      expect(paths).toHaveLength(1)
    })

    it('renders cursor line for zero-width selection', async () => {
      const wrapper = createWrapper()
      const selection = wrapper.vm.selection

      selection.select('100..100')
      await wrapper.vm.$nextTick()

      const cursors = wrapper.findAll('.selection.cursor')
      expect(cursors).toHaveLength(1)
    })
  })

  describe('handles', () => {
    it('renders post-it tab handles for selection', async () => {
      const wrapper = createWrapper()
      const selection = wrapper.vm.selection

      selection.select('100..500')
      await wrapper.vm.$nextTick()

      const handles = wrapper.findAll('.sel_handle')
      // Should have start and end handles
      expect(handles.length).toBe(2)
    })

    it('renders only one handle for cursor', async () => {
      const wrapper = createWrapper()
      const selection = wrapper.vm.selection

      selection.select('100..100')
      await wrapper.vm.$nextTick()

      const handles = wrapper.findAll('.sel_handle')
      expect(handles.length).toBe(1)
    })
  })

  describe('orientation classes', () => {
    it('applies plus class for plus strand', async () => {
      const wrapper = createWrapper()
      const selection = wrapper.vm.selection

      selection.select('100..500') // Plus strand by default
      await wrapper.vm.$nextTick()

      const path = wrapper.find('.selection.plus')
      expect(path.exists()).toBe(true)
    })

    it('applies minus class for minus strand', async () => {
      const wrapper = createWrapper()
      const selection = wrapper.vm.selection

      selection.select('(100..500)') // Minus strand
      await wrapper.vm.$nextTick()

      const path = wrapper.find('.selection.minus')
      expect(path.exists()).toBe(true)
    })
  })

  describe('multi-range selection', () => {
    it('renders multiple arcs for multi-range selection', async () => {
      const wrapper = createWrapper()
      const selection = wrapper.vm.selection

      // Create multi-range selection
      selection.select('100..500')
      selection.startSelection(1000, true)
      selection.updateSelection(1500)
      selection.endSelection()

      await wrapper.vm.$nextTick()

      const paths = wrapper.findAll('.selection')
      expect(paths.length).toBe(2)
    })

    it('shows range index tags for multi-range', async () => {
      const wrapper = createWrapper()
      const selection = wrapper.vm.selection

      // Create multi-range selection
      selection.select('100..500')
      selection.startSelection(1000, true)
      selection.updateSelection(1500)
      selection.endSelection()

      await wrapper.vm.$nextTick()

      const tags = wrapper.findAll('.sel_tag')
      expect(tags.length).toBe(2)
    })
  })

  describe('events', () => {
    it('emits contextmenu event on path right-click', async () => {
      const wrapper = createWrapper()
      const selection = wrapper.vm.selection

      selection.select('100..500')
      await wrapper.vm.$nextTick()

      const path = wrapper.find('.selection')
      await path.trigger('contextmenu')

      expect(wrapper.emitted('contextmenu')).toBeTruthy()
    })
  })

  describe('origin crossing', () => {
    it('supports wrapped selections with two ranges', async () => {
      const wrapper = createWrapper({ sequenceLength: 5000 })
      const selection = wrapper.vm.selection

      // Create a wrapped selection: 4500..5000 + 0..500
      selection.select('4500..5000')
      selection.domain.value.ranges.push({
        start: 0,
        end: 500,
        orientation: 1
      })

      await wrapper.vm.$nextTick()

      const paths = wrapper.findAll('.selection')
      expect(paths.length).toBe(2)
    })
  })
})
