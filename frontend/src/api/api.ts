import axios, { AxiosError } from 'axios';

/**
 * TYPED API CLIENT
 *
 * `/api/v1` is the canonical prefix; in dev, Vite proxies it to :5000.
 */
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api/v1',
    timeout: 20_000,
});

export const TOKEN_KEY = 'token';
export const USER_KEY = 'user';

/** Fired when the server rejects our token, so AuthProvider can sign out. */
export const AUTH_EXPIRED_EVENT = 'auth:expired';

api.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

/**
 * RESPONSE INTERCEPTOR
 *
 * On 401, clear the stale session and tell the app to sign out. Previously an
 * expired token left the UI mounted, firing endless failed requests.
 *
 * Errors are normalised to a plain `Error` whose `.message` is the server's
 * message, so every component can render `error.message` and nothing has to
 * reach into `err.response.data.error`.
 */
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ error?: string }>) => {
        // Don't bounce the user on a failed login attempt — that 401 is the
        // expected answer to a wrong password, not an expired session.
        const isLoginRequest = error.config?.url?.includes('/auth/login');

        if (error.response?.status === 401 && !isLoginRequest) {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
        }

        const message =
            error.response?.data?.error ??
            (error.code === 'ECONNABORTED'
                ? 'The request timed out. Please try again.'
                : error.code === 'ERR_NETWORK'
                  ? 'Cannot reach the server. Is the backend running?'
                  : error.message) ??
            'Something went wrong.';

        return Promise.reject(new Error(message));
    }
);

/**
 * Unwrap a paginated list endpoint (`{ data, pagination }`) down to the rows.
 * Callers that need page metadata should use `api.get` directly.
 */
export async function getList<T>(url: string, params?: Record<string, unknown>): Promise<T[]> {
    const { data } = await api.get<{ data: T[] } | T[]>(url, { params });
    // Tolerate both shapes so a stale API deployment doesn't blank the UI.
    return Array.isArray(data) ? data : data.data;
}

/** Peso formatting, used everywhere money is shown. */
export function formatCurrency(value: string | number | null | undefined): string {
    const n = Number(value ?? 0);
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
    }).format(Number.isFinite(n) ? n : 0);
}

export function formatDate(value: string | Date, withTime = false): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
    });
}

export default api;
