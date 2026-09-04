import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

/**
 * The QueryClient lives in App.tsx alongside the router — main.tsx used to
 * create a second one here and switch on `window.location.pathname`, which is
 * what react-router is for.
 */
createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </StrictMode>
);
