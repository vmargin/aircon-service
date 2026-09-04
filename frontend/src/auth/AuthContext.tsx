import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { AUTH_EXPIRED_EVENT, TOKEN_KEY, USER_KEY } from '../api/api';
import { User } from '../types';

/**
 * AUTH
 *
 * Single source of truth for "who is signed in". Previously every component
 * did its own `JSON.parse(localStorage.getItem('user'))`, which meant:
 *   - a corrupt entry threw in a dozen places,
 *   - nothing re-rendered when the session changed, and
 *   - a token the server had already rejected was still trusted.
 *
 * On boot we hold the UI in a `loading` state and call `/auth/me` to confirm
 * the stored token is still valid before rendering the app.
 */

interface AuthContextValue {
    user: User | null;
    /** True while the initial token check is in flight. */
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): User | null {
    try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? (JSON.parse(raw) as User) : null;
    } catch {
        // A malformed entry is worthless — drop it rather than crash on boot.
        localStorage.removeItem(USER_KEY);
        return null;
    }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(readStoredUser);
    const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
    }, []);

    // Validate the stored token once on mount.
    useEffect(() => {
        if (!localStorage.getItem(TOKEN_KEY)) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        api.get<{ user: User }>('/auth/me')
            .then(({ data }) => {
                if (cancelled) return;
                localStorage.setItem(USER_KEY, JSON.stringify(data.user));
                setUser(data.user);
            })
            .catch(() => {
                // The interceptor already cleared storage on a 401; make sure
                // React state agrees so we render the login screen.
                if (!cancelled) logout();
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [logout]);

    // The axios interceptor fires this when any request comes back 401.
    useEffect(() => {
        const onExpired = () => setUser(null);
        window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
        return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const { data } = await api.post<{ token: string; user: User }>('/auth/login', {
            email,
            password,
        });
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setUser(data.user);
    }, []);

    return (
        <AuthContext.Provider
            value={{ user, loading, login, logout, isAdmin: user?.role === 'ADMIN' }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
