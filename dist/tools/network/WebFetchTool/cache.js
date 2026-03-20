class URLCache {
  cache = new Map();
  CACHE_DURATION = 15 * 60 * 1000;
  set(url, entry) {
    this.cache.set(url, {
      ...entry,
      timestamp: Date.now(),
    });
  }
  get(url) {
    const entry = this.cache.get(url);
    if (!entry) {
      return null;
    }
    if (Date.now() - entry.timestamp > this.CACHE_DURATION) {
      this.cache.delete(url);
      return null;
    }
    return entry;
  }
  clear() {
    this.cache.clear();
  }
  cleanExpired() {
    const now = Date.now();
    for (const [url, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_DURATION) {
        this.cache.delete(url);
      }
    }
  }
  constructor() {
    setInterval(
      () => {
        this.cleanExpired();
      },
      5 * 60 * 1000,
    );
  }
}
export const urlCache = new URLCache();
//# sourceMappingURL=cache.js.map
