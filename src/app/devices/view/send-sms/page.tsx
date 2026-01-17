'use client';

import { useEffect, useState, useCallback, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { getContacts, dispatchCommand } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
    Send,
    Phone,
    ArrowLeft,
    CheckCircle2,
    XCircle,
    Loader2,
    MessageSquare,
    X
} from 'lucide-react';
import Link from 'next/link';

export default function SendSmsPage() {
    return (
        <Suspense fallback={null}>
            <SendSmsContent />
        </Suspense>
    );
}

function SendSmsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deviceId = searchParams.get('id') as string;
    const { isAuthenticated, isHydrated } = useAuthStore();

    const [contacts, setContacts] = useState<any[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(true);
    const [recipientInput, setRecipientInput] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    const [selectedContact, setSelectedContact] = useState<any | null>(null);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        if (isHydrated && !isAuthenticated) router.push('/login');
    }, [isHydrated, isAuthenticated, router]);

    const fetchContacts = useCallback(async () => {
        try {
            setLoadingContacts(true);
            const data = await getContacts(deviceId);
            if (data.success) setContacts(data.data);
        } catch (error) {
            console.error('Failed to fetch contacts:', error);
        } finally {
            setLoadingContacts(false);
        }
    }, [deviceId]);

    useEffect(() => {
        if (isAuthenticated && deviceId) fetchContacts();
    }, [isAuthenticated, deviceId, fetchContacts]);

    // Filter contacts based on input - match by name or phone number
    const suggestions = useMemo(() => {
        if (!recipientInput.trim() || selectedContact) return [];
        const query = recipientInput.toLowerCase();
        return contacts.filter(c =>
            c.name?.toLowerCase().includes(query) ||
            c.phone?.includes(query)
        ).slice(0, 8); // Limit to 8 suggestions
    }, [contacts, recipientInput, selectedContact]);

    // Get the phone number to send to
    const getPhoneNumber = () => {
        if (selectedContact && selectedContact.phone) {
            return selectedContact.phone;
        }
        // Use the raw input as phone number (cleaned of non-numeric except + for intl)
        return recipientInput.trim();
    };

    const canSend = () => {
        const phone = getPhoneNumber();
        return phone.length > 0 && message.trim().length > 0;
    };

    const handleSelectContact = (contact: any) => {
        setSelectedContact(contact);
        setRecipientInput(contact.phone || '');
        setShowSuggestions(false);
    };

    const clearSelection = () => {
        setSelectedContact(null);
        setRecipientInput('');
    };

    const handleInputChange = (value: string) => {
        setRecipientInput(value);
        setSelectedContact(null); // Clear selection when typing
        setShowSuggestions(value.length > 0);
    };

    const handleSend = async () => {
        const phoneNumber = getPhoneNumber();
        if (!phoneNumber || !message.trim()) return;

        setSending(true);
        setResult(null);

        try {
            const response = await dispatchCommand(deviceId, 'send_sms', {
                phoneNumber,
                message: message.trim()
            });

            if (response.success) {
                setResult({ success: true, message: 'SMS command sent successfully! Check device for delivery status.' });
                setMessage('');
            } else {
                setResult({ success: false, message: response.error || 'Failed to send SMS command' });
            }
        } catch (error: any) {
            setResult({ success: false, message: error.message || 'Failed to send SMS' });
        } finally {
            setSending(false);
        }
    };

    const charCount = message.length;
    const smsCount = Math.ceil(charCount / 160) || 1;

    if (!isHydrated || !isAuthenticated) return null;

    return (
        <div className="min-h-screen bg-[var(--bg-base)] pb-20 lg:pb-0">
            <Sidebar />
            <main className="lg:ml-72">
                <Header
                    title="Send SMS"
                    subtitle="Send SMS messages through this device"
                />

                <div className="p-4 lg:p-8 max-w-2xl mx-auto animate-fade-in">
                    {/* Back Button */}
                    <Link
                        href={`/devices/view/?id=${deviceId}`}
                        className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors text-sm font-medium mb-6 group"
                    >
                        <div className="w-8 h-8 rounded-lg bg-[var(--bg-subtle)] flex items-center justify-center group-hover:bg-[var(--primary-glow)] transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                        </div>
                        Back to Device
                    </Link>

                    {/* Main Card */}
                    <div className="card p-6 space-y-6">
                        {/* Header Icon */}
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
                                <MessageSquare className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-[var(--text-primary)]">Compose Message</h2>
                                <p className="text-sm text-[var(--text-muted)]">Enter number or select from contacts</p>
                            </div>
                        </div>

                        {/* Unified Recipient Input */}
                        <div className="space-y-3">
                            <label className="block text-sm font-semibold text-[var(--text-primary)]">
                                Recipient
                            </label>

                            <div className="relative">
                                {/* Input with optional contact avatar */}
                                <div className="relative flex items-center">
                                    {selectedContact ? (
                                        <div className="absolute left-3 w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] flex items-center justify-center text-white font-bold text-sm">
                                            {selectedContact.name?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                    ) : (
                                        <Phone className="absolute left-4 w-4 h-4 text-[var(--text-muted)]" />
                                    )}
                                    <input
                                        type="text"
                                        placeholder="Enter number or search contacts..."
                                        value={selectedContact ? `${selectedContact.name} (${selectedContact.phone})` : recipientInput}
                                        onChange={(e) => handleInputChange(e.target.value)}
                                        onFocus={() => setShowSuggestions(recipientInput.length > 0 && !selectedContact)}
                                        className={`input w-full ${selectedContact ? 'pl-14 pr-10' : 'pl-11'}`}
                                        readOnly={!!selectedContact}
                                    />
                                    {selectedContact && (
                                        <button
                                            onClick={clearSelection}
                                            className="absolute right-3 p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors text-[var(--text-muted)] hover:text-red-500"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Contact Suggestions Dropdown */}
                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="absolute z-50 top-full mt-2 w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                        {suggestions.map((contact) => (
                                            <button
                                                key={contact.id}
                                                onClick={() => handleSelectContact(contact)}
                                                className="w-full flex items-center gap-3 p-3 hover:bg-[var(--bg-subtle)] transition-colors text-left"
                                            >
                                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] flex items-center justify-center text-white font-semibold text-sm">
                                                    {contact.name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-[var(--text-primary)] truncate">{contact.name}</p>
                                                    <p className="text-xs text-[var(--text-muted)]">{contact.phone || 'No phone'}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Loading indicator */}
                                {loadingContacts && recipientInput.length > 0 && !selectedContact && (
                                    <div className="absolute z-50 top-full mt-2 w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-lg p-4 text-center">
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-[var(--text-muted)]" />
                                    </div>
                                )}
                            </div>

                            <p className="text-xs text-[var(--text-muted)]">
                                Type a phone number or contact name. Matching contacts will appear as suggestions.
                            </p>
                        </div>

                        {/* Message Input */}
                        <div className="space-y-3">
                            <label className="block text-sm font-semibold text-[var(--text-primary)]">
                                Message
                            </label>
                            <div className="relative">
                                <textarea
                                    placeholder="Type your message..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={5}
                                    className="input w-full resize-none"
                                />
                            </div>
                            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                                <span>{charCount} characters</span>
                                <span>{smsCount} SMS{smsCount > 1 ? 's' : ''} ({charCount > 160 ? 'multi-part' : 'single'})</span>
                            </div>
                        </div>

                        {/* Result Message */}
                        {result && (
                            <div className={`flex items-center gap-3 p-4 rounded-xl ${result.success
                                ? 'bg-green-500/10 border border-green-500/30'
                                : 'bg-red-500/10 border border-red-500/30'
                                }`}>
                                {result.success ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                                ) : (
                                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                                )}
                                <p className={`text-sm font-medium ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                                    {result.message}
                                </p>
                            </div>
                        )}

                        {/* Send Button */}
                        <button
                            onClick={handleSend}
                            disabled={!canSend() || sending}
                            className="btn btn-primary w-full h-12 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {sending ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="w-5 h-5" />
                                    Send SMS
                                </>
                            )}
                        </button>
                    </div>

                    {/* Info Card */}
                    <div className="card p-4 mt-6 bg-blue-500/5 border border-blue-500/20">
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                <MessageSquare className="w-4 h-4 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-[var(--text-primary)] mb-1">How it works</p>
                                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                                    SMS will be sent from the connected device using its phone number.
                                    Long messages (&gt;160 chars) will be split into multiple parts.
                                    Ensure the device has SMS credits and network coverage.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Click outside to close suggestions */}
            {showSuggestions && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSuggestions(false)}
                />
            )}
        </div>
    );
}
