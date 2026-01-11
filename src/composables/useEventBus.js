/**
 * Event bus for plugin communication.
 * Replaces the jQuery plugin broadcast system from the original OpenGenePool.
 *
 * Token types (from original editor.js):
 * - initialize: DOM ready
 * - newdata: sequence loaded
 * - ready: both DOM and data ready
 * - redraw: render specific line (with { line } data)
 * - invalidate: mark line dirty (with { line } data)
 * - render: trigger render pass
 * - rendered: render complete
 * - zoomed: zoom level changed (with { level } data)
 * - resize: container resized
 * - contextmenu: right-click event (with { ref, pos } data)
 * - startselect: begin selection drag
 * - select: select a domain
 * - unselect: clear selection
 */

/**
 * Create a new event bus instance.
 * @returns {EventBus}
 */
export function createEventBus() {
  const listeners = new Map()
  const plugins = new Map()

  /**
   * Subscribe to an event.
   * @param {string} event - Event name
   * @param {Function} handler - Handler function
   */
  function on(event, handler) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set())
    }
    listeners.get(event).add(handler)
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event - Event name
   * @param {Function} handler - Handler function to remove
   */
  function off(event, handler) {
    if (listeners.has(event)) {
      listeners.get(event).delete(handler)
    }
  }

  /**
   * Emit an event to all subscribers.
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  function emit(event, data = {}) {
    // Call direct listeners
    if (listeners.has(event)) {
      for (const handler of listeners.get(event)) {
        handler(data)
      }
    }

    // Call plugin handlers (prefixed with underscore, like original)
    const handlerName = `_${event}`
    for (const [, pluginHandlers] of plugins) {
      if (typeof pluginHandlers[handlerName] === 'function') {
        pluginHandlers[handlerName](data)
      }
    }
  }

  /**
   * Register a plugin with its token handlers.
   * Handlers should be named with underscore prefix: _initialize, _ready, etc.
   * @param {string} name - Plugin name
   * @param {Object} handlers - Object with handler functions
   */
  function registerPlugin(name, handlers) {
    plugins.set(name, handlers)
  }

  /**
   * Unregister a plugin.
   * @param {string} name - Plugin name
   */
  function unregisterPlugin(name) {
    plugins.delete(name)
  }

  /**
   * Broadcast an event from a plugin (adds source to data).
   * @param {string} source - Source plugin name
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  function broadcast(source, event, data = {}) {
    emit(event, { source, ...data })
  }

  return {
    on,
    off,
    emit,
    registerPlugin,
    unregisterPlugin,
    broadcast
  }
}

/**
 * Singleton event bus instance for the editor.
 */
let editorBus = null

/**
 * Get or create the editor event bus singleton.
 * @returns {EventBus}
 */
export function getEditorBus() {
  if (!editorBus) {
    editorBus = createEventBus()
  }
  return editorBus
}

/**
 * Reset the editor bus (useful for testing).
 */
export function resetEditorBus() {
  editorBus = null
}
