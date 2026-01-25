import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Notification {
    id: string;
    type: 'online' | 'offline' | 'sms' | 'call' | 'photo' | 'screenshot' | 'security' | 'other';
    title: string;
    message: string;
    timestamp: number;
    deviceId: string;
    deviceName?: string;
    read: boolean;
    link?: string;
}

interface NotificationsState {
    notifications: Notification[];
    unreadCount: number;
    addNotification: (notification: Omit<Notification, 'id' | 'read' | 'timestamp'>) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearAll: () => void;
    removeNotification: (id: string) => void;
}

export const useNotificationsStore = create<NotificationsState>()(
    persist(
        (set, get) => ({
            notifications: [],
            unreadCount: 0,

            addNotification: (notif) => {
                const newNotif: Notification = {
                    ...notif,
                    id: Math.random().toString(36).substring(2, 11),
                    read: false,
                    timestamp: Date.now(),
                };

                set((state) => {
                    const updatedNotifications = [newNotif, ...state.notifications].slice(0, 100); // Keep last 100
                    return {
                        notifications: updatedNotifications,
                        unreadCount: updatedNotifications.filter(n => !n.read).length
                    };
                });
            },

            markAsRead: (id) => {
                set((state) => {
                    const updated = state.notifications.map(n =>
                        n.id === id ? { ...n, read: true } : n
                    );
                    return {
                        notifications: updated,
                        unreadCount: updated.filter(n => !n.read).length
                    };
                });
            },

            markAllAsRead: () => {
                set((state) => {
                    const updated = state.notifications.map(n => ({ ...n, read: true }));
                    return {
                        notifications: updated,
                        unreadCount: 0
                    };
                });
            },

            clearAll: () => {
                set({ notifications: [], unreadCount: 0 });
            },

            removeNotification: (id) => {
                set((state) => {
                    const updated = state.notifications.filter(n => n.id !== id);
                    return {
                        notifications: updated,
                        unreadCount: updated.filter(n => !n.read).length
                    };
                });
            }
        }),
        {
            name: 'notifications-storage',
        }
    )
);
