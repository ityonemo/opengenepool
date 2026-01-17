/**
 * Readonly backend adapter - a no-op backend that silently ignores all edit operations.
 *
 * This is a safety measure for readonly mode. Even if UI elements aren't properly
 * disabled, this backend ensures no edits can be sent to the server.
 *
 * Usage:
 *   import { createReadonlyBackend } from '../adapters/readonlyBackend.js'
 *   const backend = readonly ? createReadonlyBackend() : createLiveViewBackend(live)
 */

export function createReadonlyBackend() {
  return {
    // Sequence operations - silently ignore
    insert: () => {},
    delete: () => {},

    // Annotation operations - silently ignore
    annotationCreated: () => {},
    annotationChanged: () => {},
    annotationDeleted: () => {},

    // Metadata operations - silently ignore
    titleChange: () => {},
    metadataInsert: () => {},
    metadataEdit: () => {},
    metadataDelete: () => {},

    // Callbacks - return no-op cleanup functions
    onAck: () => () => {},
    onError: () => () => {},
  }
}
