import { useState, useCallback } from 'react';

/**
 * Traccar Authentication and URL Utilities
 * Handles automatic login and URL generation for Traccar integration
 */

interface TraccarUrlOptions {
  deviceId?: string | number;
  fullscreen?: boolean;
  hideHeader?: boolean;
  hideMenu?: boolean;
  hideControls?: boolean;
  mapOnly?: boolean;
  autoLogin?: boolean;
}

/**
 * Generate a Traccar URL with authentication and optional parameters
 * Uses session-based authentication to avoid showing login screens
 */
export function generateTraccarUrl(options: TraccarUrlOptions = {}): string {
  const {
    deviceId,
    fullscreen = true,
    hideHeader = true,
    hideMenu = true,
    hideControls = false,
    mapOnly = false,
    autoLogin = true
  } = options;

  const baseUrl = import.meta.env.VITE_TRACCAR_URL || 'https://fleet.numz.site';
  const params = new URLSearchParams();

  // UI parameters for clean embedding
  if (fullscreen) params.append('fullscreen', 'true');
  if (hideHeader) params.append('hideHeader', 'true');
  if (hideMenu) params.append('hideMenu', 'true');
  if (hideControls) params.append('hideControls', 'true');
  if (mapOnly) params.append('mapOnly', 'true');

  // Use Traccar's session-based authentication
  // This relies on the browser's session management to handle authentication
  if (autoLogin) {
    // Add parameters that help with seamless embedding
    params.append('embedded', 'true');
    params.append('session', 'true');
  }

  // Device-specific parameters
  if (deviceId) {
    params.append('deviceId', deviceId.toString());
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Perform background authentication to Traccar
 * This function handles login silently without showing any UI
 * FIXED: Now properly handles session cookies and authentication state
 */
export async function authenticateTraccarBackground(): Promise<boolean> {
  try {
    const credentials = getTraccarCredentials();
    if (!credentials) {
      console.warn('⚠️ No Traccar credentials configured');
      return false;
    }

    const baseUrl = import.meta.env.VITE_TRACCAR_URL || 'https://fleet.numz.site';
    
    // First, try to access Traccar to check if already authenticated
    try {
      const response = await fetch(`${baseUrl}/api/devices`, {
        method: 'GET',
        credentials: 'include', // Include cookies
        headers: {
          'Accept': 'application/json',
        }
      });
      
      // If we get a successful response, we're already authenticated
      if (response.ok) {
        return true;
      } else {
      }
    } catch (error) {
    }
    
    // Perform login using form submission to get proper session cookies
    const loginFormData = new FormData();
    loginFormData.append('username', credentials.username);
    loginFormData.append('password', credentials.password);
    
    try {
      const loginResponse = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        credentials: 'include', // Important: include cookies
        body: loginFormData,
        redirect: 'manual', // Don't follow redirects
      });
      
      
      // Check if login was successful
      if (loginResponse.status === 200 || loginResponse.status === 302) {
        
        // Verify authentication by testing API access
        try {
          const testResponse = await fetch(`${baseUrl}/api/devices`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
            }
          });
          
          if (testResponse.ok) {
            return true;
          } else {
            console.warn('⚠️ API test failed with status:', testResponse.status);
          }
        } catch (testError) {
          console.warn('⚠️ Login successful but API test failed:', testError);
        }
        
        return true;
      } else {
        console.warn('⚠️ Traccar login failed with status:', loginResponse.status);
        return false;
      }
    } catch (loginError) {
      console.error('❌ Traccar login request failed:', loginError);
      return false;
    }
  } catch (error) {
    console.error('❌ Background authentication failed:', error);
    return false;
  }
}

/**
 * Check if Traccar authentication is configured
 */
export function isTraccarAuthConfigured(): boolean {
  return !!import.meta.env.VITE_TRACCAR_AUTH;
}

/**
 * Debug function to check Traccar authentication status
 * Useful for troubleshooting authentication issues
 */
export async function debugTraccarAuth(): Promise<{
  configured: boolean;
  credentials: { username: string; password: string } | null;
  baseUrl: string;
  authStatus: 'unknown' | 'authenticated' | 'not_authenticated' | 'error';
  details?: string;
}> {
  try {
    const configured = isTraccarAuthConfigured();
    const credentials = getTraccarCredentials();
    const baseUrl = import.meta.env.VITE_TRACCAR_URL || 'https://fleet.numz.site';
    
    if (!configured || !credentials) {
      return {
        configured,
        credentials,
        baseUrl,
        authStatus: 'not_authenticated',
        details: 'No credentials configured'
      };
    }
    
    // Test authentication
    try {
      const response = await fetch(`${baseUrl}/api/devices`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        return {
          configured,
          credentials,
          baseUrl,
          authStatus: 'authenticated',
          details: `API access successful (${response.status})`
        };
      } else {
        return {
          configured,
          credentials,
          baseUrl,
          authStatus: 'not_authenticated',
          details: `API access failed (${response.status})`
        };
      }
    } catch (error) {
      return {
        configured,
        credentials,
        baseUrl,
        authStatus: 'error',
        details: `API test error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  } catch (error) {
    return {
      configured: false,
      credentials: null,
      baseUrl: 'unknown',
      authStatus: 'error',
      details: `Debug function error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Get Traccar credentials (decoded from environment variable)
 */
export function getTraccarCredentials(): { username: string; password: string } | null {
  const authString = import.meta.env.VITE_TRACCAR_AUTH;
  if (!authString) return null;

  try {
    const decoded = atob(authString);
    const [username, password] = decoded.split(':');
    
    if (username && password) {
      return { username, password };
    }
  } catch (error) {
    console.warn('Failed to decode Traccar credentials');
  }

  return null;
}

/**
 * Enhanced TraccarIframe component hook for background authentication
 */
export function useTraccarBackgroundAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const authenticate = useCallback(async () => {
    if (isAuthenticated || isAuthenticating) return;
    
    setIsAuthenticating(true);
    try {
      const success = await authenticateTraccarBackground();
      setIsAuthenticated(success);
    } catch (error) {
      console.error('Authentication failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsAuthenticating(false);
    }
  }, [isAuthenticated, isAuthenticating]);

  return {
    isAuthenticated,
    isAuthenticating,
    authenticate
  };
}
