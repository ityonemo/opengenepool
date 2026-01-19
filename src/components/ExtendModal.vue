<script setup>
import { ref, watch, nextTick, computed } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  direction: {
    type: String,  // 'positive' or 'negative'
    default: 'positive'
  },
  maxBases: {
    type: Number,
    default: null  // null means no limit
  }
})

const emit = defineEmits(['submit', 'cancel'])

const inputRef = ref(null)
const bases = ref('')

// Quick-pick options
const quickOptions = [10, 20, 50, 100, 1000, 2000, 5000]

// Check if a quick option is disabled (exceeds maxBases)
function isOptionDisabled(opt) {
  if (props.maxBases === null) return false
  return opt > props.maxBases
}

// Direction label for display
const directionLabel = computed(() => {
  return props.direction === 'positive' ? 'positive (rightward)' : 'negative (leftward)'
})

// Focus input when modal becomes visible
watch(() => props.visible, async (visible) => {
  if (visible) {
    bases.value = ''
    await nextTick()
    inputRef.value?.focus()
  }
}, { immediate: true })

function handleSubmit() {
  const value = parseInt(bases.value, 10)
  if (value > 0) {
    emit('submit', value)
  }
  bases.value = ''
}

function handleQuickPick(event, value) {
  if (event.shiftKey) {
    // Shift-click adds to current value, capped at max
    const current = parseInt(bases.value, 10) || 0
    let newValue = current + value
    if (props.maxBases !== null) {
      newValue = Math.min(newValue, props.maxBases)
    }
    bases.value = String(newValue)
  } else {
    // Regular click submits immediately
    emit('submit', value)
    bases.value = ''
  }
}

function handleCancel() {
  bases.value = ''
  emit('cancel')
}

function handleKeyDown(event) {
  if (event.key === 'Enter') {
    event.preventDefault()
    handleSubmit()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    handleCancel()
  }
}
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleCancel">
    <div class="modal-content">
      <label class="modal-label">
        Extend selection {{ directionLabel }}
      </label>

      <div class="quick-options">
        <button
          v-for="opt in quickOptions"
          :key="opt"
          class="quick-btn"
          :disabled="isOptionDisabled(opt)"
          @click="handleQuickPick($event, opt)"
        >
          {{ opt >= 1000 ? `${opt / 1000}k` : opt }}
        </button>
      </div>
      <div class="hint-text">Click to extend, shift-click to add to custom value</div>

      <div class="custom-input-row">
        <label class="input-label">Custom:</label>
        <input
          ref="inputRef"
          v-model="bases"
          type="number"
          class="modal-input"
          placeholder="bases"
          min="1"
          :max="maxBases || undefined"
          @keydown="handleKeyDown"
        />
        <span class="input-suffix">bases</span>
      </div>

      <div class="modal-buttons">
        <button class="btn btn-cancel" @click="handleCancel">Cancel</button>
        <button class="btn btn-submit" @click="handleSubmit" :disabled="!bases">
          Extend
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  padding: 20px;
  min-width: 320px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 12px;
  color: #333;
}

.quick-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.quick-btn {
  padding: 8px 16px;
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid #ccc;
  background: #f8f8f8;
  color: #333;
  min-width: 50px;
}

.quick-btn:hover:not(:disabled) {
  background: #e8e8e8;
  border-color: #999;
}

.quick-btn:disabled {
  background: #f0f0f0;
  color: #aaa;
  border-color: #ddd;
  cursor: not-allowed;
}

.hint-text {
  font-size: 11px;
  color: #888;
  margin-bottom: 12px;
}

.custom-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.input-label {
  font-size: 13px;
  color: #666;
}

.modal-input {
  flex: 1;
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
  max-width: 120px;
}

.modal-input:focus {
  outline: none;
  border-color: #4a90d9;
  box-shadow: 0 0 0 2px rgba(74, 144, 217, 0.2);
}

.input-suffix {
  font-size: 13px;
  color: #666;
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid #ccc;
}

.btn-cancel {
  background: white;
  color: #333;
}

.btn-cancel:hover {
  background: #f0f0f0;
}

.btn-submit {
  background: #4a90d9;
  color: white;
  border-color: #4a90d9;
}

.btn-submit:hover {
  background: #357abd;
}

.btn-submit:disabled {
  background: #ccc;
  border-color: #ccc;
  cursor: not-allowed;
}
</style>
