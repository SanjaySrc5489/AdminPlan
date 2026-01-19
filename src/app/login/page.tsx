'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, User, Lock, AlertCircle, Loader2, Sparkles, Zap, Eye, EyeOff, Clock } from 'lucide-react';
import { login as apiLogin } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function LoginPage() {
    const router = useRouter();
    const { login, isAuthenticated, isHydrated } = useAuthStore();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Redirect if already logged in - must be in useEffect, not during render
    useEffect(() => {
        if (isHydrated && isAuthenticated) {
            router.push('/');
        }
    }, [isHydrated, isAuthenticated, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const data = await apiLogin(username, password);
            if (data.success) {
                login(
                    data.token,
                    data.refreshToken,
                    data.user,
                    data.signatureSecret
                );

                // Show welcome message based on role
                console.log(`Logged in as ${data.user.role}: ${data.user.username}`);

                router.push('/');
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (err: any) {
            const errorMessage = err.response?.data?.error || 'Connection failed';

            // Handle specific error cases
            if (errorMessage.includes('expired')) {
                setError('Your account has expired. Please contact the administrator.');
            } else if (errorMessage.includes('disabled')) {
                setError('Your account has been disabled. Please contact the administrator.');
            } else {
                setError(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
            {/* Animated Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-[var(--aurora-violet)]/20 to-[var(--aurora-purple)]/10 rounded-full blur-3xl animate-float" />
                <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-gradient-to-br from-[var(--aurora-pink)]/15 to-[var(--aurora-rose)]/10 rounded-full blur-3xl" style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-gradient-to-br from-[var(--aurora-cyan)]/15 to-[var(--aurora-blue)]/10 rounded-full blur-3xl" style={{ animationDelay: '2s' }} />
            </div>

            <div className="relative z-10 w-full max-w-md animate-fade-in">
                {/* Logo & Branding */}
                <div className="text-center mb-8">
                    <div className="relative inline-block">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[var(--aurora-violet)] via-[var(--aurora-purple)] to-[var(--aurora-pink)] flex items-center justify-center shadow-2xl shadow-purple-500/30 animate-float">
                            <Shield className="w-10 h-10 text-white" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-[var(--aurora-emerald)] to-[var(--aurora-teal)] flex items-center justify-center border-4 border-[var(--bg-base)] shadow-lg">
                            <Zap className="w-3.5 h-3.5 text-white" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold gradient-text">
                        ParentGuard
                    </h1>
                    <p className="text-[var(--text-muted)] mt-2 font-medium">Secure Control Panel</p>
                </div>

                {/* Login Card */}
                <div className="card bg-[var(--bg-elevated)] p-6 lg:p-8 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Error Alert */}
                        {error && (
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--danger-glow)] border border-[var(--danger)]/20 text-[var(--danger)]">
                                {error.includes('expired') ? (
                                    <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                )}
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        )}

                        {/* Username Field */}
                        <div>
                            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                                Username
                            </label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--aurora-violet)]" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter username"
                                    className="input pl-12"
                                    required
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div>
                            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--aurora-violet)]" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter password"
                                    className="input pl-12 pr-12"
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn w-full py-4 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[var(--aurora-violet)] via-[var(--aurora-purple)] to-[var(--aurora-pink)] text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    Sign In
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-sm text-[var(--text-muted)] mt-6 font-medium flex items-center justify-center gap-2">
                    <Lock className="w-4 h-4" />
                    End-to-end encrypted connection
                </p>
            </div>
        </div>
    );
}
