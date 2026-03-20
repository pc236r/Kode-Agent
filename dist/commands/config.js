import { Config } from '@components/Config';
import * as React from 'react';
const config = {
    type: 'local-jsx',
    name: 'config',
    description: '打开配置面板',
    isEnabled: true,
    isHidden: false,
    async call(onDone) {
        return React.createElement(Config, { onClose: onDone });
    },
    userFacingName() {
        return 'config';
    },
};
export default config;
//# sourceMappingURL=config.js.map