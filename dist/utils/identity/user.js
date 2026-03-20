import { getGlobalConfig, getOrCreateUserID } from '@utils/config';
import { memoize } from 'lodash-es';
import { env } from '@utils/config/env';
import { execFileNoThrow } from '@utils/system/execFileNoThrow';
import { logError, SESSION_ID } from '@utils/log';
import { MACRO } from '@constants/macros';
export const getGitEmail = memoize(async () => {
    const result = await execFileNoThrow('git', ['config', 'user.email']);
    if (result.code !== 0) {
        logError(`Failed to get git email: ${result.stdout} ${result.stderr}`);
        return undefined;
    }
    return result.stdout.trim() || undefined;
});
export const getUser = memoize(async () => {
    const userID = getOrCreateUserID();
    const config = getGlobalConfig();
    const email = undefined;
    return {
        customIDs: {
            sessionId: SESSION_ID,
        },
        userID,
        appVersion: MACRO.VERSION,
        userAgent: env.platform,
        email,
        custom: {
            nodeVersion: env.nodeVersion,
            userType: process.env.USER_TYPE,
            organizationUuid: config.oauthAccount?.organizationUuid,
            accountUuid: config.oauthAccount?.accountUuid,
        },
    };
});
//# sourceMappingURL=user.js.map