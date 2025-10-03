"use client";
import React, { useState, useEffect } from "react";

// Simple runtime error boundary (client side) to surface errors instead of blank screen
function RuntimeErrorBoundary({ children }: { children: React.ReactNode }) {
  const [err, setErr] = useState<Error | null>(null);
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      setErr(event.error || new Error(event.message));
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, []);
  if (err) {
    return (
      <div className="p-6 text-red-600 font-mono text-sm space-y-2">
        <h2 className="font-bold">Client Runtime Error</h2>
        <pre className="whitespace-pre-wrap break-all">{err.message}</pre>
        {err.stack && (
          <details open>
            <summary className="cursor-pointer mb-1">Stack trace</summary>
            <pre className="whitespace-pre-wrap break-all max-h-64 overflow-auto">{err.stack}</pre>
          </details>
        )}
        <button
          onClick={() => location.reload()}
          className="px-3 py-1 rounded bg-red-500 text-white text-xs"
        >Reload</button>
      </div>
    );
  }
  return <>{children}</>;
}

export { RuntimeErrorBoundary };