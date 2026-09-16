import React from 'react';
import { captureFrontendException } from '@/lib/frontendMonitoring';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
        this.crashReference = globalThis.crypto?.randomUUID?.() || `crash-${Date.now()}`;
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        captureFrontendException(error, {
            componentStack: errorInfo?.componentStack || '',
            reference: this.crashReference,
        });
    }

    render() {
        if (this.state.hasError) {
            const label = this.props.label || 'the application';
            return (
                <div role="alert" style={{ padding: '24px', background: '#111', color: 'white', border: '1px solid #333', borderRadius: '12px', zIndex: 9999, position: 'relative', margin: '20px' }}>
                    <h2>Something went wrong in {label}.</h2>
                    <p style={{ marginTop: '10px', color: '#d4d4d4' }}>
                        Please refresh the page and try again. Your saved project remains available.
                    </p>
                    <p style={{ marginTop: '8px', color: '#a3a3a3', fontSize: '12px' }}>
                        Support reference: {this.crashReference}
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        style={{ marginTop: '16px', border: 0, borderRadius: '999px', background: 'white', color: 'black', padding: '8px 14px', fontWeight: 600, cursor: 'pointer' }}
                    >
                        Refresh page
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
