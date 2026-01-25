'use client';

import { useEffect, useState } from 'react';
import {
    Bell,
    RefreshCw,
    Battery,
    BatteryCharging,
    Wifi,
    Signal,
    Mic,
    ChevronLeft,
    Sparkles,
    Activity,
} from 'lucide-react';
import { connectSocket } from '@/lib/socket';
import { useRouter } from 'next/navigation';
import NotificationDropdown from '../notifications/NotificationDropdown';

interface DeviceInfo {
    batteryLevel?: number;
    isCharging?: boolean;
    networkType?: string;
    androidVersion?: string;
    model?: string;
    isRecording?: boolean;
    recordingNumber?: string;
}

interface HeaderProps {
    title: string;
    subtitle?: string;
    onRefresh?: () => void;
    deviceInfo?: DeviceInfo;
    deviceId?: string;
    showBack?: boolean;
}

export default function Header({ title, subtitle, onRefresh, deviceInfo, deviceId, showBack }: HeaderProps) {
    const router = useRouter();
    const [liveDeviceInfo, setLiveDeviceInfo] = useState<DeviceInfo | undefined>(deviceInfo);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [currentTime, setCurrentTime] = useState<string>('');

    // Update time every minute
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }));
        };
        updateTime();
        const interval = setInterval(updateTime, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (deviceId) {
            const socket = connectSocket();

            // Define handlers so we can properly remove just OUR listeners on cleanup
            const handleStatus = (data: {
                deviceId: string;
                batteryLevel?: number;
                networkType?: string;
                isCharging?: boolean;
            }) => {
                if (data.deviceId === deviceId) {
                    setLiveDeviceInfo(prev => ({
                        ...prev,
                        batteryLevel: data.batteryLevel,
                        networkType: data.networkType,
                        isCharging: data.isCharging
                    }));
                }
            };

            const handleRecordingStatus = (data: { deviceId: string; status: string; phoneNumber?: string }) => {
                if (data.deviceId === deviceId) {
                    setLiveDeviceInfo(prev => ({
                        ...prev,
                        isRecording: data.status === 'recording',
                        recordingNumber: data.phoneNumber
                    }));
                }
            };

            socket.on('device:status', handleStatus);
            socket.on('recording:status', handleRecordingStatus);

            return () => {
                // Only remove OUR specific listeners, not all listeners for these events
                socket.off('device:status', handleStatus);
                socket.off('recording:status', handleRecordingStatus);
            };
        }
    }, [deviceId]);

    useEffect(() => {
        if (deviceInfo) setLiveDeviceInfo(deviceInfo);
    }, [deviceInfo]);

    const handleRefresh = async () => {
        if (onRefresh && !isRefreshing) {
            setIsRefreshing(true);
            await onRefresh();
            setTimeout(() => setIsRefreshing(false), 500);
        }
    };

    const getBatteryColor = (level?: number) => {
        if (!level) return 'text-slate-400';
        if (level <= 20) return 'text-red-500';
        if (level <= 50) return 'text-amber-500';
        return 'text-emerald-500';
    };

    const getBatteryBg = (level?: number) => {
        if (!level) return 'bg-slate-100';
        if (level <= 20) return 'bg-red-500/10';
        if (level <= 50) return 'bg-amber-500/10';
        return 'bg-emerald-500/10';
    };

    return (
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 lg:bg-transparent lg:backdrop-blur-none lg:border-0">
            <div className="px-4 py-4 lg:px-8 lg:py-6">
                <div className="flex items-center justify-between gap-4">
                    {/* Left Section */}
                    <div className="flex items-center gap-3 min-w-0">
                        {/* Back Button */}
                        {showBack && (
                            <button
                                onClick={() => router.back()}
                                className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                        )}

                        {/* Title */}
                        <div className="min-w-0">
                            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 truncate">
                                {title}
                            </h1>
                            {subtitle && (
                                <p className="text-sm text-slate-500 truncate flex items-center gap-2 mt-0.5">
                                    {subtitle}
                                    {subtitle.toLowerCase().includes('online') && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-semibold">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            Live
                                        </span>
                                    )}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-3">
                        {/* Device Info Pills - Desktop Only */}
                        {liveDeviceInfo && (
                            <div className="hidden lg:flex items-center gap-2">
                                {/* Recording Indicator */}
                                {liveDeviceInfo.isRecording && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 animate-pulse">
                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                        <Mic className="w-4 h-4 text-red-500" />
                                        <span className="text-xs font-bold text-red-600 uppercase">Recording</span>
                                    </div>
                                )}

                                {/* Battery */}
                                {liveDeviceInfo.batteryLevel !== undefined && (
                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${getBatteryBg(liveDeviceInfo.batteryLevel)} border-transparent`}>
                                        {liveDeviceInfo.isCharging ? (
                                            <BatteryCharging className={`w-5 h-5 ${getBatteryColor(liveDeviceInfo.batteryLevel)}`} />
                                        ) : (
                                            <Battery className={`w-5 h-5 ${getBatteryColor(liveDeviceInfo.batteryLevel)}`} />
                                        )}
                                        <span className={`text-sm font-bold ${getBatteryColor(liveDeviceInfo.batteryLevel)}`}>
                                            {liveDeviceInfo.batteryLevel}%
                                        </span>
                                    </div>
                                )}

                                {/* Network */}
                                {liveDeviceInfo.networkType && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10">
                                        {liveDeviceInfo.networkType.toLowerCase().includes('wifi') ? (
                                            <Wifi className="w-4 h-4 text-blue-500" />
                                        ) : (
                                            <Signal className="w-4 h-4 text-violet-500" />
                                        )}
                                        <span className="text-xs font-bold text-slate-600 uppercase">
                                            {liveDeviceInfo.networkType}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Notifications */}
                        <NotificationDropdown />

                        {/* Refresh */}
                        {onRefresh && (
                            <button
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className="w-10 h-10 lg:w-auto lg:px-4 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                                <span className="hidden lg:inline font-medium">Refresh</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile Device Info Bar */}
                {liveDeviceInfo && (
                    <div className="flex lg:hidden items-center gap-2 mt-4 pt-4 border-t border-slate-100 overflow-x-auto no-scrollbar -mx-4 px-4">
                        {/* Recording Alert */}
                        {liveDeviceInfo.isRecording && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 shrink-0">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <Mic className="w-4 h-4 text-red-500" />
                                <span className="text-xs font-bold text-red-600">REC</span>
                            </div>
                        )}

                        {/* Battery */}
                        {liveDeviceInfo.batteryLevel !== undefined && (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl shrink-0 ${getBatteryBg(liveDeviceInfo.batteryLevel)}`}>
                                {liveDeviceInfo.isCharging ? (
                                    <BatteryCharging className={`w-4 h-4 ${getBatteryColor(liveDeviceInfo.batteryLevel)}`} />
                                ) : (
                                    <Battery className={`w-4 h-4 ${getBatteryColor(liveDeviceInfo.batteryLevel)}`} />
                                )}
                                <span className={`text-xs font-bold ${getBatteryColor(liveDeviceInfo.batteryLevel)}`}>
                                    {liveDeviceInfo.batteryLevel}%
                                </span>
                            </div>
                        )}

                        {/* Network */}
                        {liveDeviceInfo.networkType && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 shrink-0">
                                {liveDeviceInfo.networkType.toLowerCase().includes('wifi') ? (
                                    <Wifi className="w-4 h-4 text-blue-500" />
                                ) : (
                                    <Signal className="w-4 h-4 text-violet-500" />
                                )}
                                <span className="text-xs font-bold text-slate-600 uppercase">
                                    {liveDeviceInfo.networkType}
                                </span>
                            </div>
                        )}

                        {/* Time */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 shrink-0 ml-auto">
                            <Activity className="w-4 h-4 text-slate-500" />
                            <span className="text-xs font-bold text-slate-600">{currentTime}</span>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
}
