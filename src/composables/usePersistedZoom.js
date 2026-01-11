/**
 * Composable for persisting zoom level to localStorage.
 *
 * Usage:
 *   const { getInitialZoom, saveZoom } = usePersistedZoom(props.initialZoom)
 *   editorState.setZoom(getInitialZoom())
 *   watch(zoomLevel, saveZoom)
 */

export const STORAGE_KEY = 'opengenepool-zoom'
const DEFAULT_ZOOM = 100
const MIN_ZOOM = 50

/**
 * @param {number} fallbackZoom - Zoom value to use if localStorage is empty/invalid
 * @param {Storage} storage - Storage implementation (defaults to localStorage)
 */
export function usePersistedZoom(fallbackZoom = DEFAULT_ZOOM, storage = null) {
  // Use provided storage or fall back to localStorage (handle SSR where localStorage doesn't exist)
  const getStorage = () => {
    if (storage) return storage
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null
    } catch {
      return null
    }
  }

  /**
   * Get initial zoom from localStorage, falling back to provided value.
   * @returns {number} The zoom level to use
   */
  function getInitialZoom() {
    try {
      const store = getStorage()
      if (!store) return fallbackZoom

      const stored = store.getItem(STORAGE_KEY)
      if (stored !== null) {
        const parsed = parseInt(stored, 10)
        if (!isNaN(parsed) && parsed >= MIN_ZOOM) {
          return parsed
        }
      }
    } catch (e) {
      // Storage may be unavailable (SSR, private browsing)
    }
    return fallbackZoom
  }

  /**
   * Save zoom level to localStorage.
   * @param {number} level - The zoom level to save
   */
  function saveZoom(level) {
    try {
      const store = getStorage()
      if (store) {
        store.setItem(STORAGE_KEY, String(level))
      }
    } catch (e) {
      // Ignore storage errors (quota exceeded, private browsing, etc.)
    }
  }

  return { getInitialZoom, saveZoom }
}
