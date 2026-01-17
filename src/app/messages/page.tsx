'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import {
    MessageCircle,
    Search,
    ChevronLeft,
    Check,
    CheckCheck,
    Loader2,
    Trash2,
    History,
    Sparkles,
    Wifi,
    WifiOff,
    Users,
    Clock,
    ArrowRight,
} from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { connectSocket } from '@/lib/socket';
import { chatAppConfig, getAppConfig } from '@/components/ChatAppIcons';

interface ChatMessage {
    id: string;
    chatApp: string;
    contactName: string;
    messageText: string;
    isSent: boolean;
    isRaw: boolean;
    timestamp: string;
    screenPosition?: number;
    dateContext?: string;
    extractedTime?: string;
    captureSession?: string;
    isLatest?: boolean;
    captureTimestamp?: string;
}

interface Contact {
    name: string;
    count: number;
    lastMessage?: string;
    lastTime?: string;
    liveActivityTime?: number;
}

function MessagesPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deviceId = searchParams.get('deviceId');

    const [selectedApp, setSelectedApp] = useState<string | null>(null);
    const [selectedContact, setSelectedContact] = useState<string | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [appStats, setAppStats] = useState<{ app: string, count: number }[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [chatTab, setChatTab] = useState<'latest' | 'history'>('latest');
    const [socketConnected, setSocketConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [activeContacts, setActiveContacts] = useState<Map<string, number>>(new Map());
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    // Auto-scroll to bottom
    useEffect(() => {
        if (messagesContainerRef.current && messages.length > 0) {
            setTimeout(() => {
                messagesContainerRef.current?.scrollTo({
                    top: messagesContainerRef.current.scrollHeight,
                    behavior: 'smooth'
                });
            }, 100);
        }
    }, [messages]);

    // Socket connection for real-time updates
    useEffect(() => {
        if (!deviceId) return;

        const socket = connectSocket();
        const handleConnect = () => setSocketConnected(true);
        const handleDisconnect = () => setSocketConnected(false);

        const handleChatNew = (data: {
            deviceId: string;
            count: number;
            chatApp?: string;
            contactName?: string;
            timestamp?: number;
            messages: ChatMessage[]
        }) => {
            if (data.deviceId !== deviceId) return;
            setLastUpdate(new Date());

            if (data.contactName && data.chatApp?.toLowerCase() === selectedApp?.toLowerCase()) {
                const now = Date.now();
                setActiveContacts(prev => {
                    const newMap = new Map(prev);
                    newMap.set(data.contactName!, now);
                    return newMap;
                });

                setContacts(prev => {
                    const updated = prev.map(c =>
                        c.name === data.contactName ? { ...c, liveActivityTime: now } : c
                    );
                    return updated.sort((a, b) => {
                        const aLive = a.liveActivityTime || 0;
                        const bLive = b.liveActivityTime || 0;
                        if (aLive !== bLive) return bLive - aLive;
                        return b.count - a.count;
                    });
                });
            }

            if (selectedApp && selectedContact) {
                const hasRelevantMessages = data.contactName?.toLowerCase() === selectedContact.toLowerCase() ||
                    data.messages?.some(
                        (msg) => msg.chatApp?.toLowerCase() === selectedApp.toLowerCase() &&
                            msg.contactName?.toLowerCase() === selectedContact.toLowerCase()
                    );

                if (hasRelevantMessages) {
                    fetch(`${API_URL}/api/devices/${deviceId}/chats?chatApp=${selectedApp}&contactName=${encodeURIComponent(selectedContact)}&limit=500`)
                        .then(res => res.json())
                        .then(fetchedData => {
                            if (fetchedData.success) setMessages(fetchedData.data);
                        })
                        .catch(console.error);
                }
            }

            fetch(`${API_URL}/api/devices/${deviceId}/chats?limit=1`)
                .then(res => res.json())
                .then(fetchedData => {
                    if (fetchedData.success && fetchedData.filters?.apps) {
                        setAppStats(fetchedData.filters.apps);
                    }
                })
                .catch(() => { });
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('chat:new', handleChatNew);
        setSocketConnected(socket.connected);

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('chat:new', handleChatNew);
        };
    }, [deviceId, selectedApp, selectedContact, API_URL]);

    // Fetch app stats
    useEffect(() => {
        if (!deviceId) return;
        const fetchStats = async () => {
            try {
                const res = await fetch(`${API_URL}/api/devices/${deviceId}/chats?limit=1`);
                const data = await res.json();
                if (data.success && data.filters?.apps) setAppStats(data.filters.apps);
            } catch (err) {
                console.error('Failed to fetch chat stats:', err);
            }
        };
        fetchStats();
    }, [deviceId, API_URL]);

    // Fetch contacts when app selected
    useEffect(() => {
        if (!deviceId || !selectedApp) return;
        const fetchContacts = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_URL}/api/devices/${deviceId}/chats?chatApp=${selectedApp}&limit=1000`);
                const data = await res.json();
                if (data.success) {
                    const contactMap = new Map<string, Contact>();
                    data.data.forEach((msg: ChatMessage) => {
                        const name = msg.contactName || 'Unknown';
                        if (!contactMap.has(name)) {
                            contactMap.set(name, { name, count: 1, lastMessage: msg.messageText, lastTime: msg.timestamp });
                        } else {
                            const c = contactMap.get(name)!;
                            c.count++;
                        }
                    });
                    setContacts(Array.from(contactMap.values()));
                }
            } catch (err) {
                console.error('Failed to fetch contacts:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchContacts();
    }, [deviceId, selectedApp, API_URL]);

    // Fetch messages when contact selected
    useEffect(() => {
        if (!deviceId || !selectedApp || !selectedContact) return;
        const fetchMessages = async () => {
            setLoading(true);
            try {
                const res = await fetch(
                    `${API_URL}/api/devices/${deviceId}/chats?chatApp=${selectedApp}&contactName=${encodeURIComponent(selectedContact)}&limit=500`
                );
                const data = await res.json();
                if (data.success) {
                    const sorted = data.data.sort((a: ChatMessage, b: ChatMessage) => {
                        if (a.captureSession && b.captureSession) {
                            if (a.captureSession !== b.captureSession) {
                                return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
                            }
                            return (a.screenPosition || 0) - (b.screenPosition || 0);
                        }
                        const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
                        if (timeDiff !== 0) return timeDiff;
                        return (a.screenPosition || 0) - (b.screenPosition || 0);
                    });
                    setMessages(sorted);
                }
            } catch (err) {
                console.error('Failed to fetch messages:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchMessages();
    }, [deviceId, selectedApp, selectedContact, API_URL]);

    // Helper functions
    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (timestamp: string) => {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString();
    };

    const isDateOnlyMessage = (messageText: string): boolean => {
        const text = messageText.trim();
        const dateOnlyPatterns = [
            /^\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i,
            /^(Today|Yesterday)$/i,
            /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i,
        ];
        return dateOnlyPatterns.some(p => p.test(text));
    };

    const parseMessageContent = (text: string) => {
        let cleanText = text;
        let extractedTime = '';
        let status = '';
        let isSticker = false;
        let isForward = false;
        let isReply = false;
        let replyTo = '';
        let quotedText = '';

        const statusMatch = cleanText.match(/\s*\[(Read|Delivered|Seen|Sent|Pending)\]\s*$/i);
        if (statusMatch) {
            status = statusMatch[1];
            cleanText = cleanText.replace(/\s*\[(Read|Delivered|Seen|Sent|Pending)\]\s*$/i, '');
        }

        if (/^\s*\d{1,2}:\d{2}\s*(am|pm)\s*$/i.test(cleanText)) {
            cleanText = '👁️ Viewed';
        }

        cleanText = cleanText.replace(/(\bhttps?:\/\/[^\s\]]+)\s*\[\1\]/gi, '$1');
        cleanText = cleanText.replace(/\s*\[(https?:\/\/[^\]]+)\]$/i, '');
        cleanText = cleanText.replace(/\[Missed video call\]\s*Missed video call\s*Tap to call back/gi, '📵 Missed video call');
        cleanText = cleanText.replace(/\[Missed video call\]/gi, '📵 Missed video call');
        cleanText = cleanText.replace(/\[Silenced video call\]\s*Silenced video call\s*While in.*/gi, '🔇 Silenced video call');
        cleanText = cleanText.replace(/\[Silenced video call\]/gi, '🔇 Silenced video call');
        cleanText = cleanText.replace(/📞\s*No answer/gi, '📵 No answer');
        cleanText = cleanText.replace(/^\s*No answer\s*$/gi, '📵 No answer');
        cleanText = cleanText.replace(/\[Enlarge photo\]/gi, '🖼️ Photo');
        cleanText = cleanText.replace(/Tap to call back/gi, '');
        cleanText = cleanText.replace(/\[(Video call|Voice call)\]\s*(Video call|Voice call)\s*/gi, '📞 ');
        cleanText = cleanText.replace(/\[(Video call)\]/gi, '📹 Video call');
        cleanText = cleanText.replace(/\[(Voice call)\]/gi, '📞 Voice call');

        const timeMatch = cleanText.match(/\s+(\d{1,2}:\d{2}\s*(?:am|pm))$/i);
        if (timeMatch) {
            extractedTime = timeMatch[1];
            cleanText = cleanText.replace(/\s+\d{1,2}:\d{2}\s*(?:am|pm)$/i, '');
        }

        if (cleanText.includes('[Sticker]') || cleanText.includes('[Forward sticker]')) {
            isSticker = true;
            cleanText = cleanText.replace(/\[Forward sticker\]\s*/gi, '');
            cleanText = cleanText.replace(/\[Sticker[^\]]*\]\s*/gi, '');
            if (!cleanText.trim()) cleanText = '🏷️ Sticker';
        }

        if (cleanText.includes('Forwarded') || cleanText.includes('[Forward')) {
            isForward = true;
            cleanText = cleanText.replace(/^↩?\s*Forwarded\s*/gi, '');
            cleanText = cleanText.replace(/\[Forward[^\]]*\]\s*/gi, '');
        }

        cleanText = cleanText.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Today|Yesterday)\s+/i, '');
        cleanText = cleanText.replace(/^\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\s*/i, '');
        cleanText = cleanText.replace(/\s+/g, ' ').trim();

        return { text: cleanText || text, time: extractedTime, status, isSticker, isForward, isReply, replyTo, quotedText };
    };

    const getAppColor = (appId: string) => getAppConfig(appId)?.color || '#666';
    const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

    // Process and group messages
    const processAndGroupMessages = () => {
        const processed = messages.filter(msg => !isDateOnlyMessage(msg.messageText));
        const grouped: { [key: string]: ChatMessage[] } = {};

        processed.forEach(msg => {
            let date: string;
            if (msg.isLatest !== undefined) {
                date = msg.isLatest ? 'Today' : (msg.dateContext || formatDate(msg.timestamp));
            } else {
                const dateCtx = msg.dateContext?.toLowerCase();
                date = (!dateCtx || dateCtx === 'today') ? 'Today' : (msg.dateContext || formatDate(msg.timestamp));
            }
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(msg);
        });

        return grouped;
    };

    const groupedMessages = processAndGroupMessages();
    const latestDateKeys = Object.keys(groupedMessages).filter(d => d.toLowerCase() === 'today');
    const historyDateKeys = Object.keys(groupedMessages).filter(d => d.toLowerCase() !== 'today');
    const displayDateKeys = chatTab === 'latest' ? latestDateKeys : historyDateKeys;
    const latestMessageCount = latestDateKeys.reduce((sum, date) => sum + (groupedMessages[date]?.length || 0), 0);
    const historyMessageCount = historyDateKeys.reduce((sum, date) => sum + (groupedMessages[date]?.length || 0), 0);

    // No device selected state
    if (!deviceId) {
        return (
            <div className="min-h-screen bg-[var(--bg-base)]">
                <Sidebar />
                <Header title="Messages" />
                <main className="lg:ml-72 pt-16 p-6">
                    <div className="max-w-4xl mx-auto text-center py-20">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[var(--aurora-violet)] to-[var(--aurora-purple)] flex items-center justify-center shadow-2xl">
                            <MessageCircle className="w-12 h-12 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold mb-3">No Device Selected</h2>
                        <p className="text-[var(--text-muted)] mb-8 max-w-md mx-auto">
                            Select a device from the dashboard to monitor chat messages across all social apps.
                        </p>
                        <button
                            onClick={() => router.push('/devices')}
                            className="px-8 py-4 bg-gradient-to-r from-[var(--aurora-violet)] to-[var(--aurora-purple)] text-white rounded-2xl hover:opacity-90 transition-all font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        >
                            Select Device
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-base)]">
            <Sidebar />
            <Header title="Chat Monitor" />

            <main className="lg:ml-72 pt-16">
                <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
                    {/* Apps Panel - Horizontal on mobile, Vertical on desktop */}
                    <div className="flex-shrink-0 lg:w-24 bg-gradient-to-b from-[var(--bg-elevated)] to-[var(--bg-base)] border-b lg:border-b-0 lg:border-r border-[var(--border-light)] flex lg:flex-col items-center p-4 lg:py-6 gap-3 lg:gap-3 overflow-x-auto lg:overflow-y-auto z-10">
                        <p className="hidden lg:block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Apps</p>

                        {chatAppConfig.map(app => {
                            const stat = appStats.find(s => s.app === app.id);
                            const count = stat?.count || 0;
                            const isActive = selectedApp === app.id;
                            const IconComponent = app.Icon;

                            return (
                                <button
                                    key={app.id}
                                    onClick={() => {
                                        setSelectedApp(app.id);
                                        setSelectedContact(null);
                                        setMessages([]);
                                    }}
                                    className={`group relative flex-shrink-0 w-14 h-14 lg:w-16 lg:h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 ${isActive
                                        ? `bg-gradient-to-br ${app.gradient} shadow-lg shadow-[${app.color}]/30 scale-105 ring-2 ring-white/20`
                                        : 'bg-[var(--bg-subtle)] hover:bg-[var(--bg-elevated)] hover:scale-105'
                                        }`}
                                    title={app.name}
                                >
                                    <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                                        <IconComponent
                                            className={`w-7 h-7 lg:w-8 lg:h-8 ${isActive
                                                ? (app.textColor || 'text-white')
                                                : 'text-[var(--text-secondary)]'
                                                }`}
                                        />
                                    </div>

                                    {/* Message count badge */}
                                    {count > 0 && (
                                        <span className={`absolute -top-1 -right-1 min-w-[20px] h-[20px] text-[10px] font-bold rounded-full flex items-center justify-center px-1.5 shadow-lg ${isActive
                                            ? 'bg-white text-gray-900'
                                            : 'bg-gradient-to-r from-[var(--danger)] to-[#ff6b6b] text-white'
                                            }`}>
                                            {count > 99 ? '99+' : count}
                                        </span>
                                    )}

                                    {/* App name tooltip on hover */}
                                    <span className="hidden lg:block absolute left-full ml-3 px-3 py-1.5 bg-[var(--bg-elevated)] rounded-lg text-xs font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg whitespace-nowrap z-50">
                                        {app.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Contacts Panel */}
                    <div className={`${selectedContact ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 xl:w-96 flex-col bg-[var(--bg-elevated)] border-r border-[var(--border-light)]`}>
                        {/* Header */}
                        <div className="p-4 lg:p-5 border-b border-[var(--border-light)] bg-gradient-to-r from-[var(--bg-elevated)] to-[var(--bg-subtle)]">
                            <div className="flex items-center gap-3 mb-4">
                                {selectedApp && getAppConfig(selectedApp) && (
                                    <div
                                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAppConfig(selectedApp)?.gradient} flex items-center justify-center shadow-lg`}
                                    >
                                        {(() => {
                                            const config = getAppConfig(selectedApp);
                                            if (config) {
                                                const IconComponent = config.Icon;
                                                return <IconComponent className={`w-5 h-5 ${config.textColor || 'text-white'}`} />;
                                            }
                                            return null;
                                        })()}
                                    </div>
                                )}
                                <div>
                                    <h2 className="font-bold text-lg">
                                        {selectedApp ? getAppConfig(selectedApp)?.name : 'Select App'}
                                    </h2>
                                    {selectedApp && (
                                        <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                                            <Users className="w-3 h-3" />
                                            {contacts.length} conversations
                                        </p>
                                    )}
                                </div>
                            </div>

                            {selectedApp && (
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                                    <input
                                        type="text"
                                        placeholder="Search conversations..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-[var(--bg-base)] border border-[var(--border-light)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Contact List */}
                        <div className="flex-1 overflow-y-auto">
                            {!selectedApp ? (
                                <div className="p-8 text-center">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center">
                                        <MessageCircle className="w-8 h-8 text-[var(--text-muted)]" />
                                    </div>
                                    <p className="text-[var(--text-muted)] mb-2">Select an App</p>
                                    <p className="text-xs text-[var(--text-muted)] opacity-60">Choose a messaging app from the sidebar</p>
                                </div>
                            ) : loading && contacts.length === 0 ? (
                                <div className="p-8 text-center">
                                    <Loader2 className="w-10 h-10 mx-auto animate-spin text-[var(--primary)]" />
                                    <p className="mt-4 text-sm text-[var(--text-muted)]">Loading conversations...</p>
                                </div>
                            ) : filteredContacts.length === 0 ? (
                                <div className="p-8 text-center">
                                    <Users className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
                                    <p className="text-[var(--text-muted)]">No conversations found</p>
                                </div>
                            ) : (
                                filteredContacts.map(contact => {
                                    const activityTime = contact.liveActivityTime || activeContacts.get(contact.name) || 0;
                                    const isLive = activityTime > Date.now() - 30000;
                                    const isRecent = activityTime > Date.now() - 300000;

                                    return (
                                        <button
                                            key={contact.name}
                                            onClick={() => setSelectedContact(contact.name)}
                                            className={`w-full p-4 flex items-center gap-3 border-b border-[var(--border-light)] hover:bg-[var(--bg-subtle)] transition-all group ${selectedContact === contact.name ? 'bg-[var(--primary-glow)] border-l-4 border-l-[var(--primary)]' : ''
                                                } ${isLive ? 'bg-green-500/5' : ''}`}
                                        >
                                            <div className="relative">
                                                <div
                                                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg transition-all ${isLive ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-[var(--bg-base)]' : ''
                                                        }`}
                                                    style={{
                                                        background: `linear-gradient(135deg, ${getAppColor(selectedApp || '')} 0%, ${getAppColor(selectedApp || '')}aa 100%)`
                                                    }}
                                                >
                                                    {contact.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[var(--bg-elevated)] ${isLive ? 'bg-green-500 animate-pulse' : isRecent ? 'bg-yellow-500' : 'bg-gray-500'
                                                    }`} />
                                            </div>

                                            <div className="flex-1 text-left min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`font-semibold truncate ${isLive ? 'text-green-400' : ''}`}>
                                                        {contact.name}
                                                        {isLive && (
                                                            <span className="ml-2 px-2 py-0.5 text-[9px] uppercase tracking-wider bg-green-500/20 text-green-400 rounded-full">
                                                                Live
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {contact.lastTime && formatTime(contact.lastTime)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm text-[var(--text-muted)] truncate max-w-[180px]">
                                                        {contact.lastMessage?.substring(0, 35)}...
                                                    </p>
                                                    <span className="ml-2 min-w-[24px] h-6 bg-gradient-to-r from-[var(--primary)] to-[var(--aurora-purple)] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-2 shadow-sm">
                                                        {contact.count}
                                                    </span>
                                                </div>
                                            </div>

                                            <ArrowRight className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Chat View Panel */}
                    <div className={`${selectedContact ? 'flex' : 'hidden lg:flex'} flex-1 flex-col bg-[var(--bg-base)]`}>
                        {!selectedContact ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center p-8">
                                    <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[var(--bg-subtle)] to-[var(--bg-elevated)] flex items-center justify-center">
                                        <MessageCircle className="w-10 h-10 text-[var(--text-muted)]" />
                                    </div>
                                    <p className="text-xl font-semibold mb-2">Select a Conversation</p>
                                    <p className="text-sm text-[var(--text-muted)]">Choose a contact to view messages</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Chat Header */}
                                <div
                                    className="p-4 flex items-center gap-3 border-b border-[var(--border-light)] backdrop-blur-xl"
                                    style={{
                                        background: `linear-gradient(135deg, ${getAppColor(selectedApp || '')}15 0%, transparent 100%)`
                                    }}
                                >
                                    <button
                                        onClick={() => setSelectedContact(null)}
                                        className="lg:hidden p-2 -ml-2 rounded-xl hover:bg-[var(--bg-subtle)] transition-colors"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>

                                    <div
                                        className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shadow-lg"
                                        style={{
                                            background: `linear-gradient(135deg, ${getAppColor(selectedApp || '')} 0%, ${getAppColor(selectedApp || '')}aa 100%)`
                                        }}
                                    >
                                        {selectedContact.charAt(0).toUpperCase()}
                                    </div>

                                    <div className="flex-1">
                                        <h3 className="font-bold flex items-center gap-2">
                                            {selectedContact}
                                            <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-medium ${socketConnected
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                {socketConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                                                {socketConnected ? 'Live' : 'Offline'}
                                            </span>
                                        </h3>
                                        <p className="text-xs text-[var(--text-muted)]">
                                            {messages.length} messages • {getAppConfig(selectedApp || '')?.name}
                                            {lastUpdate && (
                                                <span className="ml-2 text-green-400">
                                                    • Updated {lastUpdate.toLocaleTimeString()}
                                                </span>
                                            )}
                                        </p>
                                    </div>

                                    <button
                                        onClick={async () => {
                                            if (confirm(`Clear all messages for ${selectedContact}?`)) {
                                                try {
                                                    const res = await fetch(
                                                        `${API_URL}/api/devices/${deviceId}/chats?chatApp=${selectedApp}&contactName=${encodeURIComponent(selectedContact)}`,
                                                        { method: 'DELETE' }
                                                    );
                                                    const data = await res.json();
                                                    if (data.success) {
                                                        setMessages([]);
                                                        alert(`Cleared ${data.deleted} messages!`);
                                                    }
                                                } catch (e) {
                                                    console.error('Failed to clear messages:', e);
                                                }
                                            }
                                        }}
                                        className="p-2.5 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors"
                                        title="Clear messages"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Tab Navigation */}
                                <div className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-light)]">
                                    <button
                                        onClick={() => setChatTab('latest')}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${chatTab === 'latest'
                                            ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--aurora-purple)] text-white shadow-lg'
                                            : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'
                                            }`}
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        Latest
                                        {latestMessageCount > 0 && (
                                            <span className={`min-w-[20px] h-[20px] text-[10px] font-bold rounded-full flex items-center justify-center px-1.5 ${chatTab === 'latest' ? 'bg-white/20' : 'bg-[var(--primary)] text-white'
                                                }`}>
                                                {latestMessageCount}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setChatTab('history')}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${chatTab === 'history'
                                            ? 'bg-gradient-to-r from-[var(--aurora-purple)] to-[var(--aurora-violet)] text-white shadow-lg'
                                            : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'
                                            }`}
                                    >
                                        <History className="w-4 h-4" />
                                        History
                                        {historyMessageCount > 0 && (
                                            <span className={`min-w-[20px] h-[20px] text-[10px] font-bold rounded-full flex items-center justify-center px-1.5 ${chatTab === 'history' ? 'bg-white/20' : 'bg-[var(--aurora-purple)] text-white'
                                                }`}>
                                                {historyMessageCount}
                                            </span>
                                        )}
                                    </button>
                                </div>

                                {/* Messages Area */}
                                <div
                                    ref={messagesContainerRef}
                                    className="flex-1 overflow-y-auto p-4 space-y-4"
                                    style={{
                                        backgroundImage: selectedApp === 'whatsapp'
                                            ? 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23075e54\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'
                                            : undefined,
                                        backgroundColor: selectedApp === 'whatsapp' ? '#0b141a' : undefined
                                    }}
                                >
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center py-12">
                                            <Loader2 className="w-10 h-10 animate-spin text-[var(--primary)]" />
                                            <p className="mt-4 text-sm text-[var(--text-muted)]">Loading messages...</p>
                                        </div>
                                    ) : displayDateKeys.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
                                            {chatTab === 'latest' ? (
                                                <>
                                                    <div className="w-16 h-16 rounded-2xl bg-[var(--bg-elevated)] flex items-center justify-center mb-4">
                                                        <Sparkles className="w-8 h-8 opacity-40" />
                                                    </div>
                                                    <p className="font-medium">No messages today</p>
                                                    <p className="text-xs mt-2 opacity-60">Check History for older messages</p>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-16 h-16 rounded-2xl bg-[var(--bg-elevated)] flex items-center justify-center mb-4">
                                                        <History className="w-8 h-8 opacity-40" />
                                                    </div>
                                                    <p className="font-medium">No message history</p>
                                                    <p className="text-xs mt-2 opacity-60">Older messages will appear here</p>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        displayDateKeys.map((date) => {
                                            const msgs = groupedMessages[date];
                                            return (
                                                <div key={date}>
                                                    <div className="flex justify-center mb-4">
                                                        <span className="px-4 py-1.5 bg-[var(--bg-elevated)] rounded-full text-xs text-[var(--text-muted)] shadow-lg backdrop-blur-sm">
                                                            {date}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {msgs.filter(msg => {
                                                            if (isDateOnlyMessage(msg.messageText)) return false;
                                                            const parsed = parseMessageContent(msg.messageText);
                                                            return parsed.text && parsed.text.trim().length > 0;
                                                        }).map((msg) => {
                                                            const parsed = parseMessageContent(msg.messageText);
                                                            const displayTime = msg.extractedTime || parsed.time || formatTime(msg.timestamp);

                                                            return (
                                                                <div
                                                                    key={msg.id}
                                                                    className={`flex ${msg.isSent ? 'justify-end' : 'justify-start'}`}
                                                                >
                                                                    <div
                                                                        className={`max-w-[75%] px-4 py-2.5 rounded-2xl shadow-sm ${msg.isRaw
                                                                            ? 'bg-[var(--bg-elevated)] border border-[var(--border-light)]'
                                                                            : msg.isSent
                                                                                ? selectedApp === 'whatsapp'
                                                                                    ? 'bg-[#005c4b] text-white'
                                                                                    : 'bg-gradient-to-br from-[var(--aurora-violet)] to-[var(--aurora-purple)] text-white'
                                                                                : 'bg-[var(--bg-elevated)]'
                                                                            }`}
                                                                        style={{
                                                                            borderRadius: msg.isSent
                                                                                ? '20px 20px 4px 20px'
                                                                                : '20px 20px 20px 4px'
                                                                        }}
                                                                    >
                                                                        {parsed.isForward && (
                                                                            <div className={`text-[10px] mb-1 flex items-center gap-1 ${msg.isSent ? 'text-white/60' : 'text-[var(--text-muted)]'
                                                                                }`}>
                                                                                ↪ Forwarded
                                                                            </div>
                                                                        )}
                                                                        <p className="text-sm break-words leading-relaxed">
                                                                            {parsed.isSticker ? '🏷️ ' : ''}{parsed.text}
                                                                        </p>
                                                                        <div className={`flex items-center justify-end gap-1.5 mt-1 ${msg.isSent ? 'text-white/70' : 'text-[var(--text-muted)]'
                                                                            }`}>
                                                                            <span className="text-[10px]">{displayTime}</span>
                                                                            {msg.isSent && !msg.isRaw && (
                                                                                <>
                                                                                    {parsed.status === 'Read' || parsed.status === 'Seen' ? (
                                                                                        <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                                                                                    ) : parsed.status === 'Delivered' ? (
                                                                                        <CheckCheck className="w-3.5 h-3.5" />
                                                                                    ) : (
                                                                                        <Check className="w-3.5 h-3.5" />
                                                                                    )}
                                                                                </>
                                                                            )}
                                                                            {msg.isRaw && (
                                                                                <span className="text-[10px] opacity-60">RAW</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Read-only Footer */}
                                <div className="p-4 border-t border-[var(--border-light)] bg-[var(--bg-elevated)]">
                                    <div className="flex items-center gap-3 px-5 py-3.5 bg-[var(--bg-subtle)] rounded-2xl text-[var(--text-muted)]">
                                        <MessageCircle className="w-5 h-5" />
                                        <span className="text-sm">Messages are read-only (monitoring mode)</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function MessagesPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-[var(--primary)] mx-auto" />
                    <p className="mt-4 text-sm text-[var(--text-muted)]">Loading Chat Monitor...</p>
                </div>
            </div>
        }>
            <MessagesPageContent />
        </Suspense>
    );
}
