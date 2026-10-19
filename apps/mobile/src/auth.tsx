// Auth state: restores the stored session on launch, signs in/out, and signs out on any 401.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onUnauthorized, signIn as signInRequest } from './api';
import type { UserDTO } from './api-types';
import { clearStoredUser, clearToken, getStoredUser, getToken, setStoredUser, setToken } from './storage';

export interface AuthValue {
  token: string | null;
  user: UserDTO | null;
  /** True while the stored session is being restored. */
  loading: boolean;
  signIn: (email: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<UserDTO | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on launch. A token without a user is treated as signed out.
  useEffect(() => {
    let active = true;
    (async () => {
      const [storedToken, storedUser] = await Promise.all([getToken(), getStoredUser<UserDTO>()]);
      if (!active) return;
      if (storedToken && storedUser) {
        setTokenState(storedToken);
        setUser(storedUser);
      } else if (storedToken) {
        await clearToken();
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    setTokenState(null);
    setUser(null);
    await Promise.all([clearToken(), clearStoredUser()]);
  }, []);

  const signIn = useCallback(async (email: string, name?: string): Promise<void> => {
    const trimmedName = name?.trim();
    const session = await signInRequest(email.trim(), trimmedName ? trimmedName : undefined);
    await setToken(session.token);
    await setStoredUser(session.user);
    setTokenState(session.token);
    setUser(session.user);
  }, []);

  useEffect(() => {
    onUnauthorized(() => {
      void signOut();
    });
    return () => onUnauthorized(null);
  }, [signOut]);

  const value = useMemo<AuthValue>(
    () => ({ token, user, loading, signIn, signOut }),
    [token, user, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
