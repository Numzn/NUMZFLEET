import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

export interface NetworkStatus {
  isOnline: boolean;
  isConnected: boolean;
  lastError: string | null;
  retryCount: number;
  isRetrying: boolean;
}

export const useNetworkStatus = () => {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    isConnected: true,
    lastError: null,
    retryCount: 0,
    isRetrying: false,
  });

  // Monitor browser online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Network: Browser is online');
      setStatus(prev => ({
        ...prev,
        isOnline: true,
        lastError: null,
        retryCount: 0,
      }));
      
      toast({
        title: "🌐 Network Restored",
        description: "Internet connection has been restored.",
        variant: "default",
      });
    };

    const handleOffline = () => {
      console.log('🌐 Network: Browser is offline');
      setStatus(prev => ({
        ...prev,
        isOnline: false,
        isConnected: false,
        lastError: 'No internet connection',
      }));
      
      toast({
        title: "🌐 No Internet Connection",
        description: "Please check your internet connection and try again.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Test server connectivity
  const testServerConnection = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('/api/health', {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      const isConnected = response.ok;
      setStatus(prev => ({
        ...prev,
        isConnected,
        lastError: isConnected ? null : `Server error: ${response.status}`,
      }));

      return isConnected;
    } catch (error) {
      console.error('🌐 Server connection test failed:', error);
      
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Connection timeout';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Server unreachable';
        } else {
          errorMessage = error.message;
        }
      }

      setStatus(prev => ({
        ...prev,
        isConnected: false,
        lastError: errorMessage,
      }));

      return false;
    }
  }, []);

  // Handle network errors with retry logic
  const handleNetworkError = useCallback((error: any, context: string = 'API call') => {
    console.error(`🌐 Network error in ${context}:`, error);
    
    let errorMessage = 'Unknown network error';
    let shouldRetry = false;

    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        errorMessage = 'No internet connection';
        shouldRetry = true;
      } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        errorMessage = 'Connection timeout - server is slow';
        shouldRetry = true;
      } else if (error.message.includes('ENOTFOUND')) {
        errorMessage = 'Server not found - check your connection';
        shouldRetry = true;
      } else if (error.message.includes('ECONNRESET')) {
        errorMessage = 'Connection reset by server';
        shouldRetry = true;
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error (500) - please try again later';
        shouldRetry = true;
      } else if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = 'Authentication failed - please login again';
        shouldRetry = false;
      } else {
        errorMessage = error.message;
        shouldRetry = true;
      }
    }

    setStatus(prev => ({
      ...prev,
      isConnected: false,
      lastError: errorMessage,
      retryCount: shouldRetry ? prev.retryCount + 1 : prev.retryCount,
    }));

    // Show appropriate toast based on error type
    if (errorMessage.includes('No internet connection')) {
      toast({
        title: "🌐 No Internet Connection",
        description: "Please check your internet connection and try again.",
        variant: "destructive",
      });
    } else if (errorMessage.includes('timeout')) {
      toast({
        title: "⏱️ Connection Timeout",
        description: "The server is taking too long to respond. Please try again.",
        variant: "destructive",
      });
    } else if (errorMessage.includes('Server error')) {
      toast({
        title: "🔧 Server Error",
        description: "The server is experiencing issues. Please try again later.",
        variant: "destructive",
      });
    } else if (errorMessage.includes('Authentication failed')) {
      toast({
        title: "🔐 Authentication Error",
        description: "Your session has expired. Please login again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "🌐 Network Error",
        description: errorMessage,
        variant: "destructive",
      });
    }

    return { errorMessage, shouldRetry };
  }, []);

  // Retry mechanism
  const retry = useCallback(async (retryFunction: () => Promise<any>, maxRetries: number = 3) => {
    if (status.retryCount >= maxRetries) {
      toast({
        title: "🔄 Max Retries Reached",
        description: `Failed after ${maxRetries} attempts. Please check your connection.`,
        variant: "destructive",
      });
      return false;
    }

    setStatus(prev => ({ ...prev, isRetrying: true }));

    try {
      const result = await retryFunction();
      setStatus(prev => ({
        ...prev,
        isConnected: true,
        lastError: null,
        retryCount: 0,
        isRetrying: false,
      }));
      
      toast({
        title: "✅ Connection Restored",
        description: "Successfully reconnected to the server.",
        variant: "default",
      });
      
      return result;
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        retryCount: prev.retryCount + 1,
        isRetrying: false,
      }));
      
      handleNetworkError(error, 'retry attempt');
      return false;
    }
  }, [status.retryCount, handleNetworkError]);

  // Reset retry count
  const resetRetryCount = useCallback(() => {
    setStatus(prev => ({
      ...prev,
      retryCount: 0,
      lastError: null,
    }));
  }, []);

  return {
    ...status,
    testServerConnection,
    handleNetworkError,
    retry,
    resetRetryCount,
  };
};

