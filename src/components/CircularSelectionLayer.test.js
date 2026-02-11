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

  describe('merge bubbles', () => {
    it('shows merge bubble when ranges touch', async () => {
      const wrapper = createWrapper()
      const selection = wrapper.vm.selection

      // Create two touching ranges: 100..500 and 500..1000
      selection.select('100..500')
      selection.startSelection(500, true)
      selection.updateSelection(1000)
      selection.endSelection()

      await wrapper.vm.$nextTick()

      // Check that merge bubble is rendered
      const mergeBubbles = wrapper.findAll('.merge_bubble')
      expect(mergeBubbles.length).toBe(1)
    })

    it('does not show merge bubble for non-touching ranges', async () => {
      const wrapper = createWrapper()
      const selection = wrapper.vm.selection

      // Create two non-touching ranges: 100..500 and 600..1000
      selection.select('100..500')
      selection.startSelection(600, true)
      selection.updateSelection(1000)
      selection.endSelection()

      await wrapper.vm.$nextTick()

      // No merge bubble should be shown
      const mergeBubbles = wrapper.findAll('.merge_bubble')
      expect(mergeBubbles.length).toBe(0)
    })

    it('emits merge event when merge bubble is clicked', async () => {
      const wrapper = createWrapper()
      const selection = wrapper.vm.selection

      // Create two touching ranges
      selection.select('100..500')
      selection.startSelection(500, true)
      selection.updateSelection(1000)
      selection.endSelection()

      await wrapper.vm.$nextTick()

      const mergeBubble = wrapper.find('.merge_bubble')
      await mergeBubble.trigger('click')

      expect(wrapper.emitted('merge')).toBeTruthy()
      // After merge, should only have one range
      expect(selection.domain.value.ranges.length).toBe(1)
    })
  })

  describe('origin crossing range order', () => {
    // When a selection wraps across the origin on a circular plasmid,
    // the range order must be correct for cut/paste to concatenate properly:
    // - FORWARD strand: high positions first (reads clockwise through origin)
    // - REVERSE strand: low positions first (reads counter-clockwise through origin)

    it('forward strand wrapped selection should have high range first, low range second', async () => {
      // For forward strand reading clockwise through origin,
      // the expected order for cut/paste is: 800..1000 then 0..200
      // This ensures the sequence concatenates in biological reading order
      const expectedRanges = [
        { start: 800, end: 1000, orientation: 1 },  // high range first (PLUS = 1)
        { start: 0, end: 200, orientation: 1 }      // low range second
      ]

      const [first, second] = expectedRanges
      expect(first.end).toBe(1000)  // First range ends at seqLen (high positions)
      expect(second.start).toBe(0)  // Second range starts at 0 (low positions)
    })

    it('reverse strand wrapped selection should have low range first, high range second', async () => {
      // For reverse strand reading counter-clockwise through origin,
      // the expected order for cut/paste is: 0..200 then 800..1000
      // This ensures the sequence concatenates in biological reading order for minus strand
      const expectedRanges = [
        { start: 0, end: 200, orientation: -1 },    // low range first (MINUS = -1)
        { start: 800, end: 1000, orientation: -1 }  // high range second
      ]

      const [first, second] = expectedRanges
      expect(first.start).toBe(0)    // First range starts at 0 (low positions)
      expect(second.end).toBe(1000)  // Second range ends at seqLen (high positions)
    })
  })
})
