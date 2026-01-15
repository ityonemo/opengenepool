<script setup>
import { ref } from 'vue'

const props = defineProps({
  sequences: {
    type: Array,
    default: () => []
  },
  selectedId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['select', 'upload', 'delete'])

const fileInput = ref(null)

function selectSequence(id) {
  emit('select', id)
}

function deleteSequence(event, id) {
  event.stopPropagation()  // Don't trigger select
  emit('delete', id)
}

function triggerUpload() {
  fileInput.value?.click()
}

function handleFileChange(event) {
  const file = event.target.files?.[0]
  if (file) {
    emit('upload', file)
    // Reset input so same file can be uploaded again
    event.target.value = ''
  }
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h2>Sequences</h2>
      <button class="upload-btn" @click="triggerUpload" title="Upload GenBank file">
        +
      </button>
      <input
        ref="fileInput"
        type="file"
        accept=".gb,.gbk,.genbank,.txt"
        style="display: none"
        @change="handleFileChange"
      />
    </div>
    <ul class="sequence-list">
      <li
        v-for="seq in props.sequences"
        :key="seq.id"
        :class="{ selected: seq.id === props.selectedId }"
        @click="selectSequence(seq.id)"
      >
        <span class="seq-name">{{ seq.name }}</span>
        <button
          class="delete-btn"
          @click="deleteSequence($event, seq.id)"
          title="Delete sequence"
        >
          ×
        </button>
      </li>
    </ul>
    <div v-if="props.sequences.length === 0" class="empty-state">
      No sequences stored
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 250px;
  background: #f5f5f5;
  border-right: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #ddd;
  background: #eee;
  gap: 8px;
}

h2 {
  margin: 0;
  font-size: 16px;
  flex: 1;
}

.upload-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: #4a90d9;
  color: white;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.upload-btn:hover {
  background: #357abd;
}

.sequence-list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  overflow-y: auto;
}

.sequence-list li {
  padding: 8px 16px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  gap: 8px;
}

.seq-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.delete-btn {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: #999;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.delete-btn:hover {
  background: #e74c3c;
  color: white;
}

.sequence-list li:hover {
  background: #e8e8e8;
}

.sequence-list li.selected {
  background: #d0e0ff;
  font-weight: 500;
}

.empty-state {
  padding: 16px;
  color: #888;
  font-size: 14px;
}
</style>
