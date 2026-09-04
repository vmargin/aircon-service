import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Last-resort boundary. Catches render-time crashes so a component bug shows a
 * recoverable screen instead of a blank white page.
 */
class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { error: Error | null }
> {
    state: { error: Error | null } = { error: null };

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    componentDidCatch(error: Error) {
        console.error('Unhandled UI error:', error);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
                <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-center">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-rose-50 flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-rose-500" />
                    </div>
                    <h1 className="mt-4 text-base font-bold text-slate-800">
                        Something broke
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">{this.state.error.message}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition"
                    >
                        Reload
                    </button>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
