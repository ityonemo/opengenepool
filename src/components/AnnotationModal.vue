<script setup>
import { ref, computed, watch } from 'vue'
import { TrashIcon, PlusIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/vue/20/solid'
import { Range, Orientation } from '../utils/dna.js'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  span: {
    type: String,
    default: '0..0'
  },
  sequenceLength: {
    type: Number,
    default: null
  },
  readonly: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'create'])

// Standard annotation types
const STANDARD_TYPES = [
  'gene', 'CDS', 'promoter', 'terminator', 'misc_feature',
  'rep_origin', 'primer_bind', 'protein_bind', 'regulatory',
  'source', 'exon', 'intron', 'mRNA', 'rRNA', 'tRNA', 'ncRNA', 'misc_RNA'
]

// Optional fields that can be added
const OPTIONAL_FIELDS = [
  { key: 'gene', label: 'Gene' },
  { key: 'product', label: 'Product' },
  { key: 'note', label: 'Note' },
  { key: 'locus_tag', label: 'Locus Tag' },
  { key: 'protein_id', label: 'Protein ID' },
  { key: 'translation', label: 'Translation' },
  { key: 'db_xref', label: 'DB Xref' },
  { key: 'codon_start', label: 'Codon Start' }
]

// Form state
const caption = ref('')
const annotationType = ref('')
const ranges = ref([])
const attributes = ref({})
const visibleFields = ref([])
const customFieldName = ref('')

// Parse span prop to extract ranges with orientation
function parseSpan(spanStr) {
  // Split on " + " for multi-range spans
  const parts = spanStr.split(/\s*\+\s*/)
  return parts.map(part => {
    try {
      const range = Range.parse(part.trim())
      return {
        start: range.start,
        end: range.end,
        strand: orientationToStrand(range.orientation)
      }
    } catch {
      return { start: 0, end: 0, strand: 'forward' }
    }
  })
}

function orientationToStrand(orientation) {
  switch (orientation) {
    case Orientation.MINUS: return 'reverse'
    case Orientation.NONE: return 'none'
    default: return 'forward'
  }
}

function strandToOrientation(strand) {
  switch (strand) {
    case 'reverse': return Orientation.MINUS
    case 'none': return Orientation.NONE
    default: return Orientation.PLUS
  }
}

// Initialize form from span prop when modal opens
watch(() => props.open, (isOpen) => {
  if (isOpen && !props.readonly) {
    ranges.value = parseSpan(props.span)
    // Reset other fields
    caption.value = ''
    annotationType.value = ''
    attributes.value = {}
    visibleFields.value = []
    customFieldName.value = ''
  }
}, { immediate: true })

// Computed label for ranges section
const rangesLabel = computed(() => {
  return ranges.value.length === 1 ? 'Range' : 'Ranges'
})

// Build span string from current ranges
const computedSpan = computed(() => {
  return ranges.value.map(range => {
    const start = parseInt(range.start, 10) || 0
    const end = parseInt(range.end, 10) || 0
    const content = `${start}..${end}`

    switch (range.strand) {
      case 'reverse': return `(${content})`
      case 'none': return `[${content}]`
      default: return content
    }
  }).join(' + ')
})

// Check if a range is complete (has both start and end values)
function isRangeComplete(range) {
  const start = range.start
  const end = range.end
  // Check that both values exist and are valid numbers
  return start !== '' && start !== null && start !== undefined &&
         end !== '' && end !== null && end !== undefined
}

// Check if two ranges overlap (adjacent ranges like 0..10 and 10..20 do NOT overlap)
function rangesOverlap(r1, r2) {
  const s1 = Number(r1.start)
  const e1 = Number(r1.end)
  const s2 = Number(r2.start)
  const e2 = Number(r2.end)
  // Overlap: start1 < end2 AND start2 < end1
  // Using < (not <=) means adjacent ranges don't count as overlapping
  return s1 < e2 && s2 < e1
}

// Computed: which range indices overlap with a previous range
const overlappingRanges = computed(() => {
  const overlaps = new Set()
  for (let i = 1; i < ranges.value.length; i++) {
    if (!isRangeComplete(ranges.value[i])) continue
    for (let j = 0; j < i; j++) {
      if (!isRangeComplete(ranges.value[j])) continue
      if (rangesOverlap(ranges.value[i], ranges.value[j])) {
        overlaps.add(i)
        break
      }
    }
  }
  return overlaps
})

// Form validation
const isValid = computed(() => {
  if (!caption.value.trim()) return false
  if (!annotationType.value.trim()) return false
  // All ranges must be complete
  if (!ranges.value.every(isRangeComplete)) return false
  // No ranges can overlap
  if (overlappingRanges.value.size > 0) return false
  return true
})

// Range management functions
function addRange() {
  const lastStrand = ranges.value.length > 0
    ? ranges.value[ranges.value.length - 1].strand
    : 'forward'
  ranges.value.push({ start: '', end: '', strand: lastStrand })
}

function removeRange(index) {
  ranges.value.splice(index, 1)
}

function moveRangeUp(index) {
  if (index > 0) {
    const temp = ranges.value[index]
    ranges.value[index] = ranges.value[index - 1]
    ranges.value[index - 1] = temp
  }
}

function moveRangeDown(index) {
  if (index < ranges.value.length - 1) {
    const temp = ranges.value[index]
    ranges.value[index] = ranges.value[index + 1]
    ranges.value[index + 1] = temp
  }
}

// Available fields to add (not yet visible)
const availableToAdd = computed(() => {
  const visibleKeys = new Set(visibleFields.value)
  return OPTIONAL_FIELDS.filter(f => !visibleKeys.has(f.key))
})

function addField(key) {
  if (key && !visibleFields.value.includes(key)) {
    visibleFields.value.push(key)
    attributes.value[key] = ''
  }
}

function addCustomField() {
  const key = customFieldName.value.trim()
  if (key && !visibleFields.value.includes(key)) {
    visibleFields.value.push(key)
    attributes.value[key] = ''
    customFieldName.value = ''
  }
}

function removeField(key) {
  visibleFields.value = visibleFields.value.filter(k => k !== key)
  delete attributes.value[key]
}

function getFieldLabel(key) {
  const field = OPTIONAL_FIELDS.find(f => f.key === key)
  return field ? field.label : key
}

function close() {
  emit('close')
}

function handleSubmit() {
  if (!isValid.value) return

  // Build final attributes (only non-empty values)
  const finalAttrs = {}
  for (const [key, value] of Object.entries(attributes.value)) {
    if (value && value.trim()) {
      finalAttrs[key] = value.trim()
    }
  }

  emit('create', {
    caption: caption.value.trim(),
    type: annotationType.value.trim(),
    span: computedSpan.value,
    attributes: finalAttrs
  })

  emit('close')
}

function onOverlayClick() {
  close()
}
</script>

<template>
  <div v-if="open && !readonly" class="modal-overlay" @click="onOverlayClick">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Create Annotation</h3>
        <button class="modal-close" @click="close">&times;</button>
      </div>

      <div class="modal-body">
        <form class="annotation-form" @submit.prevent="handleSubmit">
          <!-- Caption (required) -->
          <div class="form-group">
            <label for="annotation-caption">Caption <span class="required">*</span></label>
            <input
              type="text"
              id="annotation-caption"
              v-model="caption"
              placeholder="e.g., GFP, lacZ, T7 promoter"
            />
          </div>

          <!-- Type (combo control: input + datalist) -->
          <div class="form-group">
            <label for="annotation-type">Type <span class="required">*</span></label>
            <input
              type="text"
              id="annotation-type"
              v-model="annotationType"
              list="annotation-type-list"
              placeholder="Select or type a custom type"
            />
            <datalist id="annotation-type-list">
              <option v-for="t in STANDARD_TYPES" :key="t" :value="t" />
            </datalist>
          </div>

          <!-- Ranges section -->
          <div class="form-group ranges-section">
            <div class="form-label-row">
              <label>{{ rangesLabel }}</label>
              <button type="button" class="btn-add-range" @click="addRange" title="Add range">
                <PlusIcon class="icon-small" />
              </button>
            </div>
            <div
              v-for="(range, index) in ranges"
              :key="index"
              class="range-row"
            >
              <template v-if="ranges.length > 1">
                <button
                  type="button"
                  class="btn-remove-range"
                  @click="removeRange(index)"
                  title="Remove range"
                >
                  <TrashIcon class="icon-small" />
                </button>
                <div class="range-move-controls">
                  <button
                    v-if="index > 0"
                    type="button"
                    class="btn-move-up"
                    @click="moveRangeUp(index)"
                    title="Move up"
                  >
                    <ChevronUpIcon class="icon-small" />
                  </button>
                  <button
                    v-if="index < ranges.length - 1"
                    type="button"
                    class="btn-move-down"
                    @click="moveRangeDown(index)"
                    title="Move down"
                  >
                    <ChevronDownIcon class="icon-small" />
                  </button>
                </div>
              </template>
              <input
                type="number"
                class="range-start"
                v-model="range.start"
                min="0"
                :max="range.end !== '' && range.end !== null ? Number(range.end) - 1 : props.sequenceLength"
                placeholder="Start"
              />
              <input
                type="number"
                class="range-end"
                v-model="range.end"
                :min="range.start !== '' && range.start !== null ? Number(range.start) + 1 : 1"
                :max="props.sequenceLength"
                placeholder="End"
              />
              <select class="range-strand" v-model="range.strand">
                <option value="forward">Forward</option>
                <option value="reverse">Reverse</option>
                <option value="none">None</option>
              </select>
              <div v-if="overlappingRanges.has(index)" class="range-overlap-error">
                ! This range overlaps with a previous range
              </div>
            </div>
          </div>

          <!-- Optional fields -->
          <div v-for="key in visibleFields" :key="key" class="form-group">
            <div class="form-label-row">
              <label :for="'annotation-attr-' + key">{{ getFieldLabel(key) }}</label>
              <button
                type="button"
                class="btn-remove-field"
                @click="removeField(key)"
                title="Remove field"
              >
                <TrashIcon class="icon-small" />
              </button>
            </div>
            <textarea
              v-if="key === 'translation' || key === 'note'"
              :id="'annotation-attr-' + key"
              v-model="attributes[key]"
              rows="3"
            ></textarea>
            <input
              v-else
              type="text"
              :id="'annotation-attr-' + key"
              v-model="attributes[key]"
            />
          </div>

          <!-- Add field dropdown and actions -->
          <div class="form-actions">
            <div class="add-field-controls">
              <div v-if="availableToAdd.length > 0" class="add-field-dropdown">
                <select class="add-field-select" @change="addField($event.target.value); $event.target.value = ''">
                  <option value="">Add field...</option>
                  <option v-for="field in availableToAdd" :key="field.key" :value="field.key">
                    {{ field.label }}
                  </option>
                </select>
              </div>
              <div class="custom-field-group">
                <input
                  type="text"
                  class="custom-field-input"
                  v-model="customFieldName"
                  placeholder="Custom qualifier"
                  @keyup.enter="addCustomField"
                />
                <button type="button" class="btn-add-custom-field" @click="addCustomField" title="Add custom qualifier">
                  <PlusIcon class="icon-small" />
                </button>
              </div>
            </div>
            <div class="form-actions-right">
              <button type="button" class="btn-cancel" @click="close">Cancel</button>
              <button type="submit" class="btn-create" :disabled="!isValid">Create</button>
            </div>
          </div>
        </form>
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
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0 4px;
  line-height: 1;
}

.modal-close:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
}

.annotation-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group > label:first-child,
.form-label-row > label {
  font-weight: 600;
  font-size: 13px;
  color: #666;
}

.required {
  color: #cc4444;
}

.form-label-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-remove-field {
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  color: #cc4444;
  opacity: 0.6;
  transition: opacity 0.15s;
}

.btn-remove-field:hover {
  opacity: 1;
}

.icon-small {
  width: 14px;
  height: 14px;
  display: block;
}

.form-group select,
.form-group input[type="text"],
.form-group input[type="number"],
.form-group textarea {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.ranges-section {
  gap: 8px;
}

.btn-add-range {
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  color: #4CAF50;
  opacity: 0.6;
  transition: opacity 0.15s;
}

.btn-add-range:hover {
  opacity: 1;
}

.range-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.range-overlap-error {
  width: 100%;
  color: #cc4444;
  font-size: 12px;
  margin-top: -4px;
}

.range-row .btn-remove-range {
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  color: #cc4444;
  opacity: 0.6;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.range-row .btn-remove-range:hover {
  opacity: 1;
}

.range-move-controls {
  display: flex;
  flex-direction: column;
  width: 18px;
  flex-shrink: 0;
}

.range-move-controls button {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: #666;
  opacity: 0.6;
  transition: opacity 0.15s;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.range-move-controls button:hover {
  opacity: 1;
}

.range-row .range-start,
.range-row .range-end {
  flex: 1;
  min-width: 0;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.range-row .range-strand {
  width: 100px;
  flex-shrink: 0;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.form-actions-right {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.btn-cancel {
  padding: 8px 16px;
  background: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
}

.btn-cancel:hover {
  background: #e0e0e0;
}

.btn-create {
  padding: 8px 16px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-create:hover:not(:disabled) {
  background: #45a049;
}

.btn-create:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.add-field-select {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: white;
  font-size: 13px;
  cursor: pointer;
  color: #666;
}

.add-field-select:hover {
  border-color: #999;
}

.add-field-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.custom-field-group {
  display: flex;
  gap: 4px;
  align-items: center;
}

.custom-field-input {
  width: 120px;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
}

.custom-field-input:focus {
  outline: none;
  border-color: #4CAF50;
}

.btn-add-custom-field {
  background: none;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 6px;
  cursor: pointer;
  color: #4CAF50;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-add-custom-field:hover {
  border-color: #4CAF50;
  background: #f0fff0;
}
</style>
