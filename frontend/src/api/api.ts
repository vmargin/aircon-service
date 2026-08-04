import axios, { AxiosError } from 'axios';

/**
 * TYPED API CLIENT
 *
 * `/api/v1` is the canonical prefix; the backend still serves `/api` as an
 * alias for older deployments.
 */
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api/v1',
    timeout: 20_000,
});

export const TOKEN_KEY = 'token';
export const USER_KEY = 'user';

/** Fired when the server rejects our token, so the app can drop to /login. */
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
 * Two jobs:
 *  1. On 401, clear the stale session and tell the app to redirect. Previously
 *     an expired token left the UI mounted, rendering endless failed requests.
 *  2. Normalise errors so components can always read `error.message`.
 */
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ error?: string }>) => {
        if (error.response?.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
        }

        const message =
            error.response?.data?.error ??
            (error.code === 'ECONNABORTED'
                ? 'The request timed out. Please try again.'
                : error.message) ??
            'Something went wrong.';

        return Promise.reject(new Error(message));
    }
);

/**
 * Unwrap a paginated list endpoint (`{ data, pagination }`) down to the rows.
 * Callers that need the page metadata should use `api.get` directly.
 */
export async function getList<T>(
    url: string,
    params?: Record<string, unknown>
): Promise<T[]> {
    const { data } = await api.get<{ data: T[] } | T[]>(url, { params });
    // Tolerate both shapes so a stale API deployment doesn't blank the UI.
    return Array.isArray(data) ? data : data.data;
}

export default api;
