# OpenGenePool

A Vue.js DNA sequence editor component library for viewing and editing genetic sequences.

## Features

- **Sequence Display** - View DNA sequences with configurable zoom levels (text or compressed bar view)
- **Multi-Range Selection** - Select multiple non-contiguous regions with orientation support
- **Annotations** - Display gene annotations with automatic stacking for overlapping features
- **Keyboard Shortcuts** - Full support for copy (Ctrl+C), cut (Ctrl+X), select all (Ctrl+A)
- **Selection Operations** - Shift-click to extend, Ctrl-click to add ranges, merge overlapping selections
- **Context Menus** - Right-click menus for selection and annotation operations
- **Fenced Coordinates** - Uses 0-based, half-open coordinate system (like JavaScript slice)

## Installation

```bash
bun install
```

## Usage

### SequenceEditor

Full-featured editor with selection, annotations, and editing capabilities:

```vue
<template>
  <SequenceEditor
    :sequence="dnaSequence"
    :annotations="annotations"
    :initial-zoom="100"
    @edit="handleEdit"
    @annotation-click="handleAnnotationClick"
  />
</template>

<script setup>
import { SequenceEditor } from 'opengenepool'

const dnaSequence = 'ATCGATCG...'
const annotations = [
  { id: '1', caption: 'Gene A', type: 'gene', span: '0..500' },
  { id: '2', caption: 'Promoter', type: 'promoter', span: '(500..600)' }
]
</script>
```

### SequenceViewer

Read-only viewer for displaying sequences:

```vue
<template>
  <SequenceViewer
    :sequence="dnaSequence"
    :initial-zoom="100"
  />
</template>
```

## Coordinate System

OpenGenePool uses a **fenced coordinate system** (0-based, half-open intervals):

```
Sequence:    A  T  C  G  A  T
Position:   0  1  2  3  4  5  6
            |  |  |  |  |  |  |
```

- `0..1` = first base (length 1)
- `0..6` = full sequence (length 6)
- `0..0` = cursor at start (length 0)
- `(0..6)` = full sequence, minus strand (reverse complement)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+C | Copy selection |
| Ctrl+X | Cut selection |
| Ctrl+A | Select all |
| Shift+Click | Extend selection to position |
| Ctrl+Click | Add new range to selection |

## Development

```bash
# Run tests
bun test

# Run tests in watch mode
bun test --watch
```

## Project Structure

```
src/
├── components/
│   ├── SequenceEditor.vue   # Main editor component
│   ├── SequenceViewer.vue   # Read-only viewer
│   ├── AnnotationLayer.vue  # Annotation rendering
│   ├── SelectionLayer.vue   # Selection handling
│   └── ContextMenu.vue      # Right-click menus
├── composables/
│   ├── useEditorState.js    # Sequence state management
│   ├── useSelection.js      # Multi-range selection logic
│   ├── useAnnotations.js    # Annotation layout
│   ├── useGraphics.js       # Coordinate calculations
│   └── useEventBus.js       # Component communication
└── utils/
    ├── dna.js               # DNA utilities (Range, Span, reverseComplement)
    └── annotation.js        # Annotation model
```

## License

See [LICENCE.txt](LICENCE.txt)
