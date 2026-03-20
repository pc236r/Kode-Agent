import { getProjectDocs } from '@context';
import { debug as debugLogger } from '@utils/log/debugLogger';
import { logError } from '@utils/log';
class KodeContextManager {
    static instance;
    projectDocsCache = '';
    cacheInitialized = false;
    initPromise = null;
    static getInstance() {
        if (!KodeContextManager.instance) {
            KodeContextManager.instance = new KodeContextManager();
        }
        return KodeContextManager.instance;
    }
    async initialize() {
        if (this.initPromise)
            return this.initPromise;
        this.initPromise = (async () => {
            try {
                const projectDocs = await getProjectDocs();
                this.projectDocsCache = projectDocs || '';
                this.cacheInitialized = true;
            }
            catch (error) {
                logError(error);
                debugLogger.warn('KODE_CONTEXT_LOAD_FAILED', {
                    error: error instanceof Error ? error.message : String(error),
                });
                this.projectDocsCache = '';
                this.cacheInitialized = true;
            }
        })();
        return this.initPromise;
    }
    getKodeContext() {
        if (!this.cacheInitialized) {
            this.initialize().catch(error => {
                logError(error);
                debugLogger.warn('KODE_CONTEXT_LOAD_FAILED', {
                    error: error instanceof Error ? error.message : String(error),
                });
            });
            return '';
        }
        return this.projectDocsCache;
    }
    async refreshCache() {
        this.cacheInitialized = false;
        this.initPromise = null;
        await this.initialize();
    }
}
const kodeContextManager = KodeContextManager.getInstance();
export const generateKodeContext = () => {
    return kodeContextManager.getKodeContext();
};
export const refreshKodeContext = async () => {
    await kodeContextManager.refreshCache();
};
if (process.env.NODE_ENV !== 'test') {
    setTimeout(() => {
        refreshKodeContext().catch(() => { });
    }, 0);
}
//# sourceMappingURL=kodeContext.js.map