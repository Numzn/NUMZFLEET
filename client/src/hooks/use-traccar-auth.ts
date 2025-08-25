import { useState, useEffect } from 'react';
import { authenticateTraccarBackground } from '@/lib/traccar-auth';

// Global state for Traccar authentication
let globalAuthState = {
  isAuthenticated: false,
  isAuthenticating: false,
  lastAuthAttempt: 0,
};

// Listeners for state changes
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(listener => listener());
}

function setGlobalAuthState(newState: Partial<typeof globalAuthState>) {
  globalAuthState = { ...globalAuthState, ...newState };
  notifyListeners();
}

export function useTraccarAuth() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);

  const authenticate = async () => {
    if (globalAuthState.isAuthenticated || globalAuthState.isAuthenticating) {
      return globalAuthState.isAuthenticated;
    }

    // Check if we've tried recently (within 5 minutes)
    const now = Date.now();
    if (now - globalAuthState.lastAuthAttempt < 5 * 60 * 1000) {
      return globalAuthState.isAuthenticated;
    }

    setGlobalAuthState({ isAuthenticating: true, lastAuthAttempt: now });

    try {
      const success = await authenticateTraccarBackground();
      setGlobalAuthState({ isAuthenticated: success, isAuthenticating: false });
      return success;
    } catch (error) {
      console.error('Traccar authentication failed:', error);
      setGlobalAuthState({ isAuthenticated: false, isAuthenticating: false });
      return false;
    }
  };

  const resetAuth = () => {
    setGlobalAuthState({ isAuthenticated: false, isAuthenticating: false, lastAuthAttempt: 0 });
  };

  return {
    isAuthenticated: globalAuthState.isAuthenticated,
    isAuthenticating: globalAuthState.isAuthenticating,
    authenticate,
    resetAuth,
  };
}

// Function to trigger authentication from anywhere
export function triggerTraccarAuth() {
  const { authenticate } = useTraccarAuth();
  return authenticate();
}



