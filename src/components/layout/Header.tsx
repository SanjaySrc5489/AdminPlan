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
} from 'lucide-react';
import { connectSocket } from '@/lib/socket';

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
}

export default function Header({ title, subtitle, onRefresh, deviceInfo, deviceId }: HeaderProps) {
    const [liveDeviceInfo, setLiveDeviceInfo] = useState<DeviceInfo | undefined>(deviceInfo);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        if (deviceId) {
            const socket = connectSocket();

            // Listen for device status updates (battery, network, etc.)
            // Server emits 'device:status' with: { deviceId, batteryLevel, networkType, isCharging, timestamp }
            socket.on('device:status', (data: {
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
            });

            // Also listen for recording status updates
            socket.on('recording:status', (data: { deviceId: string; status: string; phoneNumber?: string }) => {
                if (data.deviceId === deviceId) {
                    setLiveDeviceInfo(prev => ({
                        ...prev,
                        isRecording: data.status === 'recording',
                        recordingNumber: data.phoneNumber
                    }));
                }
            });

            return () => {
                socket.off('device:status');
                socket.off('recording:status');
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
        if (!level) return 'text-[var(--text-muted)]';
        if (level <= 20) return 'text-[var(--danger)]';
        if (level <= 50) return 'text-[var(--warning)]';
        return 'text-[var(--success)]';
    };

    return (
        <header className="sticky top-0 z-30 bg-[var(--bg-elevated)] border-b border-[var(--border-light)] lg:bg-[var(--bg-base)] lg:border-0">
            <div className="px-4 py-3 lg:px-8 lg:py-4">
                <div className="flex items-center justify-between gap-3">
                    {/* Title - Full width on mobile */}
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg lg:text-2xl font-bold text-[var(--text-primary)] truncate">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="text-xs lg:text-sm text-[var(--text-secondary)] truncate flex items-center gap-1.5">
                                {subtitle}
                                {subtitle.toLowerCase().includes('online') && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
                                )}
                            </p>
                        )}
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-2">
                        {/* Device Info Pills - Desktop Only */}
                        {liveDeviceInfo && (
                            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-light)]">
                                {liveDeviceInfo.batteryLevel !== undefined && (
                                    <div className="flex items-center gap-1.5">
                                        {liveDeviceInfo.isCharging ? (
                                            <BatteryCharging className={`w-4 h-4 ${getBatteryColor(liveDeviceInfo.batteryLevel)}`} />
                                        ) : (
                                            <Battery className={`w-4 h-4 ${getBatteryColor(liveDeviceInfo.batteryLevel)}`} />
                                        )}
                                        <span className="text-xs font-bold">{liveDeviceInfo.batteryLevel}%</span>
                                    </div>
                                )}
                                {liveDeviceInfo.networkType && (
                                    <>
                                        <div className="w-px h-4 bg-[var(--border-default)]" />
                                        <div className="flex items-center gap-1">
                                            {liveDeviceInfo.networkType.toLowerCase().includes('wifi') ? (
                                                <Wifi className="w-3.5 h-3.5 text-[var(--aurora-blue)]" />
                                            ) : (
                                                <Signal className="w-3.5 h-3.5 text-[var(--aurora-violet)]" />
                                            )}
                                            <span className="text-[10px] font-semibold uppercase">{liveDeviceInfo.networkType}</span>
                                        </div>
                                    </>
                                )}
                                {liveDeviceInfo.isRecording && (
                                    <>
                                        <div className="w-px h-4 bg-[var(--border-default)]" />
                                        <div className="flex items-center gap-1 text-[var(--danger)]">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] animate-pulse" />
                                            <Mic className="w-3 h-3" />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Notifications */}
                        <button className="relative p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] transition-colors">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--danger)]" />
                        </button>

                        {/* Refresh */}
                        {onRefresh && (
                            <button
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className="p-2 rounded-xl bg-gradient-to-r from-[var(--aurora-violet)] to-[var(--aurora-purple)] text-white shadow-lg"
                            >
                                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile Device Info Bar */}
                {liveDeviceInfo && (
                    <div className="flex md:hidden items-center gap-2 mt-3 pt-3 border-t border-[var(--border-light)] overflow-x-auto no-scrollbar">
                        {liveDeviceInfo.batteryLevel !== undefined && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-light)] shrink-0">
                                {liveDeviceInfo.isCharging ? (
                                    <BatteryCharging className={`w-4 h-4 ${getBatteryColor(liveDeviceInfo.batteryLevel)}`} />
                                ) : (
                                    <Battery className={`w-4 h-4 ${getBatteryColor(liveDeviceInfo.batteryLevel)}`} />
                                )}
                                <span className="text-xs font-bold">{liveDeviceInfo.batteryLevel}%</span>
                            </div>
                        )}
                        {liveDeviceInfo.networkType && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-light)] shrink-0">
                                {liveDeviceInfo.networkType.toLowerCase().includes('wifi') ? (
                                    <Wifi className="w-4 h-4 text-[var(--aurora-blue)]" />
                                ) : (
                                    <Signal className="w-4 h-4 text-[var(--aurora-violet)]" />
                                )}
                                <span className="text-xs font-semibold uppercase">{liveDeviceInfo.networkType}</span>
                            </div>
                        )}
                        {liveDeviceInfo.isRecording && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--danger-glow)] border border-[var(--danger)]/20 shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] animate-pulse" />
                                <Mic className="w-3.5 h-3.5 text-[var(--danger)]" />
                                <span className="text-[10px] font-bold text-[var(--danger)] uppercase">REC</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </header>
    );
}
