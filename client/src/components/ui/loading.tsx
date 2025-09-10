import React from 'react';
import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export function Loading({ size = 'md', text, className }: LoadingProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center gap-2', className)}>
      <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
      {text && (
        <p className="text-sm text-muted-foreground">{text}</p>
      )}
    </div>
  );
}

export function PageLoading() {
  const [showTimeout, setShowTimeout] = useState(false);

  // Show timeout message after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTimeout(true);
    }, 8000);

    return () => clearTimeout(timer);
  }, []);

  const handleBypass = () => {
    // Clear any stored auth data and force login
    localStorage.removeItem('supabase.auth.token');
    localStorage.removeItem('sb-yyqvediztsrlugentoca-auth-token');
    sessionStorage.clear();
    window.location.reload();
  };

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="space-y-6 w-[400px] text-center">
        <Loading size="lg" text="Authenticating..." />
        
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Checking your session and loading the application...
          </p>
          
          {showTimeout && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 mb-3">
                ⏱️ Loading is taking longer than expected. This might be due to network issues.
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleRetry}
                  className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                >
                  Retry
                </button>
                <button
                  onClick={handleBypass}
                  className="px-3 py-1.5 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
                >
                  Clear & Reload
                </button>
              </div>
            </div>
          )}
          
          {!showTimeout && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-2">
                Having trouble? Wait a moment or try refreshing.
              </p>
              <button
                onClick={handleRetry}
                className="text-xs text-primary hover:underline"
              >
                Refresh page
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function InlineLoading({ size = 'sm', text }: LoadingProps) {
  return (
    <div className="flex items-center gap-2">
      <Loading size={size} />
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </div>
  );
}
