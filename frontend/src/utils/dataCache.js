/**
 * In-Memory Data Cache with Stale-While-Revalidate (SWR) Support
 * 
 * Provides instant 0ms retrieval for previously loaded data (requirements,
 * office summaries, assigned users, and user evidence files) while silently
 * revalidating in the background.
 */

class DataCache {
    constructor(defaultTTL = 5 * 60 * 1000) { // default 5 minutes
        this.cache = new Map();
        this.defaultTTL = defaultTTL;
        this.activeFetches = new Map(); // deduplicate in-flight requests
    }

    /**
     * Set a value in the cache
     * @param {string} key 
     * @param {any} data 
     * @param {number} [ttl] Time to live in ms
     */
    set(key, data, ttl = this.defaultTTL) {
        if (!key) return;
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            expiresAt: Date.now() + ttl,
        });
    }

    /**
     * Get a value from the cache
     * @param {string} key 
     * @returns {any|null}
     */
    get(key) {
        if (!key || !this.cache.has(key)) return null;
        const entry = this.cache.get(key);
        return entry.data;
    }

    /**
     * Check if key exists in cache
     * @param {string} key 
     * @returns {boolean}
     */
    has(key) {
        return !!key && this.cache.has(key);
    }

    /**
     * Check if cache entry is still fresh (not expired)
     * @param {string} key 
     * @returns {boolean}
     */
    isFresh(key) {
        if (!key || !this.cache.has(key)) return false;
        const entry = this.cache.get(key);
        return Date.now() < entry.expiresAt;
    }

    /**
     * Invalidate (remove) a specific key or keys matching a prefix/regex
     * @param {string|RegExp} pattern 
     */
    invalidate(pattern) {
        if (!pattern) return;
        if (typeof pattern === 'string') {
            for (const key of this.cache.keys()) {
                if (key === pattern || key.startsWith(pattern)) {
                    this.cache.delete(key);
                }
            }
        } else if (pattern instanceof RegExp) {
            for (const key of this.cache.keys()) {
                if (pattern.test(key)) {
                    this.cache.delete(key);
                }
            }
        }
    }

    /**
     * Clear all cached items
     */
    clear() {
        this.cache.clear();
        this.activeFetches.clear();
    }

    /**
     * Stale-While-Revalidate (SWR) Runner
     * Immediately returns cached data if available, and runs the fetcher in the background.
     * 
     * @param {string} key
     * @param {Function} fetcher Async function that returns fresh data
     * @param {Object} [options]
     * @param {number} [options.ttl] Custom TTL
     * @param {boolean} [options.force] Force network request
     * @param {Function} [options.onFresh] Callback when fresh data arrives
     * @returns {Promise<{ data: any, isStale: boolean }>}
     */
    async fetchWithSWR(key, fetcher, options = {}) {
        const { ttl = this.defaultTTL, force = false, onFresh } = options;

        const cached = this.get(key);
        const fresh = this.isFresh(key);

        // Deduplicate ongoing network calls for the same key
        const executeFetch = async () => {
            if (this.activeFetches.has(key)) {
                return this.activeFetches.get(key);
            }

            const fetchPromise = (async () => {
                try {
                    const freshData = await fetcher();
                    if (freshData !== undefined && freshData !== null) {
                        this.set(key, freshData, ttl);
                        if (typeof onFresh === 'function') {
                            onFresh(freshData);
                        }
                    }
                    return freshData;
                } finally {
                    this.activeFetches.delete(key);
                }
            })();

            this.activeFetches.set(key, fetchPromise);
            return fetchPromise;
        };

        // If we have cached data and not forcing, return cached immediately and refresh in background
        if (cached && !force) {
            if (!fresh) {
                // Revalidate in background silently
                executeFetch().catch((err) => console.warn(`[DataCache] Background revalidate failed for ${key}:`, err));
            }
            return { data: cached, isStale: !fresh };
        }

        // If no cache or forced, await the network call
        const freshData = await executeFetch();
        return { data: freshData, isStale: false };
    }
}

export const dataCache = new DataCache(10 * 60 * 1000); // 10 minute default cache

// Invalidate in-memory cache whenever live data mutations arrive from Socket.io
if (typeof window !== 'undefined') {
    window.addEventListener('app:data-sync', () => {
        dataCache.clear();
    });
}

// Convenience helpers
export const CacheKeys = {
    officeReqs: (officeid) => `office_reqs_${officeid}`,
    userFiles: (reqId, userid, officeid = 'all') => `user_files_${reqId}_${officeid || 'all'}_${userid}`,
    allUserFilesForReq: (reqId, officeid = 'all') => `user_files_${reqId}_${officeid || 'all'}_`,
    officeSummary: (officeid) => `office_summary_${officeid}`,
};

