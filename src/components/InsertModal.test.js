import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import InsertModal from './InsertModal.vue'

describe('InsertModal', () => {
  describe('visibility', () => {
    it('does not render when visible is false', () => {
      const wrapper = mount(InsertModal, {
        props: { visible: false }
      })
      expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    })

    it('renders when visible is true', () => {
      const wrapper = mount(InsertModal, {
        props: { visible: true }
      })
      expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    })
  })

  describe('prompt text', () => {
    it('shows insert prompt for non-replace mode', () => {
      const wrapper = mount(InsertModal, {
        props: { visible: true, isReplace: false, position: 123 }
      })
      expect(wrapper.find('.modal-label').text()).toBe('Insert sequence at 123:')
    })

    it('shows replace prompt for replace mode', () => {
      const wrapper = mount(InsertModal, {
        props: { visible: true, isReplace: true, position: 123 }
      })
      expect(wrapper.find('.modal-label').text()).toBe('Replace sequence with:')
    })
  })

  describe('initial text', () => {
    it('populates input with initialText', async () => {
      const wrapper = mount(InsertModal, {
        props: { visible: true, initialText: 'ATG' }
      })
      await nextTick()
      await nextTick()
      const input = wrapper.find('textarea')
      expect(input.element.value).toBe('ATG')
    })

    it('starts with empty input when no initialText', async () => {
      const wrapper = mount(InsertModal, {
        props: { visible: true, initialText: '' }
      })
      await nextTick()
      await nextTick()
      const input = wrapper.find('textarea')
      expect(input.element.value).toBe('')
    })
  })

  describe('submit', () => {
    it('emits submit with uppercase text on button click', async () => {
      const wrapper = mount(InsertModal, {
        props: { visible: true, initialText: 'atg' }
      })
      await nextTick()
      await nextTick()
      await wrapper.find('.btn-submit').trigger('click')
      expect(wrapper.emitted('submit')).toHaveLength(1)
      expect(wrapper.emitted('submit')[0]).toEqual(['ATG'])
    })

    it('emits submit on Enter key', async () => {
      const wrapper = mount(InsertModal, {
        props: { visible: true, initialText: 'ATG' }
      })
      await nextTick()
      await nextTick()
      await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
      expect(wrapper.emitted('submit')).toHaveLength(1)
      expect(wrapper.emitted('submit')[0]).toEqual(['ATG'])
    })

    it('filters out invalid characters', async () => {
      const wrapper = mount(InsertModal, {
        props: { visible: true, initialText: 'ATG123XYZ' }
      })
      await nextTick()
      await nextTick()
      await wrapper.find('.btn-submit').trigger('click')
      // Only valid IUPAC codes should remain: X and Z are not valid, Y is valid
      expect(wrapper.emitted('submit')[0]).toEqual(['ATGY'])
    })

    it('does not emit submit with empty text', async () => {
      const wrapper = mount(InsertModal, {
        props: { visible: true, initialText: '' }
      })
      await nextTick()
      await nextTick()
      await wrapper.find('.btn-submit').trigger('click')
      expect(wrapper.emitted('submit')).toBeUndefined()
    })
  })

  describe('cancel', () => {
    it('emits cancel on button click', async () => {
      const wrapper = mount(InsertModal, {
        props: { visible: true }
      })
      await wrapper.find('.btn-cancel').trigger('click')
      expect(wrapper.emitted('cancel')).toHaveLength(1)
    })

    it('emits cancel on Escape key', async () => {
      const wrapper = mount(InsertModal, {
        props: { visible: true }
      })
      await wrapper.find('textarea').trigger('keydown', { key: 'Escape' })
      expect(wrapper.emitted('cancel')).toHaveLength(1)
    })

    it('emits cancel when clicking overlay', async () => {
      const wrapper = mount(InsertModal, {
        props: { visible: true }
      })
      await wrapper.find('.modal-overlay').trigger('click')
      expect(wrapper.emitted('cancel')).toHaveLength(1)
    })

    it('does not emit cancel when clicking modal content', async () => {
      const wrapper = mount(InsertModal, {
        props: { visible: true }
      })
      await wrapper.find('.modal-content').trigger('click')
      expect(wrapper.emitted('cancel')).toBeUndefined()
    })
  })

  describe('IUPAC validation', () => {
    it('accepts all standard bases', async () => {
      const wrapper = mount(InsertModal, {
        props: { visible: true, initialText: 'ATCG' }
      })
      await nextTick()
      await nextTick()
      await wrapper.find('.btn-submit').trigger('click')
      expect(wrapper.emitted('submit')[0]).toEqual(['ATCG'])
    })

    it('accepts N wildcard', async () => {
      const wrapper = mount(InsertModal, {
        props: { visible: true, initialText: 'ATNGC' }
      })
      await nextTick()
      await nextTick()
      await wrapper.find('.btn-submit').trigger('click')
      expect(wrapper.emitted('submit')[0]).toEqual(['ATNGC'])
    })

    it('accepts two-letter IUPAC codes', async () => {
      const wrapper = mount(InsertModal, {
        props: { visible: true, initialText: 'RYSWKM' }
      })
      await nextTick()
      await nextTick()
      await wrapper.find('.btn-submit').trigger('click')
      expect(wrapper.emitted('submit')[0]).toEqual(['RYSWKM'])
    })

    it('accepts three-letter IUPAC codes', async () => {
      const wrapper = mount(InsertModal, {
        props: { visible: true, initialText: 'BDHV' }
      })
      await nextTick()
      await nextTick()
      await wrapper.find('.btn-submit').trigger('click')
      expect(wrapper.emitted('submit')[0]).toEqual(['BDHV'])
    })
  })
})
