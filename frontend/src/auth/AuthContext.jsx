import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  clearSession,
  getStoredUser,
  getToken,
  loginRequest,
  logoutRequest,
  meRequest,
  persistSession,
} from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [token, setToken] = useState(getToken());
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await meRequest();
        if (!cancelled) {
          setUser(me);
          persistSession(getToken(), me);
        }
      } catch {
        if (!cancelled) {
          clearSession();
          setUser(null);
          setToken(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(token && user),
      updateUser(next) {
        setUser(next);
        if (next && getToken()) persistSession(getToken(), next);
      },
      applySession(nextToken, nextUser) {
        persistSession(nextToken, nextUser);
        setToken(nextToken);
        setUser(nextUser);
      },
      async refreshUser() {
        const me = await meRequest();
        setUser(me);
        persistSession(getToken(), me);
        return me;
      },
      async login(credentials) {
        const data = await loginRequest(credentials);
        persistSession(data.token, data.user);
        setToken(data.token);
        setUser(data.user);
        return data;
      },
      async logout() {
        await logoutRequest();
        setToken(null);
        setUser(null);
      },
    }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
