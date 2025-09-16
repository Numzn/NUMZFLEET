import React from 'react';

/**
 * Environment Variables Test Page
 * This page shows what environment variables are actually loaded
 */
export default function EnvTestPage() {
  const envVars = {
    VITE_TRACCAR_URL: import.meta.env.VITE_TRACCAR_URL,
    VITE_TRACCAR_AUTH: import.meta.env.VITE_TRACCAR_AUTH ? '***HIDDEN***' : 'NOT SET',
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? '***HIDDEN***' : 'NOT SET',
    VITE_APP_MODE: import.meta.env.VITE_APP_MODE,
    VITE_DEBUG: import.meta.env.VITE_DEBUG,
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Environment Variables Test</h1>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-4">Loaded Environment Variables:</h2>
          <div className="space-y-2">
            {Object.entries(envVars).map(([key, value]) => (
              <div key={key} className="flex items-center gap-4">
                <code className="bg-white px-2 py-1 rounded border text-sm font-mono w-48">
                  {key}
                </code>
                <span className="text-sm">:</span>
                <code className="bg-white px-2 py-1 rounded border text-sm font-mono flex-1">
                  {value || 'undefined'}
                </code>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-2">Expected Values:</h3>
          <ul className="text-sm space-y-1">
            <li><strong>VITE_TRACCAR_URL:</strong> https://fleet.numz.site</li>
            <li><strong>VITE_TRACCAR_AUTH:</strong> bnVtZXJpbnlpcmVuZGExNEBnbWFpbC5jb206bnVtejAwOTk=</li>
            <li><strong>VITE_SUPABASE_URL:</strong> https://yyqvediztsrlugentoca.supabase.co</li>
            <li><strong>VITE_APP_MODE:</strong> development</li>
            <li><strong>VITE_DEBUG:</strong> true</li>
          </ul>
        </div>

        <div className="mt-6">
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
}




