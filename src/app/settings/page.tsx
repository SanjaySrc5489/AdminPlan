'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useAuthStore } from '@/lib/store';
import { changePassword, getSessions, revokeSession, getCurrentUser, generateMyApiToken } from '@/lib/api';
import {
    Settings,
    Key,
    Lock,
    Eye,
    EyeOff,
    AlertCircle,
    CheckCircle,
    Loader2,
    Monitor,
    Smartphone,
    LogOut,
    Shield,
    Calendar,
    Clock,
    User,
    Globe,
    Trash2,
    Copy,
    Check
} from 'lucide-react';

interface Session {
    id: string;
    ipAddress: string;
    userAgent: string;
    deviceInfo?: string;
    createdAt: string;
    expiresAt: string;
    isCurrent: boolean;
}

export default function SettingsPage() {
    return (
        <Suspense fallback={null}>
            <SettingsPageContent />
        </Suspense>
    );
}

function SettingsPageContent() {
    const router = useRouter();
    const { isAuthenticated, isHydrated, user, logout: storeLogout } = useAuthStore();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(false);

    // Password form
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);

    // Token states
    const [apiToken, setApiToken] = useState<string | null>(null);
    const [tokenLoading, setTokenLoading] = useState(false);
    const [tokenCopied, setTokenCopied] = useState(false);

    // Redirect if not authenticated
    useEffect(() => {
        if (isHydrated && !isAuthenticated) {
            router.push('/login');
        }
    }, [isHydrated, isAuthenticated, router]);

    // Fetch sessions
    useEffect(() => {
        const fetchSessions = async () => {
            try {
                setLoading(true);
                const data = await getSessions();
                if (data.success) {
                    setSessions(data.sessions);
                }
            } catch (error) {
                console.error('Failed to fetch sessions:', error);
            } finally {
                setLoading(false);
            }
        };

        if (isAuthenticated) {
            fetchSessions();
        }
    }, [isAuthenticated]);

    // Fetch user's API token
    useEffect(() => {
        const fetchToken = async () => {
            try {
                const data = await getCurrentUser();
                if (data.success && data.user) {
                    setApiToken(data.user.apiToken || null);
                }
            } catch (error) {
                console.error('Failed to fetch token:', error);
            }
        };

        if (isAuthenticated) {
            fetchToken();
        }
    }, [isAuthenticated]);

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            setPasswordError('New password must be at least 6 characters');
            return;
        }

        setPasswordLoading(true);

        try {
            const data = await changePassword(currentPassword, newPassword);

            if (data.success) {
                setPasswordSuccess('Password changed successfully! Other devices will need to login again.');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');

                // Update signature secret in store
                localStorage.setItem('signature_secret', data.signatureSecret);
            } else {
                setPasswordError(data.error || 'Failed to change password');
            }
        } catch (err: any) {
            setPasswordError(err.response?.data?.error || 'Failed to change password');
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleRevokeSession = async (sessionId: string) => {
        try {
            await revokeSession(sessionId);
            setSessions(sessions.filter(s => s.id !== sessionId));
        } catch (error) {
            console.error('Failed to revoke session:', error);
        }
    };

    const handleGenerateToken = async () => {
        setTokenLoading(true);
        try {
            const result = await generateMyApiToken();
            if (result.success) {
                setApiToken(result.apiToken);
            }
        } catch (error: any) {
            console.error('Failed to generate token:', error);
            alert(error.message || 'Failed to generate token');
        } finally {
            setTokenLoading(false);
        }
    };

    const handleCopyToken = async () => {
        if (!apiToken) return;
        try {
            await navigator.clipboard.writeText(apiToken);
            setTokenCopied(true);
            setTimeout(() => setTokenCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy token:', error);
        }
    };

    const maskToken = (token: string) => {
        if (!token) return '';
        if (token.length <= 12) return token;
        return `${token.slice(0, 8)}...${token.slice(-4)}`;
    };

    const parseUserAgent = (ua: string) => {
        if (!ua) return { browser: 'Unknown', os: 'Unknown' };

        let browser = 'Unknown';
        let os = 'Unknown';

        if (ua.includes('Chrome')) browser = 'Chrome';
        else if (ua.includes('Firefox')) browser = 'Firefox';
        else if (ua.includes('Safari')) browser = 'Safari';
        else if (ua.includes('Edge')) browser = 'Edge';

        if (ua.includes('Windows')) os = 'Windows';
        else if (ua.includes('Mac')) os = 'macOS';
        else if (ua.includes('Linux')) os = 'Linux';
        else if (ua.includes('Android')) os = 'Android';
        else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

        return { browser, os };
    };

    if (!isHydrated || !isAuthenticated || !user) return null;

    return (
        <div className="min-h-screen bg-[var(--bg-elevated)] pb-20 lg:pb-0">
            <Sidebar />
            <main className="lg:ml-72 lg:bg-[var(--bg-base)]">
                <Header title="Settings" subtitle="Manage your account settings" />

                <div className="p-3 lg:px-8 lg:py-6 lg:max-w-3xl lg:mx-auto space-y-6">
                    {/* Account Info Card */}
                    <div className="bg-white rounded-xl p-6 border border-[var(--border-light)]">
                        <div className="flex items-center gap-4 mb-4">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${user.role === 'admin'
                                ? 'bg-gradient-to-br from-purple-500 to-pink-400'
                                : 'bg-gradient-to-br from-blue-500 to-cyan-400'
                                }`}>
                                <Shield className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-[var(--text-primary)]">{user.username}</h2>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.role === 'admin'
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        {user.role}
                                    </span>
                                    {user.expiresAt && (
                                        <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Expires {new Date(user.expiresAt).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="p-3 bg-[var(--bg-subtle)] rounded-lg">
                                <p className="text-[var(--text-muted)] text-xs mb-1">Email</p>
                                <p className="font-medium">{user.email || 'Not set'}</p>
                            </div>
                            <div className="p-3 bg-[var(--bg-subtle)] rounded-lg">
                                <p className="text-[var(--text-muted)] text-xs mb-1">Max Devices</p>
                                <p className="font-medium">{user.maxDevices}</p>
                            </div>
                        </div>

                        {user.role === 'client' && user.permissions.length > 0 && (
                            <div className="mt-4">
                                <p className="text-xs text-[var(--text-muted)] mb-2">Your Permissions</p>
                                <div className="flex flex-wrap gap-1">
                                    {user.permissions.map(perm => (
                                        <span key={perm} className="text-xs px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-muted)]">
                                            {perm}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Change Password Card */}
                    <div className="bg-white rounded-xl p-6 border border-[var(--border-light)]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--aurora-violet)] to-[var(--aurora-purple)] flex items-center justify-center">
                                <Key className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-[var(--text-primary)]">Change Password</h3>
                                <p className="text-xs text-[var(--text-muted)]">Update your account password</p>
                            </div>
                        </div>

                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            {passwordError && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    {passwordError}
                                </div>
                            )}

                            {passwordSuccess && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 text-emerald-600 text-sm">
                                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                    {passwordSuccess}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium mb-1">Current Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                                    <input
                                        type={showCurrentPassword ? 'text' : 'password'}
                                        value={currentPassword}
                                        onChange={e => setCurrentPassword(e.target.value)}
                                        className="input pl-10 pr-10"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                                    >
                                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">New Password</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        className="input pl-10 pr-10"
                                        required
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                                    >
                                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Confirm New Password</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        className="input pl-10"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={passwordLoading}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--aurora-violet)] to-[var(--aurora-purple)] text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {passwordLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Key className="w-4 h-4" />
                                        Change Password
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* API Token Card */}
                    <div className="bg-white rounded-xl p-6 border border-[var(--border-light)]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center">
                                <Key className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-[var(--text-primary)]">API Token</h3>
                                <p className="text-xs text-[var(--text-muted)]">Use this to link devices to your account</p>
                            </div>
                        </div>

                        <div className="p-4 bg-[var(--bg-subtle)] rounded-lg">
                            {apiToken ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <code className="text-sm bg-white px-3 py-2 rounded-lg font-mono text-[var(--text-secondary)] flex-1 border border-[var(--border-light)]">
                                            {maskToken(apiToken)}
                                        </code>
                                        <button
                                            onClick={handleCopyToken}
                                            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${tokenCopied
                                                    ? 'bg-emerald-100 text-emerald-600'
                                                    : 'bg-white text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-light)]'
                                                }`}
                                        >
                                            {tokenCopied ? (
                                                <>
                                                    <Check className="w-4 h-4" />
                                                    Copied!
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-4 h-4" />
                                                    Copy
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-xs text-[var(--text-muted)]">
                                        This is your permanent API token. Use it in the app to link devices to your account.
                                        <br />
                                        <span className="text-amber-600 font-medium">Keep it secret! Anyone with this token can link devices to your account.</span>
                                    </p>
                                </div>
                            ) : (
                                <div className="text-center py-2">
                                    <p className="text-sm text-[var(--text-muted)] mb-3">
                                        You don&apos;t have an API token yet. Generate one to link devices to your account.
                                    </p>
                                    <button
                                        onClick={handleGenerateToken}
                                        disabled={tokenLoading}
                                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 text-white font-medium disabled:opacity-50 flex items-center gap-2 mx-auto"
                                    >
                                        {tokenLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Key className="w-4 h-4" />
                                                Generate Token
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Active Sessions Card */}
                    <div className="bg-white rounded-xl p-6 border border-[var(--border-light)]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center">
                                <Monitor className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-[var(--text-primary)]">Active Sessions</h3>
                                <p className="text-xs text-[var(--text-muted)]">Manage your active login sessions</p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-[var(--aurora-violet)]" />
                            </div>
                        ) : sessions.length === 0 ? (
                            <p className="text-center text-sm text-[var(--text-muted)] py-4">No active sessions</p>
                        ) : (
                            <div className="space-y-3">
                                {sessions.map(session => {
                                    const { browser, os } = parseUserAgent(session.userAgent);
                                    return (
                                        <div
                                            key={session.id}
                                            className={`p-4 rounded-lg border ${session.isCurrent
                                                ? 'border-emerald-200 bg-emerald-50/50'
                                                : 'border-[var(--border-light)]'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${session.isCurrent
                                                        ? 'bg-emerald-100'
                                                        : 'bg-[var(--bg-subtle)]'
                                                        }`}>
                                                        {os === 'Android' || os === 'iOS' ? (
                                                            <Smartphone className={`w-5 h-5 ${session.isCurrent ? 'text-emerald-600' : 'text-[var(--text-muted)]'}`} />
                                                        ) : (
                                                            <Monitor className={`w-5 h-5 ${session.isCurrent ? 'text-emerald-600' : 'text-[var(--text-muted)]'}`} />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium text-sm">{browser} on {os}</p>
                                                            {session.isCurrent && (
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                                                                    Current
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                                                            <span className="flex items-center gap-1">
                                                                <Globe className="w-3 h-3" />
                                                                {session.ipAddress || 'Unknown IP'}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="w-3 h-3" />
                                                                {new Date(session.createdAt).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {!session.isCurrent && (
                                                    <button
                                                        onClick={() => handleRevokeSession(session.id)}
                                                        className="p-2 hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500 rounded-lg transition-colors"
                                                        title="Revoke Session"
                                                    >
                                                        <LogOut className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Logout */}
                    <button
                        onClick={() => {
                            storeLogout();
                            router.push('/login');
                        }}
                        className="w-full py-3 rounded-xl border border-red-200 text-red-600 font-medium flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </main>
        </div>
    );
}
