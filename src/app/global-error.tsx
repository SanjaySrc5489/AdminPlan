'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log error to console for debugging (dev only)
        if (process.env.NODE_ENV === 'development') {
            console.error('[Global Error]', error);
        }
    }, [error]);

    return (
        <html lang="en">
            <body className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center">
                    {/* Error Icon */}
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                        <AlertCircle className="w-10 h-10 text-red-400" />
                    </div>

                    {/* Error Message - Generic, no sensitive details */}
                    <h1 className="text-2xl font-bold text-white mb-2">
                        Something went wrong
                    </h1>
                    <p className="text-slate-400 mb-8">
                        An unexpected error occurred. Please try again or return to the dashboard.
                    </p>

                    {/* Action Buttons */}
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={reset}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition-all"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Try Again
                        </button>
                        <Link
                            href="/"
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-semibold shadow-lg hover:shadow-purple-500/30 transition-all"
                        >
                            <Home className="w-4 h-4" />
                            Dashboard
                        </Link>
                    </div>

                    {/* Error Code (if available, but not the full message) */}
                    {error.digest && (
                        <p className="mt-6 text-xs text-slate-500">
                            Error Code: {error.digest}
                        </p>
                    )}
                </div>
            </body>
        </html>
    );
}
