import { useEffect } from 'react';
import { logUnaryEvent } from '@utils/log/unaryLogging';
import { env } from '@utils/config/env';
export function usePermissionRequestLogging(toolUseConfirm, unaryEvent) {
    useEffect(() => {
        const languagePromise = Promise.resolve(unaryEvent.language_name);
        languagePromise.then(language => {
            logUnaryEvent({
                completion_type: unaryEvent.completion_type,
                event: 'response',
                metadata: {
                    language_name: language,
                    message_id: toolUseConfirm.assistantMessage.message.id,
                    platform: env.platform,
                },
            });
        });
    }, [toolUseConfirm, unaryEvent]);
}
//# sourceMappingURL=usePermissionRequestLogging.js.map