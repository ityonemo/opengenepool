import { describe, it, expect } from 'bun:test'
import { useEditorState } from './useEditorState.js'

describe('useEditorState', () => {
  describe('initial state', () => {
    it('starts with empty sequence', () => {
      const editor = useEditorState()
      expect(editor.sequence.value).toBe('')
      expect(editor.sequenceLength.value).toBe(0)
    })

    it('has default zoom level of 100', () => {
      const editor = useEditorState()
      expect(editor.zoomLevel.value).toBe(100)
    })

    it('has no selection initially', () => {
      const editor = useEditorState()
      expect(editor.selection.value).toBe(null)
    })

    it('has zero lines when empty', () => {
      const editor = useEditorState()
      expect(editor.lineCount.value).toBe(0)
      expect(editor.lines.value).toEqual([])
    })
  })

  describe('setSequence', () => {
    it('sets the sequence', () => {
      const editor = useEditorState()
      editor.setSequence('ATCGATCG')
      expect(editor.sequence.value).toBe('ATCGATCG')
      expect(editor.sequenceLength.value).toBe(8)
    })

    it('sets the title', () => {
      const editor = useEditorState()
      editor.setSequence('ATCG', 'My Sequence')
      expect(editor.title.value).toBe('My Sequence')
    })

    it('clears selection when sequence changes', () => {
      const editor = useEditorState()
      editor.setSequence('ATCGATCG')
      editor.setSelection(2, 5)
      expect(editor.selection.value).not.toBe(null)

      editor.setSequence('GGGG')
      expect(editor.selection.value).toBe(null)
    })
  })

  describe('lineCount', () => {
    it('calculates lines based on zoom level', () => {
      const editor = useEditorState()
      editor.setSequence('A'.repeat(250))
      expect(editor.zoomLevel.value).toBe(100)
      expect(editor.lineCount.value).toBe(3)  // 250 / 100 = 2.5 -> 3 lines
    })

    it('updates when zoom changes', () => {
      const editor = useEditorState()
      editor.setSequence('A'.repeat(250))
      expect(editor.lineCount.value).toBe(3)

      editor.setZoom(50)
      expect(editor.lineCount.value).toBe(5)  // 250 / 50 = 5 lines
    })
  })

  describe('lines', () => {
    it('splits sequence into line objects', () => {
      const editor = useEditorState()
      // Use a longer sequence so we can set zoom to 50 (minimum)
      // 150 bases at zoom 50 = 3 lines
      const seq = 'A'.repeat(150)
      editor.setSequence(seq)
      editor.setZoom(50)

      const lines = editor.lines.value
      expect(lines.length).toBe(3)

      expect(lines[0]).toEqual({
        index: 0,
        start: 0,
        end: 50,
        text: seq.slice(0, 50),
        position: 1
      })

      expect(lines[1]).toEqual({
        index: 1,
        start: 50,
        end: 100,
        text: seq.slice(50, 100),
        position: 51
      })

      expect(lines[2]).toEqual({
        index: 2,
        start: 100,
        end: 150,
        text: seq.slice(100, 150),
        position: 101
      })
    })
  })

  describe('setZoom', () => {
    it('sets zoom level', () => {
      const editor = useEditorState()
      editor.setSequence('A'.repeat(1000))  // need sequence for zoom to work
      editor.setZoom(200)
      expect(editor.zoomLevel.value).toBe(200)
    })

    it('clamps to minimum of 50', () => {
      const editor = useEditorState()
      editor.setZoom(10)
      expect(editor.zoomLevel.value).toBe(50)
    })

    it('clamps to sequence length for small sequences', () => {
      const editor = useEditorState()
      editor.setSequence('ATCG')  // 4 bases
      editor.setZoom(1000)
      // Max is 50 (minimum) since sequence is shorter
      expect(editor.zoomLevel.value).toBe(50)
    })

    it('allows zoom up to sequence length for large sequences', () => {
      const editor = useEditorState()
      editor.setSequence('A'.repeat(10000))
      editor.setZoom(5000)
      expect(editor.zoomLevel.value).toBe(5000)
    })
  })

  describe('selection', () => {
    it('sets selection with start and end', () => {
      const editor = useEditorState()
      editor.setSequence('ATCGATCGATCG')
      editor.setSelection(3, 7)

      expect(editor.selection.value).toEqual({ start: 3, end: 7 })
    })

    it('normalizes selection so start <= end', () => {
      const editor = useEditorState()
      editor.setSequence('ATCGATCGATCG')
      editor.setSelection(7, 3)  // reversed

      expect(editor.selection.value).toEqual({ start: 3, end: 7 })
    })

    it('clears selection with null', () => {
      const editor = useEditorState()
      editor.setSequence('ATCGATCGATCG')
      editor.setSelection(3, 7)
      editor.setSelection(null, null)

      expect(editor.selection.value).toBe(null)
    })

    it('clearSelection clears selection', () => {
      const editor = useEditorState()
      editor.setSequence('ATCGATCGATCG')
      editor.setSelection(3, 7)
      editor.clearSelection()

      expect(editor.selection.value).toBe(null)
    })
  })

  describe('getSelectedSequence', () => {
    it('returns selected subsequence', () => {
      const editor = useEditorState()
      editor.setSequence('ATCGATCGATCG')
      editor.setSelection(3, 7)

      expect(editor.getSelectedSequence()).toBe('GATC')
    })

    it('returns empty string when no selection', () => {
      const editor = useEditorState()
      editor.setSequence('ATCGATCGATCG')

      expect(editor.getSelectedSequence()).toBe('')
    })
  })

  describe('position helpers', () => {
    it('positionToLine converts position to line index', () => {
      const editor = useEditorState()
      editor.setSequence('A'.repeat(500))
      editor.setZoom(100)

      expect(editor.positionToLine(0)).toBe(0)
      expect(editor.positionToLine(50)).toBe(0)
      expect(editor.positionToLine(100)).toBe(1)
      expect(editor.positionToLine(250)).toBe(2)
    })

    it('positionInLine gets position within line', () => {
      const editor = useEditorState()
      editor.setSequence('A'.repeat(500))
      editor.setZoom(100)

      expect(editor.positionInLine(0)).toBe(0)
      expect(editor.positionInLine(50)).toBe(50)
      expect(editor.positionInLine(150)).toBe(50)
    })

    it('lineToPosition converts line and position to absolute position', () => {
      const editor = useEditorState()
      editor.setSequence('A'.repeat(500))
      editor.setZoom(100)

      expect(editor.lineToPosition(0, 0)).toBe(0)
      expect(editor.lineToPosition(0, 50)).toBe(50)
      expect(editor.lineToPosition(1, 0)).toBe(100)
      expect(editor.lineToPosition(2, 25)).toBe(225)
    })
  })
})
