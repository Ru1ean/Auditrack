import { useEffect, useRef, useCallback } from 'react';
import { socket } from './socket';

// Connect Socket.io to global live sync events in browser
if (typeof window !== 'undefined') {
  socket.on('data_updated', (data) => {
    window.dispatchEvent(
      new CustomEvent('app:data-sync', {
        detail: {
          entityType: data?.entityType || 'all',
          payload: data?.payload,
          silent: true,
          fromSocket: true,
          timestamp: data?.timestamp || Date.now(),
        },
      })
    );
  });
}

/**
 * Dispatches a global event indicating that data was mutated locally in the application.
 * @param {string} [entityType] - Optional entity name or URL that was changed.
 * @param {any} [payload] - Optional details of the change.
 */
export function notifyDataChanged(entityType = 'all', payload = null) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app:data-sync', {
        detail: { entityType, payload, silent: true, timestamp: Date.now() },
      })
    );
  }
}

/**
 * Custom hook that automatically re-triggers a data fetch callback:
 * 1. When Socket.io broadcasts a real-time data update from any user/tab
 * 2. When another part of the local application mutates data (app:data-sync event)
 * 3. When the user returns to or focuses the window/tab
 * 4. Periodically in the background (if intervalMs > 0)
 *
 * @param {Function} refreshCallback - Function that fetches fresh data. Receives ({ silent: true }) on background live updates!
 * @param {Object} [options]
 * @param {boolean} [options.enableSyncEvent=true] - Listen to live socket / app:data-sync
 * @param {boolean} [options.enableFocus=true] - Re-fetch on window focus / tab visibility
 * @param {number} [options.intervalMs=0] - Polling interval in ms (0 to disable)
 * @param {string|string[]} [options.entityTypes] - Filter specific entity types (e.g. 'events', 'compliance')
 * @param {Array} [options.deps=[]] - Additional dependencies to trigger refresh
 */
export function useLiveRefresh(refreshCallback, options = {}) {
  const {
    enableSyncEvent = true,
    enableFocus = true,
    intervalMs = 0,
    entityTypes = null,
    deps = [],
  } = options;

  const callbackRef = useRef(refreshCallback);
  const lastRunRef = useRef(0);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    callbackRef.current = refreshCallback;
  }, [refreshCallback]);

  const executeRefresh = useCallback((immediate = false, meta = { silent: true }) => {
    if (typeof callbackRef.current !== 'function') return;

    if (immediate) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      lastRunRef.current = Date.now();
      callbackRef.current(meta);
      return;
    }

    // Debounce to batch multiple rapid changes cleanly
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      lastRunRef.current = Date.now();
      if (typeof callbackRef.current === 'function') {
        callbackRef.current(meta);
      }
    }, 350);
  }, []);

  useEffect(() => {
    // 1. Data mutation listener (Socket.io and local events)
    const handleDataSync = (event) => {
      const incomingType = event?.detail?.entityType || 'all';

      // Check if entity matches filter if provided
      if (entityTypes && incomingType !== 'all') {
        const allowed = Array.isArray(entityTypes) ? entityTypes : [entityTypes];
        if (!allowed.includes(incomingType) && !allowed.includes('all')) {
          return;
        }
      }

      executeRefresh(false, { silent: true, detail: event?.detail });
    };

    // 2. Focus & Visibility listener
    const handleFocusOrVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Only run if last run was more than 3 seconds ago to avoid unnecessary re-fetch
        if (Date.now() - lastRunRef.current > 3000) {
          executeRefresh(false, { silent: true });
        }
      }
    };

    if (enableSyncEvent) {
      window.addEventListener('app:data-sync', handleDataSync);
    }

    if (enableFocus) {
      window.addEventListener('focus', handleFocusOrVisibility);
      document.addEventListener('visibilitychange', handleFocusOrVisibility);
    }

    // 3. Periodic background refresh (only while tab is visible)
    let intervalId = null;
    if (intervalMs > 0) {
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible') {
          executeRefresh(false, { silent: true });
        }
      }, intervalMs);
    }

    return () => {
      if (enableSyncEvent) {
        window.removeEventListener('app:data-sync', handleDataSync);
      }
      if (enableFocus) {
        window.removeEventListener('focus', handleFocusOrVisibility);
        document.removeEventListener('visibilitychange', handleFocusOrVisibility);
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [enableSyncEvent, enableFocus, intervalMs, entityTypes, executeRefresh, ...deps]);
}
