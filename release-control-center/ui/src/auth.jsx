import React, { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);
const TOKEN_KEY = 'rcc_api_token';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');

  const value = useMemo(
    () => ({
      token,
      setToken: (t) => {
        setToken(t);
        if (t) sessionStorage.setItem(TOKEN_KEY, t);
        else sessionStorage.removeItem(TOKEN_KEY);
      },
      isAuthenticated: Boolean(token),
    }),
    [token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
