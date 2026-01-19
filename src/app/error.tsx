'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log error to console for debugging (dev only)
        if (process.env.NODE_ENV === 'development') {
            console.error('[Page Error]', error);
        }
    }, [error]);

    // Determine user-friendly message based on error type
    const getUserMessage = () => {
        const msg = error.message?.toLowerCase() || '';

        if (msg.includes('network') || msg.includes('connection')) {
            return 'Network connection issue. Please check your internet.';
        }
        if (msg.includes('session') || msg.includes('401') || msg.includes('unauthorized')) {
            return 'Your session has expired. Please login again.';
        }
        if (msg.includes('permission') || msg.includes('403')) {
            return 'You don\'t have permission to access this resource.';
        }
        if (msg.includes('not found') || msg.includes('404')) {
            return 'The requested resource was not found.';
        }
        return 'Something went wrong. Please try again.';
    };

    return (
        <div className="min-h-[50vh] flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center">
                {/* Error Icon */}
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/15 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>

                {/* Error Message - User-friendly, no sensitive details */}
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                    Oops! Something went wrong
                </h2>
                <p className="text-[var(--text-muted)] mb-6">
                    {getUserMessage()}
                </p>

                {/* Action Buttons */}
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-subtle)] text-[var(--text-primary)] font-semibold border border-[var(--border-light)] hover:bg-[var(--bg-base)] transition-all"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Retry
                    </button>
                    <Link
                        href="/"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Go Back
                    </Link>
                </div>

                {/* Error Code - Only show digest, not full error */}
                {error.digest && (
                    <p className="mt-4 text-xs text-[var(--text-muted)]">
                        Reference: {error.digest}
                    </p>
                )}
            </div>
        </div>
    );
}
