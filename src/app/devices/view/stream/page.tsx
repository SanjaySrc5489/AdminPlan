'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useAuthStore } from '@/lib/store';
import {
    connectSocket,
    getSocket,
    watchDeviceStream,
    unwatchDeviceStream,
    sendCommand,
    sendWebRTCAnswer,
    sendWebRTCIceCandidate,
    stopWebRTCStream,
    setStreamQuality
} from '@/lib/socket';
import {
    Video,
    VideoOff,
    Camera,
    RefreshCw,
    AlertCircle,
    Wifi,
    Mic,
    ArrowLeft,
    Maximize2,
    Minimize2,
    Volume2,
    VolumeX,
    Settings,
    ChevronDown,
    Monitor,
    MousePointer2,
    Move,
} from 'lucide-react';
import Link from 'next/link';

// Stream modes - must match Android WebRTCManager constants
const STREAM_MODE = {
    VIDEO_ONLY: 0,
    AUDIO_ONLY: 1,
    VIDEO_AUDIO: 2,
    SCREEN: 3,
    SCREEN_AUDIO: 4,
};

// Quality presets - must match Android WebRTCManager constants
const QUALITY_PRESETS = [
    { id: 0, label: 'Low', resolution: '480×360', fps: '15 fps' },
    { id: 1, label: 'Medium', resolution: '640×480', fps: '24 fps' },
    { id: 2, label: 'High', resolution: '720p', fps: '30 fps' },
    { id: 3, label: 'Ultra', resolution: '1080p', fps: '30 fps' },
];

// Session duration presets in milliseconds
const DURATION_PRESETS = [
    { id: 60000, label: '1 min' },
    { id: 120000, label: '2 min' },
    { id: 180000, label: '3 min' },
    { id: 300000, label: '5 min' },
    { id: 600000, label: '10 min' },
];

export default function LiveStreamPage() {
    return (
        <Suspense fallback={null}>
            <LiveStreamContent />
        </Suspense>
    );
}

function LiveStreamContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deviceId = searchParams.get('id') as string;
    const { isAuthenticated, isHydrated } = useAuthStore();

    const [isStreaming, setIsStreaming] = useState(false);
    const [connectionState, setConnectionState] = useState<string>('disconnected');
    const [error, setError] = useState<string | null>(null);
    const [useFrontCamera, setUseFrontCamera] = useState(false);
    const [streamMode, setStreamMode] = useState(STREAM_MODE.VIDEO_ONLY);

    // New state for enhanced controls
    const [quality, setQuality] = useState(0); // Default to Low
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showQualityMenu, setShowQualityMenu] = useState(false);
    const [showControls, setShowControls] = useState(false); // For mobile tap-to-show
    const [isRemoteEnabled, setIsRemoteEnabled] = useState(false);
    const [isSwiping, setIsSwiping] = useState(false);
    const swipeStartPos = useRef<{ x: number; y: number } | null>(null);
    const swipeStartTime = useRef<number>(0);

    // Session duration state
    const [sessionDuration, setSessionDuration] = useState(60000); // Default 1 min
    const [remainingTime, setRemainingTime] = useState(0);
    const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
    const sessionEndTimeRef = useRef<number>(0);

    // Floating control bubble state
    const [bubblePosition, setBubblePosition] = useState({ x: 20, y: 100 });
    const [isBubbleExpanded, setIsBubbleExpanded] = useState(false);
    const [isDraggingBubble, setIsDraggingBubble] = useState(false);
    const bubbleDragStart = useRef<{ x: number; y: number; bubbleX: number; bubbleY: number } | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    // Ref to track streaming state for cleanup (avoids dependency issues)
    const isStreamingRef = useRef(false);

    // Auth check
    useEffect(() => {
        if (isHydrated && !isAuthenticated) {
            router.push('/login');
        }
    }, [isHydrated, isAuthenticated, router]);

    // ICE servers for NAT traversal
    const ICE_SERVERS: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
        ],
    };

    /**
     * Coordinate Translation for remote touch
     * Accounts for object-contain black bars to get precise coordinates
     */
    const getTranslatedCoords = (e: React.MouseEvent | React.TouchEvent, isEnd = false) => {
        if (!videoRef.current || !videoContainerRef.current) return null;

        const video = videoRef.current;
        const container = videoContainerRef.current;
        const rect = container.getBoundingClientRect();

        let clientX, clientY;
        if ('nativeEvent' in e && ('touches' in (e.nativeEvent as any) || 'changedTouches' in (e.nativeEvent as any))) {
            const touchEvent = e.nativeEvent as unknown as TouchEvent;
            // Use changedTouches for touchend, touches for touchstart/touchmove
            const touchList = isEnd ? touchEvent.changedTouches : touchEvent.touches;
            if (!touchList || touchList.length === 0) {
                // Fallback to changedTouches if touches is empty
                if (touchEvent.changedTouches && touchEvent.changedTouches.length > 0) {
                    clientX = touchEvent.changedTouches[0].clientX;
                    clientY = touchEvent.changedTouches[0].clientY;
                } else {
                    return null;
                }
            } else {
                clientX = touchList[0].clientX;
                clientY = touchList[0].clientY;
            }
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Video's native resolution
        const vw = video.videoWidth;
        const vh = video.videoHeight;

        if (!vw || !vh) return { x: x / rect.width, y: y / rect.height };

        // Container's size
        const cw = rect.width;
        const ch = rect.height;

        // Calculate the size of the video inside the container with object-contain
        const containerRatio = cw / ch;
        const videoRatio = vw / vh;

        let actualWidth, actualHeight, offsetX, offsetY;

        if (videoRatio > containerRatio) {
            // Video is wider than container ratio
            actualWidth = cw;
            actualHeight = cw / videoRatio;
            offsetX = 0;
            offsetY = (ch - actualHeight) / 2;
        } else {
            // Video is taller than container ratio
            actualHeight = ch;
            actualWidth = ch * videoRatio;
            offsetY = 0;
            offsetX = (cw - actualWidth) / 2;
        }

        // Relative to the actual video area
        const relX = (x - offsetX) / actualWidth;
        const relY = (y - offsetY) / actualHeight;

        // Clamp between 0 and 1
        const clampedX = Math.max(0, Math.min(1, relX));
        const clampedY = Math.max(0, Math.min(1, relY));

        return { x: clampedX, y: clampedY };
    };

    /**
     * Mouse/Touch Handlers for remote control
     */
    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isRemoteEnabled || !isStreaming) return;

        // Don't capture if clicking on bubble
        if (isDraggingBubble) return;

        const coords = getTranslatedCoords(e, false);
        if (!coords) return;

        console.log('[Remote] Swipe START at:', coords);
        swipeStartPos.current = coords;
        swipeStartTime.current = Date.now();
        setIsSwiping(true);
    };

    const handleMouseUp = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isRemoteEnabled || !isStreaming || !swipeStartPos.current) {
            setIsSwiping(false);
            return;
        }

        // Get end coordinates with isEnd=true for touch events
        const endCoords = getTranslatedCoords(e, true) || swipeStartPos.current;
        const duration = Date.now() - swipeStartTime.current;
        const socket = getSocket();

        // Check if it's a tap or a swipe
        const dx = Math.abs(endCoords.x - swipeStartPos.current.x);
        const dy = Math.abs(endCoords.y - swipeStartPos.current.y);
        const distance = Math.sqrt(dx * dx + dy * dy);

        console.log('[Remote] Swipe END at:', endCoords);
        console.log('[Remote] Gesture analysis:', {
            start: swipeStartPos.current,
            end: endCoords,
            dx: dx.toFixed(3),
            dy: dy.toFixed(3),
            distance: distance.toFixed(3),
            duration
        });

        // Threshold: if moved less than 3% of screen AND was quick, it's a tap
        if (distance < 0.03 && duration < 300) {
            // Tap gesture (small movement + quick)
            console.log('[Remote] => TAP detected at:', endCoords);
            socket?.emit('admin:touch', {
                deviceId,
                type: 'tap',
                x: endCoords.x,
                y: endCoords.y
            });
        } else {
            // Swipe gesture (larger movement or longer hold)
            console.log('[Remote] => SWIPE detected from', swipeStartPos.current, 'to', endCoords);
            socket?.emit('admin:touch', {
                deviceId,
                type: 'swipe',
                startX: swipeStartPos.current.x,
                startY: swipeStartPos.current.y,
                endX: endCoords.x,
                endY: endCoords.y,
                duration: Math.min(Math.max(duration, 150), 500) // Between 150-500ms for natural swipe
            });
        }

        swipeStartPos.current = null;
        setIsSwiping(false);
    };

    // Bubble drag handlers
    const handleBubbleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        bubbleDragStart.current = {
            x: clientX,
            y: clientY,
            bubbleX: bubblePosition.x,
            bubbleY: bubblePosition.y
        };
        setIsDraggingBubble(true);
    };

    const handleBubbleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isDraggingBubble || !bubbleDragStart.current) return;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const deltaX = clientX - bubbleDragStart.current.x;
        const deltaY = clientY - bubbleDragStart.current.y;

        setBubblePosition({
            x: Math.max(0, bubbleDragStart.current.bubbleX + deltaX),
            y: Math.max(0, bubbleDragStart.current.bubbleY + deltaY)
        });
    }, [isDraggingBubble]);

    const handleBubbleDragEnd = useCallback(() => {
        setIsDraggingBubble(false);
        bubbleDragStart.current = null;
    }, []);

    // Add global event listeners for bubble dragging
    useEffect(() => {
        if (isDraggingBubble) {
            window.addEventListener('mousemove', handleBubbleDragMove);
            window.addEventListener('mouseup', handleBubbleDragEnd);
            window.addEventListener('touchmove', handleBubbleDragMove);
            window.addEventListener('touchend', handleBubbleDragEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleBubbleDragMove);
            window.removeEventListener('mouseup', handleBubbleDragEnd);
            window.removeEventListener('touchmove', handleBubbleDragMove);
            window.removeEventListener('touchend', handleBubbleDragEnd);
        };
    }, [isDraggingBubble, handleBubbleDragMove, handleBubbleDragEnd]);

    // Handle incoming WebRTC offer from device
    const handleOffer = useCallback(async (data: { deviceId: string; sdp: string }) => {
        if (data.deviceId !== deviceId) return;

        console.log('[WebRTC] Received offer from device');
        setError(null);

        try {
            const sdp = JSON.parse(data.sdp);

            // Create peer connection if not exists
            if (!peerConnectionRef.current) {
                peerConnectionRef.current = new RTCPeerConnection(ICE_SERVERS);

                // Handle incoming tracks (video and/or audio)
                peerConnectionRef.current.ontrack = (event) => {
                    console.log('[WebRTC] Got remote track:', event.track.kind, event.streams);

                    // Attach stream to video element
                    if (videoRef.current && event.streams[0]) {
                        console.log('[WebRTC] Setting srcObject for:', event.track.kind);
                        if (videoRef.current.srcObject !== event.streams[0]) {
                            videoRef.current.srcObject = event.streams[0];
                        }

                        // Set streaming state
                        setIsStreaming(true);
                        isStreamingRef.current = true;
                        setConnectionState('connected');

                        // Play the video
                        videoRef.current.play().catch(err => {
                            if (err.name !== 'AbortError') {
                                console.error('[WebRTC] Play error:', err);
                            }
                        });
                    }
                };

                // Handle ICE candidates
                peerConnectionRef.current.onicecandidate = (event) => {
                    if (event.candidate) {
                        console.log('[WebRTC] Sending ICE candidate to device');
                        sendWebRTCIceCandidate(deviceId, event.candidate);
                    }
                };

                // Connection state changes
                peerConnectionRef.current.onconnectionstatechange = () => {
                    const state = peerConnectionRef.current?.connectionState || 'unknown';
                    console.log('[WebRTC] PC State:', state);

                    // Handle transient states during ICE restart
                    if (state === 'connected') {
                        setConnectionState('connected');
                        setIsStreaming(true);
                        isStreamingRef.current = true;
                    } else if (state === 'failed') {
                        // Show 'reconnecting' instead of 'failed' - ICE restart may recover
                        setConnectionState('reconnecting');
                        // Don't immediately set isStreaming to false - wait for closed state
                    } else if (state === 'disconnected') {
                        // Temporary state during ICE restart - show reconnecting
                        setConnectionState('reconnecting');
                    } else if (state === 'closed') {
                        // Final state - stream is truly stopped
                        setConnectionState('disconnected');
                        setIsStreaming(false);
                        isStreamingRef.current = false;
                    } else {
                        setConnectionState(state);
                    }
                };

                // ICE connection state changes
                peerConnectionRef.current.oniceconnectionstatechange = () => {
                    console.log('[WebRTC] ICE State:', peerConnectionRef.current?.iceConnectionState);
                };
            }

            // Set remote description (offer)
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(sdp));

            // Create and send answer
            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);

            console.log('[WebRTC] Sending answer to device');
            sendWebRTCAnswer(deviceId, answer);

        } catch (err: any) {
            console.error('[WebRTC] Error handling offer:', err);
            setError('Failed to establish connection: ' + err.message);
        }
    }, [deviceId]);

    // Handle incoming ICE candidate
    const handleIceCandidate = useCallback(async (data: { deviceId: string; candidate: any }) => {
        if (data.deviceId && data.deviceId !== deviceId) return;

        try {
            const candidateData = typeof data.candidate === 'string' ? JSON.parse(data.candidate) : data.candidate;
            if (peerConnectionRef.current) {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidateData));
                console.log('[WebRTC] Added remote ICE candidate');
            }
        } catch (err: any) {
            console.error('[WebRTC] Error adding remote ICE:', err);
        }
    }, [deviceId]);

    const cleanupConnection = useCallback(() => {
        if (peerConnectionRef.current) { peerConnectionRef.current.close(); peerConnectionRef.current = null; }
        if (videoRef.current) videoRef.current.srcObject = null;
        setIsStreaming(false);
        setConnectionState('disconnected');
    }, []);

    // Handle stream stopped from device
    const handleStreamStopped = useCallback((data: { deviceId: string }) => {
        if (data.deviceId !== deviceId) return;
        console.log('[WebRTC] Stream stopped notification received');
        cleanupConnection();
    }, [deviceId, cleanupConnection]);

    // Setup socket listeners
    useEffect(() => {
        if (!isAuthenticated || !deviceId) return;

        console.log('[Stream] Registering listeners for:', deviceId);
        const socket = getSocket();

        // Ensure connected
        if (!socket.connected) socket.connect();

        // Join rooms
        socket.emit('admin:join');
        socket.emit('stream:join', { deviceId });

        // Check if device is already streaming
        socket.emit('stream:check', { deviceId });

        socket.on('webrtc:offer', handleOffer);
        socket.on('webrtc:ice-candidate', handleIceCandidate);
        socket.on('webrtc:stopped', handleStreamStopped);
        socket.on('camera:stopped', handleStreamStopped);
        socket.on('camera:error', (data: { error: string }) => {
            console.error('[Camera] Device reported error:', data.error);
            setError(data.error);
            cleanupConnection();
        });

        // Handle active stream status response
        socket.on('stream:status', (data: { deviceId: string; isActive: boolean; streamType?: string; startTime?: number }) => {
            if (data.deviceId !== deviceId) return;
            if (data.isActive) {
                console.log('[Stream] Device already streaming:', data.streamType);
                setError(`This device is already streaming (${data.streamType || 'unknown'}). Stop the existing stream first.`);
            }
        });

        // Handle session expired from device
        socket.on('stream:session-expired', (data: { deviceId: string; reason: string; duration: number }) => {
            if (data.deviceId !== deviceId) return;
            console.log('[Stream] Session expired:', data.reason);
            if (sessionTimerRef.current) {
                clearInterval(sessionTimerRef.current);
                sessionTimerRef.current = null;
            }
            setRemainingTime(0);
            setError('Session time limit reached. Stream stopped automatically.');
            cleanupConnection();
        });

        return () => {
            console.log('[Stream] Cleaning up listeners');
            socket.off('webrtc:offer', handleOffer);
            socket.off('webrtc:ice-candidate', handleIceCandidate);
            socket.off('webrtc:stopped', handleStreamStopped);
            socket.off('camera:stopped', handleStreamStopped);
            socket.off('camera:error');
            socket.off('stream:status');
            socket.off('stream:session-expired');
            // Don't leave admin room, just the stream
            socket.emit('stream:leave', { deviceId });

            // Stop the stream on the device side when leaving the page (use ref to avoid dependency issues)
            if (isStreamingRef.current) {
                console.log('[Stream] Stopping stream on device - page leave cleanup');
                stopWebRTCStream(deviceId);
            }

            cleanupConnection();
        };
    }, [isAuthenticated, deviceId, handleOffer, handleIceCandidate, handleStreamStopped, cleanupConnection]);

    // Fullscreen change listener
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Page visibility and unload handlers - stop stream when leaving page
    useEffect(() => {
        const handleVisibilityChange = () => {
            // When page becomes hidden (tab switch, minimize), stop the stream
            if (document.hidden && isStreamingRef.current) {
                console.log('[Stream] Page hidden - stopping stream to release camera');
                stopWebRTCStream(deviceId);
                cleanupConnection();
            }
        };

        const handleBeforeUnload = () => {
            // Stop stream on page close/refresh
            if (isStreamingRef.current) {
                console.log('[Stream] Page unloading - stopping stream');
                stopWebRTCStream(deviceId);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [deviceId, cleanupConnection]);

    const startStream = () => {
        setError(null);
        setConnectionState('connecting');

        // Start countdown timer
        sessionEndTimeRef.current = Date.now() + sessionDuration;
        setRemainingTime(sessionDuration);
        sessionTimerRef.current = setInterval(() => {
            const remaining = sessionEndTimeRef.current - Date.now();
            if (remaining <= 0) {
                // Timer expired - stop stream
                if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
                setRemainingTime(0);
                stopStream();
            } else {
                setRemainingTime(remaining);
            }
        }, 1000);

        // Use different command for screen mode
        if (streamMode === STREAM_MODE.SCREEN || streamMode === STREAM_MODE.SCREEN_AUDIO) {
            sendCommand(deviceId, 'start_screen_stream', {
                withAudio: streamMode === STREAM_MODE.SCREEN_AUDIO,
                duration: sessionDuration
            });
        } else {
            sendCommand(deviceId, 'start_camera_stream', {
                camera: useFrontCamera ? 'front' : 'back',
                mode: streamMode,
                duration: sessionDuration
            });
        }
    };

    const stopStream = () => {
        // Clear session timer
        if (sessionTimerRef.current) {
            clearInterval(sessionTimerRef.current);
            sessionTimerRef.current = null;
        }
        setRemainingTime(0);
        stopWebRTCStream(deviceId);
        cleanupConnection();
    };

    // Format remaining time as MM:SS
    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const toggleCamera = () => {
        setUseFrontCamera(!useFrontCamera);
        if (isStreaming) {
            stopStream();
            setTimeout(() => {
                sendCommand(deviceId, 'start_camera_stream', { camera: !useFrontCamera ? 'front' : 'back', mode: streamMode });
            }, 500);
        }
    };

    // Change quality during stream
    const handleQualityChange = (newQuality: number) => {
        setQuality(newQuality);
        setShowQualityMenu(false);
        if (isStreaming) {
            setStreamQuality(deviceId, newQuality);
        }
    };

    // Toggle mute
    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(!isMuted);
        }
    };

    // Toggle fullscreen
    const toggleFullscreen = () => {
        if (!document.fullscreenElement && videoContainerRef.current) {
            videoContainerRef.current.requestFullscreen();
        } else if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    };

    if (!isHydrated || !isAuthenticated) return null;

    return (
        <div className="flex min-h-screen bg-[var(--background)]">
            <Sidebar />
            <main className="flex-1 lg:ml-72">
                <Header title="Live Stream" subtitle="Encrypted P2P Media Relay" />

                <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in space-y-6">
                    {/* Header Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <Link href={`/devices/view/?id=${deviceId}`} className="inline-flex items-center gap-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors text-sm font-medium w-fit">
                            <ArrowLeft className="w-4 h-4" />
                            Back to Device
                        </Link>

                        <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-xl border border-[var(--border)] shadow-sm">
                            <div className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Status:</span>
                            <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${connectionState === 'connected' ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {connectionState}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
                        {/* Video Feed */}
                        <div className="lg:col-span-3">
                            <div
                                ref={videoContainerRef}
                                onClick={() => isStreaming && setShowControls(!showControls)}
                                className={`card p-0 rounded-[2.5rem] border border-[var(--border)] overflow-hidden shadow-2xl relative flex items-center justify-center group cursor-pointer ${streamMode === STREAM_MODE.SCREEN || streamMode === STREAM_MODE.SCREEN_AUDIO
                                    ? 'min-h-[60vh] bg-slate-900' // Taller container for portrait screen shares
                                    : 'aspect-video bg-black' // 16:9 for camera
                                    }`}
                            >
                                {/* Video element - always black background */}
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted={isMuted}
                                    onMouseDown={handleMouseDown}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={handleMouseUp}
                                    onTouchStart={handleMouseDown}
                                    onTouchEnd={handleMouseUp}
                                    onTouchCancel={handleMouseUp}
                                    className={`w-full h-full bg-black select-none pointer-events-auto ${streamMode === STREAM_MODE.SCREEN || streamMode === STREAM_MODE.SCREEN_AUDIO
                                        ? 'object-contain' // Contain for screen to show full screen
                                        : 'object-contain' // Contain for camera
                                        } ${isRemoteEnabled ? 'cursor-crosshair' : ''} ${isSwiping ? 'ring-2 ring-indigo-500/50' : ''}`}
                                />

                                {/* Status indicator overlay - only when not connected */}
                                {connectionState !== 'connected' && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                                        <div className="text-center text-white">
                                            <RefreshCw className={`w-12 h-12 mx-auto mb-4 text-slate-400 ${connectionState === 'connecting' || connectionState === 'reconnecting' ? 'animate-spin' : ''}`} />
                                            <p className="text-sm font-medium text-slate-300 uppercase tracking-widest">{connectionState === 'connecting' ? 'Connecting...' : connectionState === 'reconnecting' ? 'Reconnecting...' : connectionState}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Top overlay badges */}
                                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                                    {/* Status badge */}
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md transition-all ${connectionState === 'connected' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-white/80 border-[var(--border)] text-[var(--muted)]'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${connectionState === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-current opacity-30'}`} />
                                        <span className="text-[9px] font-bold uppercase tracking-widest">{connectionState}</span>
                                    </div>

                                    {/* Countdown timer badge - shown during streaming */}
                                    {isStreaming && remainingTime > 0 && (
                                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border backdrop-blur-md ${remainingTime <= 30000 ? 'bg-red-500/80 border-red-400/50 animate-pulse' : 'bg-amber-500/80 border-amber-400/50'} text-white`}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <span className="text-sm font-bold font-mono">{formatTime(remainingTime)}</span>
                                        </div>
                                    )}

                                    {/* Quality badge */}
                                    {isStreaming && (
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md bg-black/50 border-white/20 text-white">
                                            <span className="text-[9px] font-bold uppercase tracking-widest">
                                                {QUALITY_PRESETS[quality]?.resolution}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Bottom controls overlay - visible on hover OR tap on mobile */}
                                {isStreaming && (
                                    <div className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                        <div className="flex items-center justify-center gap-3">
                                            {/* Mute button */}
                                            <button
                                                onClick={toggleMute}
                                                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                                                title={isMuted ? 'Unmute' : 'Mute'}
                                            >
                                                {isMuted ? (
                                                    <VolumeX className="w-5 h-5 text-white" />
                                                ) : (
                                                    <Volume2 className="w-5 h-5 text-white" />
                                                )}
                                            </button>

                                            {/* Quality selector */}
                                            <div className="relative">
                                                <button
                                                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                                                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                                                >
                                                    <Settings className="w-4 h-4 text-white" />
                                                    <span className="text-xs font-bold text-white uppercase">
                                                        {QUALITY_PRESETS[quality]?.label}
                                                    </span>
                                                    <ChevronDown className="w-3 h-3 text-white" />
                                                </button>

                                                {/* Quality dropdown */}
                                                {showQualityMenu && (
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 rounded-xl border border-white/10 shadow-xl overflow-hidden min-w-[160px]">
                                                        {QUALITY_PRESETS.map((preset) => (
                                                            <button
                                                                key={preset.id}
                                                                onClick={() => handleQualityChange(preset.id)}
                                                                className={`w-full px-4 py-3 text-left hover:bg-white/10 transition-colors ${quality === preset.id ? 'bg-indigo-600/30' : ''}`}
                                                            >
                                                                <div className="text-xs font-bold text-white">{preset.label}</div>
                                                                <div className="text-[10px] text-white/60">{preset.resolution} · {preset.fps}</div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Fullscreen button */}
                                            <button
                                                onClick={toggleFullscreen}
                                                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                                                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                                            >
                                                {isFullscreen ? (
                                                    <Minimize2 className="w-5 h-5 text-white" />
                                                ) : (
                                                    <Maximize2 className="w-5 h-5 text-white" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Draggable Floating Control Bubble */}
                                {isStreaming && isRemoteEnabled && (streamMode === STREAM_MODE.SCREEN || streamMode === STREAM_MODE.SCREEN_AUDIO) && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            left: bubblePosition.x,
                                            top: bubblePosition.y,
                                            zIndex: 100,
                                            cursor: isDraggingBubble ? 'grabbing' : 'grab',
                                            userSelect: 'none',
                                            touchAction: 'none'
                                        }}
                                    >
                                        {!isBubbleExpanded ? (
                                            /* Collapsed Bubble */
                                            <div
                                                className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl flex items-center justify-center cursor-pointer hover:scale-110 transition-transform border-2 border-white/30"
                                                onClick={() => !isDraggingBubble && setIsBubbleExpanded(true)}
                                                onMouseDown={handleBubbleDragStart}
                                                onTouchStart={handleBubbleDragStart}
                                            >
                                                <MousePointer2 className="w-6 h-6 text-white" />
                                            </div>
                                        ) : (
                                            /* Expanded Control Panel */
                                            <div className="bg-black/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden min-w-[180px]">
                                                {/* Drag Handle */}
                                                <div
                                                    className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-600/50 to-purple-600/50 cursor-grab active:cursor-grabbing"
                                                    onMouseDown={handleBubbleDragStart}
                                                    onTouchStart={handleBubbleDragStart}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Move className="w-4 h-4 text-white/60" />
                                                        <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Remote</span>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setIsBubbleExpanded(false); }}
                                                        className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
                                                    >
                                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </div>

                                                <div className="p-2 space-y-2">
                                                    {/* Navigation Row */}
                                                    <div>
                                                        <div className="text-[8px] text-white/50 uppercase tracking-wider mb-1 px-1">Navigation</div>
                                                        <div className="flex gap-1">
                                                            <button onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'back' })} className="flex-1 p-2 rounded-lg bg-white/10 hover:bg-white/20 flex flex-col items-center gap-0.5 transition-colors" title="Back">
                                                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                                                <span className="text-[8px] text-white/70">Back</span>
                                                            </button>
                                                            <button onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'home' })} className="flex-1 p-2 rounded-lg bg-white/10 hover:bg-white/20 flex flex-col items-center gap-0.5 transition-colors" title="Home">
                                                                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4" /></svg>
                                                                <span className="text-[8px] text-white/70">Home</span>
                                                            </button>
                                                            <button onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'recents' })} className="flex-1 p-2 rounded-lg bg-white/10 hover:bg-white/20 flex flex-col items-center gap-0.5 transition-colors" title="Recents">
                                                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2" strokeWidth={2} /></svg>
                                                                <span className="text-[8px] text-white/70">Recents</span>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Swipe/Scroll */}
                                                    <div>
                                                        <div className="text-[8px] text-white/50 uppercase tracking-wider mb-1 px-1">Swipe</div>
                                                        <div className="grid grid-cols-3 gap-1">
                                                            <button onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'scroll_up' })} className="col-span-3 p-1.5 rounded-lg bg-blue-500/30 hover:bg-blue-500/50 flex items-center justify-center transition-colors">
                                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                                            </button>
                                                            <button onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'scroll_left' })} className="p-1.5 rounded-lg bg-orange-500/30 hover:bg-orange-500/50 flex items-center justify-center transition-colors">
                                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                                            </button>
                                                            <div className="flex items-center justify-center">
                                                                <div className="w-2 h-2 rounded-full bg-white/30" />
                                                            </div>
                                                            <button onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'scroll_right' })} className="p-1.5 rounded-lg bg-orange-500/30 hover:bg-orange-500/50 flex items-center justify-center transition-colors">
                                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                            </button>
                                                            <button onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'scroll_down' })} className="col-span-3 p-1.5 rounded-lg bg-blue-500/30 hover:bg-blue-500/50 flex items-center justify-center transition-colors">
                                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Quick Actions */}
                                                    <div>
                                                        <div className="text-[8px] text-white/50 uppercase tracking-wider mb-1 px-1">Actions</div>
                                                        <div className="flex gap-1">
                                                            <button onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'notifications' })} className="flex-1 p-2 rounded-lg bg-purple-500/30 hover:bg-purple-500/50 flex items-center justify-center transition-colors" title="Notifications">
                                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                                            </button>
                                                            <button onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'quick_settings' })} className="flex-1 p-2 rounded-lg bg-purple-500/30 hover:bg-purple-500/50 flex items-center justify-center transition-colors" title="Quick Settings">
                                                                <Settings className="w-4 h-4 text-white" />
                                                            </button>
                                                            <button onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'screenshot' })} className="flex-1 p-2 rounded-lg bg-green-500/30 hover:bg-green-500/50 flex items-center justify-center transition-colors" title="Screenshot">
                                                                <Camera className="w-4 h-4 text-white" />
                                                            </button>
                                                            <button onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'lock_screen' })} className="flex-1 p-2 rounded-lg bg-red-500/30 hover:bg-red-500/50 flex items-center justify-center transition-colors" title="Lock">
                                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="card bg-white p-6 lg:p-8 rounded-[2.5rem] border border-[var(--border)] shadow-2xl space-y-8">
                                {/* Stream Mode */}
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--primary)] mb-6 block">Stream Mode</span>
                                    <div className="space-y-2">
                                        {[
                                            { id: STREAM_MODE.VIDEO_ONLY, label: 'Video Only', icon: Video },
                                            { id: STREAM_MODE.AUDIO_ONLY, label: 'Audio Only', icon: Mic },
                                            { id: STREAM_MODE.VIDEO_AUDIO, label: 'Full Media', icon: Wifi },
                                            { id: STREAM_MODE.SCREEN, label: 'Screen Share', icon: Monitor },
                                        ].map((mode) => (
                                            <button
                                                key={mode.id}
                                                onClick={() => !isStreaming && setStreamMode(mode.id)}
                                                disabled={isStreaming}
                                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${streamMode === mode.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'} ${isStreaming ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <mode.icon className="w-4 h-4" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest">{mode.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Quality selector (pre-stream) */}
                                {!isStreaming && streamMode !== STREAM_MODE.AUDIO_ONLY && (
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)] mb-3 block">
                                            {streamMode === STREAM_MODE.SCREEN || streamMode === STREAM_MODE.SCREEN_AUDIO
                                                ? 'Resolution'
                                                : 'Initial Quality'}
                                        </span>

                                        {/* Screen share - Native resolution indicator */}
                                        {(streamMode === STREAM_MODE.SCREEN || streamMode === STREAM_MODE.SCREEN_AUDIO) ? (
                                            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-4 text-center">
                                                <div className="flex items-center justify-center gap-2 text-white">
                                                    <Monitor className="w-5 h-5" />
                                                    <span className="text-sm font-bold text-white">NATIVE RESOLUTION</span>
                                                </div>
                                                <p className="text-[10px] text-white/70 mt-1">Captures at device's full screen resolution</p>
                                            </div>
                                        ) : (
                                            /* Camera modes - Quality presets */
                                            <div className="grid grid-cols-2 gap-2">
                                                {QUALITY_PRESETS.map((preset) => (
                                                    <button
                                                        key={preset.id}
                                                        onClick={() => setQuality(preset.id)}
                                                        className={`px-3 py-2 rounded-lg border text-center transition-all ${quality === preset.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                                    >
                                                        <div className="text-[10px] font-bold uppercase">{preset.label}</div>
                                                        <div className="text-[9px] opacity-70">{preset.resolution}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Session Duration Selector */}
                                {!isStreaming && (
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)] mb-3 block">
                                            Session Duration
                                        </span>
                                        <div className="grid grid-cols-5 gap-1">
                                            {DURATION_PRESETS.map((preset) => (
                                                <button
                                                    key={preset.id}
                                                    onClick={() => setSessionDuration(preset.id)}
                                                    className={`px-2 py-2 rounded-lg border text-center transition-all ${sessionDuration === preset.id ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                                >
                                                    <div className="text-[9px] font-bold">{preset.label}</div>
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[9px] text-slate-400 mt-2 text-center">Stream will auto-stop after selected time</p>
                                    </div>
                                )}

                                {/* Countdown Timer (During Stream) */}
                                {isStreaming && remainingTime > 0 && (
                                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-4 text-center animate-pulse">
                                        <div className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-1">Session Expires In</div>
                                        <div className="text-3xl font-bold text-white font-mono">{formatTime(remainingTime)}</div>
                                    </div>
                                )}

                                {/* Remote Control Toggle (During Screen Stream) */}
                                {isStreaming && (streamMode === STREAM_MODE.SCREEN || streamMode === STREAM_MODE.SCREEN_AUDIO) && (
                                    <div className="pt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <button
                                            onClick={() => setIsRemoteEnabled(!isRemoteEnabled)}
                                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-300 ${isRemoteEnabled
                                                ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-inner'
                                                : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${isRemoteEnabled ? 'bg-rose-600 text-white animate-pulse' : 'bg-indigo-600 text-white'}`}>
                                                    <MousePointer2 className="w-4 h-4" />
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-[10px] font-bold uppercase tracking-widest">Remote Control</div>
                                                    <div className="text-[9px] opacity-60">{isRemoteEnabled ? 'Interaction Enabled' : 'Interaction Disabled'}</div>
                                                </div>
                                            </div>
                                            <div className={`w-10 h-6 rounded-full p-1 transition-colors duration-300 ${isRemoteEnabled ? 'bg-rose-600' : 'bg-slate-300'}`}>
                                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${isRemoteEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                                            </div>
                                        </button>

                                        {/* Navigation Controls - Show when remote enabled */}
                                        {isRemoteEnabled && (
                                            <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                {/* System Navigation */}
                                                <div>
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">Navigation</span>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <button
                                                            onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'back' })}
                                                            className="p-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors flex flex-col items-center gap-1"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                                            <span className="text-[8px] font-bold uppercase">Back</span>
                                                        </button>
                                                        <button
                                                            onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'home' })}
                                                            className="p-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors flex flex-col items-center gap-1"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                                                            <span className="text-[8px] font-bold uppercase">Home</span>
                                                        </button>
                                                        <button
                                                            onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'recents' })}
                                                            className="p-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors flex flex-col items-center gap-1"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                                                            <span className="text-[8px] font-bold uppercase">Recents</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Scroll Controls */}
                                                <div>
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">Scroll</span>
                                                    <div className="grid grid-cols-4 gap-2">
                                                        <button
                                                            onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'scroll_up' })}
                                                            className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors flex flex-col items-center"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                                            <span className="text-[7px] font-bold">UP</span>
                                                        </button>
                                                        <button
                                                            onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'scroll_down' })}
                                                            className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors flex flex-col items-center"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                            <span className="text-[7px] font-bold">DOWN</span>
                                                        </button>
                                                        <button
                                                            onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'scroll_left' })}
                                                            className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors flex flex-col items-center"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                                            <span className="text-[7px] font-bold">LEFT</span>
                                                        </button>
                                                        <button
                                                            onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'scroll_right' })}
                                                            className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors flex flex-col items-center"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                            <span className="text-[7px] font-bold">RIGHT</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Quick Actions */}
                                                <div>
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">Quick Actions</span>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'notifications' })}
                                                            className="p-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                                            <span className="text-[8px] font-bold uppercase">Notifications</span>
                                                        </button>
                                                        <button
                                                            onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'quick_settings' })}
                                                            className="p-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            <Settings className="w-4 h-4" />
                                                            <span className="text-[8px] font-bold uppercase">Quick Settings</span>
                                                        </button>
                                                        <button
                                                            onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'screenshot' })}
                                                            className="p-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            <Camera className="w-4 h-4" />
                                                            <span className="text-[8px] font-bold uppercase">Screenshot</span>
                                                        </button>
                                                        <button
                                                            onClick={() => getSocket()?.emit('admin:touch', { deviceId, type: 'lock_screen' })}
                                                            className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                            <span className="text-[8px] font-bold uppercase">Lock Screen</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <p className="text-[9px] text-[var(--muted)] mt-2 px-2 italic text-center">
                                            {isRemoteEnabled
                                                ? 'Click or swipe on the screen to control the device'
                                                : 'Enable to click/swipe the remote device screen'}
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-3 pt-6 border-t border-[var(--border)]">
                                    {!isStreaming ? (
                                        <button onClick={startStream} disabled={connectionState === 'connecting'} className="btn btn-primary w-full py-4 text-xs font-bold uppercase tracking-[0.1em] flex items-center justify-center gap-3">
                                            <Wifi className="w-4 h-4" /> Start Feed
                                        </button>
                                    ) : (
                                        <button onClick={stopStream} className="btn bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white w-full py-4 text-xs font-bold uppercase tracking-[0.1em] flex items-center justify-center gap-3">
                                            <VideoOff className="w-4 h-4" /> Stop Feed
                                        </button>
                                    )}

                                    {streamMode !== STREAM_MODE.AUDIO_ONLY && streamMode !== STREAM_MODE.SCREEN && streamMode !== STREAM_MODE.SCREEN_AUDIO && (
                                        <button onClick={toggleCamera} className="w-full py-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
                                            <Camera className="w-3.5 h-3.5" />
                                            {useFrontCamera ? 'Front Lens' : 'Rear Lens'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Signal Info */}
                            <div className="card bg-indigo-50/30 border-indigo-100 p-6 rounded-[2rem]">
                                <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                    Stream Info
                                </h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                        <span>Encryption</span>
                                        <span className="text-emerald-600">DTLS-SRTP</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                        <span>Protocol</span>
                                        <span className="text-indigo-600">WebRTC P2P</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                        <span>Quality</span>
                                        <span className="text-violet-600">{QUALITY_PRESETS[quality]?.label}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                        <span>Audio</span>
                                        <span className={isMuted ? 'text-red-500' : 'text-emerald-600'}>
                                            {isMuted ? 'Muted' : 'On'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Silent Stream Link */}
                            <Link
                                href={`/devices/view/silent-stream?id=${deviceId}`}
                                className="card p-6 rounded-[2rem] border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 hover:from-violet-100 hover:to-purple-100 transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-sm text-violet-900">Silent Screen Stream</h4>
                                        <p className="text-[10px] text-violet-600 mt-0.5">View FLAG_SECURE protected apps</p>
                                    </div>
                                    <svg className="w-5 h-5 text-violet-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </Link>
                        </div>
                    </div>

                    {error && (
                        <div className="card bg-red-50 border-red-100 p-5 rounded-[2rem] flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-red-100 shadow-sm shrink-0">
                                <AlertCircle className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1 block">Relay Interruption</span>
                                <p className="text-slate-600 text-sm font-medium">{error}</p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
