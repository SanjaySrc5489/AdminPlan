'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useAuthStore } from '@/lib/store';
import { getSocket, connectSocket } from '@/lib/socket';
import { getDeviceLogs } from '@/lib/api';
import Link from 'next/link';
import {
    ArrowLeft,
    Terminal,
    Trash2,
    Pause,
    Play,
    Download,
} from 'lucide-react';

interface LogEntry {
    deviceId: string;
    level: string;
    tag: string;
    message: string;
    timestamp: number;
}



export default function LogsPage() {
    return (
        <Suspense fallback={null}>
            <LogsContent />
        </Suspense>
    );
}

function LogsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deviceId = searchParams.get('id') as string;
    const { isAuthenticated, isHydrated } = useAuthStore();

    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isPaused, setIsPaused] = useState(false);
    const [filter, setFilter] = useState<string>('ALL');
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const maxLogs = 500;

    // Auth check
    useEffect(() => {
        if (isHydrated && !isAuthenticated) {
            router.push('/login');
        }
    }, [isHydrated, isAuthenticated, router]);

    // Fetch historical logs from database on mount
    useEffect(() => {
        if (!isAuthenticated || !deviceId) return;

        const fetchHistoricalLogs = async () => {
            try {
                setIsLoadingHistory(true);
                const response = await getDeviceLogs(deviceId, 1, 200);
                if (response.success && response.data) {
                    // API returns newest first - keep that order (latest at top)
                    const historicalLogs = response.data.map((log: any) => ({
                        deviceId: log.deviceId,
                        level: log.level,
                        tag: log.tag,
                        message: log.message,
                        timestamp: new Date(log.timestamp).getTime()
                    }));
                    setLogs(historicalLogs);
                }
            } catch (error) {
                console.error('Failed to fetch historical logs:', error);
            } finally {
                setIsLoadingHistory(false);
            }
        };

        fetchHistoricalLogs();
    }, [isAuthenticated, deviceId]);

    // Socket listeners
    useEffect(() => {
        if (!isAuthenticated || !deviceId) return;

        const socket = connectSocket();

        const handleLog = (data: LogEntry) => {
            if (data.deviceId === deviceId && !isPaused) {
                setLogs(prev => {
                    // Prepend new log to top (newest first)
                    const newLogs = [data, ...prev];
                    // Keep only first maxLogs entries
                    if (newLogs.length > maxLogs) {
                        return newLogs.slice(0, maxLogs);
                    }
                    return newLogs;
                });
            }
        };

        socket.on('device:log', handleLog);

        return () => {
            socket.off('device:log', handleLog);
        };
    }, [isAuthenticated, deviceId, isPaused]);

    // Auto-scroll disabled - newest logs appear at top now
    // useEffect(() => {
    //     if (!isPaused && logsEndRef.current) {
    //         logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    //     }
    // }, [logs, isPaused]);

    const clearLogs = () => setLogs([]);

    const filteredLogs = filter === 'ALL'
        ? logs
        : logs.filter(log => log.level === filter);

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'ERROR': return 'text-red-400 bg-red-400/20 ring-1 ring-red-400/30';
            case 'WARN': return 'text-amber-300 bg-amber-300/20 ring-1 ring-amber-300/30';
            case 'INFO': return 'text-emerald-400 bg-emerald-400/20 ring-1 ring-emerald-400/30';
            case 'DEBUG': return 'text-indigo-300 bg-indigo-300/20 ring-1 ring-indigo-300/30';
            default: return 'text-slate-400 bg-slate-400/10 ring-1 ring-slate-400/20';
        }
    };

    const downloadLogs = () => {
        const text = filteredLogs.map(log =>
            `[${new Date(log.timestamp).toISOString()}] [${log.level}] [${log.tag}] ${log.message}`
        ).join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `device_logs_${deviceId}_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!isHydrated || !isAuthenticated) return null;

    return (
        <div className="flex min-h-screen bg-[var(--background)]">
            <Sidebar />
            <main className="flex-1 lg:ml-72">
                <Header title="Device Logs" subtitle="Real-time Monitoring" />

                <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <Link href={`/devices/view/?id=${deviceId}`} className="inline-flex items-center gap-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors text-sm font-medium w-fit">
                            <ArrowLeft className="w-4 h-4" />
                            Back to Device
                        </Link>
                        <div className="text-sm text-slate-500">
                            Device ID: <span className="font-mono text-slate-400">{deviceId?.slice(0, 8)}...</span>
                        </div>
                    </div>

                    {/* Log Viewer */}
                    <div className="card bg-slate-900 p-0 rounded-[2rem] border border-slate-700 shadow-2xl overflow-hidden">
                        {/* Toolbar */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <Terminal className="w-5 h-5 text-emerald-400" />
                                <span className="text-xs font-bold text-white uppercase tracking-widest">Live Logs</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                                    {filteredLogs.length} entries
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Filter */}
                                <select
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    className="text-xs bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="ALL">All Levels</option>
                                    <option value="ERROR">Errors</option>
                                    <option value="WARN">Warnings</option>
                                    <option value="INFO">Info</option>
                                    <option value="DEBUG">Debug</option>
                                </select>

                                {/* Pause/Play */}
                                <button
                                    onClick={() => setIsPaused(!isPaused)}
                                    className={`p-2 rounded-lg ${isPaused ? 'bg-emerald-600' : 'bg-slate-700'} hover:opacity-80 transition-opacity`}
                                    title={isPaused ? 'Resume' : 'Pause'}
                                >
                                    {isPaused ? (
                                        <Play className="w-4 h-4 text-white" />
                                    ) : (
                                        <Pause className="w-4 h-4 text-white" />
                                    )}
                                </button>

                                {/* Download */}
                                <button
                                    onClick={downloadLogs}
                                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                                    title="Download Logs"
                                >
                                    <Download className="w-4 h-4 text-white" />
                                </button>

                                {/* Clear */}
                                <button
                                    onClick={clearLogs}
                                    className="p-2 rounded-lg bg-slate-700 hover:bg-red-600 transition-colors"
                                    title="Clear Logs"
                                >
                                    <Trash2 className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        </div>

                        {/* Log Content */}
                        <div className="h-[600px] overflow-y-auto font-mono text-[11px] p-6 space-y-0.5 bg-[#0a0a0c] relative group/terminal">
                            {/* Scanline effect overlay */}
                            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_4px,3px_100%] z-10" />

                            {filteredLogs.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center relative z-20">
                                    <div className="p-10 rounded-3xl bg-slate-900/40 border border-emerald-500/10 backdrop-blur-md shadow-[0_0_50px_-12px_rgba(16,185,129,0.1)]">
                                        <div className="relative mb-6">
                                            <Terminal className="w-16 h-16 mx-auto text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]" />
                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full animate-pulse border-4 border-slate-900" />
                                        </div>
                                        <div className="font-mono text-center">
                                            <p className="text-emerald-400 text-base font-bold mb-3 tracking-wider">ion@parental:~$ <span className="text-emerald-300">{isLoadingHistory ? 'loading' : 'listening'}</span></p>
                                            <div className="flex items-center justify-center gap-2 text-slate-400">
                                                <span>{isLoadingHistory ? 'fetching logs from database' : 'waiting for new logs'}</span>
                                                <span className="text-emerald-500 font-bold">~</span>
                                                <span className="w-2 h-4 bg-emerald-500 animate-[blink_1s_infinite] shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                            </div>
                                        </div>
                                        <div className="mt-8 pt-6 border-t border-slate-800/50 text-[10px] text-slate-500 text-center uppercase tracking-widest leading-relaxed">
                                            <p>Real-time stream connection established</p>
                                            <p className="text-slate-600 mt-2 italic font-serif">Awaiting incoming telemetry data...</p>
                                        </div>
                                    </div>

                                    {/* Small style tag for custom blink animation if needed, though standard tailwind pulse works often better */}
                                    <style jsx global>{`
                                        @keyframes blink {
                                            0%, 100% { opacity: 1; }
                                            50% { opacity: 0; }
                                        }
                                    `}</style>
                                </div>
                            ) : (
                                <div className="relative z-20">
                                    {/* Terminal session header */}
                                    <div className="flex items-center gap-2 text-emerald-500/80 mb-4 font-bold text-[10px] uppercase tracking-widest pb-2 border-b border-emerald-500/10">
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                        Session: Real-time App Telemetry
                                    </div>
                                    {/* Waiting cursor at TOP - newest logs come here */}
                                    <div className="flex items-center gap-2 text-emerald-500/60 mb-3 px-2 font-bold tracking-tighter">
                                        <span>ion@parental:~$</span>
                                        <span className="w-2 h-4 bg-emerald-500 animate-[blink_1s_infinite] shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    </div>
                                    <div className="space-y-0.5">
                                        {filteredLogs.map((log, idx) => (
                                            <div key={idx} className="flex gap-3 hover:bg-emerald-500/5 px-2 py-1 rounded transition-colors group/row border-l border-transparent hover:border-emerald-500/30">
                                                <span className="text-slate-600 shrink-0 font-medium opacity-70 group-hover/row:opacity-100">
                                                    [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}]
                                                </span>
                                                <span className={`px-1 rounded-sm text-[9px] font-black uppercase text-center min-w-[32px] flex items-center justify-center ${getLevelColor(log.level)} shadow-sm`}>
                                                    {log.level.charAt(0)}
                                                </span>
                                                <span className="text-cyan-500/90 shrink-0 font-bold tracking-tight">
                                                    {log.tag}:
                                                </span>
                                                <span className="text-[#d1d5db] break-all leading-relaxed selection:bg-emerald-500/30">
                                                    {log.message}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div ref={logsEndRef} />
                        </div>

                        {/* Status Bar */}
                        <div className="px-4 py-2 border-t border-slate-700 bg-slate-800/50 flex items-center justify-between">
                            <span className="text-[10px] text-slate-500">
                                {isPaused && <span className="text-amber-400 mr-2">⏸ PAUSED</span>}
                                Auto-scrolling {isPaused ? 'disabled' : 'enabled'}
                            </span>
                            <span className="text-[10px] text-slate-500">
                                Showing last {maxLogs} entries
                            </span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
