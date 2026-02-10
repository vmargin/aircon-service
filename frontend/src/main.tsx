import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';
import PublicBooking from './components/PublicBooking';
import ErrorBoundary from './components/ErrorBoundary';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
        },
    },
});

const isPublicBooking = window.location.pathname.startsWith('/book');

createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                {isPublicBooking ? <PublicBooking /> : <App />}
            </QueryClientProvider>
        </ErrorBoundary>
    </StrictMode>,
);
