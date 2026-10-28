import { isPinHashed, maskPin } from '../utils/securityUtils';
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { StaffMember, UserRole, StaffRole, PaymentMethodConfig, PaymentMethodType } from '../types';
import { ALL_SYSTEM_PERMISSIONS, ALL_SYSTEM_PERMISSIONS as SYSTEM_PERMISSIONS } from '../data/accountingAndConfigData';
import { Users, Shield, KeyRound, Trash2, Plus, Edit2, CheckCircle2, AlertTriangle, AlertCircle, RotateCcw, Building2, Factory, Mail, Phone, Search, Lock, Eye, EyeOff, SlidersHorizontal, FolderSync, FileSpreadsheet, AlertOctagon, CheckSquare, Square, Sparkles, Server, Globe, ExternalLink, Cpu, HardDrive, ShieldCheck, Zap, CreditCard, Landmark, Smartphone, Save, Copy, Check, Star, Banknote, X, Wallet, Database, Printer, Cloud, RefreshCw, Upload, Download, ArrowRight, MapPin, Loader2, } from 'lucide-react';
import { getPaymentMethodLiveBalance, getBankAccountsBreakdown } from '../utils/accountUtils';
import { BrandLogo } from './BrandLogo';
import { PrinterBridgeModal } from './PrinterBridgeModal';
import { checkHardwareAgentStatus, HardwareAgentStatus } from '../utils/hardwarePrint';
interface SettingsModuleProps {
    onNavigateTab?: (tab: string) => void;
}
export const SettingsModule: React.FC<SettingsModuleProps> = ({ onNavigateTab }) => {
    const { staffMembers = [], userRoles = [], activeStaff, setActiveStaff, language, profile, updateProfile, paymentMethods = [], accountBalances, chartOfAccounts = [], transactions = [], invoices = [], products = [], journalEntries = [], projects = [], addPaymentMethod, updatePaymentMethod, deletePaymentMethod, togglePaymentMethod, setDefaultPaymentMethod, addAuditLog, addStaffMember, updateStaffMember, deleteStaffMember, addUserRole, updateUserRole, deleteUserRole, cleanModuleData, resetToDefaultData, checkPermission, exportDatabase, importDatabase, syncWithCloud, cloudSyncStatus, isCloudConnected, lastSyncedAt, } = useApp();
    const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'payment-gateways' | 'system-tools' | 'data-clean' | 'system'>('users');
    const [searchQuery, setSearchQuery] = useState('');
    const [printerStatus, setPrinterStatus] = useState<HardwareAgentStatus>({ isOnline: false });
    const [showPrinterBridgeModal, setShowPrinterBridgeModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [importStatus, setImportStatus] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchPrinterStatus = async () => {
            try {
                const s = await checkHardwareAgentStatus();
                if (isMounted)
                    setPrinterStatus(s);
            }
            catch {
                if (isMounted)
                    setPrinterStatus({ isOnline: false });
            }
        };
        fetchPrinterStatus();
        const interval = setInterval(fetchPrinterStatus, 6000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const lowStockCount = (products || []).filter((p) => (p.stockFactory || 0) + (p.stockOffice || 0) <= (p.minStockAlert || 5)).length;

    const handleExport = () => {
        const dataStr = exportDatabase();
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dot-color-erp-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            const ok = importDatabase(content);
            if (ok) {
                setImportStatus('success');
                syncWithCloud?.({ forcePush: true });
                setTimeout(() => setImportStatus(null), 4000);
            }
            else {
                setImportStatus('error');
                setTimeout(() => setImportStatus(null), 4000);
            }
        };
        reader.readAsText(file);
    };
    // User modal states
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
    const [showUserPassword, setShowUserPassword] = useState(false);
    const [userSaveSuccess, setUserSaveSuccess] = useState<string | null>(null);
    const [userFormData, setUserFormData] = useState({
        name: '',
        nameBn: '',
        role: 'Sales Executive' as StaffRole,
        roleBn: "",
        location: 'Office' as 'Office' | 'Factory' | 'Both',
        phone: '',
        email: '',
        password: '',
        customRoleId: '',
        isActive: true,
    });
    // Role modal states
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [editingRole, setEditingRole] = useState<UserRole | null>(null);
    const [roleFormData, setRoleFormData] = useState({
        name: '',
        nameBn: '',
        description: '',
        permissions: [] as string[],
    });
    // Data cleanup modal state
    const [cleanConfirmModule, setCleanConfirmModule] = useState<string | null>(null);
    const [cleanFeedback, setCleanFeedback] = useState<string | null>(null);
    const [isPurging, setIsPurging] = useState<boolean>(false);
    const isSuperUser = (activeStaff?.role || '').toLowerCase() === 'super admin' ||
        (activeStaff?.role || '').toLowerCase() === 'superadmin' ||
        activeStaff?.customRoleId === 'role-superadmin' ||
        (activeStaff?.name || '').toLowerCase().includes('super admin');
    const canManageUsers = isSuperUser || checkPermission('settings.manage_users') ||
        checkPermission('SETTINGS_MANAGE_USERS');
    const canManageRoles = isSuperUser || checkPermission('settings.manage_roles') ||
        checkPermission('SETTINGS_MANAGE_ROLES');
    const canCleanData = isSuperUser || checkPermission('settings.clean_data') ||
        checkPermission('SETTINGS_CLEAN_DATA');
    const canManagePayments = isSuperUser || checkPermission('settings.manage_payments');
    const [paymentFormData, setPaymentFormData] = useState({
        bankName: profile.bankName || '',
        bankAccount: profile.bankAccount || '',
        bankAccountTitle: profile.bankAccountTitle || profile.name || '',
        bankBranch: profile.bankBranch || '',
        routingNumber: profile.routingNumber || '',
        bkashNagadNumber: profile.bkashNagadNumber || '',
        nagadNumber: profile.nagadNumber || '',
        rocketNumber: profile.rocketNumber || '',
        bankingNotes: profile.bankingNotes || '',
        paymentGatewayProvider: profile.paymentGatewayProvider || 'none',
        paymentGatewayMode: profile.paymentGatewayMode || 'sandbox',
        paymentGatewayStoreId: profile.paymentGatewayStoreId || '',
        paymentGatewayApiKey: profile.paymentGatewayApiKey || '',
        paymentGatewaySecret: profile.paymentGatewaySecret || '',
        paymentGatewayIsEnabled: profile.paymentGatewayIsEnabled || false,
    });
    const [showSecretKey, setShowSecretKey] = useState(false);
    const [paymentSaveSuccess, setPaymentSaveSuccess] = useState(false);
    const [copiedCallback, setCopiedCallback] = useState(false);
    useEffect(() => {
        setPaymentFormData({
            bankName: profile.bankName || '',
            bankAccount: profile.bankAccount || '',
            bankAccountTitle: profile.bankAccountTitle || profile.name || '',
            bankBranch: profile.bankBranch || '',
            routingNumber: profile.routingNumber || '',
            bkashNagadNumber: profile.bkashNagadNumber || '',
            nagadNumber: profile.nagadNumber || '',
            rocketNumber: profile.rocketNumber || '',
            bankingNotes: profile.bankingNotes || '',
            paymentGatewayProvider: profile.paymentGatewayProvider || 'none',
            paymentGatewayMode: profile.paymentGatewayMode || 'sandbox',
            paymentGatewayStoreId: profile.paymentGatewayStoreId || '',
            paymentGatewayApiKey: profile.paymentGatewayApiKey || '',
            paymentGatewaySecret: profile.paymentGatewaySecret || '',
            paymentGatewayIsEnabled: profile.paymentGatewayIsEnabled || false,
        });
    }, [profile]);
    useEffect(() => {
        const handleOpenPayment = () => setActiveTab('payment-gateways');
        window.addEventListener('open-payment-settings', handleOpenPayment);
        return () => window.removeEventListener('open-payment-settings', handleOpenPayment);
    }, []);
    // Dynamic Payment Method State & Handlers
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethodConfig | null>(null);
    const [paymentFilterType, setPaymentFilterType] = useState<string>('ALL');
    const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
    const [paymentViewMode, setPaymentViewMode] = useState<'table' | 'cards'>('table');
    const [deleteConfirmPaymentId, setDeleteConfirmPaymentId] = useState<string | null>(null);
    const filteredPaymentMethods = useMemo(() => {
        return paymentMethods
            .filter((pm) => {
            if (paymentFilterType === 'ALL')
                return true;
            if (paymentFilterType === 'cash')
                return pm.type === 'cash';
            if (paymentFilterType === 'mfs')
                return pm.type === 'mfs';
            if (paymentFilterType === 'bank')
                return pm.type === 'bank';
            if (paymentFilterType === 'credit')
                return pm.name.toLowerCase().includes('due') || pm.name.toLowerCase().includes('credit') || pm.type === 'cheque';
            if (paymentFilterType === 'gateway')
                return pm.type === 'gateway' || pm.name.toLowerCase().includes('qr') || pm.name.toLowerCase().includes('ssl');
            return true;
        })
            .filter((pm) => {
            if (!paymentSearchQuery.trim())
                return true;
            const q = paymentSearchQuery.toLowerCase().trim();
            return (pm.name.toLowerCase().includes(q) ||
                (pm.nameBn && pm.nameBn.toLowerCase().includes(q)) ||
                (pm.accountNumber && pm.accountNumber.toLowerCase().includes(q)) ||
                (pm.bankName && pm.bankName.toLowerCase().includes(q)) ||
                (pm.provider && pm.provider.toLowerCase().includes(q)));
        });
    }, [paymentMethods, paymentFilterType, paymentSearchQuery]);

    const bankBreakdownText = useMemo(() => {
        const bankList = getBankAccountsBreakdown(chartOfAccounts, transactions, invoices);
        if (bankList.length === 0) return '';
        return bankList.map(b => `${b.name.replace(/ PLC| Bank/gi, '')}: ${profile.currencySymbol || "Tk"}${b.balance.toLocaleString()}`).join(' • ');
    }, [chartOfAccounts, transactions, invoices, profile.currencySymbol]);
    const [paymentMethodFormData, setPaymentMethodFormData] = useState<Partial<PaymentMethodConfig>>({
        name: '',
        nameBn: '',
        type: 'bank',
        bankName: '',
        accountNumber: '',
        accountTitle: '',
        branchName: '',
        routingNumber: '',
        provider: 'sslcommerz',
        gatewayMode: 'sandbox',
        storeId: '',
        secretKey: '',
        chargePercent: 0,
        notes: '',
        isEnabled: true,
        isDefault: false,
    });
    const handleOpenAddPaymentMethod = (presetType: PaymentMethodType = 'bank') => {
        setEditingPaymentMethod(null);
        setPaymentMethodFormData({
            name: presetType === 'bank'
                ? 'Corporate Bank'
                : presetType === 'mfs'
                    ? 'bKash Merchant'
                    : presetType === 'gateway'
                        ? 'SSLCommerz Gateway'
                        : presetType === 'cash'
                            ? 'Cash Counter'
                            : presetType === 'cheque'
                                ? 'Bank Cheque'
                                : 'New Payment Method',
            nameBn: presetType === 'bank'
                ? "Bank" : presetType === 'mfs'
                ? "bKash" : presetType === 'gateway'
                ? "Online Payment" : presetType === 'cash'
                ? "Cash" : presetType === 'cheque'
                ? "Bank Cheque" : "Payment",
            type: presetType,
            bankName: presetType === 'bank' ? 'City Bank PLC' : '',
            accountNumber: '',
            accountTitle: profile.name || 'Dot Color Communication',
            branchName: '',
            routingNumber: '',
            provider: presetType === 'gateway' ? 'sslcommerz' : presetType === 'mfs' ? 'bKash' : '',
            gatewayMode: 'sandbox',
            storeId: '',
            secretKey: '',
            chargePercent: 0,
            notes: '',
            isEnabled: true,
            isDefault: (paymentMethods || []).length === 0,
        });
        setShowPaymentModal(true);
    };
    const handleOpenEditPaymentMethod = (pm: PaymentMethodConfig) => {
        setEditingPaymentMethod(pm);
        setPaymentMethodFormData({
            name: pm.name,
            nameBn: pm.nameBn || '',
            type: pm.type,
            bankName: pm.bankName || '',
            accountNumber: pm.accountNumber || '',
            accountTitle: pm.accountTitle || '',
            branchName: pm.branchName || '',
            routingNumber: pm.routingNumber || '',
            provider: pm.provider || '',
            gatewayMode: pm.gatewayMode || 'sandbox',
            storeId: pm.storeId || '',
            secretKey: pm.secretKey || '',
            chargePercent: pm.chargePercent || 0,
            notes: pm.notes || '',
            isEnabled: pm.isEnabled !== false,
            isDefault: pm.isDefault || false,
        });
        setShowPaymentModal(true);
    };
    const handleSavePaymentMethod = (e: React.FormEvent) => {
        e.preventDefault();
        if (!paymentMethodFormData.name?.trim())
            return;
        if (editingPaymentMethod) {
            updatePaymentMethod(editingPaymentMethod.id, paymentMethodFormData);
        }
        else {
            addPaymentMethod({
                name: paymentMethodFormData.name.trim(),
                nameBn: paymentMethodFormData.nameBn?.trim(),
                type: paymentMethodFormData.type || 'bank',
                bankName: paymentMethodFormData.bankName?.trim(),
                accountNumber: paymentMethodFormData.accountNumber?.trim(),
                accountTitle: paymentMethodFormData.accountTitle?.trim(),
                branchName: paymentMethodFormData.branchName?.trim(),
                routingNumber: paymentMethodFormData.routingNumber?.trim(),
                provider: paymentMethodFormData.provider?.trim(),
                gatewayMode: paymentMethodFormData.gatewayMode || 'sandbox',
                storeId: paymentMethodFormData.storeId?.trim(),
                secretKey: paymentMethodFormData.secretKey?.trim(),
                chargePercent: Number(paymentMethodFormData.chargePercent) || 0,
                notes: paymentMethodFormData.notes?.trim(),
                isEnabled: paymentMethodFormData.isEnabled !== false,
                isDefault: Boolean(paymentMethodFormData.isDefault),
            });
        }
        setShowPaymentModal(false);
        setPaymentSaveSuccess(true);
        setTimeout(() => setPaymentSaveSuccess(false), 3000);
    };
    const handleDeletePaymentMethod = (id: string) => {
        const res = deletePaymentMethod(id);
        if (!res.success && res.message) {
            alert(res.message);
        }
        setDeleteConfirmPaymentId(null);
    };
    const handleSavePaymentSettings = (e: React.FormEvent) => {
        e.preventDefault();
        updateProfile(paymentFormData);
        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: 'All',
            actionType: 'PROFILE_UPDATED',
            entityType: 'Configuration',
            details: `Updated payment gateway settings and banking credentials (${paymentFormData.paymentGatewayProvider})`,
            detailsBn: `Payment gateway & banking settings updated (${paymentFormData.paymentGatewayProvider})`,
            severity: 'info',
        });
        setPaymentSaveSuccess(true);
        setTimeout(() => setPaymentSaveSuccess(false), 3000);
    };
    // Filtered staff members
    const filteredStaff = staffMembers.filter((staff) => {
        const q = searchQuery.toLowerCase().trim();
        if (!q)
            return true;
        return (staff.name.toLowerCase().includes(q) ||
            (staff.nameBn && staff.nameBn.includes(q)) ||
            staff.role.toLowerCase().includes(q) ||
            (staff.phone && staff.phone.includes(q)));
    });
    const isSuperAdminStaff = (staff?: StaffMember | null): boolean => {
        if (!staff)
            return false;
        const r = (staff.role || '').toLowerCase().trim();
        const n = (staff.name || '').toLowerCase().trim();
        const cid = (staff.customRoleId || '').toLowerCase().trim();
        return (r === 'super admin' || r === 'superadmin' ||
            n === 'super admin' ||
            staff.id === 'staff-superadmin' ||
            cid === 'role-superadmin');
    };
    // User Handlers
    const handleOpenAddUser = () => {
        const regularRoles = userRoles.filter((r) => r.name !== 'Super Admin' && r.name.toLowerCase() !== 'superadmin');
        const defaultRole = regularRoles.find((r) => r.name === 'Sales Executive') || regularRoles[0] || userRoles[0];
        setUserFormData({
            name: '',
            nameBn: '',
            role: (defaultRole?.name || 'Sales Executive') as StaffRole,
            roleBn: defaultRole?.nameBn || "",
            location: 'Both',
            phone: '',
            email: '',
            password: '1234',
            customRoleId: defaultRole?.id || '',
            isActive: true,
        });
        setShowUserPassword(false);
        setEditingStaff(null);
        setShowUserModal(true);
    };
    const handleOpenEditUser = (staff: StaffMember) => {
        const matchedRole = userRoles.find((r) => r.id === staff.customRoleId || r.name === staff.role);
        setUserFormData({
            name: staff.name,
            nameBn: staff.nameBn || '',
            role: staff.role,
            roleBn: staff.roleBn || '',
            location: staff.location || 'Both',
            phone: staff.phone || '',
            email: staff.email || '',
            password: isPinHashed(staff.password) ? '' : (staff.password || '1234'),
            customRoleId: matchedRole?.id || staff.customRoleId || userRoles[0]?.id || '',
            isActive: staff.isActive !== false,
        });
        setShowUserPassword(false);
        setEditingStaff(staff);
        setShowUserModal(true);
    };
    const handleUserFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!userFormData.name.trim())
            return;
        const colors = ['bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-purple-600', 'bg-rose-600', 'bg-indigo-600'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const selectedRole = userRoles.find((r) => r.id === userFormData.customRoleId);
        const finalRoleName = (selectedRole ? selectedRole.name : userFormData.role) as StaffRole;
        const finalRoleBn = selectedRole?.nameBn || userFormData.roleBn;
        if (editingStaff) {
            const updates: any = {
                name: userFormData.name.trim(),
                role: isSuperAdminStaff(editingStaff) ? 'Super Admin' : finalRoleName,
                roleBn: isSuperAdminStaff(editingStaff) ? "" : finalRoleBn,
                location: 'Both',
                phone: userFormData.phone.trim(),
                email: userFormData.email.trim(),
                customRoleId: userFormData.customRoleId || undefined,
                isActive: userFormData.isActive,
            };
            if (userFormData.password.trim()) {
                updates.password = userFormData.password.trim();
            }
            updateStaffMember(editingStaff.id, updates);
        }
        else {
            addStaffMember({
                name: userFormData.name.trim(),
                role: finalRoleName,
                roleBn: finalRoleBn,
                location: 'Both',
                phone: userFormData.phone.trim(),
                email: userFormData.email.trim(),
                password: userFormData.password.trim() || '1234',
                avatarColor: randomColor,
                customRoleId: userFormData.customRoleId || undefined,
                isActive: userFormData.isActive,
            });
        }
        setUserSaveSuccess(`User "${userFormData.name.trim()}" saved and synced to cloud database successfully!`);
        setTimeout(() => setUserSaveSuccess(null), 4000);
        setShowUserModal(false);
    };
    const handleDeleteUser = (id: string) => {
        const target = staffMembers.find((s) => s.id === id);
        if (!target)
            return;
        if (isSuperAdminStaff(target)) {
            alert('Super Admin is a permanent system root account and cannot be deleted.');
            return;
        }
        if (staffMembers.length <= 1) {
            alert('Cannot delete the last remaining staff member.');
            return;
        }
        if (activeStaff.id === id) {
            alert('You cannot delete the currently active logged-in staff member.');
            return;
        }
        if (confirm(`Are you sure you want to remove staff user "${target.name}"?`)) {
            deleteStaffMember(id);
        }
    };
    // Role Handlers
    const handleOpenAddRole = () => {
        setRoleFormData({
            name: '',
            nameBn: '',
            description: '',
            permissions: ['pos.view', 'pos.create_sale', 'sales.view', 'inventory.view'],
        });
        setEditingRole(null);
        setShowRoleModal(true);
    };
    const isSuperAdminRole = (role?: UserRole | null): boolean => {
        if (!role)
            return false;
        const rName = (role.name || '').toLowerCase().trim();
        return (rName === 'super admin' || rName === 'superadmin' || role.id === 'role-superadmin');
    };
    const handleOpenEditRole = (role: UserRole) => {
        if (isSuperAdminRole(role)) {
            alert('Super Admin automatically has full unrestricted access and cannot be modified.');
            return;
        }
        setRoleFormData({
            name: role.name,
            nameBn: role.nameBn || '',
            description: role.description || '',
            permissions: [...role.permissions],
        });
        setEditingRole(role);
        setShowRoleModal(true);
    };
    const handleTogglePermission = (permCode: string) => {
        setRoleFormData((prev) => {
            const exists = prev.permissions.includes(permCode);
            const newPerms = exists
                ? prev.permissions.filter((p) => p !== permCode)
                : [...prev.permissions, permCode];
            return { ...prev, permissions: newPerms };
        });
    };
    const handleSelectAllCategory = (cat: string) => {
        const categoryPerms = SYSTEM_PERMISSIONS.filter((p) => p.category === cat).map((p) => p.code);
        setRoleFormData((prev) => {
            const allSelected = categoryPerms.every((code) => prev.permissions.includes(code));
            if (allSelected) {
                return {
                    ...prev,
                    permissions: prev.permissions.filter((code) => !categoryPerms.includes(code)),
                };
            }
            else {
                const union = Array.from(new Set([...prev.permissions, ...categoryPerms]));
                return { ...prev, permissions: union };
            }
        });
    };
    const handleRoleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = roleFormData.name.trim();
        if (!trimmedName)
            return;

        if (trimmedName.toLowerCase() === 'super admin' || trimmedName.toLowerCase() === 'superadmin') {
            alert('Cannot create or rename role as "Super Admin". Super Admin is a unique permanent root role.');
            return;
        }

        if (editingRole) {
            updateUserRole(editingRole.id, {
                name: trimmedName,
                nameBn: roleFormData.nameBn.trim(),
                description: roleFormData.description.trim(),
                permissions: roleFormData.permissions,
            });
        }
        else {
            addUserRole({
                name: trimmedName,
                nameBn: roleFormData.nameBn.trim(),
                description: roleFormData.description.trim(),
                permissions: roleFormData.permissions,
            });
        }
        setShowRoleModal(false);
    };
    // Module Cleanup
    const handleExecuteClean = async (moduleKey: any) => {
        setIsPurging(true);
        let mappedKey = moduleKey;
        if (moduleKey === 'invoices' || moduleKey === 'SALES_RESET' || moduleKey === 'SALES') {
            mappedKey = 'SALES';
        }
        else if (moduleKey === 'stockMovements') {
            mappedKey = 'INVENTORY_STOCK';
        }
        else if (moduleKey === 'purchaseOrders') {
            mappedKey = 'PURCHASES';
        }
        else if (moduleKey === 'transactions') {
            mappedKey = 'TRANSACTIONS';
        }
        else if (moduleKey === 'projects') {
            mappedKey = 'PROJECTS';
        }
        else if (moduleKey === 'WIPE_ALL_EXCEPT_PRODUCTS' || moduleKey === 'RESET_ALL_TRANSACTIONS') {
            mappedKey = 'RESET_ALL_TRANSACTIONS';
        }
        try {
            await cleanModuleData(mappedKey);
            setCleanConfirmModule(null);
            if (moduleKey === 'WIPE_ALL_EXCEPT_PRODUCTS' || moduleKey === 'RESET_ALL_TRANSACTIONS') {
                setCleanFeedback('All transactional data (sales, purchases, cash txns, journals, projects, stock, dues & advances) reset successfully across all devices.');
            }
            else if (moduleKey === 'invoices' || moduleKey === 'SALES_RESET' || moduleKey === 'SALES') {
                setCleanFeedback('All sales data (invoices, POS orders, quotes, customer dues & sales revenue) reset successfully across all devices.');
            }
            else {
                setCleanFeedback(`Module '${moduleKey}' data purged successfully across all devices.`);
            }
        } catch {
            setCleanFeedback(`Failed to purge module '${moduleKey}'. Please check connection.`);
        } finally {
            setIsPurging(false);
            setTimeout(() => setCleanFeedback(null), 5000);
        }
    };
    const handleFactoryReset = () => {
        if (confirm('CRITICAL WARNING: This will reset the entire ERP database to default demo records and clear cached changes. Are you sure?')) {
            resetToDefaultData();
            setCleanFeedback('System successfully restored to default baseline.');
            setTimeout(() => setCleanFeedback(null), 4000);
        }
    };
    return (<div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
            <Shield className="w-4 h-4"/>
            <span>{'ERP System Configuration & RBAC'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black mt-1">
            {'Enterprise Control & Settings'}
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            {'Configure system users, assign role-based access control (RBAC), manage module data, and set security policies.'}
          </p>
        </div>

        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700 text-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
            {activeStaff.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <span className="text-slate-400 text-[10px] block">
              {'Current Session Account:'}
            </span>
            <span className="font-bold text-white">{activeStaff.name}</span>
            <span className="text-[11px] text-amber-400 font-semibold block">({activeStaff.role})</span>
          </div>
        </div>
      </div>

      {cleanFeedback && (<div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0"/>
          <span>{cleanFeedback}</span>
        </div>)}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button type="button" id="tab-settings-users" onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${activeTab === 'users'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'}`}>
          <Users className="w-4 h-4"/>
          <span>{'Users & Staff'}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-800 text-amber-300">
            {staffMembers.length}
          </span>
        </button>

        <button type="button" id="tab-settings-roles" onClick={() => setActiveTab('roles')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${activeTab === 'roles'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'}`}>
          <KeyRound className="w-4 h-4"/>
          <span>{'Roles & Permissions'}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
            {userRoles.length}
          </span>
        </button>

        {canManagePayments && (<button type="button" id="tab-settings-payments" onClick={() => setActiveTab('payment-gateways')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${activeTab === 'payment-gateways'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-emerald-700 border border-slate-200'}`}>
            <CreditCard className="w-4 h-4 text-emerald-500"/>
            <span>{'Payment Gateways & Methods'}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800">
              {paymentMethods.filter((p) => p.isEnabled).length} Active
            </span>
          </button>)}

        <button type="button" id="tab-settings-tools" onClick={() => setActiveTab('system-tools')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${activeTab === 'system-tools'
            ? 'bg-amber-600 text-white shadow-xs'
            : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-amber-700 border border-slate-200'}`}>
          <Database className="w-4 h-4 text-amber-500"/>
          <span>{'Backup, Hardware & Tools'}</span>
          {lowStockCount > 0 && (<span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-200">
              {lowStockCount} Low
            </span>)}
        </button>

        {canCleanData && (<button type="button" id="tab-settings-dataclean" onClick={() => setActiveTab('data-clean')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${activeTab === 'data-clean'
            ? 'bg-rose-700 text-white shadow-xs'
            : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-rose-700 border border-slate-200'}`}>
          <Trash2 className="w-4 h-4"/>
          <span>{'Module Data Clean'}</span>
        </button>)}

        <button type="button" id="tab-settings-system" onClick={() => setActiveTab('system')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${activeTab === 'system'
            ? 'bg-gradient-to-r from-blue-700 to-indigo-700 text-white shadow-xs'
            : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-blue-700 border border-slate-200'}`}>
          <Server className="w-4 h-4 text-blue-500"/>
          <span>{'System & IT Partner'}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
            BD HOSTT
          </span>
        </button>
      </div>

      {/* TAB 1: USERS & STAFF */}
      {activeTab === 'users' && (<div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"/>
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={'Search staff by name or role...'} className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"/>
            </div>

            {canManageUsers && (<button type="button" id="btn-add-staff-member" onClick={handleOpenAddUser} className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-all w-full sm:w-auto justify-center">
                <Plus className="w-4 h-4"/>
                <span>{'Add New User / Staff'}</span>
              </button>)}
          </div>

          {userSaveSuccess && (<div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0"/>
              <span>{userSaveSuccess}</span>
            </div>)}

          {/* Users & Staff Table List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                    <th className="py-3 px-4">
                      {'Staff / User'}
                    </th>
                    <th className="py-3 px-4">
                      {'Designation & Role'}
                    </th>
                    <th className="py-3 px-4">
                      {'Work Location'}
                    </th>
                    <th className="py-3 px-4">
                      {'Contact'}
                    </th>
                    <th className="py-3 px-4">
                      {'RBAC Access Role'}
                    </th>
                    <th className="py-3 px-4 text-center">
                      {'Current Session'}
                    </th>
                    <th className="py-3 px-4 text-right">
                      {'Action'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStaff.length === 0 ? (<tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <div className="max-w-md mx-auto space-y-2">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                            <Users className="w-5 h-5"/>
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm">
                            {'No staff members found'}
                          </h4>
                          <p className="text-xs text-slate-400">
                            {'Try searching with another name/role or add a new user.'}
                          </p>
                        </div>
                      </td>
                    </tr>) : (filteredStaff.map((staff) => {
                const assignedRole = (userRoles || []).find((r) => r.id === staff.customRoleId);
                const isCurrent = activeStaff.id === staff.id;
                return (<tr key={staff.id} className={`transition-colors ${isCurrent
                        ? 'bg-amber-50/50 hover:bg-amber-50/80'
                        : 'hover:bg-slate-50/80'}`}>
                          <td className="py-3.5 px-4 align-middle">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl ${staff.avatarColor || 'bg-slate-700'} text-white flex items-center justify-center font-black text-xs shadow-2xs shrink-0`}>
                                {staff.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                  <span>{staff.name}</span>
                                  {isCurrent && (<span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.2 rounded border border-amber-300">
                                      You
                                    </span>)}
                                </div>
                                {staff.nameBn && (<div className="text-xs text-slate-500 font-medium">{staff.nameBn}</div>)}
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-middle">
                            <span className="font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md text-xs inline-block">
                              {staff.role}
                            </span>
                            {staff.roleBn && (<div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                {staff.roleBn}
                              </div>)}
                          </td>

                          <td className="py-3.5 px-4 align-middle">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                              {staff.location === 'Factory' ? (<Factory className="w-3.5 h-3.5 text-slate-500"/>) : (<Building2 className="w-3.5 h-3.5 text-slate-500"/>)}
                              <span>{staff.location}</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4 align-middle">
                            <div className="space-y-0.5 text-xs text-slate-600">
                              {staff.phone ? (<div className="flex items-center gap-1 font-mono text-[11px] text-slate-700">
                                  <Phone className="w-3 h-3 text-slate-400"/>
                                  <span>{staff.phone}</span>
                                </div>) : (<span className="text-[11px] text-slate-400">—</span>)}
                              {staff.email && (<div className="flex items-center gap-1 text-[11px] text-slate-500">
                                  <Mail className="w-3 h-3 text-slate-400"/>
                                  <span className="truncate max-w-[150px]">{staff.email}</span>
                                </div>)}
                              <div className="flex items-center gap-1 font-mono text-[10px] text-amber-800">
                                <Lock className="w-3 h-3 text-amber-500"/>
                                <span>PIN: {isPinHashed(staff.password) ? '•••••• (Protected)' : (staff.password || '1234')}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-middle">
                            {assignedRole ? (<span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                {assignedRole.name}
                              </span>) : (<span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                                {'Default Access'}
                              </span>)}
                          </td>

                          <td className="py-3.5 px-4 text-center align-middle">
                            {isCurrent ? (<span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600"/>
                                <span>Active Now</span>
                              </span>) : (<button type="button" onClick={() => setActiveStaff(staff)} className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition-colors cursor-pointer">
                                {'Switch To'}
                              </button>)}
                          </td>

                          <td className="py-3.5 px-4 text-right align-middle">
                            <div className="flex items-center justify-end gap-1.5">
                              <button type="button" onClick={() => handleOpenEditUser(staff)} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors" title={'Edit'}>
                                <Edit2 className="w-3.5 h-3.5"/>
                              </button>
                              {!isCurrent && !isSuperAdminStaff(staff) && (<button type="button" onClick={() => handleDeleteUser(staff.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors cursor-pointer" title={'Delete'}>
                                  <Trash2 className="w-3.5 h-3.5"/>
                                </button>)}
                              {isSuperAdminStaff(staff) && (<span className="text-[9.5px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200 select-none" title={'Permanent System Root Account (Cannot be deleted)'}>
                                  Fixed
                                </span>)}
                            </div>
                          </td>
                        </tr>);
            }))}
                </tbody>
              </table>
            </div>
          </div>
        </div>)}

      {/* TAB 2: ROLES & RBAC PERMISSIONS */}
      {activeTab === 'roles' && (<div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                {'Role-Based Access Control (RBAC)'}
              </h3>
              <p className="text-xs text-slate-500">
                {'Define custom access roles and toggle granular module permissions.'}
              </p>
            </div>

            {canManageRoles && (<button type="button" id="btn-add-custom-role" onClick={handleOpenAddRole} className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-all">
                <Plus className="w-4 h-4"/>
                <span>{'Create Custom Role'}</span>
              </button>)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userRoles.map((role) => {
                const isSuper = isSuperAdminRole(role);
                return (<div key={role.id} className={`bg-white rounded-2xl border p-5 shadow-2xs flex flex-col justify-between ${isSuper
                        ? 'border-indigo-200 bg-gradient-to-b from-indigo-50/20 to-white'
                        : 'border-slate-200'}`}>
                  <div>
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-base">{role.name}</h4>
                          {isSuper ? (<span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              {'Permanent Root Role'}
                            </span>) : role.isSystem ? (<span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              System Role
                            </span>) : null}
                        </div>
                        {role.nameBn && <p className="text-xs text-slate-500">{role.nameBn}</p>}
                        <p className="text-xs text-slate-600 mt-1">{role.description}</p>
                      </div>

                      <div className="flex items-center gap-1">
                        {isSuper ? (<span className="text-[9.5px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200 select-none" title={'Super Admin permissions are permanent and cannot be modified'}>
                            Fixed / Locked
                          </span>) : (<>
                            <button type="button" onClick={() => handleOpenEditRole(role)} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer" title={'Edit Permissions'}>
                              <Edit2 className="w-4 h-4"/>
                            </button>
                            <button type="button" onClick={() => {
                                const assignedCount = staffMembers.filter((s) => s.customRoleId === role.id || s.role === role.name).length;
                                const promptMsg = assignedCount > 0
                                  ? `Delete role '${role.name}'? ${assignedCount} assigned user(s) will be automatically reassigned to default role.`
                                  : `Delete role '${role.name}'?`;
                                if (confirm(promptMsg)) {
                                    const res = deleteUserRole(role.id);
                                    if (res && !res.success && res.message) {
                                        alert(res.message);
                                    }
                                }
                            }} className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer" title={'Delete Role'}>
                                <Trash2 className="w-4 h-4"/>
                              </button>
                          </>)}
                      </div>
                    </div>

                    <div className="mt-3">
                      <span className="text-xs font-bold text-slate-700 block mb-2">
                        {isSuper
                        ? ('Authorized Permissions: Full System Access (100% Active):')
                        : (`Authorized Permissions (${role.permissions.length} Active):`)}
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {(isSuper ? ALL_SYSTEM_PERMISSIONS.map((p) => p.code) : role.permissions).map((permCode) => {
                        const permObj = SYSTEM_PERMISSIONS.find((p) => p.code === permCode);
                        return (<span key={permCode} className={`inline-block text-[10px] font-bold px-2 py-1 rounded-md border ${isSuper
                                ? 'bg-indigo-50/70 text-indigo-800 border-indigo-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                              {permObj ? (permObj.name) : permCode}
                            </span>);
                    })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {'Assigned Users: '}
                      <strong className="text-slate-900">
                        {staffMembers.filter((s) => s.customRoleId === role.id || s.role === role.name).length}
                      </strong>{' '}
                      {'users'}
                    </span>
                    {isSuper ? (<span className="text-indigo-600 font-bold text-[11px] flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600"/>
                        <span>{'All Privileges Permanently Active'}</span>
                      </span>) : (<button type="button" onClick={() => handleOpenEditRole(role)} className="text-blue-600 font-bold hover:underline cursor-pointer">
                        {'Modify Permissions ➔'}
                      </button>)}
                  </div>
                </div>);
            })}
          </div>
        </div>)}

      {/* TAB: PAYMENT GATEWAYS & METHODS */}
      {activeTab === 'payment-gateways' && canManagePayments && (<div className="space-y-6">
          {/* Header Banner - Exactly matching Image 1 */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/70 flex items-center justify-center shrink-0 shadow-2xs">
                <CreditCard className="w-5 h-5 text-amber-600"/>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                    Payment Methods & Digital Channels
                  </h3>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                    {paymentMethods.filter((p) => p.isEnabled).length} {'Active'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure Cash drawer, Mobile Financial Services (MFS), Bank POS swipe terminals, and ledger mapping
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={() => handleOpenAddPaymentMethod('bank')} className="flex items-center gap-2 px-5 py-2.5 bg-[#0b1e36] hover:bg-[#133054] text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs transition-all cursor-pointer whitespace-nowrap">
                <Plus className="w-4 h-4 text-emerald-400"/>
                <span>+ Add Payment Method</span>
              </button>
            </div>
          </div>

          {paymentSaveSuccess && (<div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2 shadow-2xs animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0"/>
              <span>
                {'Payment methods & gateway configuration successfully saved! Updated across the entire system.'}
              </span>
            </div>)}

          {/* Quick Stats Overview - Exactly matching Image 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* TOTAL METHODS */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                TOTAL METHODS
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {paymentMethods.length}
              </div>
              <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
                {paymentMethods.filter((p) => p.isEnabled).length} Active in POS Checkout
              </span>
            </div>

            {/* CASH DRAWER (LIVE) */}
            <div className="bg-emerald-50/20 p-4 rounded-2xl border border-emerald-200/80 shadow-2xs">
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block">
                CASH DRAWER (LIVE)
              </span>
              <div className="text-2xl font-black text-emerald-800 mt-1">
                {profile.currencySymbol || "Tk"}{((accountBalances?.cash || 0) + (accountBalances?.factoryCash || 0)).toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">
                Available in register cash drawer
              </span>
            </div>

            {/* MFS INFLOW (BKASH/NAGAD) */}
            <div className="bg-pink-50/20 p-4 rounded-2xl border border-pink-200/80 shadow-2xs">
              <span className="text-[10px] font-black text-pink-700 uppercase tracking-wider block">
                MFS INFLOW (BKASH/NAGAD)
              </span>
              <div className="text-2xl font-black text-pink-800 mt-1">
                {profile.currencySymbol || "Tk"}{(accountBalances?.mobile || 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-pink-600 font-medium mt-0.5 block">
                bKash: {profile.currencySymbol || "Tk"}{(accountBalances?.bkash ?? accountBalances?.mobile ?? 0).toLocaleString()} | Nagad: {profile.currencySymbol || "Tk"}{(accountBalances?.nagad ?? 0).toLocaleString()}
              </span>
            </div>

            {/* BANK & POS CARD SALES */}
            <div className="bg-blue-50/20 p-4 rounded-2xl border border-blue-200/80 shadow-2xs">
              <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block">
                BANK & POS CARD SALES
              </span>
              <div className="text-2xl font-black text-blue-800 mt-1">
                {profile.currencySymbol || "Tk"}{(accountBalances?.bank || 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-blue-600 font-medium mt-0.5 block truncate" title={bankBreakdownText}>
                {bankBreakdownText || 'Corporate Banks & Card Swipe'}
              </span>
            </div>
          </div>

          {/* Filter Bar & Search - Exactly matching Image 1 */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {[
                { id: 'ALL', label: 'All Methods', count: paymentMethods.length },
                { id: 'cash', label: 'Cash in Hand', count: paymentMethods.filter((p) => p.type === 'cash').length },
                { id: 'mfs', label: 'Mobile Banking (MFS)', count: paymentMethods.filter((p) => p.type === 'mfs').length },
                { id: 'bank', label: 'Bank Wire Transfer', count: paymentMethods.filter((p) => p.type === 'bank').length },
                { id: 'credit', label: 'Customer Due / Credit', count: paymentMethods.filter((p) => p.name.toLowerCase().includes('due') || p.name.toLowerCase().includes('credit') || p.type === 'cheque').length },
                { id: 'gateway', label: 'Bangla QR (Universal QR)', count: paymentMethods.filter((p) => p.type === 'gateway' || p.name.toLowerCase().includes('qr') || p.name.toLowerCase().includes('ssl')).length },
            ].map((tab) => {
                const isActive = paymentFilterType === tab.id;
                return (<button key={tab.id} type="button" onClick={() => setPaymentFilterType(tab.id)} className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${isActive
                        ? 'bg-[#0b1e36] text-white shadow-xs'
                        : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200 hover:text-slate-900'}`}>
                    <span>{tab.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${isActive ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      {tab.count}
                    </span>
                  </button>);
            })}
            </div>

            {/* Search and View Mode Switcher */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"/>
                <input type="text" value={paymentSearchQuery} onChange={(e) => setPaymentSearchQuery(e.target.value)} placeholder="Search method or account..." className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"/>
              </div>

              {/* View Switcher: Table vs Cards */}
              <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
                <button type="button" onClick={() => setPaymentViewMode('table')} className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${paymentViewMode === 'table'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'}`} title="Table View">
                  📋 Table
                </button>
                <button type="button" onClick={() => setPaymentViewMode('cards')} className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${paymentViewMode === 'cards'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'}`} title="Cards View">
                  🎴 Cards
                </button>
              </div>
            </div>
          </div>

          {/* TABLE VIEW (Default matching Picture 1) */}
          {paymentViewMode === 'table' && (<div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0b1e36] text-white text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Payment Method</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Provider / Terminal</th>
                      <th className="py-3 px-3">Account / Mobile No.</th>
                      <th className="py-3 px-3">Ledger Link</th>
                      <th className="py-3 px-3 text-right">Live BalanceCollectedTk</th>
                      <th className="py-3 px-3 text-center">Service Fee</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-center">Default</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredPaymentMethods.length === 0 ? (<tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                          {'No payment methods found'}
                        </td>
                      </tr>) : (filteredPaymentMethods.map((pm) => {
                    const isBank = pm.type === 'bank';
                    const isMfs = pm.type === 'mfs';
                    const isGateway = pm.type === 'gateway';
                    const isCash = pm.type === 'cash';
                    const isCheque = pm.type === 'cheque';
                    const isDue = pm.name.toLowerCase().includes('due') || pm.name.toLowerCase().includes('credit');
                    const isQr = pm.name.toLowerCase().includes('qr');
                    const methodIcon = isCash ? '💵' : isBank ? '🏦' : isMfs ? '📱' : isGateway ? '🌐' : isCheque ? '📜' : isQr ? '📲' : isDue ? '👤' : '💳';
                    const typeBadgeClass = isQr
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : isDue
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : isCash
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isBank
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : isMfs
                                        ? 'bg-pink-50 text-pink-700 border-pink-200'
                                        : isGateway
                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                            : 'bg-slate-50 text-slate-700 border-slate-200';
                    const typeDisplayName = isQr
                        ? 'Bangla QR'
                        : isDue
                            ? 'Credit / Due'
                            : isCash
                                ? 'Cash'
                                : isBank
                                    ? 'Bank Transfer'
                                    : isMfs
                                        ? 'MFS / Mobile'
                                        : isGateway
                                            ? 'Online Gateway'
                                            : isCheque
                                                ? 'Bank Cheque'
                                                : 'Custom';
                    const cashCoa = (chartOfAccounts || []).find(a => a.classification === 'Asset' && (a.code === '1001' || a.code === '1010' || a.name.toLowerCase().includes('cash')) && !a.name.toLowerCase().includes('bkash') && !a.name.toLowerCase().includes('nagad'));
                    const resolvedCashCode = cashCoa?.code || '1001';
                    const resolvedCashName = cashCoa?.name || 'Cash In Hand';
                    const providerName = pm.provider || pm.bankName || (isCash ? 'Cash' : isCheque ? 'Cheque' : isDue ? 'Credit' : 'Direct');
                    const accountNo = isCash ? (cashCoa?.code || pm.accountNumber || '1001') : (pm.accountNumber || (isDue ? '1030' : '—'));
                    const ledgerLink = isCash 
                        ? `${resolvedCashCode} - ${resolvedCashName}` 
                        : (pm.linkedAccountId ? `${pm.linkedAccountId}` : (isBank ? '1030 - Bank' : isMfs ? '1040 - Mobile MFS' : isDue ? '1050 - Accounts' : '1030 - Bank'));
                    const liveBal = getPaymentMethodLiveBalance(pm, chartOfAccounts, transactions, invoices, accountBalances, projects, journalEntries);
                    return (<tr key={pm.id} className="hover:bg-slate-50/80 transition-colors">
                            {/* Payment Method */}
                            <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{methodIcon}</span>
                                <span>{pm.name}</span>
                                {pm.isDefault && (<span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 font-extrabold text-[9px] border border-amber-300">
                                    Primary
                                  </span>)}
                              </div>
                            </td>

                            {/* Type */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${typeBadgeClass}`}>
                                {typeDisplayName}
                              </span>
                            </td>

                            {/* Provider / Terminal */}
                            <td className="py-3 px-3 text-slate-600 font-medium whitespace-nowrap">
                              {providerName}
                            </td>

                            {/* Account / Mobile No. */}
                            <td className="py-3 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                              {accountNo}
                            </td>

                            {/* Ledger Link */}
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {ledgerLink}
                            </td>

                            {/* Live Balance / Collected */}
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                              {profile.currencySymbol || "Tk"} {liveBal.toLocaleString()}
                            </td>

                            {/* Service Fee */}
                            <td className="py-3 px-3 text-center font-semibold text-slate-500 whitespace-nowrap">
                              {pm.chargePercent ? `${pm.chargePercent}%` : '0%'}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {pm.isEnabled ? (<button type="button" onClick={() => togglePaymentMethod(pm.id)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all cursor-pointer" title="Click to Disable">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  <span>Active</span>
                                </button>) : (<button type="button" onClick={() => togglePaymentMethod(pm.id)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200 transition-all cursor-pointer" title="Click to Activate">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  <span>Inactive</span>
                                </button>)}
                            </td>

                            {/* Default */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {pm.isDefault ? (<span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                                  <Star className="w-3 h-3 fill-amber-500 text-amber-500"/>
                                  <span>Default</span>
                                </span>) : (<button type="button" onClick={() => setDefaultPaymentMethod(pm.id)} className="text-[11px] text-slate-400 hover:text-amber-700 font-semibold cursor-pointer hover:underline transition-colors">
                                  Set Default
                                </button>)}
                            </td>

                            {/* Action */}
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button type="button" onClick={() => handleOpenEditPaymentMethod(pm)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer" title="Edit Payment Method">
                                  <Edit2 className="w-3.5 h-3.5"/>
                                </button>
                                <button type="button" onClick={() => setDeleteConfirmPaymentId(pm.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer" title="Delete Payment Method">
                                  <Trash2 className="w-3.5 h-3.5"/>
                                </button>
                              </div>
                            </td>
                          </tr>);
                }))}
                  </tbody>
                </table>
              </div>
            </div>)}

          {/* Cards Grid: Dynamic Payment Methods */}
          {paymentViewMode === 'cards' && (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paymentMethods
                    .filter((pm) => {
                    if (paymentFilterType === 'ALL')
                        return true;
                    if (paymentFilterType === 'cash')
                        return pm.type === 'cash' || pm.type === 'cheque';
                    return pm.type === paymentFilterType;
                })
                    .filter((pm) => {
                    if (!paymentSearchQuery.trim())
                        return true;
                    const q = paymentSearchQuery.toLowerCase().trim();
                    return (pm.name.toLowerCase().includes(q) ||
                        (pm.nameBn && pm.nameBn.toLowerCase().includes(q)) ||
                        (pm.accountNumber && pm.accountNumber.toLowerCase().includes(q)) ||
                        (pm.bankName && pm.bankName.toLowerCase().includes(q)) ||
                        (pm.provider && pm.provider.toLowerCase().includes(q)));
                })
                    .map((pm) => {
                    const isBank = pm.type === 'bank';
                    const isMfs = pm.type === 'mfs';
                    const isGateway = pm.type === 'gateway';
                    const isCash = pm.type === 'cash';
                    const isCheque = pm.type === 'cheque';
                    const badgeBg = isBank
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : isMfs
                            ? 'bg-pink-50 text-pink-700 border-pink-200'
                            : isGateway
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isCash
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : 'bg-amber-50 text-amber-700 border-amber-200';
                    const icon = isBank ? (<Landmark className="w-5 h-5 text-blue-600"/>) : isMfs ? (<Smartphone className="w-5 h-5 text-pink-600"/>) : isGateway ? (<Zap className="w-5 h-5 text-emerald-600"/>) : isCash ? (<Banknote className="w-5 h-5 text-emerald-600"/>) : isCheque ? (<FileSpreadsheet className="w-5 h-5 text-amber-600"/>) : (<CreditCard className="w-5 h-5 text-indigo-600"/>);
                    return (<div key={pm.id} className={`bg-white rounded-2xl border transition-all shadow-2xs hover:shadow-md flex flex-col justify-between p-5 relative ${pm.isEnabled ? 'border-slate-200' : 'border-slate-200 bg-slate-50/60 opacity-75'}`}>
                    <div>
                      {/* Top Bar inside card */}
                      <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                            {icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-extrabold text-slate-900 text-sm leading-tight">{pm.name}</h4>
                              {pm.isDefault && (<span className="flex items-center gap-0.5 text-[9px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-md">
                                  <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500"/>
                                  Default
                                </span>)}
                            </div>
                            {pm.nameBn && <p className="text-[11px] text-slate-500">{pm.nameBn}</p>}
                          </div>
                        </div>

                        {/* Enable/Disable Toggle */}
                        <div className="flex items-center gap-1.5">
                          <label className="relative inline-flex items-center cursor-pointer select-none" title={pm.isEnabled ? 'Method is Active' : 'Method is Disabled'}>
                            <input type="checkbox" checked={pm.isEnabled} onChange={() => togglePaymentMethod(pm.id)} className="sr-only peer"/>
                            <div className="w-8 h-4 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                          </label>
                        </div>
                      </div>

                      {/* Card Details Body */}
                      <div className="py-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-medium">{'Method Type'}:</span>
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${badgeBg}`}>
                            {isBank
                            ? 'Corporate Bank'
                            : isMfs
                                ? 'Mobile Wallet (MFS)'
                                : isGateway
                                    ? 'Online API Gateway'
                                    : isCash
                                        ? 'Cash Counter'
                                        : isCheque
                                            ? 'Bank Cheque'
                                            : 'Custom'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-medium">{'Live Balance'}:</span>
                          <span className="font-bold text-slate-900 font-mono">
                            {profile.currencySymbol || "Tk"}{getPaymentMethodLiveBalance(pm, chartOfAccounts, transactions, invoices, accountBalances, projects, journalEntries).toLocaleString()}
                          </span>
                        </div>

                        {/* Bank specific info */}
                        {isBank && (<>
                            {pm.bankName && (<div className="flex justify-between items-baseline text-slate-700">
                                <span className="text-slate-400 font-medium text-[11px]">Bank:</span>
                                <span className="font-bold text-right">{pm.bankName}</span>
                              </div>)}
                            {pm.accountNumber && (<div className="flex justify-between items-baseline text-slate-700">
                                <span className="text-slate-400 font-medium text-[11px]">A/C No:</span>
                                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                                  {pm.accountNumber}
                                </span>
                              </div>)}
                            {pm.accountTitle && (<div className="flex justify-between items-baseline text-slate-700">
                                <span className="text-slate-400 font-medium text-[11px]">Title:</span>
                                <span className="text-[11px] font-semibold text-slate-600 text-right truncate max-w-[160px]">{pm.accountTitle}</span>
                              </div>)}
                            {pm.branchName && (<div className="flex justify-between items-baseline text-slate-700 text-[11px]">
                                <span className="text-slate-400 font-medium">Branch:</span>
                                <span className="text-slate-600">{pm.branchName}</span>
                              </div>)}
                            {pm.routingNumber && (<div className="flex justify-between items-baseline text-slate-700 text-[11px]">
                                <span className="text-slate-400 font-medium">Routing:</span>
                                <span className="font-mono text-slate-600">{pm.routingNumber}</span>
                              </div>)}
                          </>)}

                        {/* MFS specific info */}
                        {isMfs && (<>
                            {pm.provider && (<div className="flex justify-between items-baseline text-slate-700">
                                <span className="text-slate-400 font-medium text-[11px]">Wallet:</span>
                                <span className="font-bold text-pink-700">{pm.provider}</span>
                              </div>)}
                            {pm.accountNumber && (<div className="flex justify-between items-baseline text-slate-700">
                                <span className="text-slate-400 font-medium text-[11px]">Number:</span>
                                <span className="font-mono font-black text-pink-800 bg-pink-50 border border-pink-200 px-2 py-0.5 rounded text-xs">
                                  {pm.accountNumber}
                                </span>
                              </div>)}
                            {pm.accountTitle && (<div className="flex justify-between items-baseline text-slate-700 text-[11px]">
                                <span className="text-slate-400 font-medium">Title:</span>
                                <span className="text-slate-600 truncate max-w-[160px]">{pm.accountTitle}</span>
                              </div>)}
                            {Boolean(pm.chargePercent) && (<div className="flex justify-between items-baseline text-slate-700 text-[11px]">
                                <span className="text-slate-400 font-medium">Surcharge:</span>
                                <span className="font-bold text-amber-700">{pm.chargePercent}%</span>
                              </div>)}
                          </>)}

                        {/* Gateway API specific info */}
                        {isGateway && (<>
                            <div className="flex justify-between items-baseline text-slate-700">
                              <span className="text-slate-400 font-medium text-[11px]">Provider:</span>
                              <span className="font-bold text-emerald-800 uppercase">{pm.provider || 'SSLCommerz'}</span>
                            </div>
                            <div className="flex justify-between items-baseline text-slate-700 text-[11px]">
                              <span className="text-slate-400 font-medium">Mode:</span>
                              <span className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${pm.gatewayMode === 'live' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                {pm.gatewayMode === 'live' ? 'Live / Production' : 'Sandbox / Test'}
                              </span>
                            </div>
                            {pm.storeId && (<div className="flex justify-between items-baseline text-slate-700 text-[11px]">
                                <span className="text-slate-400 font-medium">Store ID:</span>
                                <span className="font-mono font-bold text-slate-700">{pm.storeId}</span>
                              </div>)}
                          </>)}

                        {/* Cash & Cheque info */}
                        {(isCash || isCheque) && (<div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            {pm.notes || (isCash ? 'Physical cash drawer at counter' : 'Customer bank cheque clearing')}
                          </div>)}

                        {pm.notes && !isCash && !isCheque && (<p className="text-[10.5px] text-slate-500 italic truncate pt-1 border-t border-slate-100">
                            {pm.notes}
                          </p>)}
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                      <div>
                        {!pm.isDefault ? (<button type="button" onClick={() => setDefaultPaymentMethod(pm.id)} className="text-[10px] font-bold text-slate-500 hover:text-amber-700 flex items-center gap-1 cursor-pointer transition-colors" title="Set as Default Payment Method">
                            <Star className="w-3 h-3 text-slate-400"/>
                            <span>{'Make Default'}</span>
                          </button>) : (<span className="text-[10px] font-extrabold text-amber-700 flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500"/>
                            <span>{'Primary Default'}</span>
                          </span>)}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => handleOpenEditPaymentMethod(pm)} className="p-1.5 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer" title="Edit Payment Method">
                          <Edit2 className="w-3.5 h-3.5"/>
                        </button>

                        <button type="button" onClick={() => setDeleteConfirmPaymentId(pm.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer" title="Delete Payment Method">
                          <Trash2 className="w-3.5 h-3.5"/>
                        </button>
                      </div>
                    </div>
                  </div>);
                })}
          </div>)}

          {/* Delete Confirmation Popup */}
          {deleteConfirmPaymentId && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold shrink-0">
                    <AlertTriangle className="w-5 h-5"/>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      {'Delete Payment Method?'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {'This will remove the method from POS checkout and sales forms.'}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button type="button" onClick={() => setDeleteConfirmPaymentId(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
                    {'Cancel'}
                  </button>
                  <button type="button" onClick={() => handleDeletePaymentMethod(deleteConfirmPaymentId)} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer">
                    {'Delete'}
                  </button>
                </div>
              </div>
            </div>)}

          {/* Section: Client Invoicing Instructions & Banking Notes */}
          <form onSubmit={handleSavePaymentSettings} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <SlidersHorizontal className="w-5 h-5"/>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {'Client Invoicing & Payment Instructions'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {'Global banking notice printed on customer invoices and slips'}
                  </p>
                </div>
              </div>

              <button type="submit" className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer">
                <Save className="w-3.5 h-3.5"/>
                <span>{'Save Notice'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Payment Notes & Notice on Invoices'}
                </label>
                <textarea rows={4} value={paymentFormData.bankingNotes} onChange={(e) => setPaymentFormData({ ...paymentFormData, bankingNotes: e.target.value })} placeholder="Clients can transfer invoices via Bank Transfer, bKash Merchant (01841581887), or Cash counters." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none leading-relaxed"/>
                <p className="text-[11px] text-slate-500 mt-1">
                  {'This note is automatically printed at the bottom of customer invoices, challans, and payment receipts.'}
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-700 text-xs block">
                  {'Live Preview (As printed on invoices):'}
                </span>
                <div className="bg-white p-3 rounded-lg border border-slate-200 text-slate-700 text-xs font-mono leading-relaxed space-y-1">
                  {paymentMethods.filter((p) => p.isEnabled).map((pm) => (<div key={pm.id} className="text-[11px]">
                      • <strong>{pm.name}:</strong> {pm.accountNumber ? `${pm.accountNumber}` : ''} {pm.bankName ? `(${pm.bankName})` : ''} {pm.accountTitle ? `- ${pm.accountTitle}` : ''}
                    </div>))}
                  {paymentFormData.bankingNotes && (<div className="text-[11px] text-slate-500 mt-2 pt-1 border-t border-slate-100">
                      💬 {paymentFormData.bankingNotes}
                    </div>)}
                </div>
              </div>
            </div>
          </form>

          {/* MODAL: CREATE / EDIT PAYMENT METHOD */}
          {showPaymentModal && (<div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8">
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                      <CreditCard className="w-5 h-5"/>
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-base sm:text-lg">
                        {editingPaymentMethod
                    ? 'Edit Payment Method'
                    : 'Create New Payment Method / Gateway'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {'Configure dynamic payment channels for the entire system'}
                      </p>
                    </div>
                  </div>

                  <button type="button" onClick={() => setShowPaymentModal(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer">
                    <X className="w-4 h-4"/>
                  </button>
                </div>

                <form onSubmit={handleSavePaymentMethod} className="space-y-4">
                  {/* Step 1: Select Type */}
                  <div>
                    <label className="font-bold text-slate-700 text-xs block mb-1.5">
                      {'1. Select Payment Method Type *'}
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {[
                    { type: 'bank' as PaymentMethodType, label: 'Bank', icon: Landmark, color: 'text-blue-600' },
                    { type: 'mfs' as PaymentMethodType, label: 'MFS / Wallet', icon: Smartphone, color: 'text-pink-600' },
                    { type: 'gateway' as PaymentMethodType, label: 'Online API', icon: Zap, color: 'text-emerald-600' },
                    { type: 'cash' as PaymentMethodType, label: 'Cash', icon: Banknote, color: 'text-emerald-700' },
                    { type: 'cheque' as PaymentMethodType, label: 'Cheque', icon: FileSpreadsheet, color: 'text-amber-600' },
                ].map((item) => {
                    const IconComponent = item.icon;
                    const isSelected = paymentMethodFormData.type === item.type;
                    return (<button key={item.type} type="button" onClick={() => {
                            setPaymentMethodFormData({
                                ...paymentMethodFormData,
                                type: item.type,
                                name: paymentMethodFormData.name && paymentMethodFormData.name !== 'Corporate Bank' && paymentMethodFormData.name !== 'bKash Merchant' && paymentMethodFormData.name !== 'SSLCommerz Gateway' && paymentMethodFormData.name !== 'Cash Counter' && paymentMethodFormData.name !== 'Bank Cheque'
                                    ? paymentMethodFormData.name
                                    : item.type === 'bank'
                                        ? 'Corporate Bank'
                                        : item.type === 'mfs'
                                            ? 'bKash Merchant'
                                            : item.type === 'gateway'
                                                ? 'SSLCommerz Gateway'
                                                : item.type === 'cash'
                                                    ? 'Cash Counter'
                                                    : 'Bank Cheque',
                            });
                        }} className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer text-center ${isSelected
                            ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}>
                            <IconComponent className={`w-4 h-4 ${isSelected ? 'text-amber-400' : item.color}`}/>
                            <span className="text-[10px] font-bold leading-tight">{item.label}</span>
                          </button>);
                })}
                    </div>
                  </div>

                  {/* Method Names */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        {'Display Name (English) *'}
                      </label>
                      <input type="text" required value={paymentMethodFormData.name || ''} onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, name: e.target.value })} placeholder="e.g. City Bank PLC / bKash Merchant" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"/>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        {'Display Name (Bangla)'}
                      </label>
                      <input type="text" value={paymentMethodFormData.nameBn || ''} onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, nameBn: e.target.value })} placeholder="e.g.  Bank" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"/>
                    </div>
                  </div>

                  {/* Contextual Fields by Type */}
                  {paymentMethodFormData.type === 'bank' && (<div className="p-3.5 bg-blue-50/40 border border-blue-200 rounded-2xl space-y-3 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-blue-900 text-xs">
                        <Landmark className="w-4 h-4 text-blue-600"/>
                        <span>{'Bank Account Credentials'}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">{'Bank Name'}</label>
                          <input type="text" value={paymentMethodFormData.bankName || ''} onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, bankName: e.target.value })} placeholder="e.g. BRAC Bank PLC / City Bank" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">{'Account Number'}</label>
                          <input type="text" value={paymentMethodFormData.accountNumber || ''} onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, accountNumber: e.target.value })} placeholder="e.g. 1504058517001" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">{'Account Title'}</label>
                          <input type="text" value={paymentMethodFormData.accountTitle || ''} onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, accountTitle: e.target.value })} placeholder="e.g. Dot Color Communication" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">{'Branch'}</label>
                          <input type="text" value={paymentMethodFormData.branchName || ''} onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, branchName: e.target.value })} placeholder="e.g. Agrabad / Pabartek" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">{'Routing Code'}</label>
                          <input type="text" value={paymentMethodFormData.routingNumber || ''} onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, routingNumber: e.target.value })} placeholder="e.g. 060150341" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                        </div>
                      </div>
                    </div>)}

                  {paymentMethodFormData.type === 'mfs' && (<div className="p-3.5 bg-pink-50/40 border border-pink-200 rounded-2xl space-y-3 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-pink-900 text-xs">
                        <Smartphone className="w-4 h-4 text-pink-600"/>
                        <span>{'Mobile Financial Wallet Details'}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">{'Wallet Provider'}</label>
                          <select value={paymentMethodFormData.provider || 'bKash'} onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, provider: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-pink-700 focus:ring-2 focus:ring-pink-500 focus:outline-none">
                            <option value="bKash">bKashbKash</option>
                            <option value="Nagad">NagadNagad</option>
                            <option value="Rocket">Rocket</option>
                            <option value="Upay">Upay</option>
                            <option value="Cellfin">Cellfin</option>
                            <option value="Other">Other Wallet</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">{'Account / Mobile No *'}</label>
                          <input type="text" required value={paymentMethodFormData.accountNumber || ''} onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, accountNumber: e.target.value })} placeholder="e.g. 01841581887" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-black text-pink-700 focus:ring-2 focus:ring-pink-500 focus:outline-none"/>
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">{'Surcharge / Fee (%)'}</label>
                          <input type="number" step="any" min="0" value={paymentMethodFormData.chargePercent || ''} onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, chargePercent: Number(e.target.value) || 0 })} placeholder="0 (Free)" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-pink-500 focus:outline-none"/>
                        </div>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">{'Merchant / Beneficiary Title'}</label>
                        <input type="text" value={paymentMethodFormData.accountTitle || ''} onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, accountTitle: e.target.value })} placeholder="e.g. Dot Color Communication (Merchant)" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:outline-none"/>
                      </div>
                    </div>)}

                  {paymentMethodFormData.type === 'gateway' && (<div className="p-3.5 bg-emerald-50/40 border border-emerald-200 rounded-2xl space-y-3 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-xs">
                        <Zap className="w-4 h-4 text-emerald-600"/>
                        <span>{'Online Payment Gateway API Integration'}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">{'Gateway Engine'}</label>
                          <select value={paymentMethodFormData.provider || 'sslcommerz'} onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, provider: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                            <option value="sslcommerz">SSLCommerz (Cards & Wallets)</option>
                            <option value="bkash_pgw">bKash Direct Checkout (PGW)</option>
                            <option value="shurjopay">Shurjopay Gateway</option>
                            <option value="aamarpay">AamarPay Payment Gateway</option>
                            <option value="custom">Custom Online Gateway</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">{'Environment Mode'}</label>
                          <select value={paymentMethodFormData.gatewayMode || 'sandbox'} onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, gatewayMode: e.target.value as any })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                            <option value="sandbox">Sandbox / Test Mode</option>
                            <option value="live">Live / Production</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">{'Store ID / App Key'}</label>
                          <input type="text" value={paymentMethodFormData.storeId || ''} onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, storeId: e.target.value })} placeholder="e.g. dotcolor_live_store" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"/>
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">{'Secret Key / Password'}</label>
                          <input type="password" value={paymentMethodFormData.secretKey || ''} onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, secretKey: e.target.value })} placeholder="••••••••••••••••••••••••" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"/>
                        </div>
                      </div>
                    </div>)}

                  {/* Notes / Instructions */}
                  <div className="text-xs">
                    <label className="font-bold text-slate-700 block mb-1">
                      {'Customer Instructions / Internal Note'}
                    </label>
                    <input type="text" value={paymentMethodFormData.notes || ''} onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, notes: e.target.value })} placeholder="e.g. Deposit slip must include invoice number as reference." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"/>
                  </div>

                  {/* Switches: Is Active and Is Default */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={paymentMethodFormData.isEnabled !== false} onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, isEnabled: e.target.checked })} className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"/>
                      <span className="font-bold text-slate-800">
                        {'Active in POS & Checkout'}
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={Boolean(paymentMethodFormData.isDefault)} onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, isDefault: e.target.checked })} className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"/>
                      <span className="font-bold text-amber-800 flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500"/>
                        <span>{'Set as Default Method'}</span>
                      </span>
                    </label>
                  </div>

                  {/* Modal Action Buttons */}
                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                    <button type="button" onClick={() => setShowPaymentModal(false)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
                      {'Cancel'}
                    </button>
                    <button type="submit" className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-2">
                      <Save className="w-4 h-4"/>
                      <span>
                        {editingPaymentMethod
                    ? 'Update Method'
                    : 'Create Method'}
                      </span>
                    </button>
                  </div>
                </form>
              </div>
            </div>)}
        </div>)}

      {/* TAB 3: MODULE DATA CLEAN & PURGE */}
      {activeTab === 'data-clean' && canCleanData && (<div className="space-y-4">
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5"/>
            <div>
              <h3 className="font-bold text-rose-900 text-sm">
                {'Modular Data Purge & Wipe Center'}
              </h3>
              <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                {'You can selectively purge data for specific modules (e.g., test sales invoices or purchase orders) or restore baseline demo data.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sales / POS Invoices Clean */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-rose-600"/>
                  {'1. Reset All Sales Data'}
                </span>
                <span className="text-xs font-mono text-slate-500">POS & Sales</span>
              </div>
              <p className="text-xs text-slate-500">
                {'Deletes all sales invoices, POS counter sales, quotes, sales revenue entries, and resets customer sales dues to 0. Master catalogs remain intact.'}
              </p>
              <button
                type="button"
                onClick={() => setCleanConfirmModule('SALES_RESET')}
                className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5"/>
                <span>{'Reset All Sales Data'}</span>
              </button>
            </div>

            {/* Inventory Movements Clean */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">
                  {'2. Stock Movement History Purge'}
                </span>
                <span className="text-xs font-mono text-slate-500">Stock Movements</span>
              </div>
              <p className="text-xs text-slate-500">
                {'Deletes all stock transfers and adjustments history logs. Master inventory catalog is preserved.'}
              </p>
              <button type="button" onClick={() => setCleanConfirmModule('stockMovements')} className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5"/>
                <span>{'Purge Movement Logs'}</span>
              </button>
            </div>

            {/* Supply Chain PO Clean */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">
                  {'3. Purchase Orders (PO) Purge'}
                </span>
                <span className="text-xs font-mono text-slate-500">Purchase Orders</span>
              </div>
              <p className="text-xs text-slate-500">
                {'Deletes all supplier purchase orders. Supplier directory remains intact.'}
              </p>
              <button type="button" onClick={() => setCleanConfirmModule('purchaseOrders')} className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5"/>
                <span>{'Purge Purchase Orders'}</span>
              </button>
            </div>

            {/* Accounting Transactions Clean */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">
                  {'4. Financial Ledger & Txns Purge'}
                </span>
                <span className="text-xs font-mono text-slate-500">Accounting Ledger</span>
              </div>
              <p className="text-xs text-slate-500">
                {'Deletes all daily expenses, revenue entries, and journal vouchers, resetting account balances to zero.'}
              </p>
              <button type="button" onClick={() => setCleanConfirmModule('transactions')} className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5"/>
                <span>{'Purge Transactions Data'}</span>
              </button>
            </div>

            {/* Projects Data Purge */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">
                  {'5. Projects Data Purge'}
                </span>
                <span className="text-xs font-mono text-slate-500">Projects & Sales</span>
              </div>
              <p className="text-xs text-slate-500">
                {'Purge all project profiles, sales income records, and expense breakdown logs.'}
              </p>
              <button type="button" onClick={() => setCleanConfirmModule('projects')} className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5"/>
                <span>{'Purge Projects Data'}</span>
              </button>
            </div>

            {/* Reset All Transactional Data */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4 text-rose-600"/>
                  {'6. Reset All Transactional Data'}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  All Transactions
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {'Wipes all sales, quotes, purchase orders, ledger entries, and stock history. Resets all dues and stock to 0 while preserving catalogs.'}
              </p>
              <button
                type="button"
                onClick={() => setCleanConfirmModule('RESET_ALL_TRANSACTIONS')}
                className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5"/>
                <span>
                  {'Reset All Transactional Data'}
                </span>
              </button>
            </div>
          </div>

          {/* Master Reset */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-sm text-amber-400">
                {'System Factory Reset (Full Baseline Reset)'}
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                {'Clear all test data and restore initial demo baseline database.'}
              </p>
            </div>
            <button type="button" onClick={handleFactoryReset} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-xs shrink-0 flex items-center gap-1.5 cursor-pointer">
              <RotateCcw className="w-4 h-4"/>
              <span>{'Reset to Default'}</span>
            </button>
          </div>
        </div>)}

      {/* TAB 4: SYSTEM & IT PARTNER (BD HOSTT) */}
      {activeTab === 'system' && (<div className="space-y-6">
          {/* Hero Banner */}
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white p-6 sm:p-8 rounded-3xl shadow-sm border border-blue-900/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"/>
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest uppercase bg-blue-500/20 text-cyan-300 border border-blue-400/40 px-3 py-1 rounded-full">
                    OFFICIAL TECHNOLOGY &amp; IT PARTNER
                  </span>
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-400"/>
                    Verified IT Infrastructure
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  BD HOSTT
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                  <strong>DotColorCommunication Sales, POS &amp; ERP</strong> is proudly designed, engineered, and powered by <strong>BD HOSTT</strong>. We provide end-to-end cloud infrastructure, web hosting, domain registration, and custom enterprise software development.
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-emerald-400"/>
                    Hotline: <strong className="text-white">01846100900, 01756007600</strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-blue-400"/>
                    <strong className="text-white">info@bdhost.com</strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-cyan-400"/>
                    <strong className="text-white">www.bdhost.com</strong>
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0 w-full sm:w-auto">
                <a href="https://www.bdhost.com" target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-center">
                  <Globe className="w-4 h-4"/>
                  <span>Visit BD HOSTT Website</span>
                  <ExternalLink className="w-3.5 h-3.5"/>
                </a>
                <a href="tel:01846100900" className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm rounded-xl border border-white/20 transition-all flex items-center justify-center gap-2 text-center">
                  <Phone className="w-4 h-4 text-emerald-400"/>
                  <span>Contact IT Hotline</span>
                </a>
              </div>
            </div>
          </div>

          {/* BD HOSTT Services Grid */}
          <div>
            <h4 className="font-black text-slate-900 text-base mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500"/>
              <span>{'BD HOSTT IT Services & Capabilities'}</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Server className="w-5 h-5"/>
                </div>
                <h5 className="font-bold text-sm text-slate-900">Custom POS &amp; ERP Engineering</h5>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Tailored enterprise resource planning, automated sales billing, barcode scanning, manufacturing workflow, and double-entry accounting software.
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <HardDrive className="w-5 h-5"/>
                </div>
                <h5 className="font-bold text-sm text-slate-900">High-Performance NVMe Hosting</h5>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Ultra-fast NVMe SSD web hosting with LiteSpeed web server, cPanel management, 99.9% uptime SLA, and BDIX super-fast Bangladesh routing.
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                  <Globe className="w-5 h-5"/>
                </div>
                <h5 className="font-bold text-sm text-slate-900">Domain Registration &amp; Corporate Mail</h5>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Instant global domain registration (.com, .net, .org, .xyz, .com.bd) with DNS management and dedicated corporate business email suites.
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Cpu className="w-5 h-5"/>
                </div>
                <h5 className="font-bold text-sm text-slate-900">Cloud VPS &amp; Dedicated Infrastructure</h5>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Scalable cloud compute instances, KVM virtualization, dedicated root access, custom firewall, and high bandwidth network connectivity.
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5"/>
                </div>
                <h5 className="font-bold text-sm text-slate-900">Cybersecurity &amp; Cloud Backup</h5>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Free Wildcard SSL certificates, anti-DDoS protection, automated daily database snapshots, and secure MongoDB Atlas cloud synchronization.
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Phone className="w-5 h-5"/>
                </div>
                <h5 className="font-bold text-sm text-slate-900">24/7 Dedicated Support SLA</h5>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Round-the-clock technical support desk, WhatsApp hotline, direct phone consultation, and guaranteed rapid response times for enterprise clients.
                </p>
              </div>
            </div>
          </div>

          {/* System Environment Specs */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
            <h4 className="font-black text-slate-900 text-sm mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600"/>
              <span>{'System Environment & Architecture'}</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">APPLICATION</span>
                <span className="font-extrabold text-slate-900 mt-1 block">DotColorCommunication</span>
                <span className="text-slate-500 text-[11px]">Sales, POS &amp; ERP Edition</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">DEVELOPER &amp; PARTNER</span>
                <span className="font-extrabold text-blue-700 mt-1 block">BD HOSTT</span>
                <span className="text-slate-500 text-[11px]">www.bdhost.com</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CLOUD SYNCHRONIZATION</span>
                <span className="font-extrabold text-emerald-700 mt-1 block">MongoDB Atlas Cloud</span>
                <span className="text-slate-500 text-[11px]">Hybrid Local &amp; Cloud Sync</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">TECHNICAL HOTLINE</span>
                <span className="font-extrabold text-slate-900 mt-1 block">01846100900</span>
                <span className="text-slate-500 text-[11px]">24/7 Support Available</span>
              </div>
            </div>
          </div>
        </div>)}

      {/* TAB: BACKUP, HARDWARE & TOOLS */}
      {activeTab === 'system-tools' && (
        <div className="space-y-6">
          {/* Top Banner / Summary */}
          <div className="bg-gradient-to-r from-amber-900 via-slate-900 to-amber-950 p-6 rounded-3xl text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-amber-900/40">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Database className="w-4 h-4" />
                <span>{'System Utilities & Hardware Integration'}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black">{'Backup, Hardware Agent & Warehouse Tools'}</h3>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                {'Manage local ERP data backups, cloud synchronization, POS 80mm thermal receipt bridge, central warehouse locations, and company contact credentials.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{'Download Backup (.JSON)'}</span>
              </button>
              <label className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs border border-white/20 transition-all cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>{'Upload & Restore'}</span>
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>

          {/* Quick Metrics & Hardware Status Grid (4 Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Central Warehouse & Locations */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {'Active'}
                </span>
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">{'Central Warehouse'}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{'Head Office & Central Storage'}</p>
              </div>
              <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{profile.officeAddress || 'Shyamoli Ring Road, Dhaka'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Factory className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">{profile.factoryAddress || 'Baitul Aman, Adabor, Dhaka'}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Low Stock Monitor */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${lowStockCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${lowStockCount > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                  {lowStockCount > 0 ? `${lowStockCount} Low Items` : 'Stock Healthy'}
                </span>
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">{'Low Stock Health Alert'}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lowStockCount > 0 ? `${lowStockCount} items below threshold` : 'All materials at safe levels'}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onNavigateTab ? onNavigateTab('inventory') : undefined}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <span>{'View in Inventory'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Card 3: POS Thermal Printer Hardware Bridge */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${printerStatus.isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                  <Printer className="w-5 h-5" />
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1 ${printerStatus.isOnline ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${printerStatus.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                  {printerStatus.isOnline ? 'Bridge OK' : 'Offline'}
                </span>
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">{'POS Thermal Printer'}</h4>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {printerStatus.isOnline ? (printerStatus.activePrinter || '80mm Hardware Agent') : '127.0.0.1:8089 bridge'}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPrinterBridgeModal(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{'Configure / Test Print'}</span>
                </button>
              </div>
            </div>

            {/* Card 4: MongoDB Atlas Cloud Sync */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCloudConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                  <Cloud className="w-5 h-5" />
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${isCloudConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  {cloudSyncStatus === 'syncing' ? 'Syncing...' : isCloudConnected ? 'Cloud Active' : 'Offline'}
                </span>
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">{'Cloud Sync Status'}</h4>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {lastSyncedAt ? `Last: ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'MongoDB Atlas Sync'}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => syncWithCloud?.({ forcePush: true })}
                  disabled={cloudSyncStatus === 'syncing'}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${cloudSyncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  <span>{cloudSyncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Database Backup & Restore Detailed Box */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">{'ERP Database Backup & JSON Restore'}</h3>
                  <p className="text-xs text-slate-500">
                    {'Export offline snapshots or restore complete database states with zero data loss.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{'Download Backup (.JSON)'}</span>
                </button>
                <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>{'Upload & Restore'}</span>
                  <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {importStatus === 'success' && (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-200 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{'Data restored & saved successfully into database! Cloud sync triggered.'}</span>
              </div>
            )}

            {importStatus === 'error' && (
              <div className="flex items-center gap-2 text-xs font-bold text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{'Invalid backup JSON format! Please supply a valid DotColor ERP backup file.'}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-amber-600" />
                  {'Instant Offline Backup'}
                </span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {'Downloads all invoices, inventory products, journal entries, accounting ledgers, customers, and user configurations as a JSON file.'}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  {'Safe Restoration'}
                </span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {'Select any previous JSON file to restore the entire ERP database instantly without restarting the application.'}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                  {'Factory Baseline'}
                </span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {'Reset the database back to clean baseline defaults if you wish to start afresh or test cleanly.'}
                </p>
                <button
                  type="button"
                  onClick={handleFactoryReset}
                  className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[11px] border border-rose-200 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{'Reset to Demo Data'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* POS Hardware & Company Info Section (2 Columns) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* POS 80mm Thermal Hardware Bridge */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <Printer className="w-5 h-5 text-amber-600" />
                  <h4 className="font-extrabold text-slate-900 text-sm">{'POS 80mm Thermal Printer Bridge'}</h4>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${printerStatus.isOnline ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {printerStatus.isOnline ? 'Active on port 8089' : 'Service Offline'}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {'Connects directly to local thermal receipt printers via the lightweight background hardware bridge agent at'} <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-amber-800">http://127.0.0.1:8089</code> {'for one-click silent printing and paper auto-cut.'}
              </p>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPrinterBridgeModal(true)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{'Open Hardware Bridge Manager'}</span>
                </button>
              </div>
            </div>

            {/* Company & Contact Profile Quick View */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-5 h-5 text-slate-800" />
                  <h4 className="font-extrabold text-slate-900 text-sm">{'Company Contact & Details'}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInfoModal(true)}
                  className="text-xs font-bold text-amber-700 hover:underline cursor-pointer"
                >
                  {'View Details Modal ↗'}
                </button>
              </div>
              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{'Hotline:'} <strong className="text-slate-900">{profile.phone || '01846100900'}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{'Email:'} <span className="text-slate-600">{profile.emails?.join(', ') || 'info@dotcolorcommunication.com'}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>{'Office:'} <span className="text-slate-600">{profile.officeAddress || 'Shyamoli Ring Road, Dhaka'}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <Factory className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{'Factory:'} <span className="text-slate-600">{profile.factoryAddress || 'Baitul Aman Housing, Adabor, Dhaka'}</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clean Confirmation Modal */}
      {cleanConfirmModule && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6"/>
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-extrabold text-slate-900 text-base">
                {cleanConfirmModule === 'invoices' || cleanConfirmModule === 'SALES_RESET' || cleanConfirmModule === 'SALES'
                  ? 'Confirm Sales Data Reset'
                  : cleanConfirmModule === 'RESET_ALL_TRANSACTIONS' || cleanConfirmModule === 'WIPE_ALL_EXCEPT_PRODUCTS'
                  ? 'Confirm All Transactional Data Reset'
                  : 'Confirm Data Deletion'}
              </h3>
              <div className="text-xs text-slate-600 space-y-1.5 leading-relaxed text-left sm:text-center">
                {cleanConfirmModule === 'RESET_ALL_TRANSACTIONS' || cleanConfirmModule === 'WIPE_ALL_EXCEPT_PRODUCTS' ? (
                  <>
                    <p className="font-semibold text-slate-800 text-center">
                      {'Are you sure you want to permanently reset all transactional data?'}
                    </p>
                    <p className="text-slate-500 text-[11px] text-center">
                      {'This will wipe all sales invoices, quotes, purchase orders, cash transactions, journal entries, project records, and stock movements. Customer & supplier dues, customer advances will be zeroed out, inventory stock reset to 0, and accounts reset to zero. Product, customer, and supplier master directories will remain intact.'}
                    </p>
                  </>
                ) : (cleanConfirmModule === 'invoices' || cleanConfirmModule === 'SALES_RESET' || cleanConfirmModule === 'SALES') ? (<>
                    <p className="font-semibold text-slate-800 text-center">
                      {'Are you sure you want to permanently reset all sales data?'}
                    </p>
                    <p className="text-slate-500 text-[11px] text-center">
                      {'This will delete all sales invoices, POS counter sales, quotation records, sales revenue journal entries, and reset customer sales dues to 0. Product catalog and customer contacts will be safely preserved.'}
                    </p>
                  </>) : (<span>
                    {(<>Are you sure you want to permanently delete all records from the <strong className="text-slate-900">{cleanConfirmModule}</strong> module?</>)}
                  </span>)}
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                disabled={isPurging}
                onClick={() => setCleanConfirmModule(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all disabled:opacity-50"
              >
                {'Cancel'}
              </button>
              <button
                type="button"
                disabled={isPurging}
                onClick={() => handleExecuteClean(cleanConfirmModule)}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold shadow-sm cursor-pointer flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isPurging ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{'Wiping & Syncing...'}</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5"/>
                    <span>
                      {cleanConfirmModule === 'invoices' || cleanConfirmModule === 'SALES_RESET' || cleanConfirmModule === 'SALES'
                        ? 'Yes, Reset'
                        : cleanConfirmModule === 'RESET_ALL_TRANSACTIONS' || cleanConfirmModule === 'WIPE_ALL_EXCEPT_PRODUCTS'
                        ? 'Yes, Reset All'
                        : 'Yes, Delete'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>)}

      {/* Add / Edit User Modal */}
      {showUserModal && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleUserFormSubmit} className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600"/>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingStaff
                ?
                    'Edit User / Staff'
                :
                    'Add New Staff / User'}
                </h3>
              </div>
              <button type="button" onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Full Name *'}
                </label>
                <input type="text" required value={userFormData.name} onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })} placeholder="e.g. Sajib Khan" className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold"/>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Role & Access Permissions *'}
                </label>
                {editingStaff && isSuperAdminStaff(editingStaff) ? (<div className="w-full px-3 py-2 border border-indigo-200 bg-indigo-50/70 rounded-xl font-bold text-indigo-900 flex items-center justify-between">
                    <span>{'Super Admin (Permanent Root Account)'}</span>
                    <span className="text-[10px] font-black text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                      Permanent Root
                    </span>
                  </div>) : (<select value={userFormData.customRoleId} onChange={(e) => {
                    const selectedId = e.target.value;
                    const foundRole = userRoles.find((r) => r.id === selectedId);
                    if (foundRole) {
                        setUserFormData({
                            ...userFormData,
                            customRoleId: foundRole.id,
                            role: foundRole.name as StaffRole,
                            roleBn: foundRole.nameBn || '',
                        });
                    }
                    else {
                        setUserFormData({ ...userFormData, customRoleId: selectedId });
                    }
                }} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-800 bg-white cursor-pointer">
                    {userRoles
                    .filter((r) => r.name !== 'Super Admin' && r.name.toLowerCase() !== 'superadmin')
                    .map((r) => (<option key={r.id} value={r.id}>
                          {r.name} — {r.permissions.length} Permissions
                        </option>))}
                  </select>)}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Phone Number'}
                  </label>
                  <input type="text" value={userFormData.phone} onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })} placeholder="+88018..." className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"/>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Email Address'}
                  </label>
                  <input type="email" value={userFormData.email} onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })} placeholder="user@dotcolorcommunication.com" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>
              </div>

              {/* Password Field */}
              <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200/80 space-y-1.5">
                <label className="font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-600"/>
                    <span>{'Login Password *'}</span>
                  </span>
                  <span className="text-[10px] text-amber-800 font-semibold bg-amber-100/70 px-1.5 py-0.5 rounded">
                    {'Default: 1234'}
                  </span>
                </label>
                <div className="relative">
                  <input type={showUserPassword ? 'text' : 'password'} required value={userFormData.password} onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })} placeholder={'Enter password (e.g. 1234 or PIN)'} className="w-full bg-white pl-3 pr-10 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-amber-400 focus:outline-hidden"/>
                  <button type="button" onClick={() => setShowUserPassword(!showUserPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer" tabIndex={-1} title={showUserPassword ? ('Hide password') : ('Show password')}>
                    {showUserPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  {'This password is used by the staff member to log in to their account.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setShowUserModal(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {'Cancel'}
              </button>
              <button type="submit" className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs">
                {'Save User'}
              </button>
            </div>
          </form>
        </div>)}

      {/* Add / Edit Role & Granular Permissions Modal */}
      {showRoleModal && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleRoleFormSubmit} className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600"/>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingRole
                ?
                    'Edit Role Permissions'
                :
                    'Create New Access Role'}
                </h3>
              </div>
              <button type="button" onClick={() => setShowRoleModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Role Name (EN) *'}
                  </label>
                  <input type="text" required value={roleFormData.name} onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })} placeholder="e.g. Inventory Controller" className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"/>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Role Name (BN)'}
                  </label>
                  <input type="text" value={roleFormData.nameBn} onChange={(e) => setRoleFormData({ ...roleFormData, nameBn: e.target.value })} placeholder={'e.g. Inventory Controller'} className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Description'}
                </label>
                <input type="text" value={roleFormData.description} onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })} placeholder="Primary duties and access scope..." className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
              </div>

              {/* Module-wise Granular Permissions Matrix */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 text-sm">
                    {'Granular Permissions Matrix'}
                  </span>
                  <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    {roleFormData.permissions.length} permissions active
                  </span>
                </div>

                {['POS', 'Sales', 'Inventory', 'Supply Chain', 'Accounting', 'Settings'].map((cat) => {
                const perms = SYSTEM_PERMISSIONS.filter((p) => p.category === cat);
                const allCatSelected = perms.every((p) => roleFormData.permissions.includes(p.code));
                return (<div key={cat} className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                        <span className="font-bold text-slate-800 text-xs">{cat} Module</span>
                        <button type="button" onClick={() => handleSelectAllCategory(cat)} className="text-[10px] font-bold text-blue-600 hover:underline">
                          {allCatSelected ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {perms.map((p) => {
                        const checked = roleFormData.permissions.includes(p.code);
                        return (<label key={p.code} className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all ${checked
                                ? 'bg-amber-50/60 border-amber-300 text-slate-900 font-semibold'
                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                              <input type="checkbox" checked={checked} onChange={() => handleTogglePermission(p.code)} className="mt-0.5 rounded text-slate-900 focus:ring-slate-900"/>
                              <div>
                                <span className="block text-xs leading-tight">
                                  {p.name}
                                </span>
                                <span className="font-mono text-[9px] text-slate-400 block mt-0.5">{p.code}</span>
                              </div>
                            </label>);
                    })}
                      </div>
                    </div>);
            })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setShowRoleModal(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {'Cancel'}
              </button>
              <button type="submit" className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs">
                {'Save Role & Permissions'}
              </button>
            </div>
          </form>
        </div>)}

      {/* Thermal Printer Hardware Bridge Modal */}
      <PrinterBridgeModal
        isOpen={showPrinterBridgeModal}
        onClose={() => {
          setShowPrinterBridgeModal(false);
          checkHardwareAgentStatus().then(setPrinterStatus).catch(() => {});
        }}
      />

      {/* Info & Contact Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <BrandLogo size="md" showTagline={true} />
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs text-slate-700">
              <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80">
                <span className="font-bold text-amber-900 text-sm block">
                  {profile?.name || 'DotColorCommunication Sales, POS & ERP'}
                </span>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  {profile?.tagline || 'YOUR VISION, OUR CREATION!'} —{' '}
                  {profile?.category ||
                    'Premier digital printing, 3D signage, corporate promotional merchandise, and custom ERP solution provider.'}
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <Factory className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 block font-semibold">{'FACTORY:'}</strong>
                    <span className="text-slate-600">{profile.factoryAddress}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Building2 className="w-4 h-4 text-slate-800 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 block font-semibold">{'OFFICE:'}</strong>
                    <span className="text-slate-600">{profile.officeAddress}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <strong className="text-slate-900 inline font-semibold">{'Hotline:'} </strong>
                    <a href={`tel:${profile.phone}`} className="text-amber-700 font-bold hover:underline">
                      {profile.phone}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <strong className="text-slate-900 inline font-semibold">{'Emails:'} </strong>
                    <span className="text-slate-600">{profile.emails?.join(' • ') || ''}</span>
                  </div>
                </div>
              </div>

              {/* Dedicated BD HOSTT Technology Partner Advertising Card */}
              <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 rounded-2xl text-white shadow-xs border border-blue-900/50 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold tracking-widest uppercase bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2.5 py-0.5 rounded-full">
                    TECHNOLOGY &amp; IT PARTNER
                  </span>
                  <span className="text-[10px] font-semibold text-amber-400">
                    ★ Certified IT Solutions
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-black text-white">BD HOSTT</h4>
                  <a
                    href="https://www.bdhost.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-blue-400 hover:text-blue-300 underline"
                  >
                    www.bdhost.com ↗
                  </a>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Web Hosting, Domain Registration, High-Performance VPS, Enterprise POS &amp; ERP Solutions.
                </p>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
                  <span>
                    Hotline: <strong className="text-white">01846100900</strong>
                  </span>
                  <a
                    href="tel:01846100900"
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[10px] transition-colors"
                  >
                    Call BD HOSTT
                  </a>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="text-xs font-semibold px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                {'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>);
};
