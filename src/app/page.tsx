'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import DeviceCard from '@/components/devices/DeviceCard';
import { getDevices, refreshRealtimeStatus } from '@/lib/api';
import { useDevicesStore, useAuthStore } from '@/lib/store';
import { connectSocket } from '@/lib/socket';
import { subscribeToDeviceStatuses } from '@/lib/firebase';
import {
  Smartphone,
  Globe,
  MessageSquare,
  Camera,
  ArrowUpRight,
  Zap,
  Activity,
  Users,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const { isAuthenticated, isHydrated } = useAuthStore();
  const { devices, setDevices, updateDevice } = useDevicesStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    online: 0,
    totalSms: 0,
    totalPhotos: 0,
  });

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [isHydrated, isAuthenticated, router]);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      await refreshRealtimeStatus().catch(() => { });
      const data = await getDevices();
      if (data.success) {
        setDevices(data.devices);
        const onlineCount = data.devices.filter((d: any) => d.isOnline).length;
        const totalSms = data.devices.reduce((sum: number, d: any) => sum + (d.stats?.sms || 0), 0);
        const totalPhotos = data.devices.reduce((sum: number, d: any) => sum + (d.stats?.photos || 0) + (d.stats?.screenshots || 0), 0);
        setStats({ total: data.devices.length, online: onlineCount, totalSms, totalPhotos });
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoading(false);
    }
  }, [setDevices]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDevices();
      const socket = connectSocket();
      socket.on('device:online', (data) => updateDevice(data.deviceId, { isOnline: true }));
      socket.on('device:offline', (data) => updateDevice(data.deviceId, { isOnline: false }));
      const unsubscribeFirebase = subscribeToDeviceStatuses((statusMap) => {
        statusMap.forEach((status, deviceId) => updateDevice(deviceId, { isOnline: status.online }));
        const onlineCount = Array.from(statusMap.values()).filter(s => s.online).length;
        setStats(prev => ({ ...prev, online: onlineCount }));
      });
      return () => {
        socket.off('device:online');
        socket.off('device:offline');
        unsubscribeFirebase();
      };
    }
  }, [isAuthenticated, fetchDevices, updateDevice]);

  if (!isHydrated || !isAuthenticated) return null;

  const statsCards = [
    { label: 'Devices', value: stats.total, icon: Smartphone, gradient: 'from-blue-500 to-cyan-400' },
    { label: 'Online', value: stats.online, icon: Globe, gradient: 'from-emerald-500 to-teal-400', live: true },
    { label: 'SMS', value: stats.totalSms.toLocaleString(), icon: MessageSquare, gradient: 'from-purple-500 to-pink-400' },
    { label: 'Media', value: stats.totalPhotos.toLocaleString(), icon: Camera, gradient: 'from-orange-500 to-amber-400' },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-elevated)] pb-20 lg:pb-0">
      <Sidebar />
      <main className="lg:ml-72 lg:bg-[var(--bg-base)]">
        <Header title="Dashboard" subtitle="Welcome back to your control center" onRefresh={fetchDevices} />

        <div className="p-3 lg:px-8 lg:py-6 lg:max-w-7xl lg:mx-auto space-y-3 lg:space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 lg:gap-4">
            {statsCards.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="bg-white rounded-xl p-3 lg:p-5 lg:rounded-2xl border border-[var(--border-light)] relative overflow-hidden shadow-sm">
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.gradient}`} />
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-9 h-9 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-4 h-4 lg:w-6 lg:h-6 text-white" />
                    </div>
                    {stat.live && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[8px] font-bold text-emerald-600">LIVE</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xl lg:text-3xl font-bold text-[var(--text-primary)]">{stat.value}</p>
                  <p className="text-[10px] lg:text-xs font-semibold text-[var(--text-muted)] uppercase">{stat.label}</p>
                </div>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-3 lg:rounded-2xl border border-[var(--border-light)] shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--aurora-violet)] to-[var(--aurora-purple)] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm text-[var(--text-primary)]">Quick Actions</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-light)] text-[var(--text-secondary)]">
                <Users className="w-4 h-4" />
              </button>
              <button className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-light)] text-[var(--text-secondary)]">
                <Activity className="w-4 h-4" />
              </button>
              <button className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-gradient-to-r from-[var(--aurora-violet)] to-[var(--aurora-purple)] text-white shadow-lg">
                <Zap className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Devices Section */}
          <div>
            <div className="flex items-center gap-3 mb-3 lg:mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--aurora-violet)] to-[var(--aurora-purple)] flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-[var(--text-primary)]">Your Devices</h2>
                <p className="text-[10px] text-[var(--text-muted)]">{devices.length} registered</p>
              </div>
            </div>

            {loading ? (
              <div className="space-y-2 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4 lg:space-y-0">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 lg:h-48 rounded-xl lg:rounded-2xl bg-[var(--bg-subtle)] skeleton" />
                ))}
              </div>
            ) : devices.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border border-[var(--border-light)] shadow-sm">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
                  <Smartphone className="w-8 h-8 text-[var(--text-muted)]" />
                </div>
                <h3 className="font-bold text-lg text-[var(--text-primary)] mb-2">No Devices</h3>
                <p className="text-sm text-[var(--text-muted)]">Install the app to start monitoring</p>
              </div>
            ) : (
              <div className="space-y-2 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4 lg:space-y-0">
                {devices.map((device) => (
                  <DeviceCard key={device.id} device={device} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
