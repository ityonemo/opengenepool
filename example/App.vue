<script setup>
import { ref, onMounted } from 'vue'
import SequenceEditor from '../src/components/SequenceEditor.vue'
import Sidebar from './Sidebar.vue'
import { listSequences, getSequence, saveSequence, deleteSequence, isEmpty } from './db.js'
import { pUC19 } from './seed.js'
import { parseGenBank } from './genbank-parser.js'
import { toGenBank } from './genbank-writer.js'

// List of sequences for sidebar
const sequences = ref([])

// Currently selected sequence
const selectedId = ref(null)
const currentSequence = ref(null)

// Load sequences on mount, seed if empty
onMounted(async () => {
  const empty = await isEmpty()
  if (empty) {
    // Seed with pUC19
    await saveSequence(pUC19)
  } else {
    // Always update pUC19 seed to ensure latest data
    const existing = await getSequence(pUC19.id)
    if (existing) {
      await saveSequence({ ...pUC19, createdAt: existing.createdAt })
    }
  }
  await refreshList()
})

async function refreshList() {
  sequences.value = await listSequences()
}

async function selectSequence(id) {
  selectedId.value = id
  currentSequence.value = await getSequence(id)
}

function handleEdit(data) {
  console.log('Edit event:', data)
  // Future: persist to IndexedDB
}

function handleSelect(data) {
  console.log('Selection:', data)
}

function downloadSequence() {
  if (!currentSequence.value) return

  const genbank = toGenBank(currentSequence.value)
  const blob = new Blob([genbank], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${currentSequence.value.name || 'sequence'}.gb`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function handleDelete(id) {
  await deleteSequence(id)
  await refreshList()

  // If we deleted the currently selected sequence, clear the view
  if (selectedId.value === id) {
    selectedId.value = null
    currentSequence.value = null
  }
}

async function handleUpload(file) {
  try {
    const text = await file.text()
    const parsed = parseGenBank(text)

    // Use filename (without extension) as fallback name
    if (!parsed.name || parsed.name === 'Untitled') {
      parsed.name = file.name.replace(/\.(gb|gbk|genbank|txt)$/i, '')
    }

    // Generate unique ID
    parsed.id = crypto.randomUUID()

    // Save to IndexedDB
    const saved = await saveSequence(parsed)

    // Refresh list and select the new sequence
    await refreshList()
    await selectSequence(saved.id)
  } catch (error) {
    console.error('Failed to parse GenBank file:', error)
    alert('Failed to parse file. Please ensure it is a valid GenBank format.')
  }
}
</script>

<template>
  <div class="app-layout">
    <Sidebar
      :sequences="sequences"
      :selected-id="selectedId"
      @select="selectSequence"
      @upload="handleUpload"
      @delete="handleDelete"
    />
    <main class="main-content">
      <div v-if="!currentSequence" class="placeholder">
        Please select a sequence on the left
      </div>
      <template v-else>
        <div class="toolbar">
          <button class="download-btn" @click="downloadSequence" title="Download as GenBank">
            Download .gb
          </button>
        </div>
        <SequenceEditor
          :key="currentSequence.id"
          :sequence="currentSequence.sequence"
          :title="currentSequence.name"
          :annotations="currentSequence.annotations || []"
          :metadata="currentSequence.metadata || {}"
          @edit="handleEdit"
          @select="handleSelect"
        />
      </template>
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
}

.app-layout {
  display: flex;
  height: 100%;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  font-size: 18px;
  background: #fafafa;
}

.toolbar {
  padding: 8px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: flex-end;
}

.download-btn {
  padding: 6px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: white;
  color: #333;
  font-size: 13px;
  cursor: pointer;
}

.download-btn:hover {
  background: #e8e8e8;
  border-color: #999;
}
</style>
