/**
 * IndexedDB persistence layer for sequences
 */

const DB_NAME = 'opengenepool'
const DB_VERSION = 1
const STORE_NAME = 'sequences'

let dbInstance = null

/**
 * Open or create the database
 */
async function openDB() {
  if (dbInstance) return dbInstance

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('name', 'name', { unique: false })
        store.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
    }
  })
}

/**
 * Get all sequences (for sidebar list)
 * Returns array of { id, name, updatedAt }
 */
export async function listSequences() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const sequences = request.result.map(seq => ({
        id: seq.id,
        name: seq.name,
        updatedAt: seq.updatedAt
      }))
      // Sort by updatedAt descending (most recent first)
      sequences.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      resolve(sequences)
    }
  })
}

/**
 * Get a single sequence by ID
 */
export async function getSequence(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || null)
  })
}

/**
 * Save a sequence (create or update)
 */
export async function saveSequence(sequence) {
  const db = await openDB()
  const now = new Date().toISOString()
  const data = {
    ...sequence,
    id: sequence.id || crypto.randomUUID(),
    updatedAt: now,
    createdAt: sequence.createdAt || now
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(data)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(data)
  })
}

/**
 * Delete a sequence by ID
 */
export async function deleteSequence(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Check if database is empty
 */
export async function isEmpty() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.count()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result === 0)
  })
}
