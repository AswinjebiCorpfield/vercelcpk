import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

// Color-mode (light/dark) context with localStorage persistence.
export const ColorModeContext = createContext({ mode: 'dark', toggle: () => {}, setMode: () => {} });

const STORAGE_KEY = 'pcm-color-mode';

const getInitialMode = () => {
  if (typeof window === 'undefined') return 'dark';
  const param = new URLSearchParams(window.location.search).get('mode');
  if (param === 'light' || param === 'dark') return param;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === 'light' || saved === 'dark' ? saved : 'dark';
};

export function ColorModeProvider({ children }) {
  const [mode, setModeState] = useState(getInitialMode);

  const setMode = useCallback((m) => {
    setModeState(m);
    try { window.localStorage.setItem(STORAGE_KEY, m); } catch (e) { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { window.localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* ignore */ }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ mode, toggle, setMode }), [mode, toggle, setMode]);
  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}

export const useColorMode = () => useContext(ColorModeContext);
