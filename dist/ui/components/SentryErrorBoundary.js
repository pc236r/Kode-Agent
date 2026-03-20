import * as React from 'react';
import { captureException } from '@services/sentry';
export class SentryErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error) {
        if (error.name === 'AbortError' ||
            error.message?.includes('abort') ||
            error.message?.includes('The operation was aborted')) {
            return;
        }
        captureException(error);
    }
    render() {
        if (this.state.hasError) {
            return null;
        }
        return this.props.children;
    }
}
//# sourceMappingURL=SentryErrorBoundary.js.map