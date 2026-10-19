import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { CompanyProfile, ProductItem, Customer, Supplier, SalesInvoice, Quotation, PurchaseOrder, AccountingTransaction, StockMovement, Language, LocationType, AccountBalances, StaffMember, StaffRole, AuditLogEntry, ChartOfAccount, ExpenseHead, ProductCategory, UserRole, RolePermission, JournalEntry, Project, ProjectExpenseItem, ProjectSalesItem, PaymentMethodConfig, PaymentStatus, ProjectSalesCollection, ProjectSalesPaymentBreakdown } from '../types';
import { INITIAL_COMPANY_PROFILE, INITIAL_PRODUCTS, INITIAL_CUSTOMERS, INITIAL_SUPPLIERS, INITIAL_INVOICES, INITIAL_PURCHASE_ORDERS, INITIAL_TRANSACTIONS, INITIAL_QUOTATIONS, INITIAL_STOCK_MOVEMENTS, INITIAL_STAFF_MEMBERS, INITIAL_AUDIT_LOGS, } from '../data/initialData';
import { INITIAL_CHART_OF_ACCOUNTS, INITIAL_EXPENSE_HEADS, INITIAL_PRODUCT_CATEGORIES, INITIAL_USER_ROLES, INITIAL_JOURNAL_ENTRIES, INITIAL_PROJECTS, ALL_SYSTEM_PERMISSIONS, INITIAL_PAYMENT_METHODS, } from '../data/accountingAndConfigData';
import { matchChannelToAccount, calculateSingleAccountBalance, getBankAccountsBreakdown, getMfsAccountsBreakdown, getCashAccountsBreakdown, isInvoiceTransaction, isProjectTransaction, isInvoiceMatchingCustomer, isAdvanceAdjustmentTransaction, isAdvanceDepositTransaction, isProjectDueCollectionTransaction, isDueReceivableTransaction, calculateTotalCustomerReceivables, calculateTotalSupplierPayables, calculateInventoryValuation } from '../utils/accountUtils';
const STORAGE_KEY = 'DOT_COLOR_ERP_V1_STATE';
interface AppContextType {
    profile: CompanyProfile;
    products: ProductItem[];
    customers: Customer[];
    suppliers: Supplier[];
    invoices: SalesInvoice[];
    quotations: Quotation[];
    purchaseOrders: PurchaseOrder[];
    transactions: AccountingTransaction[];
    stockMovements: StockMovement[];
    accountBalances: AccountBalances;
    language: Language;
    activeLocation: 'All' | 'Factory' | 'Office';
    setLanguage: (lang: Language) => void;
    setActiveLocation: (loc: 'All' | 'Factory' | 'Office') => void;
    updateProfile: (profile: Partial<CompanyProfile>) => void;
    // Payment Gateways & Methods
    paymentMethods: PaymentMethodConfig[];
    addPaymentMethod: (pm: Omit<PaymentMethodConfig, 'id'>) => PaymentMethodConfig;
    updatePaymentMethod: (id: string, updates: Partial<PaymentMethodConfig>) => void;
    deletePaymentMethod: (id: string) => {
        success: boolean;
        message?: string;
    };
    togglePaymentMethod: (id: string) => void;
    setDefaultPaymentMethod: (id: string) => void;
    // Staff & RBAC
    auditLogs: AuditLogEntry[];
    staffMembers: StaffMember[];
    activeStaff: StaffMember;
    setActiveStaff: (staff: StaffMember) => void;
    addAuditLog: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'> & {
        timestamp?: string;
    }) => void;
    addStaffMember: (staff: Omit<StaffMember, 'id'>) => StaffMember;
    updateStaffMember: (id: string, updates: Partial<StaffMember>) => void;
    deleteStaffMember: (id: string) => {
        success: boolean;
        message?: string;
    };
    userRoles: UserRole[];
    systemPermissions: RolePermission[];
    addUserRole: (role: Omit<UserRole, 'id'>) => UserRole;
    updateUserRole: (id: string, updates: Partial<UserRole>) => void;
    deleteUserRole: (id: string) => {
        success: boolean;
        message?: string;
    };
    checkPermission: (permissionCode: string) => boolean;
    // Authentication
    isAuthenticated: boolean;
    login: (staffIdOrPasscode: string, passcode?: string) => {
        success: boolean;
        message: string;
    };
    logout: () => void;
    // Sales & Invoices
    addInvoice: (invoice: Omit<SalesInvoice, 'id' | 'invoiceNo'>) => SalesInvoice;
    updateInvoice: (id: string, updates: Partial<SalesInvoice>) => void;
    deleteInvoice: (id: string) => void;
    collectInvoicePayment: (invoiceId: string, amount: number, method: any, advanceAdjustAmount?: number) => void;
    adjustCustomerAdvance: (customerId: string, amount: number, invoiceId?: string, notes?: string) => void;
    updateProductionStatus: (invoiceId: string, status: any) => void;
    // Quotations
    addQuotation: (quotation: Omit<Quotation, 'id' | 'quoteNo'>) => Quotation;
    updateQuotation: (id: string, updates: Partial<Quotation>) => void;
    updateQuotationStatus: (id: string, status: Quotation['status']) => void;
    deleteQuotation: (id: string) => void;
    convertQuotationToInvoice: (quotationId: string) => SalesInvoice | null;
    // Products & Categories
    productCategories: ProductCategory[];
    addProductCategory: (cat: Omit<ProductCategory, 'id'>) => ProductCategory;
    updateProductCategory: (id: string, updates: Partial<ProductCategory>) => void;
    deleteProductCategory: (id: string) => {
        success: boolean;
        message?: string;
    };
    addProduct: (product: Omit<ProductItem, 'id' | 'code'>) => void;
    bulkImportProducts: (items: Array<Omit<ProductItem, 'id'> & {
        id?: string;
    }>, options?: {
        updateExisting?: boolean;
    }) => {
        added: number;
        updated: number;
    };
    updateProduct: (id: string, updates: Partial<ProductItem>) => void;
    deleteProduct: (id: string) => void;
    adjustStock: (productId: string, type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT', qty: number, location: 'Factory' | 'Office', targetLocation?: 'Factory' | 'Office', reason?: string) => void;
    // Supply Chain & Purchase
    addPurchaseOrder: (po: Omit<PurchaseOrder, 'id' | 'poNo'>) => PurchaseOrder;
    updatePurchaseOrder: (id: string, updates: Partial<PurchaseOrder>) => void;
    deletePurchaseOrder: (id: string) => void;
    receivePurchaseOrder: (poId: string, receivedItems?: {
        productId: string;
        receivedQty: number;
    }[]) => void;
    payPurchaseOrder: (poId: string, amount: number, paymentAccount?: any, paymentMethod?: any) => void;
    paySupplierDue: (supplierId: string, amount: number, account?: any, targetPoId?: string) => void;
    paySupplier: (supplierId: string, amount: number, account?: any, targetPoId?: string) => void;
    // Customers & Suppliers
    addCustomer: (cust: Omit<Customer, 'id' | 'totalPurchased' | 'dueAmount' | 'createdAt'>) => Customer;
    updateCustomer: (id: string, updates: Partial<Customer>) => void;
    deleteCustomer: (id: string) => void;
    addSupplier: (sup: Omit<Supplier, 'id' | 'totalPurchased' | 'dueAmount'>) => Supplier;
    updateSupplier: (id: string, updates: Partial<Supplier>) => void;
    deleteSupplier: (id: string) => void;
    // Accounting & COA & Expense Heads
    chartOfAccounts: ChartOfAccount[];
    addChartOfAccount: (account: Omit<ChartOfAccount, 'id' | 'currentBalance'>) => ChartOfAccount;
    updateChartOfAccount: (id: string, updates: Partial<ChartOfAccount>) => void;
    deleteChartOfAccount: (id: string, force?: boolean) => {
        success: boolean;
        message?: string;
        requiresForce?: boolean;
    };
    expenseHeads: ExpenseHead[];
    addExpenseHead: (head: Omit<ExpenseHead, 'id'>) => ExpenseHead;
    updateExpenseHead: (id: string, updates: Partial<ExpenseHead>) => void;
    deleteExpenseHead: (id: string) => {
        success: boolean;
        message?: string;
    };
    journalEntries: JournalEntry[];
    addJournalEntry: (entry: Omit<JournalEntry, 'id' | 'entryNo'>) => JournalEntry;
    updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => void;
    generateJournalsFromTransactions: () => number;
    restoreDefaultExpenseHeads: () => void;
    addTransaction: (tx: Omit<AccountingTransaction, 'id'>) => void;
    updateTransaction: (id: string, updates: Partial<AccountingTransaction>) => void;
    deleteTransaction: (id: string) => void;
    // Projects Management
    projects: Project[];
    addProject: (proj: Omit<Project, 'id' | 'code' | 'totalSales' | 'totalExpenses' | 'netProfit' | 'profitMargin'>) => Project;
    updateProject: (id: string, updates: Partial<Project>) => void;
    deleteProject: (id: string) => void;
    addProjectSales: (projectId: string, sales: Omit<ProjectSalesItem, 'id'>) => void;
    collectProjectDue: (projectId: string, salesItemId: string, amount: number, paymentMethod: string, date?: string, note?: string, referenceNo?: string, advanceAdjustAmount?: number) => void;
    addProjectExpense: (projectId: string, expense: Omit<ProjectExpenseItem, 'id'>) => void;
    addProjectExpenses: (projectId: string, expenses: Omit<ProjectExpenseItem, 'id'>[]) => void;
    deleteProjectSales: (projectId: string, salesId: string) => void;
    deleteProjectExpense: (projectId: string, expenseId: string) => void;
    syncProjectsWithAccounting: () => { salesSynced: number; expensesSynced: number; totalAmount: number };
    createProjectFromInvoice: (invoiceId: string, options?: {
        name?: string;
        nameBn?: string;
        chartOfAccountId?: string;
        budget?: number;
        status?: Project['status'];
        startDate?: string;
        endDate?: string;
        notes?: string;
        includeAsSalesItem?: boolean;
    }) => Project | null;
    linkInvoiceToProject: (projectId: string, invoiceId: string, chartOfAccountId?: string, syncSalesItem?: boolean) => boolean;
    unlinkInvoiceFromProject: (projectId: string) => boolean;
    generateInvoiceForProject: (projectId: string, options?: { title?: string; date?: string; skipLedgerTransaction?: boolean }) => SalesInvoice | null;
    syncProjectInvoice: (projectId: string) => boolean;
    // Utilities & Module Data Cleanup
    cleanModuleData: (moduleKey: 'SALES' | 'QUOTATIONS' | 'PURCHASES' | 'INVENTORY_STOCK' | 'CUSTOM_PRODUCTS' | 'TRANSACTIONS' | 'JOURNALS' | 'AUDIT_LOGS' | 'PROJECTS' | 'ALL' | 'WIPE_ALL_EXCEPT_PRODUCTS' | 'RESET_ALL_TRANSACTIONS') => void;
    resetSalesData: () => void;
    resetAllTransactionalData: () => void;
    resetToDefaultData: () => void;
    exportDatabase: () => string;
    importDatabase: (jsonString: string, isCloudSync?: boolean) => boolean;
    // Cloud & MongoDB Synchronization
    cloudSyncStatus: 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
    isCloudConnected: boolean;
    lastSyncedAt: string | null;
    syncWithCloud: (options?: { forcePull?: boolean; forcePush?: boolean }) => Promise<void>;
}
const AppContext = createContext<AppContextType | undefined>(undefined);
const generateUniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${Math.floor(100 + Math.random() * 900)}`;
const ensureUniqueTransactions = (list: AccountingTransaction[]): AccountingTransaction[] => {
    const seenIds = new Set<string>();
    const seenInvoiceKeys = new Set<string>();
    const result: AccountingTransaction[] = [];

    for (let idx = 0; idx < list.length; idx++) {
        const tx = list[idx];
        if (!tx) continue;

        // Deduplicate duplicate invoice payment entries for the same invoice & payment account & amount & date
        if (tx.type === 'INCOME' && tx.refNo && tx.refNo.startsWith('DCC-INV-')) {
            const invoiceKey = `${tx.refNo}_${tx.paymentAccount || tx.account || ''}_${tx.amount}_${tx.date}`;
            if (seenInvoiceKeys.has(invoiceKey)) {
                continue; // Skip duplicate invoice income transaction
            }
            seenInvoiceKeys.add(invoiceKey);
        }

        let cleanTx = tx;
        if (!tx.id || seenIds.has(tx.id)) {
            const uniqueId = `tx-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`;
            cleanTx = { ...tx, id: uniqueId };
        }
        seenIds.add(cleanTx.id);
        result.push(cleanTx);
    }
    return result;
};
export const sanitizeUserRoles = (list: UserRole[]): UserRole[] => {
    if (!Array.isArray(list) || list.length === 0) {
        return [];
    }

    const isSuper = (r: UserRole) =>
        r.id === 'role-superadmin' ||
        (Boolean(r.name) && (r.name.trim().toLowerCase() === 'super admin' || r.name.trim().toLowerCase() === 'superadmin'));

    // Find candidate super admin to preserve fields if present, preferring the root one
    const existingSuper = list.find(r => r.id === 'role-superadmin' && r.description?.trim()) ||
                          list.find(r => r.id === 'role-superadmin') ||
                          list.find(isSuper);

    const canonicalSuperAdmin: UserRole = {
        id: 'role-superadmin',
        name: 'Super Admin',
        nameBn: existingSuper?.nameBn || '',
        description: existingSuper?.description?.trim() || 'Full root administrative access to all modules, financial ledgers, system settings and user controls.',
        isSystem: true,
        permissions: ALL_SYSTEM_PERMISSIONS.map((p) => p.code),
    };

    const legacyPermMap: Record<string, string> = {
        'POS_CREATE_INVOICE': 'pos.create_sale',
        'SALES_VIEW_LIST': 'sales.view',
        'INVENTORY_VIEW_LIST': 'inventory.view',
    };

    const seenIds = new Set<string>(['role-superadmin']);
    const nonSuperRoles: UserRole[] = [];

    for (const role of list) {
        if (isSuper(role)) continue;
        if (!seenIds.has(role.id)) {
            seenIds.add(role.id);
            const normalizedPerms = Array.from(
                new Set(
                    (role.permissions || []).map((code) => legacyPermMap[code] || code)
                )
            );
            nonSuperRoles.push({
                ...role,
                permissions: normalizedPerms,
            });
        }
    }

    return [canonicalSuperAdmin, ...nonSuperRoles];
};

export const sanitizeSalesInvoice = (inv: any): SalesInvoice => {
    if (!inv || typeof inv !== 'object') return inv;
    const grand = Number(inv.grandTotal ?? inv.subtotal ?? inv.subTotal ?? 0) || 0;
    const sub = Number(inv.subtotal ?? inv.subTotal ?? grand) || 0;
    const paid = Number(inv.paidAmount ?? 0) || 0;
    const due = Number(inv.dueAmount ?? Math.max(0, grand - paid)) || 0;
    const disc = Number(inv.discount ?? inv.discountValue ?? 0) || 0;
    const vatAmt = Number(inv.vatAmount ?? inv.vatValue ?? 0) || 0;
    const vatR = Number(inv.vatRate ?? 0) || 0;

    let split = inv.splitPayments;
    if (split && typeof split === 'object') {
        const normalizedSplit: Record<string, number> = { ...split };
        Object.entries(split).forEach(([k, v]) => {
            const num = Number(v) || 0;
            const lk = k.toLowerCase().replace(/[\s_-]/g, '');
            if (lk === 'cash' || lk === 'cashinhand') {
                normalizedSplit.cash = (normalizedSplit.cash || 0) || num;
            } else if (lk === 'card' || lk === 'bank' || lk.includes('bank')) {
                normalizedSplit.card = (normalizedSplit.card || 0) || num;
            } else if (lk === 'bkash') {
                normalizedSplit.bkash = (normalizedSplit.bkash || 0) || num;
            } else if (lk === 'nagad') {
                normalizedSplit.nagad = (normalizedSplit.nagad || 0) || num;
            }
        });
        split = normalizedSplit;
    }

    const safeItems = Array.isArray(inv.items) ? inv.items.map((it: any) => {
        const uPrice = Number(it.unitPrice ?? it.price ?? it.rate ?? 0) || 0;
        const q = Number(it.qty ?? it.quantity ?? 1) || 1;
        const tPrice = Number(it.totalPrice ?? it.total ?? (uPrice * q)) || 0;
        return {
            ...it,
            name: it.name || 'Service / Item',
            unit: it.unit || 'job',
            unitPrice: uPrice,
            qty: q,
            totalPrice: tPrice,
        };
    }) : [];

    return {
        ...inv,
        subtotal: sub,
        subTotal: sub,
        grandTotal: grand,
        paidAmount: paid,
        dueAmount: due,
        discount: disc,
        vatAmount: vatAmt,
        vatRate: vatR,
        productionStatus: inv.productionStatus || 'Queued',
        paymentStatus: inv.paymentStatus || (due <= 0 ? 'Paid' : (paid <= 0 ? 'Due' : 'Partial')),
        warehouseLocation: inv.warehouseLocation || 'Office',
        items: safeItems,
        splitPayments: split,
    };
};

export const sanitizeSalesInvoices = (list: any[]): SalesInvoice[] => {
    if (!Array.isArray(list)) return [];
    return list.map(sanitizeSalesInvoice);
};

export const AppProvider: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {
    // Safe LocalStorage parsing helper
    const safeGetLocalStorage = <T,>(key: string, fallback: T): T => {
        try {
            const saved = localStorage.getItem(key);
            if (!saved)
                return fallback;
            const parsed = JSON.parse(saved);
            if (parsed === null || parsed === undefined)
                return fallback;
            if (Array.isArray(fallback) && !Array.isArray(parsed))
                return fallback;
            if (Array.isArray(parsed)) {
                // Filter out any legacy dummy records by known mock IDs
                const isDummy = (item: any) => {
                    if (!item || typeof item !== 'object' || !item.id) return false;
                    const id = String(item.id);
                    return /^(prod-dp-|prod-sm-|prod-bg-|prod-pkg-|prod-rm-|cust-0\d|sup-0\d|inv-100\d|po-500\d|tx-0\d|qt-200\d|sm-0\d$|audit-0\d|jnl-0\d|prj-1791312899418|prj-1791313243039|prj-1791286609909)/.test(id) ||
                        (/^staff-0[2-6]$/.test(id));
                };
                const filtered = parsed.filter((item: any) => !isDummy(item));
                if (filtered.length === 0 && Array.isArray(fallback) && fallback.length > 0) {
                    return fallback;
                }
                return filtered as unknown as T;
            }
            return parsed;
        }
        catch {
            return fallback;
        }
    };
    const [profile, setProfile] = useState<CompanyProfile>(() => {
        try {
            const saved = localStorage.getItem(`${STORAGE_KEY}_PROFILE`);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === 'object') {
                    if (parsed.logoUrl &&
                        (parsed.logoUrl.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALL') ||
                            parsed.logoUrl.includes('ALLCAYAAACHp'))) {
                        parsed.logoUrl = '/dotcolor-logo.svg';
                    }
                    if (parsed.name === 'DotColorCommunication Sales, POS & ERP' || parsed.name === 'Dot Color') {
                        parsed.name = 'Dot Color Communication';
                    }
                    if (parsed.footerBrandText === 'DotColorCommunication Sales, POS & ERP') {
                        parsed.footerBrandText = 'Dot Color Communication';
                    }
                    if (!parsed.officeAddress || parsed.officeAddress.includes('South Noya Para')) {
                        parsed.officeAddress = 'Nazir Ahmed Chowdhury Road Raja Pukur By lane, G A Bhaban Mat, Chattogram, Bangladesh.';
                    }
                    if (!parsed.phone || parsed.phone.includes('01846100900')) {
                        parsed.phone = '01730581687';
                    }
                    if (!parsed.emails || (parsed.emails.length === 1 && parsed.emails[0] === 'info@dotcolorcommunication.com')) {
                        parsed.emails = ['info.dotcolor@gmail.com'];
                    }
                    return {
                        ...INITIAL_COMPANY_PROFILE,
                        ...parsed,
                        servicesCapabilities: Array.isArray(parsed?.servicesCapabilities) && parsed.servicesCapabilities.length > 0
                            ? parsed.servicesCapabilities
                            : INITIAL_COMPANY_PROFILE.servicesCapabilities,
                        customPremises: Array.isArray(parsed?.customPremises) ? parsed.customPremises : [],
                    };
                }
            }
            return INITIAL_COMPANY_PROFILE;
        }
        catch {
            return INITIAL_COMPANY_PROFILE;
        }
    });
    const [products, setProducts] = useState<ProductItem[]>(() => {
        return safeGetLocalStorage<ProductItem[]>(`${STORAGE_KEY}_PRODUCTS`, INITIAL_PRODUCTS);
    });
    const [customers, setCustomers] = useState<Customer[]>(() => {
        return safeGetLocalStorage<Customer[]>(`${STORAGE_KEY}_CUSTOMERS`, INITIAL_CUSTOMERS);
    });
    const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
        const list = safeGetLocalStorage<Supplier[]>(`${STORAGE_KEY}_SUPPLIERS`, INITIAL_SUPPLIERS);
        return list.map((s: any) => ({
            ...s,
            balancePayable: s.balancePayable ?? s.dueAmount ?? 0,
            dueAmount: s.dueAmount ?? s.balancePayable ?? 0,
        }));
    });
    const [invoices, setInvoices] = useState<SalesInvoice[]>(() => {
        const raw = safeGetLocalStorage<SalesInvoice[]>(`${STORAGE_KEY}_INVOICES`, INITIAL_INVOICES);
        return sanitizeSalesInvoices(raw || []);
    });
    const [quotations, setQuotations] = useState<Quotation[]>(() => {
        return safeGetLocalStorage<Quotation[]>(`${STORAGE_KEY}_QUOTATIONS`, INITIAL_QUOTATIONS);
    });
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => {
        const list = safeGetLocalStorage<PurchaseOrder[]>(`${STORAGE_KEY}_PURCHASE_ORDERS`, INITIAL_PURCHASE_ORDERS);
        return list.map((po: any) => {
            const num = po.poNumber || po.poNo || 'DCC-PO';
            const dest = po.destinationLocation || po.destination || 'Factory';
            const total = po.grandTotal ?? po.totalAmount ?? 0;
            return {
                ...po,
                poNo: num,
                poNumber: num,
                destination: dest,
                destinationLocation: dest,
                grandTotal: total,
                totalAmount: total,
                subtotal: po.subtotal ?? total,
                paymentStatus: po.status !== 'Received'
                    ? 'Pending'
                    : (po.paymentStatus && po.paymentStatus !== 'Pending' ? po.paymentStatus : (po.dueAmount <= 0 ? 'Paid' : po.paidAmount > 0 ? 'Partial' : 'Due')),
            };
        });
    });
    const [transactions, setTransactions] = useState<AccountingTransaction[]>(() => {
        const list = safeGetLocalStorage<AccountingTransaction[]>(`${STORAGE_KEY}_TRANSACTIONS`, INITIAL_TRANSACTIONS);
        return ensureUniqueTransactions(list);
    });
    const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => {
        return safeGetLocalStorage<StockMovement[]>(`${STORAGE_KEY}_STOCK_MOVEMENTS`, INITIAL_STOCK_MOVEMENTS);
    });
    const [language, setLanguage] = useState<Language>(() => {
        const saved = localStorage.getItem(`${STORAGE_KEY}_LANG`);
        return 'en';
    });
    const [activeLocation, setActiveLocation] = useState<'All' | 'Factory' | 'Office'>('All');
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
        return safeGetLocalStorage<AuditLogEntry[]>(`${STORAGE_KEY}_AUDIT_LOGS`, INITIAL_AUDIT_LOGS);
    });
    const [staffMembers, setStaffMembers] = useState<StaffMember[]>(() => {
        return safeGetLocalStorage<StaffMember[]>(`${STORAGE_KEY}_STAFF`, INITIAL_STAFF_MEMBERS);
    });
    const [userRoles, setUserRoles] = useState<UserRole[]>(() => {
        const list = safeGetLocalStorage<UserRole[]>(`${STORAGE_KEY}_ROLES`, INITIAL_USER_ROLES);
        return sanitizeUserRoles(list);
    });
    const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>(() => {
        return safeGetLocalStorage<ChartOfAccount[]>(`${STORAGE_KEY}_COA`, INITIAL_CHART_OF_ACCOUNTS);
    });
    const [expenseHeads, setExpenseHeads] = useState<ExpenseHead[]>(() => {
        return safeGetLocalStorage<ExpenseHead[]>(`${STORAGE_KEY}_EXPENSE_HEADS`, INITIAL_EXPENSE_HEADS);
    });
    const [productCategories, setProductCategories] = useState<ProductCategory[]>(() => {
        return safeGetLocalStorage<ProductCategory[]>(`${STORAGE_KEY}_CATEGORIES`, INITIAL_PRODUCT_CATEGORIES);
    });
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(() => {
        return safeGetLocalStorage<JournalEntry[]>(`${STORAGE_KEY}_JOURNALS`, INITIAL_JOURNAL_ENTRIES);
    });
    const [projects, setProjects] = useState<Project[]>(() => {
        return safeGetLocalStorage<Project[]>(`${STORAGE_KEY}_PROJECTS`, INITIAL_PROJECTS);
    });
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>(() => {
        const saved = safeGetLocalStorage<PaymentMethodConfig[]>(`${STORAGE_KEY}_PAYMENT_METHODS`, INITIAL_PAYMENT_METHODS);
        if (Array.isArray(saved) && saved.length > 0) {
            // Only auto-seed default methods if user was stuck on legacy single-cash default
            if (saved.length === 1 && saved[0].type === 'cash') {
                const existingNames = new Set(saved.map((p) => p.name.toLowerCase().trim()));
                const missing = INITIAL_PAYMENT_METHODS.filter((p) => !existingNames.has(p.name.toLowerCase().trim()));
                if (missing.length > 0) {
                    const merged = [...saved, ...missing];
                    try {
                        localStorage.setItem(`${STORAGE_KEY}_PAYMENT_METHODS`, JSON.stringify(merged));
                    } catch { }
                    return merged;
                }
            }
            return saved;
        }
        return INITIAL_PAYMENT_METHODS;
    });
    const [activeStaff, setActiveStaff] = useState<StaffMember>(() => {
        try {
            const saved = localStorage.getItem(`${STORAGE_KEY}_ACTIVE_STAFF`);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && parsed.id && parsed.name) {
                    const savedStaff = safeGetLocalStorage<StaffMember[]>(`${STORAGE_KEY}_STAFF`, []);
                    const matched = savedStaff.find((s) => s.id === parsed.id);
                    return matched || parsed;
                }
            }
        }
        catch { }
        const defaultStaffList = safeGetLocalStorage<StaffMember[]>(`${STORAGE_KEY}_STAFF`, []);
        return defaultStaffList[0] || {
            id: 'staff-01',
            name: 'Javed Reza',
            nameBn: '',
            role: 'Managing Director' as StaffRole,
            roleBn: '',
            location: 'Both',
            phone: '01730-581687',
            avatarColor: 'bg-purple-600',
            password: '240777',
            customRoleId: 'role-md',
            isActive: true,
        };
    });
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
        const saved = localStorage.getItem(`${STORAGE_KEY}_IS_AUTHENTICATED`);
        return saved === 'true';
    });

    // Cloud synchronization refs and helpers
    const latestStateRef = useRef<any>({
        profile,
        products,
        customers,
        suppliers,
        invoices,
        quotations,
        purchaseOrders,
        transactions,
        stockMovements,
        auditLogs,
        staffMembers,
        userRoles,
        chartOfAccounts,
        expenseHeads,
        productCategories,
        journalEntries,
        projects,
        paymentMethods,
    });
    // Keep latestStateRef updated on every render
    latestStateRef.current = {
        profile,
        products,
        customers,
        suppliers,
        invoices,
        quotations,
        purchaseOrders,
        transactions,
        stockMovements,
        auditLogs,
        staffMembers,
        userRoles,
        chartOfAccounts,
        expenseHeads,
        productCategories,
        journalEntries,
        projects,
        paymentMethods,
    };

    const isCloudLoadedRef = useRef(false);
    const isImportingRef = useRef(false);
    const isSyncingRef = useRef(false);
    const lastServerUpdatedAtRef = useRef(0);
    const syncTimeoutRef = useRef<any>(null);
    const pushToCloudRef = useRef<() => Promise<void>>(() => Promise.resolve());
    const tabIdRef = useRef<string>(`tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
    const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
    const isFirstMountRef = useRef(true);

    const broadcastCrossTabSync = () => {
        if (isImportingRef.current) return;
        try {
            broadcastChannelRef.current?.postMessage({
                type: 'CROSS_TAB_STATE_UPDATE',
                senderTabId: tabIdRef.current,
                timestamp: Date.now(),
            });
        } catch {}
    };

    const triggerImmediatePush = () => {
        if (isImportingRef.current) return;
        broadcastCrossTabSync();
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
            if (pushToCloudRef.current) {
                pushToCloudRef.current();
            }
        }, 150);
    };

    const reloadAllStateFromStorage = () => {
        try {
            isImportingRef.current = true;
            const rawInvs = localStorage.getItem(`${STORAGE_KEY}_INVOICES`);
            if (rawInvs) setInvoices(sanitizeSalesInvoices(JSON.parse(rawInvs)));

            const rawTxs = localStorage.getItem(`${STORAGE_KEY}_TRANSACTIONS`);
            if (rawTxs) setTransactions(JSON.parse(rawTxs));

            const rawProjs = localStorage.getItem(`${STORAGE_KEY}_PROJECTS`);
            if (rawProjs) setProjects(JSON.parse(rawProjs));

            const rawPos = localStorage.getItem(`${STORAGE_KEY}_PURCHASE_ORDERS`);
            if (rawPos) setPurchaseOrders(JSON.parse(rawPos));

            const rawProds = localStorage.getItem(`${STORAGE_KEY}_PRODUCTS`);
            if (rawProds) setProducts(JSON.parse(rawProds));

            const rawCusts = localStorage.getItem(`${STORAGE_KEY}_CUSTOMERS`);
            if (rawCusts) setCustomers(JSON.parse(rawCusts));

            const rawSupps = localStorage.getItem(`${STORAGE_KEY}_SUPPLIERS`);
            if (rawSupps) setSuppliers(JSON.parse(rawSupps));

            const rawCoa = localStorage.getItem(`${STORAGE_KEY}_COA`);
            if (rawCoa) setChartOfAccounts(JSON.parse(rawCoa));

            const rawExp = localStorage.getItem(`${STORAGE_KEY}_EXPENSE_HEADS`);
            if (rawExp) setExpenseHeads(JSON.parse(rawExp));

            const rawJournals = localStorage.getItem(`${STORAGE_KEY}_JOURNALS`);
            if (rawJournals) setJournalEntries(JSON.parse(rawJournals));

            const rawQuotes = localStorage.getItem(`${STORAGE_KEY}_QUOTATIONS`);
            if (rawQuotes) setQuotations(JSON.parse(rawQuotes));

            const rawStocks = localStorage.getItem(`${STORAGE_KEY}_STOCK_MOVEMENTS`);
            if (rawStocks) setStockMovements(JSON.parse(rawStocks));

            const rawStaff = localStorage.getItem(`${STORAGE_KEY}_STAFF`);
            if (rawStaff) setStaffMembers(JSON.parse(rawStaff));

            const rawRoles = localStorage.getItem(`${STORAGE_KEY}_ROLES`);
            if (rawRoles) setUserRoles(JSON.parse(rawRoles));

            const rawCats = localStorage.getItem(`${STORAGE_KEY}_CATEGORIES`);
            if (rawCats) setProductCategories(JSON.parse(rawCats));

            const rawPm = localStorage.getItem(`${STORAGE_KEY}_PAYMENT_METHODS`);
            if (rawPm) setPaymentMethods(JSON.parse(rawPm));

            const rawProfile = localStorage.getItem(`${STORAGE_KEY}_PROFILE`);
            if (rawProfile) setProfile(JSON.parse(rawProfile));

            setTimeout(() => {
                isImportingRef.current = false;
            }, 300);
        } catch (e) {
            console.error('reloadAllStateFromStorage error', e);
            isImportingRef.current = false;
        }
    };

    // Cross-Tab instant synchronization (BroadcastChannel + storage event fallback)
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let channel: BroadcastChannel | null = null;
        try {
            channel = new BroadcastChannel('dotcolor_erp_cross_tab_sync');
            broadcastChannelRef.current = channel;

            channel.onmessage = (event) => {
                const data = event.data;
                if (!data || data.senderTabId === tabIdRef.current) return;
                if (data.type === 'CROSS_TAB_STATE_UPDATE') {
                    reloadAllStateFromStorage();
                }
            };
        } catch (e) {
            console.warn('BroadcastChannel fallback to storage event', e);
        }

        const handleStorage = (e: StorageEvent) => {
            if (e.key && e.key.startsWith(STORAGE_KEY)) {
                reloadAllStateFromStorage();
            }
        };

        window.addEventListener('storage', handleStorage);

        return () => {
            if (channel) channel.close();
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    // Sync to LocalStorage
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_PROFILE`, JSON.stringify(profile));
    }, [profile]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_PRODUCTS`, JSON.stringify(products));
    }, [products]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_CUSTOMERS`, JSON.stringify(customers));
    }, [customers]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_SUPPLIERS`, JSON.stringify(suppliers));
    }, [suppliers]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_INVOICES`, JSON.stringify(invoices));
    }, [invoices]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_QUOTATIONS`, JSON.stringify(quotations));
    }, [quotations]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_PURCHASE_ORDERS`, JSON.stringify(purchaseOrders));
    }, [purchaseOrders]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_TRANSACTIONS`, JSON.stringify(transactions));
    }, [transactions]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_STOCK_MOVEMENTS`, JSON.stringify(stockMovements));
    }, [stockMovements]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_LANG`, language);
    }, [language]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_AUDIT_LOGS`, JSON.stringify(auditLogs));
    }, [auditLogs]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_STAFF`, JSON.stringify(staffMembers));
    }, [staffMembers]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_ROLES`, JSON.stringify(userRoles));
    }, [userRoles]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_COA`, JSON.stringify(chartOfAccounts));
    }, [chartOfAccounts]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_EXPENSE_HEADS`, JSON.stringify(expenseHeads));
    }, [expenseHeads]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_CATEGORIES`, JSON.stringify(productCategories));
    }, [productCategories]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_JOURNALS`, JSON.stringify(journalEntries));
    }, [journalEntries]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_PROJECTS`, JSON.stringify(projects));
    }, [projects]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_PAYMENT_METHODS`, JSON.stringify(paymentMethods));
    }, [paymentMethods]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_ACTIVE_STAFF`, JSON.stringify(activeStaff));
    }, [activeStaff]);
    // Keep activeStaff synchronized whenever staffMembers list changes (e.g. from Cloud sync or edit)
    useEffect(() => {
        if (activeStaff?.id && staffMembers && staffMembers.length > 0) {
            const current = staffMembers.find((s) => s.id === activeStaff.id);
            if (current) {
                if (current.name !== activeStaff.name ||
                    current.nameBn !== activeStaff.nameBn ||
                    current.role !== activeStaff.role ||
                    current.roleBn !== activeStaff.roleBn ||
                    current.avatarColor !== activeStaff.avatarColor ||
                    current.password !== activeStaff.password ||
                    current.phone !== activeStaff.phone ||
                    current.email !== activeStaff.email ||
                    current.location !== activeStaff.location ||
                    current.isActive !== activeStaff.isActive) {
                    setActiveStaff(current);
                }
            }
        }
    }, [staffMembers, activeStaff?.id]);
    useEffect(() => {
        localStorage.setItem(`${STORAGE_KEY}_IS_AUTHENTICATED`, String(isAuthenticated));
    }, [isAuthenticated]);
    // Real-time synchronization across multiple open browser tabs
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (!e.key || !e.newValue)
                return;
            try {
                if (e.key === `${STORAGE_KEY}_STAFF`) {
                    const parsed = JSON.parse(e.newValue);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setStaffMembers(parsed);
                    }
                }
                else if (e.key === `${STORAGE_KEY}_PAYMENT_METHODS`) {
                    const parsed = JSON.parse(e.newValue);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setPaymentMethods(parsed);
                    }
                }
                else if (e.key === `${STORAGE_KEY}_ROLES`) {
                    const parsed = JSON.parse(e.newValue);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setUserRoles(sanitizeUserRoles(parsed));
                    }
                }
                else if (e.key === `${STORAGE_KEY}_SUPPLIERS`) {
                    const parsed = JSON.parse(e.newValue);
                    if (Array.isArray(parsed)) {
                        setSuppliers(parsed);
                    }
                }
                else if (e.key === `${STORAGE_KEY}_CUSTOMERS`) {
                    const parsed = JSON.parse(e.newValue);
                    if (Array.isArray(parsed)) {
                        setCustomers(parsed);
                    }
                }
                else if (e.key === `${STORAGE_KEY}_PRODUCTS`) {
                    const parsed = JSON.parse(e.newValue);
                    if (Array.isArray(parsed)) {
                        setProducts(parsed);
                    }
                }
                else if (e.key === `${STORAGE_KEY}_PURCHASE_ORDERS`) {
                    const parsed = JSON.parse(e.newValue);
                    if (Array.isArray(parsed)) {
                        setPurchaseOrders(parsed);
                    }
                }
                else if (e.key === `${STORAGE_KEY}_INVOICES`) {
                    const parsed = JSON.parse(e.newValue);
                    if (Array.isArray(parsed)) {
                        setInvoices(parsed);
                    }
                }
                else if (e.key === `${STORAGE_KEY}_CATEGORIES`) {
                    const parsed = JSON.parse(e.newValue);
                    if (Array.isArray(parsed)) {
                        setProductCategories(parsed);
                    }
                }
            }
            catch { }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Automatic real-time dynamic reconciliation between Projects and Chart of Accounts
    useEffect(() => {
        if (!chartOfAccounts || chartOfAccounts.length === 0) return;

        const totalPrjSales = (projects || []).reduce((s, p) => s + (p.totalSales || 0), 0);
        const totalPrjExpenses = (projects || []).reduce((s, p) => s + (p.totalExpenses || 0), 0);

        let revAcc = chartOfAccounts.find(a => a.classification === 'Revenue' && (a.code === '4002' || a.code === '4051' || a.code === '4060' || a.id === 'coa-4002' || a.id === 'coa-4051' || a.name.toLowerCase().includes('project')));
        let expAcc = chartOfAccounts.find(a => a.classification === 'Expense' && (a.code === '5206' || a.code === '5300' || a.id === 'coa-5206' || a.name.toLowerCase().includes('project'))) ||
                       chartOfAccounts.find(a => a.classification === 'Expense' && a.code === '5100' && a.name.toLowerCase().includes('project'));
        const cogsAcc = chartOfAccounts.find(a => a.classification === 'Expense' && (a.code === '5010' || a.name.toLowerCase().includes('raw') || a.name.toLowerCase().includes('cost')));

        // Auto-provision 5206 Project Expense if missing from Chart of Accounts
        if (!expAcc) {
            const newExpAcc: ChartOfAccount = {
                id: 'coa-5206',
                code: '5206',
                name: 'Project Expense',
                nameBn: 'প্রজেক্ট খরচ',
                classification: 'Expense',
                accountGroup: 'Operating Expenses',
                normalBalance: 'Debit',
                openingBalance: 0,
                currentBalance: totalPrjExpenses,
                description: 'Direct expenditures, venue execution, logistics, transport, and site installation for customer projects',
                isSystem: true,
                isActive: true,
            };
            const withExp = [...chartOfAccounts, newExpAcc];
            setChartOfAccounts(withExp);
            try {
                localStorage.setItem(`${STORAGE_KEY}_COA`, JSON.stringify(withExp));
            } catch {}
            latestStateRef.current = { ...latestStateRef.current, chartOfAccounts: withExp };
            triggerImmediatePush();
            return;
        }

        // Auto-provision 4002 Project Sales if missing from Chart of Accounts
        if (!revAcc) {
            const newRevAcc: ChartOfAccount = {
                id: 'coa-4002',
                code: '4002',
                name: 'Project Sales',
                nameBn: 'প্রজেক্ট সেলস',
                classification: 'Revenue',
                accountGroup: 'Operating Revenue',
                normalBalance: 'Credit',
                openingBalance: 0,
                currentBalance: totalPrjSales,
                description: 'Revenue from large-scale corporate projects, outdoor signboards, and event fabrications',
                isSystem: true,
                isActive: true,
            };
            const withRev = [...chartOfAccounts, newRevAcc];
            setChartOfAccounts(withRev);
            try {
                localStorage.setItem(`${STORAGE_KEY}_COA`, JSON.stringify(withRev));
            } catch {}
            latestStateRef.current = { ...latestStateRef.current, chartOfAccounts: withRev };
            triggerImmediatePush();
            return;
        }

        let coaNeedsUpdate = false;
        const updatedCOA = chartOfAccounts.map(acc => {
            // 1. Dedicated Project Expense Account
            const isProjectExp = (expAcc && acc.id === expAcc.id) || acc.code === '5206' || acc.code === '5300' || acc.id === 'coa-5206' || acc.name.toLowerCase().trim() === 'project expense';
            if (isProjectExp) {
                const targetExpBal = (acc.openingBalance || 0) + totalPrjExpenses;
                if (acc.currentBalance !== targetExpBal) {
                    coaNeedsUpdate = true;
                    return { ...acc, currentBalance: targetExpBal };
                }
                return acc;
            }
            // 2. Cost of Goods Sold Account (5001 / 5010)
            const isCogsAcc = acc.classification === 'Expense' && (
                (cogsAcc && acc.id === cogsAcc.id) ||
                acc.code === '5001' ||
                acc.code === '5010' ||
                acc.id === 'coa-5001' ||
                acc.id === 'coa-5010' ||
                acc.name.toLowerCase().includes('cost of goods') ||
                acc.name.toLowerCase().includes('cogs') ||
                (acc.name.toLowerCase().includes('raw material') && acc.classification === 'Expense') ||
                acc.nameBn?.includes('বিক্রিত পণ্যের ব্যয়')
            );
            if (isCogsAcc) {
                let currentBase = acc.currentBalance;
                if (totalPrjExpenses > 0 && expAcc && currentBase >= totalPrjExpenses && expAcc.currentBalance < totalPrjExpenses) {
                    currentBase = Math.max(acc.openingBalance || 0, currentBase - totalPrjExpenses);
                }

                const poExpenses = (transactions || [])
                    .filter(t => t.type === 'EXPENSE' && (
                        (t.category && (t.category.toLowerCase().includes('raw') || t.category.toLowerCase().includes('purchase') || t.category.toLowerCase().includes('po'))) ||
                        (t.description && (t.description.toLowerCase().includes('purchase') || t.description.toLowerCase().includes('po') || t.description.toLowerCase().includes('raw')))
                    ))
                    .reduce((s, t) => s + t.amount, 0);

                let journalCogsDelta = 0;
                (journalEntries || []).forEach(j => {
                    if (j.source === 'PROJECT_SALES' || j.source === 'PROJECT_EXPENSE') return;
                    const dName = (j.debitAccountName || '').toLowerCase().trim();
                    const cName = (j.creditAccountName || '').toLowerCase().trim();
                    const isDebit = Boolean(
                        j.debitAccountId === acc.id ||
                        j.debitAccountId === acc.code ||
                        dName === acc.name.toLowerCase().trim() ||
                        dName.includes('cost of goods') ||
                        dName.includes('cogs') ||
                        (dName.includes('raw material') && (dName.includes('cost') || dName.includes('sold') || dName.includes('expense'))) ||
                        dName.includes('বিক্রিত পণ্যের ব্যয়')
                    );
                    const isCredit = Boolean(
                        j.creditAccountId === acc.id ||
                        j.creditAccountId === acc.code ||
                        cName === acc.name.toLowerCase().trim() ||
                        cName.includes('cost of goods') ||
                        cName.includes('cogs') ||
                        (cName.includes('raw material') && (cName.includes('cost') || cName.includes('sold') || cName.includes('expense'))) ||
                        cName.includes('বিক্রিত পণ্যের ব্যয়')
                    );
                    if (isDebit && !isCredit) journalCogsDelta += (Number(j.amount) || 0);
                    else if (isCredit && !isDebit) journalCogsDelta -= (Number(j.amount) || 0);
                });

                const targetCogsBal = Math.max(currentBase, poExpenses, (acc.openingBalance || 0) + journalCogsDelta);
                if (acc.currentBalance !== targetCogsBal) {
                    coaNeedsUpdate = true;
                    return { ...acc, currentBalance: targetCogsBal };
                }
                return acc;
            }
            // 3. Fix: If any non-project expense account (like 5100 or 5201 Staff Salaries) wrongly had totalPrjExpenses assigned, revert it:
            if (acc.classification === 'Expense' && !isProjectExp && !acc.name.toLowerCase().includes('project')) {
                if (totalPrjExpenses > 0 && acc.currentBalance === totalPrjExpenses) {
                    coaNeedsUpdate = true;
                    return { ...acc, currentBalance: acc.openingBalance || 0 };
                }
            }
            // 4. Dedicated Project Revenue Account (4002 / 4051 Project Sales)
            const isProjectRev = acc.classification === 'Revenue' && (
                (revAcc && acc.id === revAcc.id) || 
                acc.code === '4002' || 
                acc.code === '4051' || 
                acc.code === '4060' ||
                acc.id === 'coa-4002' ||
                acc.id === 'coa-4051' ||
                acc.name.toLowerCase().includes('project') ||
                acc.nameBn?.includes('প্রজেক্ট')
            );
            if (isProjectRev) {
                const targetRevBal = (acc.openingBalance || 0) + totalPrjSales;
                if (acc.currentBalance !== targetRevBal) {
                    coaNeedsUpdate = true;
                    return { ...acc, currentBalance: targetRevBal };
                }
                return acc;
            }
            // 5. Dedicated Customer Accounts Receivable Account (1003 / 1050 / Accounts Receivable - Customers)
            const isCustomerReceivable = acc.classification === 'Asset' && (
                acc.id === 'coa-1050' ||
                acc.code === '1003' ||
                acc.code === '1050' ||
                (acc.name.toLowerCase().includes('customer') && acc.name.toLowerCase().includes('receivable')) ||
                acc.name.toLowerCase().includes('trade debtor') ||
                acc.nameBn?.includes('কাস্টমার বকেয়া') ||
                acc.nameBn?.includes('প্রাপ্য হিসাব') ||
                (acc.name.toLowerCase().includes('receivable') && !acc.name.toLowerCase().includes('aggregator') && !acc.name.toLowerCase().includes('staff'))
            );
            if (isCustomerReceivable) {
                const totalCustomerDue = calculateTotalCustomerReceivables(invoices, customers, projects);
                const targetReceivableBal = totalCustomerDue > 0 ? totalCustomerDue : (acc.openingBalance || 0);
                if (acc.currentBalance !== targetReceivableBal) {
                    coaNeedsUpdate = true;
                    return { ...acc, currentBalance: targetReceivableBal };
                }
                return acc;
            }

            // 5b. Dedicated Inventory & Raw Materials Asset Account (1002 / 1060 / 1070 / coa-1060 / coa-1070)
            const isInventory = acc.classification === 'Asset' && (
                acc.id === 'coa-1060' ||
                acc.id === 'coa-1070' ||
                acc.code === '1002' ||
                acc.code === '1060' ||
                acc.code === '1070' ||
                acc.name.toLowerCase().includes('raw material') ||
                acc.name.toLowerCase().includes('inventory') ||
                acc.name.toLowerCase().includes('finished goods') ||
                acc.name.toLowerCase().includes('stock') ||
                acc.nameBn?.includes('কাঁচামাল') ||
                acc.nameBn?.includes('ইনভেন্টরি')
            );
            if (isInventory) {
                const targetInventoryBal = calculateInventoryValuation(products, purchaseOrders, acc, journalEntries);
                if (acc.currentBalance !== targetInventoryBal) {
                    coaNeedsUpdate = true;
                    return { ...acc, currentBalance: targetInventoryBal };
                }
                return acc;
            }

            // 4. Dedicated Accounts Payable (Suppliers) Account (2001 / 2010 / coa-2010)
            const isPayable = acc.classification === 'Liability' && (
                acc.code === '2001' ||
                acc.code === '2010' ||
                acc.id === 'coa-2010' ||
                (acc.name.toLowerCase().includes('payable') && acc.name.toLowerCase().includes('supplier')) ||
                acc.name.toLowerCase().includes('accounts payable') ||
                acc.nameBn?.includes('সাপ্লায়ার দেনা') ||
                acc.nameBn?.includes('প্রদেয় হিসাব')
            );
            if (isPayable) {
                const totalSupplierDue = calculateTotalSupplierPayables(suppliers, purchaseOrders);
                const targetPayableBal = totalSupplierDue > 0 ? totalSupplierDue : (acc.openingBalance || 0);
                if (acc.currentBalance !== targetPayableBal) {
                    coaNeedsUpdate = true;
                    return { ...acc, currentBalance: targetPayableBal };
                }
                return acc;
            }

            // 5. Sales Revenue Account (4001 / General Invoices) - strictly exclude Project Revenue
            const isSalesRevenue = !isProjectRev && acc.classification === 'Revenue' && (
                acc.code === '4001' ||
                acc.code === '4010' ||
                acc.id === 'coa-4001' ||
                acc.name.toLowerCase().includes('sales revenue') ||
                acc.name.toLowerCase().trim() === 'sales' ||
                acc.nameBn?.includes('বিক্রয়') ||
                acc.nameBn?.includes('বিক্রয়')
            );
            if (isSalesRevenue) {
                const projectLinkedInvoiceNos = new Set([
                    ...(projects || []).map(p => (p.invoiceNo || '').toLowerCase().trim()).filter(Boolean),
                    ...(projects || []).flatMap(p => (p.salesItems || []).map(s => (s.invoiceNo || '').toLowerCase().trim())).filter(Boolean),
                    ...(invoices || []).filter(inv => inv.projectId || inv.projectCode).map(inv => (inv.invoiceNo || '').toLowerCase().trim()).filter(Boolean),
                ]);
                const projectLinkedInvoiceIds = new Set([
                    ...(projects || []).map(p => p.invoiceId).filter(Boolean) as string[],
                    ...(invoices || []).filter(inv => inv.projectId || inv.projectCode).map(inv => inv.id).filter(Boolean) as string[],
                ]);
                const nonPrjInvoices = (invoices || []).filter(inv => {
                    const invNo = (inv.invoiceNo || '').toLowerCase().trim();
                    const isLinked = Boolean(
                        inv.projectId ||
                        inv.projectCode ||
                        projectLinkedInvoiceIds.has(inv.id) ||
                        (invNo && projectLinkedInvoiceNos.has(invNo))
                    );
                    return !isLinked;
                });
                const totalInvoiceSales = nonPrjInvoices.reduce((s, inv) => s + (Number(inv.grandTotal) || (Number(inv.paidAmount) + Number(inv.dueAmount)) || 0), 0);
                const invoiceSalesFromTx = (transactions || []).filter(t => 
                    t.type === 'INCOME' && 
                    isInvoiceTransaction(t) && 
                    !isProjectTransaction(t) && 
                    !isProjectDueCollectionTransaction(t) && 
                    !(t.category || '').toLowerCase().includes('project') && 
                    !projectLinkedInvoiceNos.has((t.refNo || '').toLowerCase().trim()) && 
                    !(t.refNo || '').toUpperCase().startsWith('COL-') && 
                    !(t.refNo || '').toUpperCase().startsWith('PRJ-')
                ).reduce((s, t) => s + t.amount, 0);
                const effectiveInvoiceSales = Math.max(totalInvoiceSales, invoiceSalesFromTx);
                const directSalesRevenue = (transactions || []).filter(t => 
                    t.type === 'INCOME' && 
                    !isInvoiceTransaction(t) && 
                    !isProjectTransaction(t) && 
                    !isProjectDueCollectionTransaction(t) && 
                    !(t.category || '').toLowerCase().includes('project') && 
                    !isAdvanceDepositTransaction(t) && 
                    !isAdvanceAdjustmentTransaction(t) && 
                    !(t.refNo || '').toUpperCase().startsWith('COL-') && 
                    !(t.refNo || '').toUpperCase().startsWith('PRJ-') && (
                        (t.category && (
                            t.category.toLowerCase().includes('sales') ||
                            t.category.toLowerCase().includes('বিক্রয়') ||
                            t.category.toLowerCase().includes('বিক্রয়')
                        )) ||
                        t.refNo?.startsWith('INC-')
                    )
                ).reduce((s, t) => s + t.amount, 0);
                const targetSalesBal = (acc.openingBalance || 0) + effectiveInvoiceSales + directSalesRevenue;
                if (acc.currentBalance !== targetSalesBal) {
                    coaNeedsUpdate = true;
                    return { ...acc, currentBalance: targetSalesBal };
                }
                return acc;
            }

            // 6. Customer Advance Liability (2020 / 2002 / coa-2020)
            const isAdvanceLiability = acc.classification === 'Liability' && (
                acc.code === '2020' ||
                acc.code === '2002' ||
                acc.id === 'coa-2020' ||
                acc.name.toLowerCase().includes('advance') ||
                acc.name.toLowerCase().includes('deposit') ||
                acc.nameBn?.includes('অগ্রিম')
            );
            if (isAdvanceLiability) {
                const matchingAdvance = (transactions || []).filter(t => t.type === 'INCOME' && !isInvoiceTransaction(t) && (
                    t.category?.toLowerCase().includes('advance') ||
                    t.category?.toLowerCase().includes('অগ্রিম') ||
                    t.description?.toLowerCase().includes('advance') ||
                    t.description?.toLowerCase().includes('অগ্রিম')
                )).reduce((s, t) => s + t.amount, 0);

                const matchingAdvanceAdjusted = (transactions || []).filter(t => (
                    t.category?.toLowerCase().includes('advance adjust') ||
                    t.category?.toLowerCase().includes('অগ্রিম সমন্বয়') ||
                    t.category?.toLowerCase().includes('advance adjustment') ||
                    t.description?.toLowerCase().includes('advance adjust') ||
                    t.description?.toLowerCase().includes('adjusted from advance') ||
                    t.description?.toLowerCase().includes('advance adjustment')
                )).reduce((s, t) => s + t.amount, 0);

                const netMatchingAdvance = Math.max(0, (acc.openingBalance || 0) + matchingAdvance - matchingAdvanceAdjusted);
                const totalCustomerAdvance = (customers || []).reduce((s, c) => s + (Number(c.advanceBalance) || 0), 0);
                const targetAdvanceBal = totalCustomerAdvance > 0 
                    ? totalCustomerAdvance 
                    : netMatchingAdvance;

                if (acc.currentBalance !== targetAdvanceBal) {
                    coaNeedsUpdate = true;
                    return { ...acc, currentBalance: targetAdvanceBal };
                }
            }

            // 6. Any other dynamic User-created Revenue Account
            const isOtherRevenue = acc.classification === 'Revenue' && !isSalesRevenue && !isProjectRev;
            if (isOtherRevenue) {
                const accNameLower = (acc.name || '').toLowerCase();
                const accNameBn = (acc.nameBn || '').toLowerCase();
                const matchingDirect = (transactions || []).filter(t => 
                    t.type === 'INCOME' && 
                    !isInvoiceTransaction(t) && 
                    !isProjectTransaction(t) && 
                    !isProjectDueCollectionTransaction(t) && 
                    !(t.category || '').toLowerCase().includes('project') && 
                    !(t.refNo || '').toUpperCase().startsWith('COL-') && 
                    !(t.refNo || '').toUpperCase().startsWith('PRJ-') && 
                    !isAdvanceDepositTransaction(t) && 
                    !isAdvanceAdjustmentTransaction(t) && (
                        (t.category && (
                            accNameLower.includes(t.category.toLowerCase()) ||
                            t.category.toLowerCase().includes(accNameLower) ||
                            (accNameBn && t.category.toLowerCase().includes(accNameBn)) ||
                            (accNameBn && accNameBn.includes(t.category.toLowerCase()))
                        )) ||
                        (t.accountHead && (
                            accNameLower.includes(t.accountHead.toLowerCase()) ||
                            t.accountHead.toLowerCase().includes(accNameLower)
                        ))
                    )
                ).reduce((s, t) => s + t.amount, 0);
                const targetBal = (acc.openingBalance || 0) + matchingDirect;
                if (matchingDirect > 0 && acc.currentBalance !== targetBal) {
                    coaNeedsUpdate = true;
                    return { ...acc, currentBalance: targetBal };
                }
            }
            return acc;
        });

        if (coaNeedsUpdate) {
            setChartOfAccounts(updatedCOA);
            try {
                localStorage.setItem(`${STORAGE_KEY}_COA`, JSON.stringify(updatedCOA));
            } catch {}
            latestStateRef.current = {
                ...latestStateRef.current,
                chartOfAccounts: updatedCOA,
            };
            triggerImmediatePush();
        }

        // Repair project expense journal vouchers pointing to 5010 instead of 5100
        if (expAcc) {
            let journalsUpdated = false;
            const updatedJournals = journalEntries.map(j => {
                if (j.source === 'PROJECT_EXPENSE' && j.debitAccountId !== expAcc.id) {
                    journalsUpdated = true;
                    return { ...j, debitAccountId: expAcc.id, debitAccountName: expAcc.name };
                }
                if (j.source === 'PROJECT_SALES' && revAcc && j.creditAccountId !== revAcc.id) {
                    journalsUpdated = true;
                    return { ...j, creditAccountId: revAcc.id, creditAccountName: revAcc.name };
                }
                return j;
            });
            if (journalsUpdated) {
                setJournalEntries(updatedJournals);
            }

            let txsUpdated = false;
            const updatedTxs = transactions.map(t => {
                if (t.type === 'EXPENSE' && t.refNo && (projects || []).some(p => p.code === t.refNo) && t.accountHead !== expAcc.name) {
                    txsUpdated = true;
                    return { ...t, accountHead: expAcc.name };
                }
                if (t.type === 'INCOME' && revAcc && (t.category?.toLowerCase().includes('project') || (t.refNo && (projects || []).some(p => p.code === t.refNo))) && t.accountHead !== revAcc.name) {
                    txsUpdated = true;
                    return { ...t, accountHead: revAcc.name };
                }
                return t;
            });
            if (txsUpdated) {
                setTransactions(updatedTxs);
            }
        }

        // Sanitize orphaned supplier totalPurchased when purchase orders are empty
        if ((purchaseOrders || []).length === 0 && (suppliers || []).some(s => (s.totalPurchased || 0) > 0)) {
            const cleanedSuppliers = (suppliers || []).map(s => ({ ...s, totalPurchased: 0 }));
            setSuppliers(cleanedSuppliers);
            try {
                localStorage.setItem(`${STORAGE_KEY}_SUPPLIERS`, JSON.stringify(cleanedSuppliers));
            } catch {}
            latestStateRef.current = {
                ...latestStateRef.current,
                suppliers: cleanedSuppliers,
            };
        }
    }, [projects, chartOfAccounts, invoices, customers, purchaseOrders, suppliers, products, journalEntries, transactions]);

    // Automatic reconciliation of Customer totalPurchased and dueAmount from live Sales Invoices
    useEffect(() => {
        if (!customers || customers.length === 0 || !invoices) return;

        let custsChanged = false;
        const claimedInvoiceIds = new Set<string>();

        const reconciled = customers.map(c => {
            const clientInvoices = invoices.filter(inv => {
                if (claimedInvoiceIds.has(inv.id)) return false;
                return isInvoiceMatchingCustomer(inv, c);
            });

            if (clientInvoices.length > 0) {
                clientInvoices.forEach(inv => claimedInvoiceIds.add(inv.id));
                const totalPurchased = clientInvoices.reduce((s, inv) => s + (Number(inv.grandTotal) || 0), 0);
                const dueAmount = clientInvoices.reduce((s, inv) => s + (Number(inv.dueAmount) || 0), 0);

                if (Number(c.totalPurchased) !== totalPurchased || Number(c.dueAmount) !== dueAmount) {
                    custsChanged = true;
                    return { ...c, totalPurchased, dueAmount };
                }
            } else if (invoices.length > 0 && (Number(c.dueAmount) > 0 || Number(c.totalPurchased) > 0)) {
                // If customer has no directly claimed invoices, but duplicate matching invoices exist that were claimed by their primary profile,
                // zero out the duplicate's due so the duplicate doesn't hold ghost dues
                const isDuplicateOfInvoiceCustomer = invoices.some(inv => isInvoiceMatchingCustomer(inv, c));
                if (isDuplicateOfInvoiceCustomer) {
                    custsChanged = true;
                    return { ...c, totalPurchased: 0, dueAmount: 0 };
                }
            }
            return c;
        });

        if (custsChanged) {
            setCustomers(reconciled);
            try {
                localStorage.setItem(`${STORAGE_KEY}_CUSTOMERS`, JSON.stringify(reconciled));
            } catch {}
            latestStateRef.current = {
                ...latestStateRef.current,
                customers: reconciled,
            };
            triggerImmediatePush();
        }
    }, [invoices, customers]);

    // Automatic reconciliation of Supplier totalPurchased, dueAmount, and balancePayable from live Purchase Orders
    useEffect(() => {
        if (!suppliers || suppliers.length === 0) return;

        let suppsChanged = false;
        const reconciled = suppliers.map(s => {
            const sId = s.id;
            const sName = (s.name || '').toLowerCase().trim();
            const sCompany = (s.company || '').toLowerCase().trim();
            const sPhone = (s.phone || '').replace(/\D/g, '');

            const pos = (purchaseOrders || []).filter(p => {
                const pSuppId = p.supplierId || '';
                const pSuppName = (p.supplierName || '').toLowerCase().trim();
                const pSuppPhone = (p.supplierPhone || '').replace(/\D/g, '');
                return (
                    (sId && pSuppId === sId) ||
                    (sName && pSuppName === sName) ||
                    (sName && pSuppName && (pSuppName.includes(sName) || sName.includes(pSuppName))) ||
                    (sCompany && pSuppName === sCompany) ||
                    (sCompany && pSuppName && (pSuppName.includes(sCompany) || sCompany.includes(pSuppName))) ||
                    (sPhone && pSuppPhone && sPhone === pSuppPhone)
                );
            });

            if (pos.length > 0) {
                const receivedPOs = pos.filter(p => p.status === 'Received');
                const totalPurchased = pos.reduce((sum, p) => sum + (Number(p.grandTotal ?? p.totalAmount) || 0), 0);
                const recDue = receivedPOs.reduce((acc, p) => acc + (
                    p.dueAmount !== undefined
                        ? Number(p.dueAmount)
                        : Math.max(0, (Number(p.grandTotal ?? p.totalAmount ?? 0)) - (Number(p.paidAmount || 0)))
                ), 0);

                if (Number(s.totalPurchased) !== totalPurchased || Number(s.dueAmount) !== recDue || Number(s.balancePayable) !== recDue) {
                    suppsChanged = true;
                    return { ...s, totalPurchased, dueAmount: recDue, balancePayable: recDue };
                }
            } else if ((purchaseOrders || []).length > 0) {
                if (Number(s.totalPurchased) !== 0 || Number(s.dueAmount) !== 0 || Number(s.balancePayable) !== 0) {
                    suppsChanged = true;
                    return { ...s, totalPurchased: 0, dueAmount: 0, balancePayable: 0 };
                }
            }
            return s;
        });

        if (suppsChanged) {
            setSuppliers(reconciled);
            try {
                localStorage.setItem(`${STORAGE_KEY}_SUPPLIERS`, JSON.stringify(reconciled));
            } catch {}
            latestStateRef.current = {
                ...latestStateRef.current,
                suppliers: reconciled,
            };
            triggerImmediatePush();
        }
    }, [purchaseOrders, suppliers]);

    // Automatic real-time synchronization between Sales Invoices and Accounting Transactions
    useEffect(() => {
        if (!invoices || invoices.length === 0) return;

        const projectLinkedInvoiceNos = new Set([
            ...(projects || []).map(p => (p.invoiceNo || '').toLowerCase().trim()).filter(Boolean),
            ...(projects || []).flatMap(p => (p.salesItems || []).map(s => (s.invoiceNo || '').toLowerCase().trim())).filter(Boolean),
            ...(invoices || []).filter(inv => inv.projectId || inv.projectCode).map(inv => (inv.invoiceNo || '').toLowerCase().trim()).filter(Boolean),
        ]);
        const projectLinkedInvoiceIds = new Set([
            ...(projects || []).map(p => p.invoiceId).filter(Boolean) as string[],
            ...(invoices || []).filter(inv => inv.projectId || inv.projectCode).map(inv => inv.id).filter(Boolean) as string[],
        ]);

        const isInvLinkedToProject = (inv: SalesInvoice) => {
            const invNo = (inv.invoiceNo || '').toLowerCase().trim();
            return Boolean(
                inv.projectId ||
                inv.projectCode ||
                projectLinkedInvoiceIds.has(inv.id) ||
                (invNo && projectLinkedInvoiceNos.has(invNo))
            );
        };

        // 1. Purge rogue duplicate auto-generated Sales Revenue transactions for project-linked invoices
        if (transactions && transactions.length > 0) {
            const isRogueTx = (t: AccountingTransaction) => {
                const refLower = (t.refNo || '').toLowerCase().trim();
                const descLower = (t.description || '').toLowerCase();
                const idLower = (t.id || '').toLowerCase();
                return t.type === 'INCOME' && t.category === 'Sales Revenue' && (
                    (refLower && projectLinkedInvoiceNos.has(refLower)) ||
                    refLower.startsWith('col-') ||
                    refLower.startsWith('prj-') ||
                    idLower.startsWith('tx-prj-') ||
                    descLower.includes('project due')
                );
            };

            const hasRogueTx = transactions.some(isRogueTx);
            if (hasRogueTx) {
                const cleaned = transactions.filter(t => !isRogueTx(t));
                setTransactions(cleaned);
                try { localStorage.setItem(`${STORAGE_KEY}_TRANSACTIONS`, JSON.stringify(cleaned)); } catch {}
                latestStateRef.current = {
                    ...latestStateRef.current,
                    transactions: cleaned,
                };
            }
        }

        const currentTxs = latestStateRef.current.transactions || transactions || [];
        const recordedRefs = new Set(
            currentTxs
                .filter(t => t.type === 'INCOME' && t.refNo)
                .map(t => (t.refNo || '').toLowerCase().trim())
        );

        const deletedRefs = new Set(
            safeGetLocalStorage<string[]>(`${STORAGE_KEY}_DELETED_TX_REFS`, [])
                .map(r => r.toLowerCase().trim())
        );

        const missingTxs: AccountingTransaction[] = [];
        invoices.forEach(inv => {
            // NEVER generate generic Sales Revenue transactions for invoices linked to projects!
            if (isInvLinkedToProject(inv)) return;

            const ref = (inv.invoiceNo || '').toLowerCase().trim();
            if (!ref || recordedRefs.has(ref) || deletedRefs.has(ref)) return;

            if (inv.splitPayments && Object.keys(inv.splitPayments).length > 0) {
                Object.entries(inv.splitPayments).forEach(([channel, amt]) => {
                    const val = Number(amt) || 0;
                    if (val <= 0 || channel.toLowerCase() === 'due') return;
                    const matchedCoa = matchChannelToAccount(channel, chartOfAccounts, paymentMethods);
                    const acctName = matchedCoa ? matchedCoa.name : channel;
                    missingTxs.push({
                        id: generateUniqueId('tx-auto-inv'),
                        date: inv.date || new Date().toISOString().slice(0, 10),
                        type: 'INCOME',
                        category: 'Sales Revenue',
                        amount: val,
                        paymentAccount: acctName,
                        accountHead: acctName,
                        refNo: inv.invoiceNo,
                        customerOrSupplier: inv.customerName,
                        description: `Sales Invoice Payment: ${acctName} (${inv.paymentStatus || 'Paid'}) - ${inv.invoiceNo}`,
                    });
                });
            } else if ((inv.paidAmount || 0) > 0) {
                const matchedCoa = matchChannelToAccount(inv.paymentMethod || 'Cash', chartOfAccounts, paymentMethods);
                const acctName = matchedCoa ? matchedCoa.name : (inv.paymentMethod || 'Office Cash');
                missingTxs.push({
                    id: generateUniqueId('tx-auto-inv'),
                    date: inv.date || new Date().toISOString().slice(0, 10),
                    type: 'INCOME',
                    category: 'Sales Revenue',
                    amount: inv.paidAmount,
                    paymentAccount: acctName,
                    accountHead: acctName,
                    refNo: inv.invoiceNo,
                    customerOrSupplier: inv.customerName,
                    description: `Sales Invoice Payment: ${acctName} (${inv.paymentStatus || 'Paid'}) - ${inv.invoiceNo}`,
                });
            }
        });

        if (missingTxs.length > 0) {
            setTransactions(prev => ensureUniqueTransactions([...missingTxs, ...prev]));
        }
    }, [invoices, chartOfAccounts, paymentMethods, projects]);

    // Automatic real-time reconciliation between Projects and linked Sales Invoices
    useEffect(() => {
        if (!invoices || invoices.length === 0) return;

        // 1. Check for any invoices that have a linked project reference (inv.projectId or inv.projectCode)
        // but the project object is missing from the projects array (e.g. wiped by cloud sync or never persisted).
        const currentProjects = projects || [];
        const missingProjects: Project[] = [];
        invoices.forEach(inv => {
            if (!inv.projectId && !inv.projectCode) return;
            const exists = currentProjects.some(p => 
                (inv.projectId && p.id === inv.projectId) ||
                (inv.projectCode && p.code === inv.projectCode) ||
                (p.invoiceId && p.invoiceId === inv.id) ||
                (p.invoiceNo && p.invoiceNo === inv.invoiceNo)
            );
            if (exists) return;

            const pCode = inv.projectCode || `PRJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
            const pId = inv.projectId || `prj-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
            const coaId = inv.chartOfAccountId || 'coa-4002';
            const revAcc = resolveProjectRevenueAccount(coaId);

            const paymentBreakdowns: ProjectSalesPaymentBreakdown[] = [];
            if (inv.splitPayments && Object.keys(inv.splitPayments).length > 0) {
                Object.entries(inv.splitPayments).forEach(([channel, amt]) => {
                    const num = Number(amt) || 0;
                    if (num > 0 && channel.toLowerCase() !== 'due') {
                        paymentBreakdowns.push({
                            id: `pb-${Date.now()}-${channel}`,
                            method: channel,
                            amount: num,
                            referenceNo: inv.invoiceNo,
                        });
                    }
                });
            } else if ((inv.paidAmount || 0) > 0) {
                paymentBreakdowns.push({
                    id: `pb-${Date.now()}-paid`,
                    method: inv.paymentMethod || 'Cash in Hand',
                    amount: inv.paidAmount,
                    referenceNo: inv.invoiceNo,
                });
            }
            if ((inv.dueAmount || 0) > 0) {
                paymentBreakdowns.push({
                    id: `pb-${Date.now()}-due`,
                    method: 'Due',
                    amount: inv.dueAmount,
                    referenceNo: inv.invoiceNo,
                });
            }

            const itemsCount = (inv.items || []).length;
            const defaultProjName = itemsCount > 1
                ? `${inv.customerName} - Project (#${inv.invoiceNo})`
                : (inv.items?.[0]?.name ? `${inv.customerName} - ${inv.items[0].name}` : `${inv.customerName} - Project`);
            const defaultSalesItemDesc = itemsCount > 1
                ? `Invoice #${inv.invoiceNo} Billing (${itemsCount} items)`
                : (inv.items?.[0] ? `${inv.items[0].name} (x${inv.items[0].qty || 1})` : `Invoice #${inv.invoiceNo} Billing`);

            const reconstructed: Project = recalculateProject({
                id: pId,
                code: pCode,
                name: defaultProjName,
                clientName: inv.customerName,
                clientPhone: inv.customerPhone,
                budget: Number(inv.grandTotal) || 0,
                status: (Number(inv.dueAmount) || 0) <= 0 ? 'Completed' : 'In Progress',
                startDate: inv.date || new Date().toISOString().slice(0, 10),
                endDate: '',
                notes: `Created against Sales Invoice #${inv.invoiceNo}`,
                salesItems: [{
                    id: `ps-${Date.now()}`,
                    invoiceNo: inv.invoiceNo,
                    description: defaultSalesItemDesc,
                    amount: Number(inv.grandTotal) || 0,
                    date: inv.date || new Date().toISOString().slice(0, 10),
                    clientName: inv.customerName,
                    note: `Synced from Sales Invoice #${inv.invoiceNo}`,
                    paymentMethod: inv.paymentMethod || 'Cash in Hand',
                    paymentBreakdown: paymentBreakdowns.length > 0 ? paymentBreakdowns : undefined,
                    linkedAccountId: coaId,
                    paidAmount: Number(inv.paidAmount) || 0,
                    dueAmount: Number(inv.dueAmount) || 0,
                    collections: [],
                }],
                expenseItems: [],
                totalSales: 0,
                totalExpenses: 0,
                netProfit: 0,
                profitMargin: 0,
                chartOfAccountId: coaId,
                projectAccountCode: revAcc.code || '4002',
                invoiceId: inv.id,
                invoiceNo: inv.invoiceNo,
            });
            missingProjects.push(reconstructed);
        });

        if (missingProjects.length > 0) {
            const nextProjects = [...missingProjects, ...currentProjects];
            setProjects(nextProjects);
            try { localStorage.setItem(`${STORAGE_KEY}_PROJECTS`, JSON.stringify(nextProjects)); } catch {}
            latestStateRef.current = {
                ...latestStateRef.current,
                projects: nextProjects,
            };
            triggerImmediatePush();
            return;
        }

        if (currentProjects.length === 0) return;

        let invsChanged = false;
        const updatedInvoices = invoices.map(inv => {
            const linkedProj = currentProjects.find(p => 
                (p.invoiceId && p.invoiceId === inv.id) ||
                (p.invoiceNo && p.invoiceNo === inv.invoiceNo) ||
                (p.salesItems || []).some(s => s.invoiceNo === inv.invoiceNo)
            );
            if (!linkedProj) return inv;

            const salesItem = (linkedProj.salesItems || []).find(s => s.invoiceNo === inv.invoiceNo) || linkedProj.salesItems?.[0];
            if (!salesItem) return inv;

            const projPaid = salesItem.paidAmount !== undefined 
                ? Number(salesItem.paidAmount) 
                : (salesItem.collections || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
            const projDue = salesItem.dueAmount !== undefined 
                ? Number(salesItem.dueAmount) 
                : Math.max(0, (Number(salesItem.amount) || Number(inv.grandTotal) || 0) - projPaid);

            const needsProjectRef = (!inv.projectId && !!linkedProj.id) || (!inv.projectCode && !!linkedProj.code);
            if (Number(inv.paidAmount) !== projPaid || Number(inv.dueAmount) !== projDue || needsProjectRef) {
                invsChanged = true;
                const newStatus: PaymentStatus = projDue <= 0 ? 'Paid' : projPaid > 0 ? 'Partial' : 'Due';
                const existingSplits = { ...(inv.splitPayments || {}) };
                if (projDue <= 0 && existingSplits['Due'] !== undefined) {
                    delete existingSplits['Due'];
                }
                (salesItem.collections || []).forEach(c => {
                    const m = c.paymentMethod || 'Cash in Hand';
                    existingSplits[m] = Math.max(existingSplits[m] || 0, Number(c.amount) || 0);
                });
                return {
                    ...inv,
                    projectId: inv.projectId || linkedProj.id,
                    projectCode: inv.projectCode || linkedProj.code,
                    chartOfAccountId: inv.chartOfAccountId || linkedProj.chartOfAccountId,
                    paidAmount: projPaid,
                    dueAmount: projDue,
                    paymentStatus: newStatus,
                    splitPayments: Object.keys(existingSplits).length > 0 ? existingSplits : inv.splitPayments,
                };
            }
            return inv;
        });

        if (invsChanged) {
            setInvoices(updatedInvoices);
            try { localStorage.setItem(`${STORAGE_KEY}_INVOICES`, JSON.stringify(updatedInvoices)); } catch {}
            latestStateRef.current = {
                ...latestStateRef.current,
                invoices: updatedInvoices,
            };
            triggerImmediatePush();
        }
    }, [projects, invoices]);

    // Automatic cleanup of legacy phantom unpaid due receivable transactions in transactions that cause double counting
    useEffect(() => {
        if (!transactions || transactions.length === 0) return;

        const hasPhantomDueTx = transactions.some(t => 
            t.type === 'INCOME' && 
            isProjectTransaction(t) && 
            isDueReceivableTransaction(t)
        );

        if (hasPhantomDueTx) {
            const cleanedTxs = transactions.filter(t => 
                !(t.type === 'INCOME' && isProjectTransaction(t) && isDueReceivableTransaction(t))
            );
            setTransactions(cleanedTxs);
            try { localStorage.setItem(`${STORAGE_KEY}_TRANSACTIONS`, JSON.stringify(cleanedTxs)); } catch {}
            latestStateRef.current = {
                ...latestStateRef.current,
                transactions: cleanedTxs,
            };
            triggerImmediatePush();
        }
    }, [transactions]);

    const login = (staffIdOrPasscode: string, passcode?: string): {
        success: boolean;
        message: string;
    } => {
        const staffList = (staffMembers && staffMembers.length > 0) ? staffMembers : INITIAL_STAFF_MEMBERS;
        const enteredPin = (passcode !== undefined && passcode.trim() !== '') ? passcode.trim() : (staffIdOrPasscode || '').trim();
        const requestedId = (passcode !== undefined && passcode.trim() !== '') ? (staffIdOrPasscode || '').trim() : '';

        let staff: StaffMember | undefined;

        // If specific staff ID was provided along with passcode
        if (requestedId) {
            staff = staffList.find((s) => s.id === requestedId && (s.password || '1234') === enteredPin);
        }

        // Match directly by entered PIN across all staff members
        if (!staff) {
            staff = staffList.find((s) => (s.password || '1234') === enteredPin);
        }

        // Fallback match in INITIAL_STAFF_MEMBERS
        if (!staff) {
            staff = INITIAL_STAFF_MEMBERS.find((s) => (s.password || '1234') === enteredPin);
        }

        if (!staff) {
            return {
                success: false,
                message: language === 'bn' ? 'ভুল পিন কোড! অনুগ্রহ করে সঠিক পিন নম্বর লিখুন।' : 'Incorrect PIN code. Please try again.'
            };
        }

        if (staff.isActive === false) {
            return {
                success: false,
                message: language === 'bn' ? 'এই অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে।' : 'This account has been deactivated.'
            };
        }

        if (!staffMembers.some((s) => s.id === staff!.id)) {
            setStaffMembers((prev) => [...prev, staff!]);
        }
        setActiveStaff(staff);
        setIsAuthenticated(true);
        addAuditLog({
            staffId: staff.id,
            staffName: staff.name,
            staffRole: staff.role,
            actionType: 'PROFILE_UPDATED',
            entityType: 'System',
            details: `${staff.name} (${staff.role}) logged in successfully`,
            detailsBn: `${staff.name} (${staff.role}) সফলভাবে লগইন করেছেন`,
            location: staff.location === 'Both' ? 'Office' : staff.location,
        });
        return {
            success: true,
            message: language === 'bn' ? `স্বাগতম, ${staff.nameBn || staff.name}! লগইন সফল হয়েছে।` : `Welcome, ${staff.name}! Login successful.`
        };
    };
    const logout = () => {
        const prevStaff = activeStaff;
        setIsAuthenticated(false);
        try {
            if (typeof window !== 'undefined' && window.location.search) {
                window.history.replaceState({}, '', window.location.pathname);
            }
        }
        catch { }
        if (prevStaff?.id) {
            addAuditLog({
                staffId: prevStaff.id,
                staffName: prevStaff.name || 'User',
                staffRole: prevStaff.role || 'Staff',
                actionType: 'PROFILE_UPDATED',
                entityType: 'System',
                details: `${prevStaff.name || 'User'} logged out`,
                detailsBn: undefined,
                location: prevStaff.location === 'Both' ? 'Office' : (prevStaff.location || 'Office'),
            });
        }
    };
    const addAuditLog = (entry: Omit<AuditLogEntry, 'id' | 'timestamp'> & {
        timestamp?: string;
    }) => {
        const now = new Date();
        const formattedTime = entry.timestamp ||
            `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)}`;
        const newEntry: AuditLogEntry = {
            ...entry,
            id: `audit-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
            timestamp: formattedTime,
        };
        setAuditLogs((prev) => [newEntry, ...prev]);
    };
    const updateProfile = (updates: Partial<CompanyProfile>) => {
        setProfile((prev) => ({ ...prev, ...updates }));
    };
    // Payment Gateways & Methods Management
    const addPaymentMethod = (pm: Omit<PaymentMethodConfig, 'id'>): PaymentMethodConfig => {
        const newPm: PaymentMethodConfig = {
            ...pm,
            id: `pm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            sortOrder: paymentMethods.length + 1,
        };
        if (newPm.isDefault) {
            setPaymentMethods((prev) => [...prev.map((p) => ({ ...p, isDefault: false })), newPm]);
        }
        else {
            setPaymentMethods((prev) => [...prev, newPm]);
        }
        addAuditLog({
            staffId: activeStaff?.id || 'sys',
            staffName: activeStaff?.name || 'Admin',
            staffRole: activeStaff?.role || 'Admin',
            location: 'All',
            actionType: 'PROFILE_UPDATED',
            entityType: 'Configuration',
            refNo: newPm.id,
            details: `Created payment gateway/method: ${newPm.name} (${newPm.type})`,
            detailsBn: undefined,
        });
        return newPm;
    };
    const updatePaymentMethod = (id: string, updates: Partial<PaymentMethodConfig>) => {
        setPaymentMethods((prev) => prev.map((pm) => {
            if (pm.id === id) {
                return { ...pm, ...updates };
            }
            if (updates.isDefault) {
                return { ...pm, isDefault: false };
            }
            return pm;
        }));
    };
    const deletePaymentMethod = (id: string): {
        success: boolean;
        message?: string;
    } => {
        const target = paymentMethods.find((p) => p.id === id);
        if (!target)
            return { success: false, message: 'Payment method not found' };
        const remaining = paymentMethods.filter((p) => p.id !== id);
        if (remaining.length === 0) {
            return { success: false, message: 'At least one payment method must remain active in the system.' };
        }
        if (target.isDefault && remaining.length > 0) {
            remaining[0].isDefault = true;
        }
        setPaymentMethods(remaining);
        addAuditLog({
            staffId: activeStaff?.id || 'sys',
            staffName: activeStaff?.name || 'Admin',
            staffRole: activeStaff?.role || 'Admin',
            location: 'All',
            actionType: 'PROFILE_UPDATED',
            entityType: 'Configuration',
            refNo: id,
            details: `Deleted payment method: ${target.name}`,
            detailsBn: undefined,
        });
        return { success: true };
    };
    const togglePaymentMethod = (id: string) => {
        setPaymentMethods((prev) => prev.map((pm) => (pm.id === id ? { ...pm, isEnabled: !pm.isEnabled } : pm)));
    };
    const setDefaultPaymentMethod = (id: string) => {
        setPaymentMethods((prev) => prev.map((pm) => ({
            ...pm,
            isDefault: pm.id === id,
        })));
    };
    // Add Sales Invoice
    const addInvoice = (data: Omit<SalesInvoice, 'id' | 'invoiceNo'>): SalesInvoice => {
        const id = `inv-${Date.now()}`;
        const invoiceNo = `DCC-INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const newInvoice: SalesInvoice = sanitizeSalesInvoice({
            ...data,
            id,
            invoiceNo,
        });
        setInvoices((prev) => [newInvoice, ...prev]);
        const advanceApplied = Number(data.splitPayments?.['Customer Advance']) || 0;
        // Update Customer safely
        let matchedCustomer = false;
        setCustomers((prev) => prev.map((c) => {
            if (!matchedCustomer && isInvoiceMatchingCustomer(newInvoice, c)) {
                matchedCustomer = true;
                const clientInvoices = [newInvoice, ...invoices.filter(i => isInvoiceMatchingCustomer(i, c))];
                const totalPurchased = clientInvoices.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);
                const dueAmount = clientInvoices.reduce((s, i) => s + (Number(i.dueAmount) || 0), 0);
                return {
                    ...c,
                    totalPurchased,
                    dueAmount,
                    advanceBalance: advanceApplied > 0 
                        ? Math.max(0, (Number(c.advanceBalance) || 0) - advanceApplied)
                        : c.advanceBalance,
                };
            }
            return c;
        }));
        // If paid amount > 0, record accounting entry (unless skipLedgerTransaction is set)
        if (!data.skipLedgerTransaction) {
            if (data.splitPayments) {
                const txs: AccountingTransaction[] = [];
                const cashAcct = data.warehouseLocation === 'Factory' ? 'Factory Cash' : 'Office Cash';

                // Iterate over all payment methods in splitPayments
                Object.entries(data.splitPayments).forEach(([key, val]) => {
                    const amt = Number(val) || 0;
                    if (amt <= 0 || key.toLowerCase() === 'due') return;

                    if (key === 'Customer Advance' || key.toLowerCase().includes('advance')) {
                        txs.push({
                            id: generateUniqueId('tx'),
                            date: data.date,
                            type: 'INCOME',
                            category: 'Customer Advance Adjustment',
                            amount: amt,
                            paymentAccount: 'Customer Advance',
                            accountHead: 'Customer Advance',
                            refNo: invoiceNo,
                            customerOrSupplier: data.customerName,
                            description: `Adjusted Tk ${amt.toLocaleString()} from Customer Advance for invoice ${invoiceNo} (${data.customerName})`,
                        });
                        return;
                    }

                    const matchedCoa = matchChannelToAccount(key, chartOfAccounts, paymentMethods);
                    const matchedPm = paymentMethods.find((p) => p.id === key || p.name.toLowerCase() === key.toLowerCase());

                    let acctName = matchedCoa ? matchedCoa.name : (matchedPm?.name || key);
                    if (key.toLowerCase() === 'cash' || key.toLowerCase() === 'pm-cash') {
                        acctName = matchedCoa ? matchedCoa.name : cashAcct;
                    }

                    txs.push({
                        id: generateUniqueId('tx'),
                        date: data.date,
                        type: 'INCOME',
                        category: 'Sales Revenue',
                        amount: amt,
                        paymentAccount: acctName,
                        accountHead: acctName,
                        refNo: invoiceNo,
                        customerOrSupplier: data.customerName,
                        description: `POS Payment: ${acctName} (${data.paymentStatus}) - ${(data.items || []).map((i) => i.name).join(', ')}`,
                    });
                });

                if (txs.length > 0) {
                    setTransactions((prev) => ensureUniqueTransactions([...txs, ...prev]));
                }
            }
            else if (data.paidAmount > 0) {
                const matchedCoa = matchChannelToAccount(data.paymentMethod || 'Cash', chartOfAccounts, paymentMethods);
                const pmObj = paymentMethods.find((p) => p.name.toLowerCase() === (data.paymentMethod || '').toLowerCase() || p.id === data.paymentMethod);
                const cashAcct = data.warehouseLocation === 'Factory' ? 'Factory Cash' : 'Office Cash';

                let resolvedAcct = matchedCoa ? matchedCoa.name : (pmObj?.name || data.paymentMethod || cashAcct);
                if ((data.paymentMethod || '').toLowerCase().includes('cash')) {
                    resolvedAcct = matchedCoa ? matchedCoa.name : cashAcct;
                }

                const newTx: AccountingTransaction = {
                    id: generateUniqueId('tx'),
                    date: data.date,
                    type: 'INCOME',
                    category: 'Sales Revenue',
                    amount: data.paidAmount,
                    paymentAccount: resolvedAcct,
                    accountHead: resolvedAcct,
                    refNo: invoiceNo,
                    customerOrSupplier: data.customerName,
                    description: `Sales Invoice payment: ${resolvedAcct} (${data.paymentStatus}) - ${(data.items || []).map((i) => i.name).join(', ')}`,
                };
                setTransactions((prev) => ensureUniqueTransactions([newTx, ...prev]));
            }
        }
        // Decrement stock for physical items
        if (data.items && data.items.length > 0) {
            setProducts((prev) => prev.map((p) => {
                const item = data.items.find((i) => i.productId === p.id);
                if (item) {
                    const locKey = data.warehouseLocation === 'Factory' ? 'stockFactory' : 'stockOffice';
                    const currentStock = p[locKey] !== undefined ? p[locKey] : 0;
                    const newStock = Math.max(0, currentStock - (item.qty || 0));
                    return { ...p, [locKey]: newStock };
                }
                return p;
            }));
            const newMovements: StockMovement[] = data.items.map((item, idx) => ({
                id: generateUniqueId(`sm-${idx}-${item.productId}`),
                date: new Date().toISOString().replace('T', ' ').slice(0, 16),
                productId: item.productId,
                productName: item.name,
                type: 'OUT',
                qty: item.qty,
                unit: item.unit,
                sourceLocation: data.warehouseLocation,
                refNo: invoiceNo,
                reason: `Sales Invoice to ${data.customerName}`,
            }));
            setStockMovements((prev) => [...newMovements, ...prev]);
        }
        // Record audit log entry
        try {
            addAuditLog({
                staffId: activeStaff?.id || 'staff-admin',
                staffName: activeStaff?.name || 'Staff',
                staffRole: activeStaff?.role || 'Managing Director',
                location: data.warehouseLocation === 'Factory' ? 'Factory' : 'Office',
                actionType: 'INVOICE_CREATED',
                entityType: 'POS',
                refNo: invoiceNo,
                details: `Issued sales invoice ${invoiceNo} for ${data.customerName || 'Walk-in Customer'} - Total: Tk ${(Number(data.grandTotal) || 0).toLocaleString()} (Paid: Tk ${(Number(data.paidAmount) || 0).toLocaleString()})`,
                detailsBn: undefined,
                amount: Number(data.grandTotal) || 0,
                severity: 'info',
            });
        }
        catch (e) {
            console.warn('Audit log write skipped:', e);
        }
        if (latestStateRef.current) {
            latestStateRef.current = {
                ...latestStateRef.current,
                invoices: [newInvoice, ...(latestStateRef.current.invoices || invoices)],
            };
        }
        return newInvoice;
    };
    const updateInvoice = (id: string, updates: Partial<SalesInvoice>) => {
        const currentInvoices = latestStateRef.current.invoices || invoices;
        const nextInvoices = currentInvoices.map((inv) => (inv.id === id ? sanitizeSalesInvoice({ ...inv, ...updates }) : inv));
        setInvoices(nextInvoices);
        if (latestStateRef.current) {
            latestStateRef.current = {
                ...latestStateRef.current,
                invoices: nextInvoices,
            };
        }
        try {
            localStorage.setItem(`${STORAGE_KEY}_INVOICES`, JSON.stringify(nextInvoices));
        } catch {}

        const updatedInv = nextInvoices.find(inv => inv.id === id);
        if (updatedInv) {
            const currentCusts = latestStateRef.current.customers || customers;
            const nextCusts = currentCusts.map((c: Customer) => {
                if (isInvoiceMatchingCustomer(updatedInv, c)) {
                    const clientInvoices = nextInvoices.filter(i => isInvoiceMatchingCustomer(i, c));
                    const totalPurchased = clientInvoices.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);
                    const dueAmount = clientInvoices.reduce((s, i) => s + (Number(i.dueAmount) || 0), 0);
                    return { ...c, totalPurchased, dueAmount };
                }
                return c;
            });
            setCustomers(nextCusts);
            try {
                localStorage.setItem(`${STORAGE_KEY}_CUSTOMERS`, JSON.stringify(nextCusts));
            } catch {}
            latestStateRef.current = {
                ...latestStateRef.current,
                invoices: nextInvoices,
                customers: nextCusts,
            };
        } else {
            latestStateRef.current = {
                ...latestStateRef.current,
                invoices: nextInvoices,
            };
        }
        triggerImmediatePush();
    };
    const collectInvoicePayment = (invoiceId: string, amount: number, method: any, advanceAdjustAmount: number = 0) => {
        const currentInvoices = latestStateRef.current.invoices || invoices;
        const targetInv = currentInvoices.find((i) => i.id === invoiceId);
        if (!targetInv)
            return;

        const advanceAdjust = Math.max(0, Number(advanceAdjustAmount) || 0);
        const cashCollect = Math.max(0, Number(amount) || 0);
        const totalPaymentApplied = cashCollect + advanceAdjust;
        if (totalPaymentApplied <= 0) return;

        if (advanceAdjust > 0) {
            addAuditLog({
                staffId: activeStaff.id,
                staffName: activeStaff.name,
                staffRole: activeStaff.role,
                location: 'Office',
                actionType: 'ADVANCE_ADJUSTED',
                entityType: 'Sales',
                refNo: targetInv.invoiceNo,
                details: `Adjusted payment of Tk ${advanceAdjust.toLocaleString()} from Customer Advance for invoice ${targetInv.invoiceNo} (${targetInv.customerName})`,
                amount: advanceAdjust,
                severity: 'success',
            });
        }

        if (cashCollect > 0) {
            addAuditLog({
                staffId: activeStaff.id,
                staffName: activeStaff.name,
                staffRole: activeStaff.role,
                location: 'Office',
                actionType: 'PAYMENT_COLLECTED',
                entityType: 'Sales',
                refNo: targetInv.invoiceNo,
                details: `Collected payment of Tk ${cashCollect.toLocaleString()} via ${method} for invoice ${targetInv.invoiceNo} (${targetInv.customerName})`,
                amount: cashCollect,
                severity: 'success',
            });
        }

        const newPaid = targetInv.paidAmount + totalPaymentApplied;
        const newDue = Math.max(0, targetInv.grandTotal - newPaid);
        const newStatus: PaymentStatus = newDue <= 0 ? 'Paid' : 'Partial';

        // Resolve exact channel account in Chart of Accounts
        const matchedPm = paymentMethods.find((p) => p.id === method || p.name.toLowerCase() === (method || '').toLowerCase());
        const targetCoa = matchChannelToAccount(method, chartOfAccounts, paymentMethods);
        const resolvedAccount = targetCoa ? targetCoa.name : (matchedPm?.name || method || 'Office Cash');

        // Update invoice
        const updatedInvoices = currentInvoices.map((inv) => {
            if (inv.id !== invoiceId) return inv;
            const existingSplits = { ...(inv.splitPayments || {}) };
            if (cashCollect > 0) {
                existingSplits[resolvedAccount] = (existingSplits[resolvedAccount] || 0) + cashCollect;
            }
            if (advanceAdjust > 0) {
                existingSplits['Customer Advance'] = (existingSplits['Customer Advance'] || 0) + advanceAdjust;
            }
            return {
                ...inv,
                paidAmount: newPaid,
                dueAmount: newDue,
                paymentStatus: newStatus,
                splitPayments: existingSplits,
            };
        });
        setInvoices(updatedInvoices);
        try {
            localStorage.setItem(`${STORAGE_KEY}_INVOICES`, JSON.stringify(updatedInvoices));
        } catch {}

        // Update customer due and total purchases safely
        const currentCusts = latestStateRef.current.customers || customers;
        const updatedCusts = currentCusts.map((c) => {
            if (isInvoiceMatchingCustomer(targetInv, c)) {
                const clientInvoices = updatedInvoices.filter(inv => isInvoiceMatchingCustomer(inv, c));
                const totalPurchased = clientInvoices.length > 0
                    ? clientInvoices.reduce((s, inv) => s + (Number(inv.grandTotal) || 0), 0)
                    : (c.totalPurchased || 0);
                const dueAmount = clientInvoices.length > 0
                    ? clientInvoices.reduce((s, inv) => s + (Number(inv.dueAmount) || 0), 0)
                    : Math.max(0, (c.dueAmount || 0) - totalPaymentApplied);
                const currentAdv = Number(c.advanceBalance) || 0;
                const newAdv = Math.max(0, currentAdv - advanceAdjust);
                return { ...c, totalPurchased, dueAmount, advanceBalance: newAdv };
            }
            return c;
        });
        setCustomers(updatedCusts);
        try {
            localStorage.setItem(`${STORAGE_KEY}_CUSTOMERS`, JSON.stringify(updatedCusts));
        } catch {}

        // Sync to linked Project if this invoice is attached to a project
        if (targetInv.projectId || targetInv.projectCode || (projects || []).some(p => p.invoiceId === targetInv.id || p.invoiceNo === targetInv.invoiceNo)) {
            const currentProjs = latestStateRef.current.projects || projects;
            const updatedProjs = currentProjs.map((p: Project) => {
                const isMatch = (targetInv.projectId && p.id === targetInv.projectId) ||
                                (targetInv.projectCode && p.code === targetInv.projectCode) ||
                                (p.invoiceId && p.invoiceId === targetInv.id) ||
                                (p.invoiceNo && p.invoiceNo === targetInv.invoiceNo);
                if (isMatch) {
                    const updatedSales = (p.salesItems || []).map((s: ProjectSalesItem) => {
                        if (s.invoiceNo === targetInv.invoiceNo || (!s.invoiceNo && (p.salesItems || []).length === 1)) {
                            const newDue = Math.max(0, (Number(s.dueAmount) || 0) - totalPaymentApplied);
                            const newPaid = Math.min(Number(s.amount) || 0, (Number(s.paidAmount) || 0) + totalPaymentApplied);
                            const newCol: ProjectSalesCollection = {
                                id: `col-inv-sync-${Date.now()}`,
                                date: new Date().toISOString().slice(0, 10),
                                amount: totalPaymentApplied,
                                paymentMethod: resolvedAccount,
                                referenceNo: targetInv.invoiceNo,
                                createdBy: activeStaff?.name || 'Managing Director',
                            };
                            return {
                                ...s,
                                dueAmount: newDue,
                                paidAmount: newPaid,
                                collections: [...(s.collections || []), newCol],
                            };
                        }
                        return s;
                    });
                    return recalculateProject({ ...p, salesItems: updatedSales });
                }
                return p;
            });
            setProjects(updatedProjs);
            try { localStorage.setItem(`${STORAGE_KEY}_PROJECTS`, JSON.stringify(updatedProjs)); } catch {}
            latestStateRef.current = {
                ...latestStateRef.current,
                projects: updatedProjs,
            };
        }

        // Add transaction with guaranteed unique ID and exact channel
        const newTxsToAdd: AccountingTransaction[] = [];
        if (cashCollect > 0) {
            newTxsToAdd.push({
                id: generateUniqueId('tx'),
                date: new Date().toISOString().slice(0, 10),
                type: 'INCOME',
                category: 'Client Due Collection',
                amount: cashCollect,
                paymentAccount: resolvedAccount,
                accountHead: resolvedAccount,
                refNo: targetInv.invoiceNo,
                customerOrSupplier: targetInv.customerName,
                description: `Due collection against invoice ${targetInv.invoiceNo} via ${resolvedAccount}`,
            });
        }
        if (advanceAdjust > 0) {
            newTxsToAdd.push({
                id: generateUniqueId('tx'),
                date: new Date().toISOString().slice(0, 10),
                type: 'INCOME',
                category: 'Customer Advance Adjustment',
                amount: advanceAdjust,
                paymentAccount: 'Customer Advance',
                accountHead: 'Customer Advance',
                refNo: targetInv.invoiceNo,
                customerOrSupplier: targetInv.customerName,
                description: `Adjusted Tk ${advanceAdjust.toLocaleString()} from Customer Advance against invoice ${targetInv.invoiceNo}`,
            });
        }

        const currentTxs = latestStateRef.current.transactions || transactions;
        const updatedTxs = ensureUniqueTransactions([...newTxsToAdd, ...currentTxs]);
        setTransactions(updatedTxs);
        try {
            localStorage.setItem(`${STORAGE_KEY}_TRANSACTIONS`, JSON.stringify(updatedTxs));
        } catch {}

        // Update Chart of Accounts Customer Advance liability and Customer Receivable accounts immediately
        const newTotalCustomerAdvance = updatedCusts.reduce((s, c) => s + (Number(c.advanceBalance) || 0), 0);
        const newTotalCustomerDue = calculateTotalCustomerReceivables(updatedInvoices, updatedCusts, latestStateRef.current.projects || projects);
        const currentCoa = latestStateRef.current.chartOfAccounts || chartOfAccounts;
        const updatedCoa = currentCoa.map((acc) => {
            const isAdvanceLiability = acc.classification === 'Liability' && (
                acc.code === '2020' ||
                acc.code === '2002' ||
                acc.id === 'coa-2020' ||
                acc.name.toLowerCase().includes('advance') ||
                acc.name.toLowerCase().includes('deposit') ||
                acc.nameBn?.includes('অগ্রিম')
            );
            if (isAdvanceLiability) {
                return { ...acc, currentBalance: newTotalCustomerAdvance };
            }
            const isCustomerReceivable = acc.classification === 'Asset' && (
                acc.id === 'coa-1050' ||
                acc.code === '1003' ||
                acc.code === '1050' ||
                (acc.name.toLowerCase().includes('customer') && acc.name.toLowerCase().includes('receivable')) ||
                acc.name.toLowerCase().includes('trade debtor') ||
                acc.nameBn?.includes('কাস্টমার বকেয়া') ||
                acc.nameBn?.includes('প্রাপ্য হিসাব') ||
                (acc.name.toLowerCase().includes('receivable') && !acc.name.toLowerCase().includes('aggregator') && !acc.name.toLowerCase().includes('staff'))
            );
            if (isCustomerReceivable) {
                return { ...acc, currentBalance: newTotalCustomerDue > 0 ? newTotalCustomerDue : (acc.openingBalance || 0) };
            }
            return acc;
        });
        setChartOfAccounts(updatedCoa);
        try {
            localStorage.setItem(`${STORAGE_KEY}_COA`, JSON.stringify(updatedCoa));
            localStorage.setItem(`${STORAGE_KEY}_CHART_OF_ACCOUNTS`, JSON.stringify(updatedCoa));
        } catch {}

        latestStateRef.current = {
            ...latestStateRef.current,
            invoices: updatedInvoices,
            customers: updatedCusts,
            transactions: updatedTxs,
            chartOfAccounts: updatedCoa,
        };
        triggerImmediatePush();
    };

    const adjustCustomerAdvance = (customerId: string, amount: number, invoiceId?: string, notes?: string) => {
        if (amount <= 0) return;
        if (invoiceId) {
            collectInvoicePayment(invoiceId, 0, 'Customer Advance', amount);
            return;
        }
        const currentCusts = latestStateRef.current.customers || customers;
        const cust = currentCusts.find((c) => c.id === customerId);
        if (!cust) return;

        const currentInvoices = latestStateRef.current.invoices || invoices;
        const dueInv = currentInvoices.find((inv) => isInvoiceMatchingCustomer(inv, cust) && inv.dueAmount > 0);
        if (dueInv) {
            collectInvoicePayment(dueInv.id, 0, 'Customer Advance', Math.min(amount, dueInv.dueAmount));
            return;
        }

        const newAdv = Math.max(0, (Number(cust.advanceBalance) || 0) - amount);
        const updatedCusts = currentCusts.map((c) => c.id === customerId ? { ...c, advanceBalance: newAdv } : c);
        setCustomers(updatedCusts);
        try { localStorage.setItem(`${STORAGE_KEY}_CUSTOMERS`, JSON.stringify(updatedCusts)); } catch {}

        const newTx: AccountingTransaction = {
            id: generateUniqueId('tx'),
            date: new Date().toISOString().slice(0, 10),
            type: 'INCOME',
            category: 'Customer Advance Adjustment',
            amount: amount,
            paymentAccount: 'Customer Advance',
            accountHead: 'Customer Advance',
            refNo: `ADV-ADJ-${Date.now().toString().slice(-4)}`,
            customerOrSupplier: cust.name,
            description: notes || `Direct adjustment of advance balance for ${cust.name}`,
        };
        const currentTxs = latestStateRef.current.transactions || transactions;
        const updatedTxs = ensureUniqueTransactions([newTx, ...currentTxs]);
        setTransactions(updatedTxs);
        try { localStorage.setItem(`${STORAGE_KEY}_TRANSACTIONS`, JSON.stringify(updatedTxs)); } catch {}

        const newTotalCustomerAdvance = updatedCusts.reduce((s, c) => s + (Number(c.advanceBalance) || 0), 0);
        const currentCoa = latestStateRef.current.chartOfAccounts || chartOfAccounts;
        const updatedCoa = currentCoa.map((acc) => {
            const isAdvanceLiability = acc.classification === 'Liability' && (
                acc.code === '2020' || acc.code === '2002' || acc.id === 'coa-2020' ||
                acc.name.toLowerCase().includes('advance') || acc.name.toLowerCase().includes('deposit') || acc.nameBn?.includes('অগ্রিম')
            );
            if (isAdvanceLiability) {
                return { ...acc, currentBalance: newTotalCustomerAdvance };
            }
            return acc;
        });
        setChartOfAccounts(updatedCoa);
        try { localStorage.setItem(`${STORAGE_KEY}_CHART_OF_ACCOUNTS`, JSON.stringify(updatedCoa)); } catch {}

        latestStateRef.current = {
            ...latestStateRef.current,
            customers: updatedCusts,
            transactions: updatedTxs,
            chartOfAccounts: updatedCoa,
        };
        triggerImmediatePush();
    };
    const updateProductionStatus = (invoiceId: string, status: any) => {
        setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? { ...inv, productionStatus: status } : inv)));
    };
    // Quotations
    const addQuotation = (data: Omit<Quotation, 'id' | 'quoteNo'>): Quotation => {
        const id = `qt-${Date.now()}`;
        const quoteNo = `DCC-EST-${new Date().getFullYear()}-${Math.floor(2000 + Math.random() * 8000)}`;
        const newQuote: Quotation = {
            ...data,
            id,
            quoteNo,
        };
        setQuotations((prev) => [newQuote, ...prev]);
        return newQuote;
    };
    const updateQuotation = (id: string, updates: Partial<Quotation>) => {
        setQuotations((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
    };
    const updateQuotationStatus = (id: string, status: Quotation['status']) => {
        setQuotations((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
    };
    const convertQuotationToInvoice = (quotationId: string): SalesInvoice | null => {
        const q = quotations.find((quote) => quote.id === quotationId);
        if (!q)
            return null;
        let cust = customers.find((c) => ((c.name || '').toLowerCase() === (q.customerName || '').toLowerCase() && q.customerName) ||
            (q.customerPhone && c.phone === q.customerPhone));
        let custId = cust?.id;
        if (!custId) {
            custId = `cust-${Date.now()}`;
            const newCust: Customer = {
                id: custId,
                name: q.customerName,
                phone: q.customerPhone,
                company: q.customerCompany || '',
                totalPurchased: 0,
                dueAmount: 0,
                createdAt: new Date().toISOString().slice(0, 10),
            };
            setCustomers((prev) => [...prev, newCust]);
        }
        const created = addInvoice({
            date: new Date().toISOString().slice(0, 10),
            referenceNo: q.referenceNo,
            purchaseRequisition: q.purchaseRequisition || q.prNo,
            prNo: q.prNo || q.purchaseRequisition,
            customerId: custId,
            customerName: q.customerName,
            customerPhone: q.customerPhone,
            items: q.items,
            subtotal: q.subtotal,
            discount: q.discount,
            discountType: q.discountType || 'amount',
            discountValue: q.discountValue || q.discount,
            vatRate: q.vatRate,
            vatAmount: q.vatAmount !== undefined ? q.vatAmount : Math.round((q.subtotal - q.discount) * (q.vatRate / 100)),
            vatType: q.vatType || 'percent',
            vatValue: q.vatValue !== undefined ? q.vatValue : q.vatRate,
            grandTotal: q.grandTotal,
            paidAmount: 0,
            dueAmount: q.grandTotal,
            paymentMethod: 'Cash',
            paymentStatus: 'Due',
            productionStatus: 'Queued',
            warehouseLocation: 'Factory',
            notes: `Generated from Quotation #${q.quoteNo}. ${q.notes || ''}`,
            showRegionColumn: q.showRegionColumn,
            showTypeColumn: q.showTypeColumn,
        });
        updateQuotation(quotationId, { status: 'Approved', isConverted: true });
        return created;
    };
    // Products & Stock
    const addProduct = (data: Omit<ProductItem, 'id' | 'code'>) => {
        const codePrefix = (data.category || 'GEN').slice(0, 3).toUpperCase();
        const code = `${codePrefix}-${Math.floor(100 + Math.random() * 900)}`;
        const newProd: ProductItem = {
            ...data,
            id: `prod-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
            code,
        };
        const currentProducts = latestStateRef.current.products || products;
        const next = [newProd, ...currentProducts.filter((p: ProductItem) => p.id !== newProd.id)];
        setProducts(next);
        try {
            localStorage.setItem(`${STORAGE_KEY}_PRODUCTS`, JSON.stringify(next));
        } catch {}
        latestStateRef.current = {
            ...latestStateRef.current,
            products: next,
        };
        isCloudLoadedRef.current = true;
        triggerImmediatePush();
        return newProd;
    };
    const bulkImportProducts = (items: Array<Omit<ProductItem, 'id'> & {
        id?: string;
    }>, options: {
        updateExisting?: boolean;
    } = { updateExisting: true }): {
        added: number;
        updated: number;
    } => {
        const shouldUpdate = options.updateExisting !== false;
        let addedCount = 0;
        let updatedCount = 0;
        const currentProducts = latestStateRef.current.products || products;
        const updatedList = [...currentProducts];
        const timestamp = Date.now();
        items.forEach((item, index) => {
            // Find if item already exists by id, code or name
            const existingIdx = updatedList.findIndex((p) => {
                if (item.id && p.id === item.id)
                    return true;
                if (item.code && p.code && p.code.trim().toLowerCase() === item.code.trim().toLowerCase())
                    return true;
                if (item.name && p.name && p.name.trim().toLowerCase() === item.name.trim().toLowerCase())
                    return true;
                return false;
            });
            if (existingIdx !== -1 && shouldUpdate) {
                updatedList[existingIdx] = {
                    ...updatedList[existingIdx],
                    ...item,
                    id: updatedList[existingIdx].id,
                    code: item.code || updatedList[existingIdx].code,
                };
                updatedCount++;
            }
            else if (existingIdx === -1) {
                const codePrefix = (item.category || 'GEN').slice(0, 3).toUpperCase();
                const generatedCode = item.code || `${codePrefix}-${Math.floor(100 + Math.random() * 900)}`;
                const newProd: ProductItem = {
                    id: item.id || `prod-${timestamp}-${index}-${Math.floor(10 + Math.random() * 90)}`,
                    code: generatedCode,
                    name: item.name,
                    nameBn: item.nameBn || '',
                    category: item.category || 'DIGITAL PRINTING',
                    isRawMaterial: Boolean(item.isRawMaterial),
                    unit: item.unit || 'pcs',
                    unitPrice: item.unitPrice || 0,
                    costPrice: item.costPrice || 0,
                    stockFactory: item.stockFactory || 0,
                    stockOffice: item.stockOffice || 0,
                    minStockAlert: item.minStockAlert ?? 5,
                    description: item.description || '',
                };
                updatedList.unshift(newProd);
                addedCount++;
            }
        });
        setProducts(updatedList);
        try {
            localStorage.setItem(`${STORAGE_KEY}_PRODUCTS`, JSON.stringify(updatedList));
        } catch {}
        latestStateRef.current = {
            ...latestStateRef.current,
            products: updatedList,
        };
        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: 'All',
            actionType: 'BULK_PRODUCTS_IMPORTED',
            entityType: 'Inventory',
            refNo: `CSV-${Date.now().toString().slice(-4)}`,
            details: `Bulk imported ${addedCount + updatedCount} products (${addedCount} new items, ${updatedCount} updated)`,
            detailsBn: undefined,
            severity: 'info',
        });
        isCloudLoadedRef.current = true;
        triggerImmediatePush();
        return { added: addedCount, updated: updatedCount };
    };
    const updateProduct = (id: string, updates: Partial<ProductItem>) => {
        const currentProducts = latestStateRef.current.products || products;
        const next = currentProducts.map((p: ProductItem) => (p.id === id ? { ...p, ...updates } : p));
        setProducts(next);
        try {
            localStorage.setItem(`${STORAGE_KEY}_PRODUCTS`, JSON.stringify(next));
        } catch {}
        latestStateRef.current = {
            ...latestStateRef.current,
            products: next,
        };
        isCloudLoadedRef.current = true;
        triggerImmediatePush();
    };
    const deleteProduct = (id: string) => {
        const currentProducts = latestStateRef.current.products || products;
        const prod = currentProducts.find((p: ProductItem) => p.id === id);
        const next = currentProducts.filter((p: ProductItem) => p.id !== id);
        setProducts(next);
        try {
            localStorage.setItem(`${STORAGE_KEY}_PRODUCTS`, JSON.stringify(next));
        } catch {}
        latestStateRef.current = {
            ...latestStateRef.current,
            products: next,
        };
        if (prod) {
            addAuditLog({
                staffId: activeStaff.id,
                staffName: activeStaff.name,
                staffRole: activeStaff.role,
                location: 'All',
                actionType: 'PRODUCT_DELETED',
                entityType: 'Inventory',
                refNo: prod.code,
                details: `Deleted product item: ${prod.name} (${prod.code}) [Category: ${prod.category || 'N/A'}]`,
                detailsBn: undefined,
                severity: 'warning',
            });
        }
        isCloudLoadedRef.current = true;
        triggerImmediatePush();
    };
    const adjustStock = (productId: string, type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT', qty: number, location: 'Factory' | 'Office', targetLocation?: 'Factory' | 'Office', reason: string = 'Stock manual entry') => {
        const currentProducts = latestStateRef.current.products || products;
        const prod = currentProducts.find((p: ProductItem) => p.id === productId);
        if (!prod)
            return;
        const nextProds = currentProducts.map((p: ProductItem) => {
            if (p.id !== productId)
                return p;
            if (type === 'IN') {
                return location === 'Factory'
                    ? { ...p, stockFactory: p.stockFactory + qty }
                    : { ...p, stockOffice: p.stockOffice + qty };
            }
            else if (type === 'OUT' || type === 'ADJUSTMENT') {
                return location === 'Factory'
                    ? { ...p, stockFactory: Math.max(0, p.stockFactory - qty) }
                    : { ...p, stockOffice: Math.max(0, p.stockOffice - qty) };
            }
            else if (type === 'TRANSFER' && targetLocation) {
                const fromKey = location === 'Factory' ? 'stockFactory' : 'stockOffice';
                const toKey = targetLocation === 'Factory' ? 'stockFactory' : 'stockOffice';
                return {
                    ...p,
                    [fromKey]: Math.max(0, p[fromKey] - qty),
                    [toKey]: p[toKey] + qty,
                };
            }
            return p;
        });
        setProducts(nextProds);
        try {
            localStorage.setItem(`${STORAGE_KEY}_PRODUCTS`, JSON.stringify(nextProds));
        } catch {}
        const movement: StockMovement = {
            id: `sm-${Date.now()}`,
            date: new Date().toISOString().replace('T', ' ').slice(0, 16),
            productId,
            productName: prod.name,
            type,
            qty,
            unit: prod.unit,
            sourceLocation: location,
            targetLocation: targetLocation,
            refNo: `ADJ-${Date.now().toString().slice(-4)}`,
            reason,
        };
        const nextMovements = [movement, ...(latestStateRef.current.stockMovements || stockMovements)];
        setStockMovements(nextMovements);
        try {
            localStorage.setItem(`${STORAGE_KEY}_STOCK_MOVEMENTS`, JSON.stringify(nextMovements));
        } catch {}
        latestStateRef.current = {
            ...latestStateRef.current,
            products: nextProds,
            stockMovements: nextMovements,
        };
        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: location,
            actionType: type === 'TRANSFER' ? 'STOCK_TRANSFERRED' : 'STOCK_ADJUSTED',
            entityType: 'Inventory',
            refNo: movement.refNo,
            details: `${type} ${qty} ${prod.unit} of ${prod.name} at ${location}${targetLocation ? ` -> ${targetLocation}` : ''} (${reason})`,
            detailsBn: undefined,
            severity: 'info',
        });
        isCloudLoadedRef.current = true;
        triggerImmediatePush();
    };
    // Supply Chain & Purchase Orders
    const addPurchaseOrder = (data: Omit<PurchaseOrder, 'id' | 'poNo'>): PurchaseOrder => {
        const id = `po-${Date.now()}`;
        const poNo = `DCC-PO-${new Date().getFullYear()}-${Math.floor(5000 + Math.random() * 5000)}`;
        const total = data.grandTotal ?? data.totalAmount ?? 0;
        const dest = data.destination || data.destinationLocation || 'Factory';
        const newPO: PurchaseOrder = {
            ...data,
            id,
            poNo,
            poNumber: poNo,
            destination: dest,
            destinationLocation: dest,
            totalAmount: total,
            grandTotal: total,
            subtotal: data.subtotal ?? total,
            paymentStatus: data.status !== 'Received'
                ? 'Pending'
                : (data.paymentStatus || (data.dueAmount <= 0 ? 'Paid' : data.paidAmount > 0 ? 'Partial' : 'Due')),
        };
        setPurchaseOrders((prev) => [newPO, ...prev]);
        // Only update Supplier balance if goods are already received upon creation
        if (data.status === 'Received') {
            setSuppliers((prev) => prev.map((s) => {
                const sName = s.name?.toLowerCase().trim();
                const sCompany = s.company?.toLowerCase().trim();
                const supNameData = data.supplierName?.toLowerCase().trim();
                const sPhoneClean = s.phone ? s.phone.replace(/\D/g, '') : '';
                const dataPhoneClean = data.supplierPhone ? data.supplierPhone.replace(/\D/g, '') : '';
                const matches = (data.supplierId && s.id === data.supplierId) ||
                    (supNameData && sName && (sName === supNameData || sName.includes(supNameData) || supNameData.includes(sName))) ||
                    (supNameData && sCompany && (sCompany === supNameData || sCompany.includes(supNameData) || supNameData.includes(sCompany))) ||
                    (dataPhoneClean && sPhoneClean && dataPhoneClean === sPhoneClean);
                if (matches) {
                    const prevPurchased = Number(s.totalPurchased) || 0;
                    const prevDue = Number(s.dueAmount ?? s.balancePayable ?? 0);
                    const newDue = prevDue + (Number(data.dueAmount) || 0);
                    return {
                        ...s,
                        totalPurchased: prevPurchased + (Number(data.totalAmount ?? data.grandTotal) || 0),
                        dueAmount: newDue,
                        balancePayable: newDue,
                    };
                }
                return s;
            }));
        }
        // If paid amount > 0, record accounting transaction
        if (data.paidAmount > 0) {
            const newTx: AccountingTransaction = {
                id: generateUniqueId('tx'),
                date: data.date,
                type: 'EXPENSE',
                category: 'Raw Material Purchase',
                amount: data.paidAmount,
                paymentAccount: data.paymentMethod || 'Cash',
                refNo: poNo,
                customerOrSupplier: data.supplierName,
                description: `Payment for Purchase Order ${poNo} - ${data.items.map((i) => i.name).join(', ')}`,
            };
            setTransactions((prev) => ensureUniqueTransactions([newTx, ...prev]));
        }
        // Auto receive stock if marked Received
        if (data.status === 'Received' && data.items.length > 0) {
            setProducts((prev) => {
                const existingProductIds = new Set(prev.map(p => p.id));
                const updated = prev.map((p) => {
                    const item = data.items.find((i) => i.productId === p.id);
                    if (item) {
                        const locKey = data.destination === 'Factory' ? 'stockFactory' : 'stockOffice';
                        return { 
                            ...p, 
                            [locKey]: (p[locKey] || 0) + item.qty,
                            costPrice: p.costPrice > 0 ? p.costPrice : item.unitCost
                        };
                    }
                    return p;
                });
                const toAdd: ProductItem[] = [];
                data.items.forEach(item => {
                    if (!existingProductIds.has(item.productId)) {
                        toAdd.push({
                            id: item.productId,
                            name: item.name,
                            nameBn: '',
                            code: `RM-${Math.floor(100 + Math.random() * 900)}`,
                            category: 'Raw Materials',
                            unit: item.unit || 'pcs',
                            costPrice: item.unitCost,
                            unitPrice: Math.round(item.unitCost * 1.2),
                            stockOffice: data.destination === 'Office' ? item.qty : 0,
                            stockFactory: data.destination === 'Factory' ? item.qty : 0,
                            minStockAlert: 5,
                            isRawMaterial: true,
                            description: `Purchased via PO ${poNo}`,
                        });
                    }
                });
                return [...updated, ...toAdd];
            });
            const movements: StockMovement[] = data.items.map((item, idx) => ({
                id: generateUniqueId(`sm-${idx}-${item.productId}`),
                date: new Date().toISOString().replace('T', ' ').slice(0, 16),
                productId: item.productId,
                productName: item.name,
                type: 'IN',
                qty: item.qty,
                unit: item.unit,
                targetLocation: data.destination,
                refNo: poNo,
                reason: `PO Received from ${data.supplierName}`,
            }));
            setStockMovements((prev) => [...movements, ...prev]);
        }
        return newPO;
    };
    const receivePurchaseOrder = (poId: string, receivedItems?: {
        productId: string;
        receivedQty: number;
    }[]) => {
        const po = purchaseOrders.find((p) => p.id === poId);
        if (!po || po.status === 'Received')
            return;
        let updatedItems = [...po.items];
        let newSubtotal = po.subtotal || po.totalAmount;
        if (receivedItems && receivedItems.length > 0) {
            newSubtotal = 0;
            updatedItems = po.items.map(item => {
                const recItem = receivedItems.find(ri => ri.productId === item.productId);
                const rQty = recItem ? recItem.receivedQty : item.qty;
                const newTotal = rQty * item.unitCost;
                newSubtotal += newTotal;
                return {
                    ...item,
                    receivedQty: rQty,
                    totalCost: newTotal,
                };
            });
        }
        const newDue = Math.max(0, newSubtotal - po.paidAmount);
        const newPaymentStatus = newDue <= 0 ? 'Paid' : (po.paidAmount > 0 ? 'Partial' : 'Due');
        setPurchaseOrders((prev) => prev.map((p) => (p.id === poId ? {
            ...p,
            status: 'Received',
            items: updatedItems,
            subtotal: newSubtotal,
            totalAmount: newSubtotal,
            grandTotal: newSubtotal,
            dueAmount: newDue,
            paymentStatus: newPaymentStatus
        } : p)));
        // Update supplier due amount and total purchased when goods are received
        setSuppliers((prev) => prev.map((s) => {
            const sName = s.name?.toLowerCase().trim();
            const sCompany = s.company?.toLowerCase().trim();
            const supNameData = po.supplierName?.toLowerCase().trim();
            const sPhoneClean = s.phone ? s.phone.replace(/\D/g, '') : '';
            const dataPhoneClean = po.supplierPhone ? po.supplierPhone.replace(/\D/g, '') : '';
            const matches = (po.supplierId && s.id === po.supplierId) ||
                (supNameData && sName && (sName === supNameData || sName.includes(supNameData) || supNameData.includes(sName))) ||
                (supNameData && sCompany && (sCompany === supNameData || sCompany.includes(supNameData) || supNameData.includes(sCompany))) ||
                (dataPhoneClean && sPhoneClean && dataPhoneClean === sPhoneClean);
            if (matches) {
                const prevPurchased = Number(s.totalPurchased) || 0;
                const prevDue = Number(s.dueAmount ?? s.balancePayable ?? 0);
                const newTotalDue = prevDue + newDue;
                return {
                    ...s,
                    totalPurchased: prevPurchased + newSubtotal,
                    dueAmount: newTotalDue,
                    balancePayable: newTotalDue,
                };
            }
            return s;
        }));
        if (updatedItems.length > 0) {
            setProducts((prev) => {
                const existingProductIds = new Set(prev.map(p => p.id));
                const updated = prev.map((p) => {
                    const item = updatedItems.find((i) => i.productId === p.id);
                    if (item) {
                        const rQty = item.receivedQty !== undefined ? item.receivedQty : item.qty;
                        const locKey = po.destination === 'Factory' ? 'stockFactory' : 'stockOffice';
                        return { 
                            ...p, 
                            [locKey]: (p[locKey] || 0) + rQty,
                            costPrice: p.costPrice > 0 ? p.costPrice : item.unitCost
                        };
                    }
                    return p;
                });
                const toAdd: ProductItem[] = [];
                updatedItems.forEach(item => {
                    if (!existingProductIds.has(item.productId)) {
                        const rQty = item.receivedQty !== undefined ? item.receivedQty : item.qty;
                        toAdd.push({
                            id: item.productId,
                            name: item.name,
                            nameBn: '',
                            code: `RM-${Math.floor(100 + Math.random() * 900)}`,
                            category: 'Raw Materials',
                            unit: item.unit || 'pcs',
                            costPrice: item.unitCost,
                            unitPrice: Math.round(item.unitCost * 1.2),
                            stockOffice: po.destination === 'Office' ? rQty : 0,
                            stockFactory: po.destination === 'Factory' ? rQty : 0,
                            minStockAlert: 5,
                            isRawMaterial: true,
                            description: `Purchased via PO ${po.poNo}`,
                        });
                    }
                });
                return [...updated, ...toAdd];
            });
            const movements: StockMovement[] = updatedItems.map((item, idx) => {
                const rQty = item.receivedQty !== undefined ? item.receivedQty : item.qty;
                return {
                    id: generateUniqueId(`sm-${idx}-${item.productId}`),
                    date: new Date().toISOString().replace('T', ' ').slice(0, 16),
                    productId: item.productId,
                    productName: item.name,
                    type: 'IN',
                    qty: rQty,
                    unit: item.unit,
                    targetLocation: po.destination,
                    refNo: po.poNo,
                    reason: `PO marked received from ${po.supplierName}`,
                };
            });
            setStockMovements((prev) => [...movements, ...prev]);
        }
        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: po.destination === 'Factory' ? 'Factory' : 'Office',
            actionType: 'PO_RECEIVED',
            entityType: 'Supply Chain',
            refNo: po.poNo,
            details: `Received material delivery for PO ${po.poNo} from ${po.supplierName} (Total: Tk ${(po.grandTotal || po.totalAmount || 0).toLocaleString()})`,
            detailsBn: undefined,
            amount: po.grandTotal || po.totalAmount || 0,
            severity: 'info',
        });
    };
    const payPurchaseOrder = (poId: string, amount: number, paymentAccount: any = 'Cash', paymentMethod: any = 'Cash') => {
        const po = purchaseOrders.find((p) => p.id === poId);
        if (!po)
            return;
        const safeAmount = Math.max(0, Number(amount) || 0);
        if (safeAmount <= 0)
            return;
        const currentGrandTotal = po.grandTotal ?? po.totalAmount ?? 0;
        const currentPaid = po.paidAmount || 0;
        const newPaid = Math.min(currentGrandTotal, currentPaid + safeAmount);
        const newDue = Math.max(0, currentGrandTotal - newPaid);
        const newStatus: 'Paid' | 'Partial' | 'Due' = newDue <= 0 ? 'Paid' : newPaid > 0 ? 'Partial' : 'Due';
        // 1. Update the Purchase Order
        setPurchaseOrders((prev) => prev.map((p) => p.id === poId
            ? {
                ...p,
                paidAmount: newPaid,
                dueAmount: newDue,
                paymentStatus: newStatus,
                paymentMethod: paymentMethod || p.paymentMethod || 'Bank Transfer',
            }
            : p));
        // 2. Also reduce the Supplier's due amount / balance payable
        const poSupName = po.supplierName?.toLowerCase().trim();
        const poSupPhone = (po.supplierPhone || '').replace(/\D/g, '');
        setSuppliers((prev) => prev.map((s) => {
            const sName = s.name?.toLowerCase().trim();
            const sCompany = s.company?.toLowerCase().trim();
            const sPhone = (s.phone || '').replace(/\D/g, '');
            const matches = (po.supplierId && s.id === po.supplierId) ||
                (poSupName && sName && (sName === poSupName || sName.includes(poSupName) || poSupName.includes(sName))) ||
                (poSupName && sCompany && (sCompany === poSupName || sCompany.includes(poSupName) || poSupName.includes(sCompany))) ||
                (poSupPhone && sPhone && poSupPhone === sPhone);
            if (matches) {
                const currentSupDue = Number(s.dueAmount ?? s.balancePayable ?? 0);
                const updatedSupDue = Math.max(0, currentSupDue - safeAmount);
                return {
                    ...s,
                    dueAmount: updatedSupDue,
                    balancePayable: updatedSupDue,
                };
            }
            return s;
        }));
        // 3. Add accounting transaction
        const newTx: AccountingTransaction = {
            id: generateUniqueId('tx'),
            date: new Date().toISOString().slice(0, 10),
            type: 'EXPENSE',
            category: 'Raw Materials / PO Payment',
            amount: safeAmount,
            paymentAccount: paymentAccount || paymentMethod || 'Cash',
            refNo: po.poNo,
            customerOrSupplier: po.supplierName,
            description: `Payment for Purchase Order ${po.poNo} (${newStatus}) - Supplier: ${po.supplierName}`,
        };
        setTransactions((prev) => ensureUniqueTransactions([newTx, ...prev]));
        // 4. Audit log
        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: po.destination === 'Factory' ? 'Factory' : 'Office',
            actionType: 'SUPPLIER_PAID',
            entityType: 'Supply Chain',
            refNo: po.poNo,
            details: `Paid Tk ${safeAmount.toLocaleString()} for Purchase Order ${po.poNo} to ${po.supplierName}. Status: ${newStatus}`,
            detailsBn: undefined,
            amount: safeAmount,
            severity: 'success',
        });
    };
    const paySupplierDue = (supplierId: string, amount: number, account: any, targetPoId?: string) => {
        const safeAmount = Math.max(0, Number(amount) || 0);
        if (safeAmount <= 0)
            return;
        const sup = suppliers.find((s) => s.id === supplierId || s.name.toLowerCase().trim() === supplierId.toLowerCase().trim());
        const supName = sup?.name?.toLowerCase().trim();
        const supCompany = sup?.company?.toLowerCase().trim();
        const supPhone = sup?.phone ? sup.phone.replace(/\D/g, '') : '';
        const supId = sup?.id || supplierId;
        setSuppliers((prev) => prev.map((s) => {
            const isThisSup = s.id === supplierId ||
                s.id === supId ||
                (supName && s.name.toLowerCase().trim() === supName) ||
                (supCompany && s.company?.toLowerCase().trim() === supCompany) ||
                (supPhone && s.phone && s.phone.replace(/\D/g, '') === supPhone);
            if (isThisSup) {
                const currentDue = Number(s.dueAmount ?? s.balancePayable ?? 0);
                const newDue = Math.max(0, currentDue - safeAmount);
                return { ...s, dueAmount: newDue, balancePayable: newDue };
            }
            return s;
        }));
        // Update POs for this supplier so PO statuses & action buttons sync immediately with payment
        setPurchaseOrders((prev) => {
            let remaining = safeAmount;
            return prev.map((p) => {
                const isTarget = targetPoId && targetPoId !== 'all' ? p.id === targetPoId : true;
                const pSuppName = (p.supplierName || '').toLowerCase().trim();
                const pSuppPhone = (p.supplierPhone || '').replace(/\D/g, '');
                const matchesSupplier = (targetPoId && targetPoId !== 'all' && p.id === targetPoId) ||
                    p.supplierId === supplierId ||
                    p.supplierId === supId ||
                    (supName && pSuppName === supName) ||
                    (supName && (pSuppName.includes(supName) || supName.includes(pSuppName))) ||
                    (supCompany && pSuppName === supCompany) ||
                    (supCompany && (pSuppName.includes(supCompany) || supCompany.includes(pSuppName))) ||
                    (supPhone && pSuppPhone && supPhone === pSuppPhone);
                const currentTotal = Number(p.grandTotal ?? p.totalAmount ?? 0);
                const currentPaid = Number(p.paidAmount || 0);
                const currentDue = p.dueAmount !== undefined ? Number(p.dueAmount) : Math.max(0, currentTotal - currentPaid);
                if (matchesSupplier && isTarget && (targetPoId && targetPoId !== 'all' ? true : p.status === 'Received') && currentDue > 0 && remaining > 0) {
                    const payForThisPo = Math.min(currentDue, remaining);
                    remaining -= payForThisPo;
                    const newPaid = currentPaid + payForThisPo;
                    const newDue = Math.max(0, currentTotal - newPaid);
                    const newStatus: 'Paid' | 'Partial' | 'Due' = newDue <= 0 ? 'Paid' : newPaid > 0 ? 'Partial' : 'Due';
                    return {
                        ...p,
                        paidAmount: newPaid,
                        dueAmount: newDue,
                        paymentStatus: newStatus,
                    };
                }
                return p;
            });
        });
        const newTx: AccountingTransaction = {
            id: generateUniqueId('tx'),
            date: new Date().toISOString().slice(0, 10),
            type: 'EXPENSE',
            category: 'Supplier Due Payment',
            amount: safeAmount,
            paymentAccount: account || 'Cash',
            customerOrSupplier: sup?.company || sup?.name || 'Vendor',
            description: `Payment to supplier ${sup?.name} for clearing dues`,
        };
        setTransactions((prev) => ensureUniqueTransactions([newTx, ...prev]));
        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: 'Office',
            actionType: 'SUPPLIER_PAID',
            entityType: 'Supply Chain',
            refNo: `SUP-PAY-${Date.now().toString().slice(-4)}`,
            details: `Paid supplier due of Tk ${safeAmount.toLocaleString()} to ${sup?.company || sup?.name || 'Vendor'} via ${account || 'Cash'}`,
            detailsBn: undefined,
            amount: safeAmount,
            severity: 'warning',
        });
    };
    // Customers & Suppliers
    const addCustomer = (cust: Omit<Customer, 'id' | 'totalPurchased' | 'dueAmount' | 'createdAt'>): Customer => {
        const newCust: Customer = {
            ...cust,
            id: `cust-${Date.now()}`,
            totalPurchased: 0,
            dueAmount: 0,
            advanceBalance: Number(cust.advanceBalance) || 0,
            createdAt: new Date().toISOString().slice(0, 10),
        };
        setCustomers((prev) => {
            const next = [newCust, ...prev.filter((c) => c.id !== newCust.id)];
            try {
                localStorage.setItem(`${STORAGE_KEY}_CUSTOMERS`, JSON.stringify(next));
            } catch { }
            return next;
        });
        latestStateRef.current = {
            ...latestStateRef.current,
            customers: [newCust, ...(latestStateRef.current.customers || []).filter((c) => c.id !== newCust.id)],
        };
        isCloudLoadedRef.current = true;
        triggerImmediatePush();
        return newCust;
    };
    const updateCustomer = (id: string, updates: Partial<Customer>) => {
        setCustomers((prev) => {
            const next = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
            try {
                localStorage.setItem(`${STORAGE_KEY}_CUSTOMERS`, JSON.stringify(next));
            } catch { }
            return next;
        });
        latestStateRef.current = {
            ...latestStateRef.current,
            customers: (latestStateRef.current.customers || []).map((c) => (c.id === id ? { ...c, ...updates } : c)),
        };
        isCloudLoadedRef.current = true;
        triggerImmediatePush();
    };
    const addSupplier = (sup: Omit<Supplier, 'id' | 'totalPurchased' | 'dueAmount'>): Supplier => {
        const newSup: Supplier = {
            ...sup,
            id: `sup-${Date.now()}`,
            totalPurchased: 0,
            dueAmount: 0,
            balancePayable: sup.balancePayable ?? 0,
        };
        setSuppliers((prev) => {
            const next = [newSup, ...prev.filter((s) => s.id !== newSup.id)];
            try {
                localStorage.setItem(`${STORAGE_KEY}_SUPPLIERS`, JSON.stringify(next));
            } catch { }
            return next;
        });
        latestStateRef.current = {
            ...latestStateRef.current,
            suppliers: [newSup, ...(latestStateRef.current.suppliers || []).filter((s) => s.id !== newSup.id)],
        };
        addAuditLog({
            staffId: activeStaff?.id || 'sys',
            staffName: activeStaff?.name || 'Staff',
            staffRole: activeStaff?.role || 'Staff',
            location: 'Factory',
            actionType: 'SUPPLIER_UPDATED',
            entityType: 'Supply Chain',
            refNo: newSup.id,
            details: `Enlisted new vendor / supplier: ${newSup.name} (${newSup.phone})`,
            detailsBn: undefined,
            severity: 'info',
        });
        isCloudLoadedRef.current = true;
        setTimeout(() => {
            syncWithCloud();
        }, 100);
        return newSup;
    };
    const updateSupplier = (id: string, updates: Partial<Supplier>) => {
        setSuppliers((prev) => {
            const next = prev.map((s) => (s.id === id ? { ...s, ...updates } : s));
            try {
                localStorage.setItem(`${STORAGE_KEY}_SUPPLIERS`, JSON.stringify(next));
            } catch { }
            return next;
        });
        latestStateRef.current = {
            ...latestStateRef.current,
            suppliers: (latestStateRef.current.suppliers || []).map((s) => (s.id === id ? { ...s, ...updates } : s)),
        };
        addAuditLog({
            staffId: activeStaff?.id || 'sys',
            staffName: activeStaff?.name || 'Staff',
            staffRole: activeStaff?.role || 'Staff',
            location: 'Factory',
            actionType: 'SUPPLIER_UPDATED',
            entityType: 'Supply Chain',
            refNo: id,
            details: `Updated vendor details for: ${updates.name || id}`,
            detailsBn: undefined,
            severity: 'info',
        });
        isCloudLoadedRef.current = true;
        setTimeout(() => {
            syncWithCloud();
        }, 100);
    };
    const deleteCustomer = (id: string) => {
        const cust = customers.find((c) => c.id === id);
        setCustomers((prev) => {
            const next = prev.filter((c) => c.id !== id);
            try {
                localStorage.setItem(`${STORAGE_KEY}_CUSTOMERS`, JSON.stringify(next));
            } catch { }
            return next;
        });
        latestStateRef.current = {
            ...latestStateRef.current,
            customers: (latestStateRef.current.customers || []).filter((c) => c.id !== id),
        };
        if (cust) {
            addAuditLog({
                staffId: activeStaff.id,
                staffName: activeStaff.name,
                staffRole: activeStaff.role,
                location: 'Office',
                actionType: 'CUSTOMER_CREATED',
                entityType: 'Sales',
                refNo: cust.code || cust.phone,
                details: `Deleted customer record: ${cust.name} (${cust.phone})`,
                detailsBn: undefined,
                severity: 'warning',
            });
        }
        isCloudLoadedRef.current = true;
        setTimeout(() => {
            syncWithCloud();
        }, 100);
    };
    const deleteSupplier = (id: string) => {
        const sup = suppliers.find((s) => s.id === id);
        setSuppliers((prev) => {
            const next = prev.filter((s) => s.id !== id);
            try {
                localStorage.setItem(`${STORAGE_KEY}_SUPPLIERS`, JSON.stringify(next));
            } catch { }
            return next;
        });
        latestStateRef.current = {
            ...latestStateRef.current,
            suppliers: (latestStateRef.current.suppliers || []).filter((s) => s.id !== id),
        };
        if (sup) {
            addAuditLog({
                staffId: activeStaff.id,
                staffName: activeStaff.name,
                staffRole: activeStaff.role,
                location: 'Factory',
                actionType: 'SUPPLIER_UPDATED',
                entityType: 'Supply Chain',
                refNo: sup.phone,
                details: `Deleted supplier record: ${sup.name}`,
                detailsBn: undefined,
                severity: 'warning',
            });
        }
        isCloudLoadedRef.current = true;
        setTimeout(() => {
            syncWithCloud();
        }, 100);
    };
    const deleteInvoice = (id: string) => {
        const currentInvoices = latestStateRef.current.invoices || invoices;
        const inv = currentInvoices.find((i: SalesInvoice) => i.id === id);
        if (!inv)
            return;
        const nextInvoices = currentInvoices.filter((i: SalesInvoice) => i.id !== id);
        setInvoices(nextInvoices);
        try {
            localStorage.setItem(`${STORAGE_KEY}_INVOICES`, JSON.stringify(nextInvoices));
        } catch {}

        const currentCusts = latestStateRef.current.customers || customers;
        const nextCusts = currentCusts.map((c: Customer) => {
            if (isInvoiceMatchingCustomer(inv, c)) {
                const clientInvoices = nextInvoices.filter(i => isInvoiceMatchingCustomer(i, c));
                const totalPurchased = clientInvoices.length > 0
                    ? clientInvoices.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0)
                    : 0;
                const dueAmount = clientInvoices.length > 0
                    ? clientInvoices.reduce((s, i) => s + (Number(i.dueAmount) || 0), 0)
                    : 0;
                return {
                    ...c,
                    totalPurchased,
                    dueAmount,
                };
            }
            return c;
        });
        setCustomers(nextCusts);
        try {
            localStorage.setItem(`${STORAGE_KEY}_CUSTOMERS`, JSON.stringify(nextCusts));
        } catch {}

        if (inv.projectId) {
            updateProject(inv.projectId, {
                invoiceId: undefined,
                invoiceNo: undefined,
            });
        }

        latestStateRef.current = {
            ...latestStateRef.current,
            invoices: nextInvoices,
            customers: nextCusts,
        };
        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: inv.warehouseLocation || 'Office',
            actionType: 'INVOICE_UPDATED',
            entityType: 'Sales',
            refNo: inv.invoiceNo,
            details: `Deleted sales invoice ${inv.invoiceNo} (Tk ${inv.grandTotal.toLocaleString()}) for customer ${inv.customerName}`,
            detailsBn: undefined,
            amount: inv.grandTotal,
            severity: 'warning',
        });
        isCloudLoadedRef.current = true;
        triggerImmediatePush();
    };
    const deleteQuotation = (id: string) => {
        const currentQuotes = latestStateRef.current.quotations || quotations;
        const next = currentQuotes.filter((q: Quotation) => q.id !== id);
        setQuotations(next);
        try {
            localStorage.setItem(`${STORAGE_KEY}_QUOTATIONS`, JSON.stringify(next));
        } catch {}
        latestStateRef.current = {
            ...latestStateRef.current,
            quotations: next,
        };
        isCloudLoadedRef.current = true;
        triggerImmediatePush();
    };
    const deletePurchaseOrder = (id: string) => {
        const currentPOs = latestStateRef.current.purchaseOrders || purchaseOrders;
        const po = currentPOs.find((p: PurchaseOrder) => p.id === id);
        if (!po)
            return;
        const next = currentPOs.filter((p: PurchaseOrder) => p.id !== id);
        setPurchaseOrders(next);
        try {
            localStorage.setItem(`${STORAGE_KEY}_PURCHASE_ORDERS`, JSON.stringify(next));
        } catch {}
        latestStateRef.current = {
            ...latestStateRef.current,
            purchaseOrders: next,
        };
        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: po.destination || 'Factory',
            actionType: 'PO_CREATED',
            entityType: 'Supply Chain',
            refNo: po.poNo,
            details: `Deleted purchase order ${po.poNo} for supplier ${po.supplierName}`,
            detailsBn: undefined,
            amount: po.totalAmount,
            severity: 'warning',
        });
        isCloudLoadedRef.current = true;
        triggerImmediatePush();
    };
    const updatePurchaseOrder = (id: string, updates: Partial<PurchaseOrder>) => {
        const currentPOs = latestStateRef.current.purchaseOrders || purchaseOrders;
        const next = currentPOs.map((p: PurchaseOrder) => (p.id === id ? { ...p, ...updates } : p));
        setPurchaseOrders(next);
        try {
            localStorage.setItem(`${STORAGE_KEY}_PURCHASE_ORDERS`, JSON.stringify(next));
        } catch {}
        latestStateRef.current = {
            ...latestStateRef.current,
            purchaseOrders: next,
        };
        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: 'Factory',
            actionType: 'PO_CREATED',
            entityType: 'Supply Chain',
            refNo: id,
            details: `Updated purchase order details`,
            detailsBn: `Order`,
            amount: updates.grandTotal || updates.totalAmount,
            severity: 'info',
        });
        isCloudLoadedRef.current = true;
        triggerImmediatePush();
    };
    // Product Categories
    const addProductCategory = (cat: Omit<ProductCategory, 'id'>): ProductCategory => {
        const isRaw = Boolean(cat.isRawMaterialGroup || cat.isRawMaterial);
        const newCat: ProductCategory = {
            ...cat,
            isRawMaterialGroup: isRaw,
            isRawMaterial: isRaw,
            id: `cat-${Date.now()}`,
        };
        const currentCats = latestStateRef.current.productCategories || productCategories;
        const next = [...currentCats, newCat];
        setProductCategories(next);
        try {
            localStorage.setItem(`${STORAGE_KEY}_CATEGORIES`, JSON.stringify(next));
        } catch {}
        latestStateRef.current = {
            ...latestStateRef.current,
            productCategories: next,
        };
        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: 'Office',
            actionType: 'CATEGORY_CREATED',
            entityType: 'Inventory',
            refNo: newCat.code,
            details: `Added new Product Category: ${newCat.name} (${newCat.nameBn})`,
            detailsBn: undefined,
            severity: 'info',
        });
        isCloudLoadedRef.current = true;
        triggerImmediatePush();
        return newCat;
    };
    const updateProductCategory = (id: string, updates: Partial<ProductCategory>) => {
        const currentCats = latestStateRef.current.productCategories || productCategories;
        const oldCat = currentCats.find((c: ProductCategory) => c.id === id);
        const resolvedUpdates: Partial<ProductCategory> = {
            ...updates,
            ...(updates.isRawMaterialGroup !== undefined ? { isRawMaterial: updates.isRawMaterialGroup } : {}),
            ...(updates.isRawMaterial !== undefined ? { isRawMaterialGroup: updates.isRawMaterial } : {}),
        };
        const nextCats = currentCats.map((c: ProductCategory) => (c.id === id ? { ...c, ...resolvedUpdates } : c));
        setProductCategories(nextCats);
        try {
            localStorage.setItem(`${STORAGE_KEY}_CATEGORIES`, JSON.stringify(nextCats));
        } catch {}

        let nextProds = latestStateRef.current.products || products;
        if (oldCat && resolvedUpdates.name && resolvedUpdates.name.trim() !== oldCat.name) {
            const nextCatName = resolvedUpdates.name.trim();
            nextProds = nextProds.map((p: ProductItem) => (p.category?.toLowerCase() === oldCat.name.toLowerCase() ? { ...p, category: nextCatName } : p));
            setProducts(nextProds);
            try {
                localStorage.setItem(`${STORAGE_KEY}_PRODUCTS`, JSON.stringify(nextProds));
            } catch {}
        }

        latestStateRef.current = {
            ...latestStateRef.current,
            productCategories: nextCats,
            products: nextProds,
        };
        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: 'Office',
            actionType: 'CATEGORY_UPDATED',
            entityType: 'Inventory',
            details: `Updated Product Category (${id})`,
            detailsBn: undefined,
            severity: 'info',
        });
        isCloudLoadedRef.current = true;
        triggerImmediatePush();
    };
    const deleteProductCategory = (id: string): {
        success: boolean;
        message?: string;
    } => {
        const currentCats = latestStateRef.current.productCategories || productCategories;
        const cat = currentCats.find((c: ProductCategory) => c.id === id);
        if (!cat)
            return { success: false, message: 'Category not found' };
        const currentProds = latestStateRef.current.products || products;
        const hasProducts = currentProds.some((p: ProductItem) => p.category?.toLowerCase() === cat.name.toLowerCase());
        if (hasProducts) {
            return {
                success: false,
                message: `Cannot delete category: products are assigned to "${cat.name}". Please reassign them first.`,
            };
        }
        const next = currentCats.filter((c: ProductCategory) => c.id !== id);
        setProductCategories(next);
        try {
            localStorage.setItem(`${STORAGE_KEY}_CATEGORIES`, JSON.stringify(next));
        } catch {}
        latestStateRef.current = {
            ...latestStateRef.current,
            productCategories: next,
        };
        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: 'Office',
            actionType: 'CATEGORY_DELETED',
            entityType: 'Inventory',
            refNo: cat.code,
            details: `Deleted Product Category: ${cat.name}`,
            detailsBn: undefined,
            severity: 'warning',
        });
        isCloudLoadedRef.current = true;
        triggerImmediatePush();
        return { success: true };
    };
    // Chart of Accounts
    const addChartOfAccount = (account: Omit<ChartOfAccount, 'id' | 'currentBalance'>): ChartOfAccount => {
        const newAcct: ChartOfAccount = {
            ...account,
            id: `coa-${Date.now()}`,
            currentBalance: account.openingBalance || 0,
            isActive: true,
        };
        const updated = [...(latestStateRef.current.chartOfAccounts || []), newAcct];
        setChartOfAccounts(updated);
        latestStateRef.current.chartOfAccounts = updated;
        try {
            localStorage.setItem(`${STORAGE_KEY}_COA`, JSON.stringify(updated));
        } catch {}
        pushToCloudRef.current?.();

        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: 'Office',
            actionType: 'COA_CREATED',
            entityType: 'Accounting',
            refNo: newAcct.code,
            details: `Created Chart of Accounts head: [${newAcct.code}] ${newAcct.name} (${newAcct.classification})`,
            detailsBn: undefined,
            severity: 'info',
        });
        return newAcct;
    };
    const updateChartOfAccount = (id: string, updates: Partial<ChartOfAccount>) => {
        const updated = (latestStateRef.current.chartOfAccounts || []).map((a) => {
            if (a.id === id) {
                const newAccount = { ...a, ...updates };
                if (updates.openingBalance !== undefined && updates.openingBalance !== a.openingBalance) {
                    const diff = updates.openingBalance - a.openingBalance;
                    newAccount.currentBalance = (a.currentBalance || 0) + diff;
                }
                return newAccount;
            }
            return a;
        });
        setChartOfAccounts(updated);
        latestStateRef.current.chartOfAccounts = updated;
        try {
            localStorage.setItem(`${STORAGE_KEY}_COA`, JSON.stringify(updated));
        } catch {}
        pushToCloudRef.current?.();

        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: 'Office',
            actionType: 'COA_UPDATED',
            entityType: 'Accounting',
            details: `Updated Chart of Account entry (${id})`,
            detailsBn: undefined,
            severity: 'info',
        });
    };
    const deleteChartOfAccount = (id: string, force: boolean = false): {
        success: boolean;
        message?: string;
        requiresForce?: boolean;
    } => {
        const target = (latestStateRef.current.chartOfAccounts || []).find((a) => a.id === id);
        if (!target)
            return { success: false, message: 'Account not found' };
        
        const hasJournals = (latestStateRef.current.journalEntries || []).some((j) => j.debitAccountId === id || j.creditAccountId === id);
        if (hasJournals && !force) {
            return {
                success: false,
                message: `This account has recorded journal entries/transactions (Balance: ${profile.currencySymbol}${target.currentBalance.toLocaleString()}).`,
                requiresForce: true,
            };
        }

        // If force is requested and account has journals, clean up associated journals
        if (hasJournals && force) {
            const updatedJournals = (latestStateRef.current.journalEntries || []).filter((j) => j.debitAccountId !== id && j.creditAccountId !== id);
            setJournalEntries(updatedJournals);
            latestStateRef.current.journalEntries = updatedJournals;
            try {
                localStorage.setItem(`${STORAGE_KEY}_JOURNALS`, JSON.stringify(updatedJournals));
            } catch {}
        }

        const updatedCOA = (latestStateRef.current.chartOfAccounts || []).filter((a) => a.id !== id);
        setChartOfAccounts(updatedCOA);
        latestStateRef.current.chartOfAccounts = updatedCOA;
        try {
            localStorage.setItem(`${STORAGE_KEY}_COA`, JSON.stringify(updatedCOA));
        } catch {}

        pushToCloudRef.current?.();

        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: 'Office',
            actionType: 'COA_DELETED',
            entityType: 'Accounting',
            refNo: target.code,
            details: `Deleted Chart of Account head: [${target.code}] ${target.name}`,
            detailsBn: undefined,
            severity: 'warning',
        });
        return { success: true };
    };
    // Expense Heads
    const addExpenseHead = (head: Omit<ExpenseHead, 'id'>): ExpenseHead => {
        const newHead: ExpenseHead = {
            ...head,
            id: `eh-${Date.now()}`,
            isActive: head.isActive ?? true,
        };
        const updated = [newHead, ...(latestStateRef.current.expenseHeads || [])];
        setExpenseHeads(updated);
        latestStateRef.current.expenseHeads = updated;
        try {
            localStorage.setItem(`${STORAGE_KEY}_EXPENSE_HEADS`, JSON.stringify(updated));
        } catch {}
        pushToCloudRef.current?.();

        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: 'Office',
            actionType: 'EXPENSE_HEAD_CREATED',
            entityType: 'Accounting',
            refNo: newHead.code,
            details: `Added new Expense Head: ${newHead.name} (${newHead.nameBn})`,
            detailsBn: undefined,
            severity: 'info',
        });
        return newHead;
    };
    const updateExpenseHead = (id: string, updates: Partial<ExpenseHead>) => {
        const updated = (latestStateRef.current.expenseHeads || []).map((h) => (h.id === id ? { ...h, ...updates } : h));
        setExpenseHeads(updated);
        latestStateRef.current.expenseHeads = updated;
        try {
            localStorage.setItem(`${STORAGE_KEY}_EXPENSE_HEADS`, JSON.stringify(updated));
        } catch {}
        pushToCloudRef.current?.();

        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: 'Office',
            actionType: 'EXPENSE_HEAD_UPDATED',
            entityType: 'Accounting',
            details: `Updated Expense Head details for ID ${id}`,
            detailsBn: undefined,
            severity: 'info',
        });
    };
    const deleteExpenseHead = (id: string): {
        success: boolean;
        message?: string;
    } => {
        const head = (latestStateRef.current.expenseHeads || []).find((h) => h.id === id);
        if (!head)
            return { success: false, message: 'Expense head not found' };
        const updated = (latestStateRef.current.expenseHeads || []).filter((h) => h.id !== id);
        setExpenseHeads(updated);
        latestStateRef.current.expenseHeads = updated;
        try {
            localStorage.setItem(`${STORAGE_KEY}_EXPENSE_HEADS`, JSON.stringify(updated));
        } catch {}
        pushToCloudRef.current?.();

        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: 'Office',
            actionType: 'EXPENSE_HEAD_DELETED',
            entityType: 'Accounting',
            refNo: head.code,
            details: `Deleted Expense Head: ${head.name}`,
            detailsBn: undefined,
            severity: 'warning',
        });
        return { success: true };
    };
    // Staff & User Management
    const addStaffMember = (staff: Omit<StaffMember, 'id'>): StaffMember => {
        const newStaff: StaffMember = {
            ...staff,
            id: `staff-${Date.now()}`,
            isActive: staff.isActive ?? true,
        };
        setStaffMembers((prev) => {
            const next = [...prev, newStaff];
            try {
                localStorage.setItem(`${STORAGE_KEY}_STAFF`, JSON.stringify(next));
            }
            catch { }
            return next;
        });
        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: newStaff.location === 'Both' ? 'All' : newStaff.location,
            actionType: 'USER_CREATED',
            entityType: 'Configuration',
            details: `Added new user/staff: ${newStaff.name} (${newStaff.role})`,
            detailsBn: undefined,
            severity: 'info',
        });
        // Immediately ensure cloud sync is active and flush to MongoDB Atlas
        isCloudLoadedRef.current = true;
        setTimeout(() => {
            syncWithCloud();
        }, 100);
        return newStaff;
    };
    const updateStaffMember = (id: string, updates: Partial<StaffMember>) => {
        let updatedActiveMember: StaffMember | null = null;
        setStaffMembers((prev) => {
            const next = prev.map((s) => {
                if (s.id === id) {
                    const updated = { ...s, ...updates };
                    if (activeStaff?.id === id) {
                        updatedActiveMember = updated;
                    }
                    return updated;
                }
                return s;
            });
            try {
                localStorage.setItem(`${STORAGE_KEY}_STAFF`, JSON.stringify(next));
            }
            catch { }
            return next;
        });
        if (updatedActiveMember) {
            setActiveStaff(updatedActiveMember);
        }
        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.id === id && updates.name ? updates.name : activeStaff.name,
            staffRole: activeStaff.role,
            location: 'All',
            actionType: 'USER_UPDATED',
            entityType: 'Configuration',
            details: `Updated staff profile/role for ID ${id}`,
            detailsBn: undefined,
            severity: 'info',
        });
        isCloudLoadedRef.current = true;
        setTimeout(() => {
            syncWithCloud();
        }, 100);
    };
    const deleteStaffMember = (id: string): {
        success: boolean;
        message?: string;
    } => {
        if (staffMembers.length <= 1) {
            return { success: false, message: 'System requires at least one active administrator.' };
        }
        const staff = staffMembers.find((s) => s.id === id);
        if (!staff)
            return { success: false, message: 'User not found' };
        if (staff.role === 'Super Admin' ||
            (staff.name || '').toLowerCase() === 'super admin' ||
            staff.id === 'staff-superadmin') {
            return { success: false, message: 'Super Admin is a permanent system root account and cannot be deleted.' };
        }
        if (staff.id === activeStaff.id) {
            return { success: false, message: 'You cannot delete the currently logged-in active user. Please switch user profile first.' };
        }
        setStaffMembers((prev) => {
            const next = prev.filter((s) => s.id !== id);
            try {
                localStorage.setItem(`${STORAGE_KEY}_STAFF`, JSON.stringify(next));
            }
            catch { }
            return next;
        });
        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: 'All',
            actionType: 'USER_DELETED',
            entityType: 'Configuration',
            details: `Removed user/staff: ${staff.name} (${staff.role})`,
            detailsBn: undefined,
            severity: 'warning',
        });
        isCloudLoadedRef.current = true;
        setTimeout(() => {
            syncWithCloud();
        }, 100);
        return { success: true };
    };
    // Roles & Permissions (RBAC)
    const addUserRole = (role: Omit<UserRole, 'id'>): UserRole => {
        const trimmedName = role.name.trim();
        if (trimmedName.toLowerCase() === 'super admin' || trimmedName.toLowerCase() === 'superadmin') {
            const rootSuper = userRoles.find((r) => r.id === 'role-superadmin') || userRoles[0];
            return rootSuper;
        }
        const newRole: UserRole = {
            ...role,
            name: trimmedName,
            id: `role-${Date.now()}`,
            isSystem: false,
        };
        setUserRoles((prev) => sanitizeUserRoles([...prev, newRole]));
        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: 'All',
            actionType: 'ROLE_UPDATED',
            entityType: 'Configuration',
            details: `Created new custom role: ${newRole.name} with ${newRole.permissions.length} permissions`,
            detailsBn: undefined,
            severity: 'info',
        });
        isCloudLoadedRef.current = true;
        setTimeout(() => {
            syncWithCloud();
        }, 100);
        return newRole;
    };
    const updateUserRole = (id: string, updates: Partial<UserRole>) => {
        const role = userRoles.find((r) => r.id === id);
        if (!role) return;

        if (role.id === 'role-superadmin' ||
            role.name.toLowerCase() === 'super admin' ||
            role.name.toLowerCase() === 'superadmin') {
            // Super Admin permanently retains all permissions and cannot be modified
            return;
        }

        if (updates.name && (updates.name.trim().toLowerCase() === 'super admin' || updates.name.trim().toLowerCase() === 'superadmin')) {
            alert('Cannot rename role to "Super Admin". Super Admin is unique.');
            return;
        }

        setUserRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
        // If role name changed, keep assigned staff members' role in sync
        if (updates.name && updates.name !== role.name) {
            setStaffMembers((prevStaff) => {
                const nextStaff = prevStaff.map((s) => (s.customRoleId === id || s.role === role.name ? { ...s, role: updates.name as StaffRole } : s));
                try {
                    localStorage.setItem(`${STORAGE_KEY}_STAFF`, JSON.stringify(nextStaff));
                } catch {}
                return nextStaff;
            });
        }
        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: 'All',
            actionType: 'ROLE_UPDATED',
            entityType: 'Configuration',
            details: `Updated role permissions for role: ${updates.name || role.name}`,
            detailsBn: undefined,
            severity: 'info',
        });
        isCloudLoadedRef.current = true;
        setTimeout(() => {
            syncWithCloud();
        }, 100);
    };
    const deleteUserRole = (id: string): {
        success: boolean;
        message?: string;
    } => {
        const role = userRoles.find((r) => r.id === id);
        if (!role)
            return { success: false, message: 'Role not found' };
        if (role.id === 'role-superadmin' ||
            role.name.toLowerCase() === 'super admin' ||
            role.name.toLowerCase() === 'superadmin') {
            return { success: false, message: 'Super Admin is the permanent system root role and cannot be deleted.' };
        }

        const fallbackRole = userRoles.find((r) => r.id !== id && r.id === 'role-superadmin') || userRoles.find((r) => r.id !== id);
        const assignedStaff = staffMembers.filter((s) => s.customRoleId === id || s.role === role.name);

        setUserRoles((prev) => prev.filter((r) => r.id !== id));

        if (assignedStaff.length > 0 && fallbackRole) {
            setStaffMembers((prev) => {
                const updated = prev.map((staff) => {
                    if (staff.customRoleId === id || staff.role === role.name) {
                        return {
                            ...staff,
                            customRoleId: fallbackRole.id,
                            role: fallbackRole.name as StaffRole,
                            roleBn: fallbackRole.nameBn || '',
                        };
                    }
                    return staff;
                });
                try {
                    localStorage.setItem(`${STORAGE_KEY}_STAFF`, JSON.stringify(updated));
                } catch {}
                return updated;
            });
            setActiveStaff((prev) => {
                if (prev && (prev.customRoleId === id || prev.role === role.name)) {
                    return {
                        ...prev,
                        customRoleId: fallbackRole.id,
                        role: fallbackRole.name as StaffRole,
                        roleBn: fallbackRole.nameBn || '',
                    };
                }
                return prev;
            });
        }

        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: 'All',
            actionType: 'ROLE_UPDATED',
            entityType: 'Configuration',
            details: `Deleted role: ${role.name}${assignedStaff.length > 0 ? ` (Reassigned ${assignedStaff.length} staff to ${fallbackRole?.name})` : ''}`,
            detailsBn: undefined,
            severity: 'warning',
        });
        isCloudLoadedRef.current = true;
        setTimeout(() => {
            syncWithCloud();
        }, 100);
        return { success: true };
    };
    const checkPermission = (permissionCode: string): boolean => {
        if (!activeStaff || !activeStaff.role)
            return false;
        const roleLower = (activeStaff.role || '').toLowerCase();
        const nameLower = (activeStaff.name || '').toLowerCase();
        if (roleLower === 'super admin' ||
            nameLower === 'super admin' ||
            nameLower.includes('super admin')) {
            return true;
        }
        const checkList = [
            permissionCode,
            permissionCode.toLowerCase(),
            permissionCode.toUpperCase(),
            permissionCode.toLowerCase().replace(/_/g, '.'),
            permissionCode.toLowerCase().replace(/\./g, '_'),
            permissionCode.toUpperCase().replace(/\./g, '_'),
        ];
        const role = (userRoles || []).find((r) => (activeStaff.customRoleId && r.id === activeStaff.customRoleId) || r.name === activeStaff.role);
        if (role && role.permissions) {
            if (role.permissions.some((p) => checkList.includes(p))) {
                return true;
            }
        }
        return false;
    };
    // Journal Entries
    const addJournalEntry = (entry: Omit<JournalEntry, 'id' | 'entryNo'>): JournalEntry => {
        const newEntry: JournalEntry = {
            ...entry,
            id: `jnl-${Date.now()}`,
            entryNo: `JNL-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        };
        setJournalEntries((prev) => [newEntry, ...prev]);
        setChartOfAccounts((prev) => prev.map((acc) => {
            if (acc.id === entry.debitAccountId) {
                const delta = acc.normalBalance === 'Debit' ? entry.amount : -entry.amount;
                return { ...acc, currentBalance: acc.currentBalance + delta };
            }
            if (acc.id === entry.creditAccountId) {
                const delta = acc.normalBalance === 'Credit' ? entry.amount : -entry.amount;
                return { ...acc, currentBalance: acc.currentBalance + delta };
            }
            return acc;
        }));
        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: 'Office',
            actionType: 'JOURNAL_ENTRY_CREATED',
            entityType: 'Accounting',
            refNo: newEntry.entryNo,
            details: `Recorded Journal Entry ${newEntry.entryNo}: Dr. ${newEntry.debitAccountName} / Cr. ${newEntry.creditAccountName} (Tk ${newEntry.amount.toLocaleString()})`,
            detailsBn: undefined,
            amount: newEntry.amount,
            severity: 'info',
        });
        return newEntry;
    };
    // Accounting
    const addTransaction = (tx: Omit<AccountingTransaction, 'id'>) => {
        const resolvedAccount = tx.paymentAccount || tx.account || tx.accountHead || tx.paymentMethod || 'Cash in Hand';
        const newTx: AccountingTransaction = {
            ...tx,
            account: resolvedAccount,
            paymentAccount: resolvedAccount,
            accountHead: resolvedAccount,
            paymentMethod: tx.paymentMethod || resolvedAccount,
            id: generateUniqueId('tx'),
        };
        const currentList = latestStateRef.current.transactions || transactions;
        const nextTxs = ensureUniqueTransactions([newTx, ...currentList]);
        setTransactions(nextTxs);
        latestStateRef.current = {
            ...latestStateRef.current,
            transactions: nextTxs,
        };
        try {
            localStorage.setItem(`${STORAGE_KEY}_TRANSACTIONS`, JSON.stringify(nextTxs));
        } catch {}
        triggerImmediatePush();

        const isExp = tx.type === 'EXPENSE';
        addAuditLog({
            staffId: activeStaff.id,
            staffName: activeStaff.name,
            staffRole: activeStaff.role,
            location: tx.account === 'Factory Cash' ? 'Factory' : 'Office',
            actionType: isExp ? 'EXPENSE_RECORDED' : 'PAYMENT_COLLECTED',
            entityType: 'Accounting',
            refNo: tx.refNo || `TX-${newTx.id.slice(-6)}`,
            details: `Recorded ${isExp ? 'expense' : 'income'}: ${tx.description} (${tx.category}) - Tk ${tx.amount.toLocaleString()} via ${resolvedAccount}`,
            detailsBn: undefined,
            amount: tx.amount,
            severity: isExp ? 'info' : 'success',
        });
    };
    const updateTransaction = (id: string, updates: Partial<AccountingTransaction>) => {
        const currentList = latestStateRef.current.transactions || transactions;
        const nextTxs = currentList.map((t) => {
            if (t.id !== id) return t;
            const updatedAccount = updates.paymentAccount || updates.account || updates.accountHead || updates.paymentMethod || t.paymentAccount || t.account;
            return {
                ...t,
                ...updates,
                account: updatedAccount,
                paymentAccount: updatedAccount,
                accountHead: updatedAccount,
                paymentMethod: updates.paymentMethod || updatedAccount,
            };
        });
        setTransactions(nextTxs);
        latestStateRef.current = {
            ...latestStateRef.current,
            transactions: nextTxs,
        };
        try {
            localStorage.setItem(`${STORAGE_KEY}_TRANSACTIONS`, JSON.stringify(nextTxs));
        } catch {}
        triggerImmediatePush();
    };
    const deleteTransaction = (id: string) => {
        const currentList = latestStateRef.current.transactions || transactions;
        const txToDelete = currentList.find(t => t.id === id || (id && t.refNo === id));
        const nextTxs = currentList.filter(t => t.id !== id && (!txToDelete || t !== txToDelete));
        setTransactions(nextTxs);
        latestStateRef.current = {
            ...latestStateRef.current,
            transactions: nextTxs,
        };
        try {
            localStorage.setItem(`${STORAGE_KEY}_TRANSACTIONS`, JSON.stringify(nextTxs));
        } catch {}

        if (txToDelete?.refNo) {
            const existingDeleted = safeGetLocalStorage<string[]>(`${STORAGE_KEY}_DELETED_TX_REFS`, []);
            const updatedDeleted = Array.from(new Set([...existingDeleted, id, txToDelete.refNo]));
            try {
                localStorage.setItem(`${STORAGE_KEY}_DELETED_TX_REFS`, JSON.stringify(updatedDeleted));
            } catch {}
        }

        triggerImmediatePush();

        if (txToDelete) {
            addAuditLog({
                staffId: activeStaff.id,
                staffName: activeStaff.name,
                staffRole: activeStaff.role,
                location: 'Office',
                actionType: 'PROFILE_UPDATED',
                entityType: 'Accounting',
                refNo: txToDelete.refNo || `TX-${id.slice(-6)}`,
                details: `Deleted ledger transaction: ${txToDelete.description} (${txToDelete.category}) - Tk ${txToDelete.amount.toLocaleString()}`,
                detailsBn: undefined,
                amount: txToDelete.amount,
                severity: 'warning',
            });
        }
    };
    const updateJournalEntry = (id: string, updates: Partial<JournalEntry>) => {
        setJournalEntries((prev) => prev.map((je) => (je.id === id ? { ...je, ...updates } : je)));
    };
    const restoreDefaultExpenseHeads = () => {
        setExpenseHeads(INITIAL_EXPENSE_HEADS);
        addAuditLog({
            staffId: activeStaff?.id || 'sys',
            staffName: activeStaff?.name || 'Admin',
            staffRole: activeStaff?.role || 'Admin',
            location: 'Office',
            actionType: 'PROFILE_UPDATED',
            entityType: 'Accounting',
            details: 'Restored standard 12 Expense Heads linked to Chart of Accounts',
            detailsBn: undefined,
        });
    };
    const generateJournalsFromTransactions = (): number => {
        const existingRefNos = new Set(journalEntries.map((j) => j.refNo).filter(Boolean));
        const newEntries: JournalEntry[] = [];

        const cashAcc = chartOfAccounts.find((a) => a.classification === 'Asset' && (a.name.toLowerCase().includes('cash') || a.code === '1010')) || chartOfAccounts[0];
        const bankAcc = chartOfAccounts.find((a) => a.classification === 'Asset' && (a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('plc') || a.code === '1020')) || cashAcc;
        const mobileAcc = chartOfAccounts.find((a) => a.classification === 'Asset' && (a.name.toLowerCase().includes('bkash') || a.name.toLowerCase().includes('nagad') || a.code === '1030')) || cashAcc;
        const salesAcc = chartOfAccounts.find((a) => a.classification === 'Revenue' && (a.code === '4010' || a.name.toLowerCase().includes('print') || a.name.toLowerCase().includes('sales'))) || chartOfAccounts.find((a) => a.classification === 'Revenue') || chartOfAccounts[0];
        const cogsAcc = chartOfAccounts.find((a) => a.classification === 'Expense' && (a.code === '5010' || a.name.toLowerCase().includes('cost') || a.name.toLowerCase().includes('raw'))) || chartOfAccounts.find((a) => a.classification === 'Expense') || chartOfAccounts[0];

        transactions.forEach((tx, idx) => {
            if (tx.refNo && existingRefNos.has(tx.refNo)) return;

            const acctName = (tx.paymentAccount || tx.account || '').toLowerCase();
            let assetAcc = cashAcc;
            if (acctName.includes('bkash') || acctName.includes('nagad') || acctName.includes('mobile')) {
                assetAcc = mobileAcc;
            } else if (acctName.includes('bank') || acctName.includes('card') || acctName.includes('city') || acctName.includes('brac') || acctName.includes('plc')) {
                assetAcc = bankAcc;
            }

            const isIncome = tx.type === 'INCOME';
            let opposingAcc = isIncome ? salesAcc : cogsAcc;

            if (!isIncome && (tx.category || tx.description)) {
                const searchStr = `${tx.category || ''} ${tx.description || ''}`.toLowerCase();
                const matchedExp = chartOfAccounts.find((a) => a.classification === 'Expense' && a.name.toLowerCase().split(' ').some((word) => word.length > 3 && searchStr.includes(word)));
                if (matchedExp) opposingAcc = matchedExp;
            }

            const debitAcc = isIncome ? assetAcc : opposingAcc;
            const creditAcc = isIncome ? opposingAcc : assetAcc;

            newEntries.push({
                id: `jnl-gen-${Date.now()}-${idx}`,
                entryNo: `JNL-${(tx.date || '2026').slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`,
                date: tx.date || new Date().toISOString().slice(0, 10),
                debitAccountId: debitAcc.id,
                debitAccountName: debitAcc.name,
                creditAccountId: creditAcc.id,
                creditAccountName: creditAcc.name,
                amount: tx.amount,
                narration: tx.description || `${tx.type === 'INCOME' ? 'Income' : 'Expense'}: ${tx.category || ''}`,
                source: 'LEDGER_SYNC',
                createdBy: 'System (Ledger Auto-Sync)',
                refNo: tx.refNo || `TX-${tx.id}`,
            } as any);
        });

        if (newEntries.length > 0) {
            setJournalEntries((prev) => [...newEntries, ...prev]);
            addAuditLog({
                staffId: activeStaff?.id || 'sys',
                staffName: activeStaff?.name || 'Admin',
                staffRole: activeStaff?.role || 'Admin',
                location: 'Office',
                actionType: 'JOURNAL_ENTRY_CREATED',
                entityType: 'Accounting',
                details: `Generated ${newEntries.length} double-entry Journal Vouchers from Financial Ledger`,
                detailsBn: undefined,
            });
            return newEntries.length;
        }
        return 0;
    };
    // Projects Management & Chart of Accounts Dynamic Alignment
    const resolvePaymentAssetAccount = (methodName?: string) => {
        const m = (methodName || 'Cash').toLowerCase();
        if (m.includes('due') || m.includes('receivable')) {
            return chartOfAccounts.find(a => a.classification === 'Asset' && (a.code === '1003' || a.code === '1004' || a.code === '1050' || a.name.toLowerCase().includes('receivable'))) || chartOfAccounts.find(a => a.classification === 'Asset') || chartOfAccounts[0];
        }
        const matched = matchChannelToAccount(methodName || 'Cash', chartOfAccounts, paymentMethods);
        if (matched) return matched;
        return chartOfAccounts.find(a => a.classification === 'Asset' && (a.code === '1001' || a.code === '1010' || a.name.toLowerCase().includes('cash'))) || chartOfAccounts[0];
    };

    const resolveProjectExpenseAccount = () => {
        return chartOfAccounts.find(a => a.classification === 'Expense' && (a.code === '5206' || a.code === '5300' || a.id === 'coa-5206' || a.name.toLowerCase().includes('project'))) ||
               chartOfAccounts.find(a => a.classification === 'Expense' && a.code === '5100' && a.name.toLowerCase().includes('project')) ||
               chartOfAccounts.find(a => a.classification === 'Expense' && (a.code === '5010' || a.name.toLowerCase().includes('raw') || a.name.toLowerCase().includes('cost'))) ||
               chartOfAccounts.find(a => a.classification === 'Expense') ||
               chartOfAccounts[0];
    };

    const resolveExpenseAccount = (categoryName: string, note?: string) => {
        const query = `${categoryName || ''} ${note || ''}`.toLowerCase();
        
        // 1. Check if specific sub-expense heads exist in chartOfAccounts
        if (query.includes('conveyance') || query.includes('transport') || query.includes('fuel') || query.includes('truck') || query.includes('courier') || query.includes('delivery')) {
            const acc = chartOfAccounts.find(a => a.classification === 'Expense' && (a.code === '5080' || a.name.toLowerCase().includes('conveyance')));
            if (acc) return acc;
        }
        if (query.includes('labor') || query.includes('labour') || query.includes('wage') || query.includes('worker') || query.includes('technician') || query.includes('installation') || query.includes('setup') || query.includes('amin vai') || query.includes('fabrication')) {
            const acc = chartOfAccounts.find(a => a.classification === 'Expense' && (a.code === '5070' || a.name.toLowerCase().includes('wages') || a.name.toLowerCase().includes('salaries')));
            if (acc) return acc;
        }
        if (query.includes('entertainment') || query.includes('refreshment') || query.includes('tea') || query.includes('snack') || query.includes('food') || query.includes('lunch') || query.includes('hospitality') || query.includes('hotel')) {
            const acc = chartOfAccounts.find(a => a.classification === 'Expense' && (a.code === '5090' || a.name.toLowerCase().includes('hospitality') || a.name.toLowerCase().includes('refreshment')));
            if (acc) return acc;
        }
        if (query.includes('electricity') || query.includes('generator') || query.includes('diesel') || query.includes('power')) {
            const acc = chartOfAccounts.find(a => a.classification === 'Expense' && (a.code === '5040' || a.name.toLowerCase().includes('electricity')));
            if (acc) return acc;
        }
        if (query.includes('rent') || query.includes('lease') || query.includes('facility')) {
            const acc = chartOfAccounts.find(a => a.classification === 'Expense' && (a.code === '5050' || a.name.toLowerCase().includes('rent')));
            if (acc) return acc;
        }
        if (query.includes('machine') || query.includes('servicing') || query.includes('equipment') || query.includes('crane') || query.includes('printer head')) {
            const acc = chartOfAccounts.find(a => a.classification === 'Expense' && (a.code === '5030' || a.name.toLowerCase().includes('servicing')));
            if (acc) return acc;
        }
        if (query.includes('permit') || query.includes('tax') || query.includes('official fee') || query.includes('license')) {
            const acc = chartOfAccounts.find(a => a.classification === 'Expense' && (a.code === '5120' || a.name.toLowerCase().includes('tax') || a.name.toLowerCase().includes('permit')));
            if (acc) return acc;
        }

        // 2. Dedicated Project Expense Head (5100 Project Expense)
        const projExpAcc = resolveProjectExpenseAccount();
        if (projExpAcc) {
            return projExpAcc;
        }

        const cogsAcc = chartOfAccounts.find(a => a.classification === 'Expense' && (a.code === '5010' || a.name.toLowerCase().includes('raw') || a.name.toLowerCase().includes('cost')));
        return cogsAcc || chartOfAccounts.find(a => a.classification === 'Expense') || chartOfAccounts[0];
    };

    const resolveProjectRevenueAccount = (targetAccountId?: string) => {
        if (targetAccountId) {
            const byId = chartOfAccounts.find(a => a.id === targetAccountId || a.code === targetAccountId);
            if (byId) return byId;
        }
        return chartOfAccounts.find(a => a.classification === 'Revenue' && (a.code === '4002' || a.code === '4051' || a.id === 'coa-4002' || a.id === 'coa-4051' || a.name.toLowerCase().includes('project') || a.code === '4060')) ||
               chartOfAccounts.find(a => a.classification === 'Revenue' && a.code === '4020') ||
               chartOfAccounts.find(a => a.classification === 'Revenue') ||
               chartOfAccounts[0];
    };

    const recalculateProject = (p: Project): Project => {
        const totalSales = (p.salesItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const totalExpenses = (p.expenseItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const netProfit = totalSales - totalExpenses;
        const profitMargin = totalSales > 0 ? Number(((netProfit / totalSales) * 100).toFixed(2)) : 0;

        let totalDue = 0;
        let totalCollected = 0;
        (p.salesItems || []).forEach(item => {
            let itemDue = 0;
            if (item.dueAmount !== undefined) {
                itemDue = Number(item.dueAmount) || 0;
            } else {
                const breakdowns = item.paymentBreakdown || [];
                const dueRow = breakdowns.find(b => {
                    const m = (b.method || '').toLowerCase();
                    return m.includes('due') || m.includes('receivable');
                });
                const dueInitial = dueRow ? Number(dueRow.amount) || 0 : 0;
                const pastCollections = (item.collections || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
                itemDue = Math.max(0, dueInitial - pastCollections);
            }
            const itemTotal = Number(item.amount) || 0;
            const itemPaid = item.paidAmount !== undefined ? Number(item.paidAmount) : Math.max(0, itemTotal - itemDue);
            totalDue += itemDue;
            totalCollected += itemPaid;
        });

        return { ...p, totalSales, totalExpenses, totalCollected, totalDue, netProfit, profitMargin };
    };

    const addProject = (proj: Omit<Project, 'id' | 'code' | 'totalSales' | 'totalExpenses' | 'netProfit' | 'profitMargin'>): Project => {
        const newId = `prj-${Date.now()}`;
        const code = `PRJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const revAcc = resolveProjectRevenueAccount(proj.chartOfAccountId);
        const resolvedChartOfAccountId = proj.chartOfAccountId || revAcc?.id || 'coa-4051';
        const resolvedAccountCode = proj.projectAccountCode || revAcc?.code || '4051';

        const baseProject: Project = {
            ...proj,
            id: newId,
            code,
            budget: Number(proj.budget) || 0,
            salesItems: (proj.salesItems || []).map(si => ({
                ...si,
                linkedAccountId: si.linkedAccountId || resolvedChartOfAccountId,
            })),
            expenseItems: proj.expenseItems || [],
            totalSales: 0,
            totalExpenses: 0,
            netProfit: 0,
            profitMargin: 0,
            chartOfAccountId: resolvedChartOfAccountId,
            projectAccountCode: resolvedAccountCode,
            invoiceId: proj.invoiceId,
            invoiceNo: proj.invoiceNo,
        };
        const calculated = recalculateProject(baseProject);

        // If project was created with initial salesItems (e.g. from an invoice), record journals and transactions
        if (calculated.salesItems.length > 0) {
            const newJournals: JournalEntry[] = [];
            const newTxs: AccountingTransaction[] = [];
            calculated.salesItems.forEach((si, sidx) => {
                const breakdowns = (si.paymentBreakdown && si.paymentBreakdown.length > 0)
                    ? si.paymentBreakdown
                    : [{ id: `pb-${Date.now()}-${sidx}`, method: si.paymentMethod || 'Cash in Hand', amount: si.amount }];

                breakdowns.forEach((pb, pidx) => {
                    const pbAmount = Number(pb.amount) || 0;
                    if (pbAmount <= 0) return;
                    const assetAcc = resolvePaymentAssetAccount(pb.method);
                    const refNo = si.invoiceNo || `${code}-${si.date || new Date().toISOString().slice(0, 10)}`;

                    const descDetail = si.invoiceNo ? `Invoice #${si.invoiceNo}` : (si.description || 'Billing');

                    newJournals.push({
                        id: `jnl-ps-init-${Date.now()}-${sidx}-${pidx}`,
                        entryNo: `JNL-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}${sidx}${pidx}`,
                        date: si.date || new Date().toISOString().slice(0, 10),
                        refNo: refNo,
                        debitAccountId: assetAcc.id,
                        debitAccountName: assetAcc.name,
                        creditAccountId: revAcc.id,
                        creditAccountName: revAcc.name,
                        amount: pbAmount,
                        narration: `Project Sales Income (Unified COA): [${code}] ${calculated.clientName} - ${descDetail} (${pb.method})`,
                        source: 'PROJECT_SALES',
                        createdBy: activeStaff?.name || 'Managing Director',
                    });

                    const isBank = pb.method.toLowerCase().includes('bank') || pb.method.toLowerCase().includes('brac') || pb.method.toLowerCase().includes('card');
                    const isMobile = pb.method.toLowerCase().includes('bkash') || pb.method.toLowerCase().includes('nagad') || pb.method.toLowerCase().includes('rocket');
                    const isDue = pb.method.toLowerCase().includes('due') || pb.method.toLowerCase().includes('receivable');

                    // Only cash/bank/MFS collections enter the financial ledger. Unpaid Due is tracked via JournalEntry and Project due.
                    if (!isDue) {
                        newTxs.push({
                            id: generateUniqueId('tx-prj-sale-init'),
                            date: si.date || new Date().toISOString().slice(0, 10),
                            type: 'INCOME',
                            category: 'Project Revenue',
                            account: isBank ? 'BRAC Bank' : isMobile ? 'bKash / Nagad' : 'Cash in Hand',
                            accountHead: revAcc.name,
                            paymentMethod: pb.method,
                            paymentAccount: pb.method,
                            refNo: refNo,
                            customerOrSupplier: calculated.clientName,
                            description: `Project Income: [${code}] ${calculated.clientName} - ${descDetail} (${pb.method})`,
                            amount: pbAmount,
                        });
                    }
                });
            });

            if (newJournals.length > 0) {
                setJournalEntries(prev => [...newJournals, ...prev]);
                setChartOfAccounts(prev => prev.map(acc => {
                    let balChange = 0;
                    newJournals.forEach(j => {
                        if (acc.id === j.debitAccountId) {
                            balChange += (acc.normalBalance === 'Debit' ? j.amount : -j.amount);
                        }
                        if (acc.id === j.creditAccountId) {
                            balChange += (acc.normalBalance === 'Credit' ? j.amount : -j.amount);
                        }
                    });
                    return balChange !== 0 ? { ...acc, currentBalance: acc.currentBalance + balChange } : acc;
                }));
            }
            if (newTxs.length > 0) {
                setTransactions(prev => ensureUniqueTransactions([...newTxs, ...prev]));
            }
        }

        // If linked to an invoice, link on the invoice side too
        if (proj.invoiceId || proj.invoiceNo) {
            setInvoices(prev => {
                const next = prev.map(inv => {
                    if ((proj.invoiceId && inv.id === proj.invoiceId) || (proj.invoiceNo && inv.invoiceNo === proj.invoiceNo)) {
                        return {
                            ...inv,
                            projectId: newId,
                            projectCode: code,
                            chartOfAccountId: resolvedChartOfAccountId,
                        };
                    }
                    return inv;
                });
                try { localStorage.setItem(`${STORAGE_KEY}_INVOICES`, JSON.stringify(next)); } catch {}
                return next;
            });
            latestStateRef.current = {
                ...latestStateRef.current,
                invoices: (latestStateRef.current.invoices || []).map((inv: SalesInvoice) => {
                    if ((proj.invoiceId && inv.id === proj.invoiceId) || (proj.invoiceNo && inv.invoiceNo === proj.invoiceNo)) {
                        return {
                            ...inv,
                            projectId: newId,
                            projectCode: code,
                            chartOfAccountId: resolvedChartOfAccountId,
                        };
                    }
                    return inv;
                }),
            };
        }

        setProjects((prev) => {
            const next = [calculated, ...prev];
            try {
                localStorage.setItem(`${STORAGE_KEY}_PROJECTS`, JSON.stringify(next));
            } catch {}
            return next;
        });
        latestStateRef.current = {
            ...latestStateRef.current,
            projects: [calculated, ...(latestStateRef.current.projects || [])],
        };
        addAuditLog({
            staffId: activeStaff?.id || 'staff-admin',
            staffName: activeStaff?.name || 'Staff',
            staffRole: activeStaff?.role || 'Managing Director',
            location: 'Office',
            actionType: 'PROJECT_CREATED',
            entityType: 'Projects',
            refNo: code,
            details: `Created new project: ${calculated.name} for ${calculated.clientName} (Budget: Tk ${(calculated.budget || 0).toLocaleString()})${proj.invoiceNo ? ` [Linked Invoice: ${proj.invoiceNo}]` : ''}`,
            detailsBn: undefined,
            severity: 'info',
        });
        triggerImmediatePush();
        return calculated;
    };

    const updateProject = (id: string, updates: Partial<Project>) => {
        setProjects((prev) => {
            const next = prev.map((p) => {
                if (p.id === id) {
                    return recalculateProject({ ...p, ...updates });
                }
                return p;
            });
            try {
                localStorage.setItem(`${STORAGE_KEY}_PROJECTS`, JSON.stringify(next));
            } catch {}
            return next;
        });
        latestStateRef.current = {
            ...latestStateRef.current,
            projects: (latestStateRef.current.projects || []).map((p: Project) => p.id === id ? recalculateProject({ ...p, ...updates }) : p),
        };
        triggerImmediatePush();
    };

    const deleteProject = (id: string) => {
        const target = projects.find(p => p.id === id);
        if (target) {
            // Unlink invoice if linked
            if (target.invoiceId || target.invoiceNo) {
                setInvoices(prev => {
                    const next = prev.map(inv => {
                        if ((target.invoiceId && inv.id === target.invoiceId) || (target.invoiceNo && inv.invoiceNo === target.invoiceNo)) {
                            const { projectId, projectCode, ...rest } = inv;
                            return rest as SalesInvoice;
                        }
                        return inv;
                    });
                    try { localStorage.setItem(`${STORAGE_KEY}_INVOICES`, JSON.stringify(next)); } catch {}
                    return next;
                });
            }

            const targetJournals = (journalEntries || []).filter(j => j.refNo === target.code || (target.invoiceNo && j.refNo === target.invoiceNo));
            if (targetJournals.length > 0) {
                setChartOfAccounts(prev => {
                    const next = prev.map(acc => {
                        let balChange = 0;
                        targetJournals.forEach(j => {
                            if (acc.id === j.debitAccountId) {
                                balChange -= (acc.normalBalance === 'Debit' ? j.amount : -j.amount);
                            }
                            if (acc.id === j.creditAccountId) {
                                balChange -= (acc.normalBalance === 'Credit' ? j.amount : -j.amount);
                            }
                        });
                        return balChange !== 0 ? { ...acc, currentBalance: acc.currentBalance + balChange } : acc;
                    });
                    try { localStorage.setItem(`${STORAGE_KEY}_COA`, JSON.stringify(next)); } catch {}
                    return next;
                });
            }
            setJournalEntries(prev => {
                const next = prev.filter(j => j.refNo !== target.code);
                try { localStorage.setItem(`${STORAGE_KEY}_JOURNALS`, JSON.stringify(next)); } catch {}
                return next;
            });
            setTransactions(prev => {
                const next = prev.filter(t => t.refNo !== target.code);
                try { localStorage.setItem(`${STORAGE_KEY}_TRANSACTIONS`, JSON.stringify(next)); } catch {}
                return next;
            });
        }
        setProjects((prev) => {
            const next = prev.filter((p) => p.id !== id);
            try {
                localStorage.setItem(`${STORAGE_KEY}_PROJECTS`, JSON.stringify(next));
            } catch {}
            return next;
        });
        latestStateRef.current = {
            ...latestStateRef.current,
            projects: (latestStateRef.current.projects || []).filter((p: Project) => p.id !== id),
        };
        triggerImmediatePush();
    };

    const createProjectFromInvoice = (
        invoiceId: string,
        options?: {
            name?: string;
            nameBn?: string;
            chartOfAccountId?: string;
            budget?: number;
            status?: Project['status'];
            startDate?: string;
            endDate?: string;
            notes?: string;
            includeAsSalesItem?: boolean;
        }
    ): Project | null => {
        const inv = invoices.find(i => i.id === invoiceId || i.invoiceNo === invoiceId);
        if (!inv) return null;

        const revAcc = resolveProjectRevenueAccount(options?.chartOfAccountId);
        const chosenCoaId = options?.chartOfAccountId || revAcc.id || 'coa-4051';
        const chosenCoaCode = revAcc.code || '4051';

        const itemsCount = (inv.items || []).length;
        const defaultProjName = itemsCount > 1
            ? `${inv.customerName} - Project (#${inv.invoiceNo})`
            : (inv.items?.[0]?.name ? `${inv.customerName} - ${inv.items[0].name}` : `${inv.customerName} - Project`);
        const projectName = options?.name?.trim() || defaultProjName;
        const budgetAmount = options?.budget !== undefined ? Number(options.budget) : Number(inv.grandTotal) || 0;
        const shouldIncludeSalesItem = options?.includeAsSalesItem !== false;

        const salesItems: ProjectSalesItem[] = [];
        if (shouldIncludeSalesItem) {
            const paymentBreakdowns: ProjectSalesPaymentBreakdown[] = [];
            if (inv.splitPayments && Object.keys(inv.splitPayments).length > 0) {
                Object.entries(inv.splitPayments).forEach(([channel, amt]) => {
                    const num = Number(amt) || 0;
                    if (num > 0 && channel.toLowerCase() !== 'due') {
                        paymentBreakdowns.push({
                            id: `pb-${Date.now()}-${channel}`,
                            method: channel,
                            amount: num,
                            referenceNo: inv.invoiceNo,
                        });
                    }
                });
            } else if ((inv.paidAmount || 0) > 0) {
                paymentBreakdowns.push({
                    id: `pb-${Date.now()}-paid`,
                    method: inv.paymentMethod || 'Cash in Hand',
                    amount: inv.paidAmount,
                    referenceNo: inv.invoiceNo,
                });
            }
            if ((inv.dueAmount || 0) > 0) {
                paymentBreakdowns.push({
                    id: `pb-${Date.now()}-due`,
                    method: 'Due',
                    amount: inv.dueAmount,
                    referenceNo: inv.invoiceNo,
                });
            }

            salesItems.push({
                id: `ps-${Date.now()}`,
                invoiceNo: inv.invoiceNo,
                description: itemsCount > 1
                    ? `Invoice #${inv.invoiceNo} Billing (${itemsCount} items)`
                    : (inv.items?.[0] ? `${inv.items[0].name} (x${inv.items[0].qty || 1})` : `Invoice #${inv.invoiceNo} Billing`),
                amount: Number(inv.grandTotal) || 0,
                date: inv.date || new Date().toISOString().slice(0, 10),
                clientName: inv.customerName,
                note: `Synced from Sales Invoice #${inv.invoiceNo}`,
                paymentMethod: inv.paymentMethod || 'Cash in Hand',
                paymentBreakdown: paymentBreakdowns.length > 0 ? paymentBreakdowns : undefined,
                linkedAccountId: chosenCoaId,
                paidAmount: Number(inv.paidAmount) || 0,
                dueAmount: Number(inv.dueAmount) || 0,
                collections: [],
            });
        }

        const newProject = addProject({
            name: projectName,
            nameBn: options?.nameBn?.trim() || undefined,
            clientName: inv.customerName,
            clientPhone: inv.customerPhone,
            budget: budgetAmount,
            status: options?.status || 'In Progress',
            startDate: options?.startDate || inv.date || new Date().toISOString().slice(0, 10),
            endDate: options?.endDate || '',
            notes: options?.notes || `Created against Sales Invoice #${inv.invoiceNo} (Unified COA: ${chosenCoaCode} - ${revAcc.name})`,
            salesItems,
            expenseItems: [],
            chartOfAccountId: chosenCoaId,
            projectAccountCode: chosenCoaCode,
            invoiceId: inv.id,
            invoiceNo: inv.invoiceNo,
        });

        updateInvoice(inv.id, {
            projectId: newProject.id,
            projectCode: newProject.code,
            chartOfAccountId: chosenCoaId,
        });

        triggerImmediatePush();

        return newProject;
    };

    const linkInvoiceToProject = (
        projectId: string,
        invoiceId: string,
        chartOfAccountId?: string,
        syncSalesItem: boolean = true
    ): boolean => {
        const targetProj = projects.find(p => p.id === projectId);
        const inv = invoices.find(i => i.id === invoiceId || i.invoiceNo === invoiceId);
        if (!targetProj || !inv) return false;

        const revAcc = resolveProjectRevenueAccount(chartOfAccountId || targetProj.chartOfAccountId);
        const unifiedCoaId = chartOfAccountId || targetProj.chartOfAccountId || revAcc.id || 'coa-4051';
        const unifiedCoaCode = revAcc.code || targetProj.projectAccountCode || '4051';

        let updatedSales = [...targetProj.salesItems];
        if (syncSalesItem && !updatedSales.some(s => s.invoiceNo === inv.invoiceNo)) {
            const paymentBreakdowns: ProjectSalesPaymentBreakdown[] = [];
            if (inv.splitPayments && Object.keys(inv.splitPayments).length > 0) {
                Object.entries(inv.splitPayments).forEach(([channel, amt]) => {
                    const num = Number(amt) || 0;
                    if (num > 0 && channel.toLowerCase() !== 'due') {
                        paymentBreakdowns.push({
                            id: `pb-${Date.now()}-${channel}`,
                            method: channel,
                            amount: num,
                            referenceNo: inv.invoiceNo,
                        });
                    }
                });
            } else if ((inv.paidAmount || 0) > 0) {
                paymentBreakdowns.push({
                    id: `pb-${Date.now()}-paid`,
                    method: inv.paymentMethod || 'Cash in Hand',
                    amount: inv.paidAmount,
                    referenceNo: inv.invoiceNo,
                });
            }
            if ((inv.dueAmount || 0) > 0) {
                paymentBreakdowns.push({
                    id: `pb-${Date.now()}-due`,
                    method: 'Due',
                    amount: inv.dueAmount,
                    referenceNo: inv.invoiceNo,
                });
            }

            const itemsCount = (inv.items || []).length;
            const salesItemDesc = itemsCount > 1
                ? `Invoice #${inv.invoiceNo} Billing (${itemsCount} items)`
                : (inv.items?.[0] ? `${inv.items[0].name} (x${inv.items[0].qty || 1})` : `Invoice #${inv.invoiceNo} Billing`);

            const newSaleItem: ProjectSalesItem = {
                id: `ps-${Date.now()}`,
                invoiceNo: inv.invoiceNo,
                description: salesItemDesc,
                amount: Number(inv.grandTotal) || 0,
                date: inv.date || new Date().toISOString().slice(0, 10),
                clientName: inv.customerName,
                note: `Linked from Sales Invoice #${inv.invoiceNo}`,
                paymentMethod: inv.paymentMethod || 'Cash in Hand',
                paymentBreakdown: paymentBreakdowns.length > 0 ? paymentBreakdowns : undefined,
                linkedAccountId: unifiedCoaId,
                paidAmount: Number(inv.paidAmount) || 0,
                dueAmount: Number(inv.dueAmount) || 0,
                collections: [],
            };
            updatedSales.push(newSaleItem);

            paymentBreakdowns.forEach((pb, pidx) => {
                const pbAmount = Number(pb.amount) || 0;
                if (pbAmount <= 0) return;
                const assetAcc = resolvePaymentAssetAccount(pb.method);
                const newJournal: JournalEntry = {
                    id: `jnl-ps-link-${Date.now()}-${pidx}`,
                    entryNo: `JNL-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}${pidx}`,
                    date: inv.date || new Date().toISOString().slice(0, 10),
                    refNo: inv.invoiceNo,
                    debitAccountId: assetAcc.id,
                    debitAccountName: assetAcc.name,
                    creditAccountId: revAcc.id,
                    creditAccountName: revAcc.name,
                    amount: pbAmount,
                    narration: `Project Sales Income (Unified COA): [${targetProj.code}] ${targetProj.clientName} - Invoice #${inv.invoiceNo} (${pb.method})`,
                    source: 'PROJECT_SALES',
                    createdBy: activeStaff?.name || 'Managing Director',
                };
                setJournalEntries(prev => [newJournal, ...prev]);
            });
        }

        updateProject(targetProj.id, {
            invoiceId: inv.id,
            invoiceNo: inv.invoiceNo,
            chartOfAccountId: unifiedCoaId,
            projectAccountCode: unifiedCoaCode,
            salesItems: updatedSales,
        });

        updateInvoice(inv.id, {
            projectId: targetProj.id,
            projectCode: targetProj.code,
            chartOfAccountId: unifiedCoaId,
        });

        addAuditLog({
            staffId: activeStaff?.id || 'staff-admin',
            staffName: activeStaff?.name || 'Staff',
            staffRole: activeStaff?.role || 'Managing Director',
            location: 'Office',
            actionType: 'PROJECT_UPDATED',
            entityType: 'Projects',
            refNo: targetProj.code,
            details: `Linked Sales Invoice #${inv.invoiceNo} to Project [${targetProj.code}] ${targetProj.name} with unified COA (${unifiedCoaCode} - ${revAcc.name})`,
            severity: 'info',
        });

        return true;
    };

    const unlinkInvoiceFromProject = (projectId: string): boolean => {
        const targetProj = projects.find(p => p.id === projectId);
        if (!targetProj) return false;
        const invId = targetProj.invoiceId;
        const invNo = targetProj.invoiceNo;

        updateProject(targetProj.id, {
            invoiceId: undefined,
            invoiceNo: undefined,
        });

        if (invId) {
            updateInvoice(invId, {
                projectId: undefined,
                projectCode: undefined,
            });
        } else if (invNo) {
            const matchedInv = invoices.find(i => i.invoiceNo === invNo);
            if (matchedInv) {
                updateInvoice(matchedInv.id, {
                    projectId: undefined,
                    projectCode: undefined,
                });
            }
        }
        return true;
    };

    const generateInvoiceForProject = (
        projectId: string,
        options?: {
            title?: string;
            date?: string;
            skipLedgerTransaction?: boolean;
        }
    ): SalesInvoice | null => {
        const currentProjects = latestStateRef.current?.projects || projects;
        const targetProj = currentProjects.find(p => p.id === projectId);
        if (!targetProj) return null;

        if (targetProj.invoiceId) {
            const currentInvoices = latestStateRef.current?.invoices || invoices;
            const existing = currentInvoices.find(i => i.id === targetProj.invoiceId || i.invoiceNo === targetProj.invoiceNo);
            if (existing) return existing;
        }

        const revAcc = resolveProjectRevenueAccount(targetProj.chartOfAccountId);
        const unifiedCoaId = targetProj.chartOfAccountId || revAcc.id || 'coa-4051';

        const grandTotal = Number(targetProj.budget) > 0
            ? Number(targetProj.budget)
            : (Number(targetProj.totalSales) > 0 ? Number(targetProj.totalSales) : 0);

        const paidAmount = Number(targetProj.totalCollected) || 0;
        const dueAmount = Math.max(0, grandTotal - paidAmount);

        let invoiceItems: InvoiceItem[] = [];
        if (targetProj.salesItems && targetProj.salesItems.length > 0) {
            invoiceItems = targetProj.salesItems.map((si, idx) => ({
                productId: `prod-prj-${si.id || idx}`,
                name: si.description || `${targetProj.name} - Billing Milestone`,
                category: 'Project Services',
                unit: 'job' as any,
                unitPrice: Number(si.amount) || 0,
                costPrice: 0,
                qty: 1,
                totalPrice: Number(si.amount) || 0,
            }));
        } else {
            invoiceItems = [{
                productId: `prod-prj-${targetProj.id}`,
                name: `${targetProj.name} (${targetProj.code})`,
                category: 'Project Services',
                unit: 'job' as any,
                unitPrice: grandTotal,
                costPrice: 0,
                qty: 1,
                totalPrice: grandTotal,
            }];
        }

        const splitPayments: Record<string, number> = {};
        const primaryMethod = targetProj.salesItems?.[0]?.paymentMethod || 'Cash in Hand';
        if (paidAmount > 0) {
            splitPayments[primaryMethod] = paidAmount;
        }
        if (dueAmount > 0) {
            splitPayments['due'] = dueAmount;
        }

        let custId: string | undefined = undefined;
        const currentCusts = latestStateRef.current?.customers || customers;
        const matchedCust = currentCusts.find(c =>
            (targetProj.clientPhone && c.phone && c.phone.trim() === targetProj.clientPhone.trim()) ||
            (c.name && c.name.toLowerCase() === targetProj.clientName.toLowerCase()) ||
            (c.company && c.company.toLowerCase() === targetProj.clientName.toLowerCase())
        );
        if (matchedCust) {
            custId = matchedCust.id;
        } else if (targetProj.clientName) {
            const newCust = addCustomer({
                name: targetProj.clientName,
                company: targetProj.clientName,
                phone: targetProj.clientPhone || '',
                address: '',
                type: 'Corporate',
            });
            custId = newCust.id;
        }

        const shouldSkipLedger = options?.skipLedgerTransaction !== undefined
            ? options.skipLedgerTransaction
            : (targetProj.salesItems && targetProj.salesItems.length > 0 && paidAmount > 0);

        const invDate = options?.date || targetProj.startDate || new Date().toISOString().slice(0, 10);

        const createdInv = addInvoice({
            date: invDate,
            customerId: custId,
            customerName: targetProj.clientName,
            customerPhone: targetProj.clientPhone || '',
            items: invoiceItems,
            subtotal: grandTotal,
            subTotal: grandTotal,
            discount: 0,
            discountType: 'flat',
            taxRate: 0,
            taxAmount: 0,
            vatRate: 0,
            vatAmount: 0,
            grandTotal,
            paidAmount,
            dueAmount,
            paymentMethod: primaryMethod,
            paymentStatus: dueAmount <= 0 ? 'Paid' : (paidAmount <= 0 ? 'Due' : 'Partial'),
            productionStatus: 'Queued',
            splitPayments: Object.keys(splitPayments).length > 0 ? splitPayments : undefined,
            projectId: targetProj.id,
            projectCode: targetProj.code,
            chartOfAccountId: unifiedCoaId,
            warehouseLocation: 'Office',
            notes: targetProj.notes || `Generated from Project [${targetProj.code}] ${targetProj.name}`,
            skipLedgerTransaction: shouldSkipLedger,
        });

        const updatedSales = (targetProj.salesItems || []).map(si => ({
            ...si,
            invoiceNo: si.invoiceNo || createdInv.invoiceNo,
        }));

        updateProject(targetProj.id, {
            invoiceId: createdInv.id,
            invoiceNo: createdInv.invoiceNo,
            budget: Number(targetProj.budget) > 0 ? targetProj.budget : grandTotal,
            salesItems: updatedSales,
        });

        addAuditLog({
            staffId: activeStaff?.id || 'staff-admin',
            staffName: activeStaff?.name || 'Staff',
            staffRole: activeStaff?.role || 'Managing Director',
            location: 'Office',
            actionType: 'PROJECT_UPDATED',
            entityType: 'Projects',
            refNo: targetProj.code,
            details: `Generated Sales Invoice #${createdInv.invoiceNo} for Project [${targetProj.code}] ${targetProj.name}`,
            amount: grandTotal,
            severity: 'info',
        });

        triggerImmediatePush();
        return createdInv;
    };

    const syncProjectInvoice = (projectId: string): boolean => {
        const currentProjects = latestStateRef.current?.projects || projects;
        const targetProj = currentProjects.find((p: Project) => p.id === projectId);
        if (!targetProj || (!targetProj.invoiceId && !targetProj.invoiceNo)) return false;

        const currentInvoices = latestStateRef.current?.invoices || invoices;
        const targetInv = currentInvoices.find(i => (targetProj.invoiceId && i.id === targetProj.invoiceId) || (targetProj.invoiceNo && i.invoiceNo === targetProj.invoiceNo));
        if (!targetInv) return false;

        const salesItems = targetProj.salesItems || [];
        let invoiceItems: InvoiceItem[] = [];

        if (salesItems.length > 0) {
            invoiceItems = salesItems.map((si, idx) => ({
                productId: `prod-prj-${si.id || idx}`,
                name: si.description || `${targetProj.name} - Billing Milestone`,
                category: 'Project Services',
                unit: 'job' as any,
                unitPrice: Number(si.amount) || 0,
                costPrice: 0,
                qty: 1,
                totalPrice: Number(si.amount) || 0,
            }));
        } else {
            const grandTotal = Number(targetProj.budget) > 0 ? Number(targetProj.budget) : 0;
            invoiceItems = [{
                productId: `prod-prj-${targetProj.id}`,
                name: `${targetProj.name} (${targetProj.code})`,
                category: 'Project Services',
                unit: 'job' as any,
                unitPrice: grandTotal,
                costPrice: 0,
                qty: 1,
                totalPrice: grandTotal,
            }];
        }

        const newSubtotal = invoiceItems.reduce((sum, it) => sum + (Number(it.totalPrice) || 0), 0);
        const disc = Number(targetInv.discount) || 0;
        const vatAmt = Number(targetInv.vatAmount) || 0;
        const newGrandTotal = Math.max(0, newSubtotal - disc + vatAmt);

        let totalPaid = 0;
        const splitPayments: Record<string, number> = {};

        salesItems.forEach(si => {
            if (si.paymentBreakdown && si.paymentBreakdown.length > 0) {
                si.paymentBreakdown.forEach(pb => {
                    const m = pb.method || 'Cash';
                    const amt = Number(pb.amount) || 0;
                    if (amt > 0 && !m.toLowerCase().includes('due') && !m.toLowerCase().includes('receivable')) {
                        totalPaid += amt;
                        splitPayments[m] = (splitPayments[m] || 0) + amt;
                    }
                });
            } else {
                const paid = Number(si.paidAmount ?? si.amount) || 0;
                const m = si.paymentMethod || 'Cash';
                if (paid > 0) {
                    totalPaid += paid;
                    splitPayments[m] = (splitPayments[m] || 0) + paid;
                }
            }

            (si.collections || []).forEach(col => {
                const colAmt = Number(col.amount) || 0;
                if (colAmt > 0) {
                    totalPaid += colAmt;
                    const m = col.paymentMethod || 'Cash';
                    splitPayments[m] = (splitPayments[m] || 0) + colAmt;
                }
            });
        });

        const finalPaid = Math.min(newGrandTotal, totalPaid);
        const finalDue = Math.max(0, newGrandTotal - finalPaid);
        const newPaymentStatus: PaymentStatus = finalDue <= 0 ? 'Paid' : (finalPaid <= 0 ? 'Due' : 'Partial');

        if (finalDue > 0) {
            splitPayments['due'] = finalDue;
        } else {
            delete splitPayments['due'];
        }

        const updatedInv: SalesInvoice = sanitizeSalesInvoice({
            ...targetInv,
            items: invoiceItems,
            subtotal: newSubtotal,
            subTotal: newSubtotal,
            grandTotal: newGrandTotal,
            paidAmount: finalPaid,
            dueAmount: finalDue,
            paymentStatus: newPaymentStatus,
            splitPayments: Object.keys(splitPayments).length > 0 ? splitPayments : undefined,
        });

        const nextInvs = currentInvoices.map(i => i.id === targetInv.id ? updatedInv : i);
        setInvoices(nextInvs);
        try { localStorage.setItem(`${STORAGE_KEY}_INVOICES`, JSON.stringify(nextInvs)); } catch {}

        if (latestStateRef.current) {
            latestStateRef.current = {
                ...latestStateRef.current,
                invoices: nextInvs,
            };
        }

        // Tag all sales items with this invoiceNo if needed
        const updatedSales = (targetProj.salesItems || []).map(si => ({
            ...si,
            invoiceNo: si.invoiceNo || targetInv.invoiceNo,
        }));
        const needsSalesTagging = updatedSales.some((si, i) => si.invoiceNo !== targetProj.salesItems?.[i]?.invoiceNo);
        if (needsSalesTagging) {
            updateProject(targetProj.id, { salesItems: updatedSales });
        }

        // Customer ledger update
        const currentCusts = latestStateRef.current?.customers || customers;
        let matchedCustomer = false;
        const nextCusts = currentCusts.map((c: Customer) => {
            if (!matchedCustomer && isInvoiceMatchingCustomer(updatedInv, c)) {
                matchedCustomer = true;
                const clientInvoices = nextInvs.filter(i => isInvoiceMatchingCustomer(i, c));
                const totalPurchased = clientInvoices.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);
                const dueAmount = clientInvoices.reduce((s, i) => s + (Number(i.dueAmount) || 0), 0);
                return { ...c, totalPurchased, dueAmount };
            }
            return c;
        });
        if (matchedCustomer) {
            setCustomers(nextCusts);
            try { localStorage.setItem(`${STORAGE_KEY}_CUSTOMERS`, JSON.stringify(nextCusts)); } catch {}
            if (latestStateRef.current) {
                latestStateRef.current = {
                    ...latestStateRef.current,
                    customers: nextCusts,
                };
            }
        }

        triggerImmediatePush();
        return true;
    };

    const addProjectSales = (projectId: string, sales: Omit<ProjectSalesItem, 'id'>) => {
        const newItemId = `ps-${Date.now()}`;
        const targetProj = projects.find(p => p.id === projectId);
        const code = targetProj?.code || 'PRJ';
        const projName = targetProj?.name || 'Project';
        const clientName = targetProj?.clientName || sales.clientName || 'Client';

        const validBreakdowns = (sales.paymentBreakdown && sales.paymentBreakdown.length > 0)
            ? sales.paymentBreakdown
            : [{ id: `pb-${Date.now()}`, method: sales.paymentMethod || 'Cash', amount: sales.amount, note: sales.note }];

        const revAcc = resolveProjectRevenueAccount();
        const newJournals: JournalEntry[] = [];
        const newTxs: AccountingTransaction[] = [];

        validBreakdowns.forEach((pb, pidx) => {
            const pbAmount = Number(pb.amount) || 0;
            if (pbAmount <= 0) return;

            const assetAcc = resolvePaymentAssetAccount(pb.method);
            const refNo = sales.invoiceNo || `${code}-${sales.date || new Date().toISOString().slice(0, 10)}`;

            const descDetail = sales.invoiceNo ? `Invoice #${sales.invoiceNo}` : (sales.description || 'Project Billing');

            newJournals.push({
                id: `jnl-ps-${Date.now()}-${pidx}`,
                entryNo: `JNL-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}${pidx}`,
                date: sales.date || new Date().toISOString().slice(0, 10),
                refNo: refNo,
                debitAccountId: assetAcc.id,
                debitAccountName: assetAcc.name,
                creditAccountId: revAcc.id,
                creditAccountName: revAcc.name,
                amount: pbAmount,
                narration: `Project Sales Income: [${code}] ${clientName} - ${descDetail} (${pb.method}${pb.note ? `: ${pb.note}` : ''})`,
                source: 'PROJECT_SALES',
                createdBy: activeStaff?.name || 'Managing Director',
            });

            const isBank = pb.method.toLowerCase().includes('bank') || pb.method.toLowerCase().includes('brac') || pb.method.toLowerCase().includes('card');
            const isMobile = pb.method.toLowerCase().includes('bkash') || pb.method.toLowerCase().includes('nagad') || pb.method.toLowerCase().includes('rocket');
            const isDue = pb.method.toLowerCase().includes('due') || pb.method.toLowerCase().includes('receivable');

            if (!isDue) {
                newTxs.push({
                    id: generateUniqueId('tx-prj-sale'),
                    date: sales.date || new Date().toISOString().slice(0, 10),
                    type: 'INCOME',
                    category: 'Project Revenue',
                    account: isBank ? 'BRAC Bank' : isMobile ? 'bKash / Nagad' : 'Cash in Hand',
                    accountHead: revAcc.name,
                    paymentMethod: pb.method,
                    paymentAccount: pb.method,
                    refNo: refNo,
                    customerOrSupplier: clientName,
                    description: `Project Income: [${code}] ${clientName} - ${descDetail} (${pb.method})`,
                    amount: pbAmount,
                });
            }
        });

        if (newJournals.length > 0) {
            setJournalEntries(prev => [...newJournals, ...prev]);
        }
        if (newTxs.length > 0) {
            setTransactions(prev => ensureUniqueTransactions([...newTxs, ...prev]));
        }

        if (newJournals.length > 0) {
            setChartOfAccounts(prev => prev.map(acc => {
                let balChange = 0;
                newJournals.forEach(j => {
                    if (acc.id === j.debitAccountId) {
                        balChange += (acc.normalBalance === 'Debit' ? j.amount : -j.amount);
                    }
                    if (acc.id === j.creditAccountId) {
                        balChange += (acc.normalBalance === 'Credit' ? j.amount : -j.amount);
                    }
                });
                return balChange !== 0 ? { ...acc, currentBalance: acc.currentBalance + balChange } : acc;
            }));
        }

        let initialDue = 0;
        validBreakdowns.forEach(pb => {
            const m = (pb.method || '').toLowerCase();
            if (m.includes('due') || m.includes('receivable')) {
                initialDue += Number(pb.amount) || 0;
            }
        });
        const initialPaid = Math.max(0, (Number(sales.amount) || 0) - initialDue);

        const newItem: ProjectSalesItem = {
            ...sales,
            id: newItemId,
            linkedAccountId: revAcc.id,
            paidAmount: initialPaid,
            dueAmount: initialDue,
            collections: [],
            invoiceNo: sales.invoiceNo || targetProj?.invoiceNo || undefined,
        };

        setProjects((prev) => {
            const next = prev.map((p) => {
                if (p.id === projectId) {
                    const updatedSales = [...p.salesItems, newItem];
                    return recalculateProject({ ...p, salesItems: updatedSales });
                }
                return p;
            });
            try { localStorage.setItem(`${STORAGE_KEY}_PROJECTS`, JSON.stringify(next)); } catch {}
            return next;
        });
        latestStateRef.current = {
            ...latestStateRef.current,
            projects: (latestStateRef.current.projects || []).map((p: Project) => {
                if (p.id === projectId) {
                    const updatedSales = [...(p.salesItems || []), newItem];
                    return recalculateProject({ ...p, salesItems: updatedSales });
                }
                return p;
            }),
        };

        if (targetProj?.invoiceId || targetProj?.invoiceNo) {
            syncProjectInvoice(projectId);
        }

        addAuditLog({
            staffId: activeStaff?.id || 'staff-admin',
            staffName: activeStaff?.name || 'Staff',
            staffRole: activeStaff?.role || 'Managing Director',
            location: 'Office',
            actionType: 'PROJECT_SALES_ADDED',
            entityType: 'Projects',
            refNo: sales.invoiceNo || code,
            details: `Recorded Project Sales Income Tk ${sales.amount.toLocaleString()} for [${code}] ${projName} (Synced to COA [${revAcc.code}] ${revAcc.name})`,
            detailsBn: undefined,
            amount: sales.amount,
            severity: 'success',
        });
        triggerImmediatePush();
    };

    const addProjectExpense = (projectId: string, expense: Omit<ProjectExpenseItem, 'id'>) => {
        addProjectExpenses(projectId, [expense]);
    };

    const addProjectExpenses = (projectId: string, expenses: Omit<ProjectExpenseItem, 'id'>[]) => {
        if (!expenses || expenses.length === 0) return;
        const targetProj = projects.find(p => p.id === projectId);
        const code = targetProj?.code || 'PRJ';
        const projName = targetProj?.name || 'Project';
        const timestamp = Date.now();

        const defaultCashAcc = resolvePaymentAssetAccount('Cash');
        const newJournals: JournalEntry[] = [];
        const newTxs: AccountingTransaction[] = [];

        const newItems: ProjectExpenseItem[] = expenses.map((exp, idx) => {
            const expAcc = (exp.linkedAccountId ? chartOfAccounts.find(a => a.id === exp.linkedAccountId) : null)
                || resolveExpenseAccount(exp.category, exp.note);
            const paymentMethodName = exp.paymentMethod || 'Cash';
            const payAcc = (exp.paymentAccountId ? chartOfAccounts.find(a => a.id === exp.paymentAccountId) : null)
                || resolvePaymentAssetAccount(paymentMethodName);
            const expAmount = Number(exp.amount) || 0;

            if (expAmount > 0) {
                newJournals.push({
                    id: `jnl-pe-${timestamp}-${idx}`,
                    entryNo: `JNL-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}${idx}`,
                    date: exp.date || new Date().toISOString().slice(0, 10),
                    refNo: code,
                    debitAccountId: expAcc.id,
                    debitAccountName: expAcc.name,
                    creditAccountId: payAcc.id,
                    creditAccountName: payAcc.name,
                    amount: expAmount,
                    narration: `Project Expense: [${code}] ${projName} - ${exp.category}${exp.note ? `: ${exp.note}` : ''}`,
                    source: 'PROJECT_EXPENSE',
                    createdBy: activeStaff?.name || 'Managing Director',
                });

                newTxs.push({
                    id: generateUniqueId('tx-prj-exp'),
                    date: exp.date || new Date().toISOString().slice(0, 10),
                    type: 'EXPENSE',
                    category: exp.category,
                    account: payAcc.name,
                    accountHead: expAcc.name,
                    paymentMethod: paymentMethodName,
                    paymentAccount: payAcc.name,
                    refNo: code,
                    customerOrSupplier: targetProj?.clientName || 'Vendor/Labor',
                    description: exp.note
                        ? `Project Cost: [${code}] ${projName} - ${exp.note}`
                        : `Project Cost: [${code}] ${projName} - ${exp.category}`,
                    amount: expAmount,
                    projectId: targetProj?.id,
                    projectCode: code,
                });
            }

            return {
                ...exp,
                id: `pe-${timestamp}-${idx}`,
                linkedAccountId: expAcc.id,
                linkedAccountCode: expAcc.code,
                paymentMethod: paymentMethodName,
                paymentAccountId: payAcc.id,
            };
        });

        if (newJournals.length > 0) {
            setJournalEntries(prev => {
                const next = [...newJournals, ...prev];
                try { localStorage.setItem(`${STORAGE_KEY}_JOURNALS`, JSON.stringify(next)); } catch {}
                return next;
            });
        }
        if (newTxs.length > 0) {
            setTransactions(prev => {
                const next = ensureUniqueTransactions([...newTxs, ...prev]);
                try { localStorage.setItem(`${STORAGE_KEY}_TRANSACTIONS`, JSON.stringify(next)); } catch {}
                return next;
            });
        }

        if (newJournals.length > 0) {
            setChartOfAccounts(prev => {
                const next = prev.map(acc => {
                    let balChange = 0;
                    newJournals.forEach(j => {
                        if (acc.id === j.debitAccountId) {
                            balChange += (acc.normalBalance === 'Debit' ? j.amount : -j.amount);
                        }
                        if (acc.id === j.creditAccountId) {
                            balChange -= (acc.normalBalance === 'Credit' ? j.amount : -j.amount);
                        }
                    });
                    return balChange !== 0 ? { ...acc, currentBalance: acc.currentBalance + balChange } : acc;
                });
                try { localStorage.setItem(`${STORAGE_KEY}_COA`, JSON.stringify(next)); } catch {}
                return next;
            });
        }

        setProjects((prev) => {
            const next = prev.map((p) => {
                if (p.id === projectId) {
                    const updatedExpenses = [...p.expenseItems, ...newItems];
                    return recalculateProject({ ...p, expenseItems: updatedExpenses });
                }
                return p;
            });
            try { localStorage.setItem(`${STORAGE_KEY}_PROJECTS`, JSON.stringify(next)); } catch {}
            return next;
        });
        latestStateRef.current = {
            ...latestStateRef.current,
            projects: (latestStateRef.current.projects || []).map((p: Project) => {
                if (p.id === projectId) {
                    const updatedExpenses = [...(p.expenseItems || []), ...newItems];
                    return recalculateProject({ ...p, expenseItems: updatedExpenses });
                }
                return p;
            }),
        };

        const totalAddedAmt = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        addAuditLog({
            staffId: activeStaff?.id || 'staff-admin',
            staffName: activeStaff?.name || 'Staff',
            staffRole: activeStaff?.role || 'Managing Director',
            location: 'Office',
            actionType: 'PROJECT_EXPENSE_ADDED',
            entityType: 'Projects',
            refNo: code,
            details: `Recorded ${expenses.length} project expense items totaling Tk ${totalAddedAmt.toLocaleString()} for [${code}] ${projName} (Synced to COA)`,
            detailsBn: undefined,
            amount: totalAddedAmt,
            severity: 'info',
        });

        triggerImmediatePush();
    };

    const deleteProjectSales = (projectId: string, salesId: string) => {
        const targetProj = projects.find(p => p.id === projectId);
        const itemToDelete = targetProj?.salesItems.find(s => s.id === salesId);
        const refNo = itemToDelete?.invoiceNo || targetProj?.code;

        if (refNo) {
            const matchingJournals = (journalEntries || []).filter(j => j.source === 'PROJECT_SALES' && j.refNo === refNo && (itemToDelete ? j.narration.includes(itemToDelete.description) || j.amount === Number(itemToDelete.amount) : true));
            if (matchingJournals.length > 0) {
                setChartOfAccounts(prev => {
                    const next = prev.map(acc => {
                        let balChange = 0;
                        matchingJournals.forEach(j => {
                            if (acc.id === j.debitAccountId) {
                                balChange -= (acc.normalBalance === 'Debit' ? j.amount : -j.amount);
                            }
                            if (acc.id === j.creditAccountId) {
                                balChange -= (acc.normalBalance === 'Credit' ? j.amount : -j.amount);
                            }
                        });
                        return balChange !== 0 ? { ...acc, currentBalance: acc.currentBalance + balChange } : acc;
                    });
                    try { localStorage.setItem(`${STORAGE_KEY}_COA`, JSON.stringify(next)); } catch {}
                    return next;
                });
            }
            setJournalEntries(prev => {
                const next = prev.filter(j => !(j.source === 'PROJECT_SALES' && j.refNo === refNo && (itemToDelete ? j.narration.includes(itemToDelete.description) : true)));
                try { localStorage.setItem(`${STORAGE_KEY}_JOURNALS`, JSON.stringify(next)); } catch {}
                return next;
            });
            setTransactions(prev => {
                const next = prev.filter(t => !(t.type === 'INCOME' && t.refNo === refNo && (itemToDelete ? t.description.includes(itemToDelete.description) : true)));
                try { localStorage.setItem(`${STORAGE_KEY}_TRANSACTIONS`, JSON.stringify(next)); } catch {}
                return next;
            });
        }

        setProjects((prev) => {
            const next = prev.map((p) => {
                if (p.id === projectId) {
                    const updatedSales = p.salesItems.filter((item) => item.id !== salesId);
                    return recalculateProject({ ...p, salesItems: updatedSales });
                }
                return p;
            });
            try { localStorage.setItem(`${STORAGE_KEY}_PROJECTS`, JSON.stringify(next)); } catch {}
            return next;
        });
        latestStateRef.current = {
            ...latestStateRef.current,
            projects: (latestStateRef.current.projects || []).map((p: Project) => {
                if (p.id === projectId) {
                    const updatedSales = (p.salesItems || []).filter((item) => item.id !== salesId);
                    return recalculateProject({ ...p, salesItems: updatedSales });
                }
                return p;
            }),
        };
        if (targetProj?.invoiceId || targetProj?.invoiceNo) {
            syncProjectInvoice(projectId);
        }
        triggerImmediatePush();
    };

    const collectProjectDue = (
        projectId: string,
        salesItemId: string,
        amount: number,
        paymentMethod: string,
        date?: string,
        note?: string,
        referenceNo?: string,
        advanceAdjustAmount: number = 0
    ) => {
        const advanceAdjust = Math.max(0, Number(advanceAdjustAmount) || 0);
        const cashCollect = Math.max(0, Number(amount) || 0);
        const totalPaymentApplied = cashCollect + advanceAdjust;
        if (totalPaymentApplied <= 0) return;

        const currentProjects = latestStateRef.current.projects || projects;
        const targetProj = currentProjects.find((p: Project) => p.id === projectId);
        if (!targetProj) return;

        const targetSale = (targetProj.salesItems || []).find((s: ProjectSalesItem) => s.id === salesItemId);
        if (!targetSale) return;

        // Determine current due amount on this sales item
        let currentItemDue = 0;
        if (targetSale.dueAmount !== undefined) {
            currentItemDue = Number(targetSale.dueAmount) || 0;
        } else {
            const breakdowns = targetSale.paymentBreakdown || [];
            const dueRow = breakdowns.find(b => {
                const m = (b.method || '').toLowerCase();
                return m.includes('due') || m.includes('receivable');
            });
            const dueInitial = dueRow ? Number(dueRow.amount) || 0 : 0;
            const pastCollections = (targetSale.collections || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
            currentItemDue = Math.max(0, dueInitial - pastCollections);
        }

        if (currentItemDue <= 0) return;

        const safeAdvance = Math.min(advanceAdjust, currentItemDue);
        const remainingDueAfterAdvance = Math.max(0, currentItemDue - safeAdvance);
        const safeCash = Math.min(cashCollect, remainingDueAfterAdvance);
        const finalTotalApplied = safeAdvance + safeCash;
        if (finalTotalApplied <= 0) return;

        const colDate = date || new Date().toISOString().slice(0, 10);
        const ref = referenceNo || targetSale.invoiceNo || `${targetProj.code}-${colDate}`;

        const newCollectionsToAdd: ProjectSalesCollection[] = [];
        if (safeAdvance > 0) {
            newCollectionsToAdd.push({
                id: `col-prj-adv-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
                date: colDate,
                amount: safeAdvance,
                paymentMethod: 'Customer Advance',
                note: note ? `Advance Adjustment: ${note.trim()}` : 'Adjusted from Customer Advance',
                referenceNo: ref,
                createdBy: activeStaff?.name || 'Managing Director',
            });
        }
        if (safeCash > 0) {
            newCollectionsToAdd.push({
                id: `col-prj-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
                date: colDate,
                amount: safeCash,
                paymentMethod,
                note: note?.trim() || undefined,
                referenceNo: ref,
                createdBy: activeStaff?.name || 'Managing Director',
            });
        }

        const updatedCollections = [...(targetSale.collections || []), ...newCollectionsToAdd];
        const newDueAmount = Math.max(0, currentItemDue - finalTotalApplied);
        const newPaidAmount = Math.max(0, (Number(targetSale.amount) || 0) - newDueAmount);

        // 1. Update Project in state and local storage
        const updatedProjects = currentProjects.map((p: Project) => {
            if (p.id !== projectId) return p;
            const updatedSales = (p.salesItems || []).map((s: ProjectSalesItem) => {
                if (s.id !== salesItemId) return s;
                return {
                    ...s,
                    dueAmount: newDueAmount,
                    paidAmount: newPaidAmount,
                    collections: updatedCollections,
                };
            });
            return recalculateProject({ ...p, salesItems: updatedSales });
        });

        setProjects(updatedProjects);
        try { localStorage.setItem(`${STORAGE_KEY}_PROJECTS`, JSON.stringify(updatedProjects)); } catch {}

        latestStateRef.current = {
            ...latestStateRef.current,
            projects: updatedProjects,
        };

        // 2. Accounting Double-Entry (Journal Entries)
        const creditAcc = resolvePaymentAssetAccount('Due');
        const newJournals: JournalEntry[] = [];
        const descRef = targetSale.invoiceNo ? `Invoice #${targetSale.invoiceNo}` : `Ref #${ref}`;

        // Cash/Bank/MFS journal if safeCash > 0
        let debitAcc = resolvePaymentAssetAccount(paymentMethod);
        if (safeCash > 0) {
            newJournals.push({
                id: `jnl-pcol-${Date.now()}`,
                entryNo: `JNL-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
                date: colDate,
                refNo: ref,
                debitAccountId: debitAcc.id,
                debitAccountName: debitAcc.name,
                creditAccountId: creditAcc.id,
                creditAccountName: creditAcc.name,
                amount: safeCash,
                narration: `Project Due Collection: [${targetProj.code}] ${targetProj.clientName} - Collected via ${paymentMethod} (${descRef})${note ? ` - ${note}` : ''}`,
                source: 'PROJECT_SALES',
                createdBy: activeStaff?.name || 'Managing Director',
            });
        }

        // Advance Adjustment journal if safeAdvance > 0
        const advanceLiabilityAcc = chartOfAccounts.find(a => a.classification === 'Liability' && (
            a.code === '2020' ||
            a.code === '2002' ||
            a.id === 'coa-2020' ||
            a.name.toLowerCase().includes('advance') ||
            a.name.toLowerCase().includes('deposit') ||
            a.nameBn?.includes('অগ্রিম')
        )) || chartOfAccounts.find(a => a.classification === 'Liability') || { id: 'coa-2020', name: 'Customer Advance', code: '2020', classification: 'Liability' as const, normalBalance: 'Credit' as const, currentBalance: 0 };

        if (safeAdvance > 0) {
            newJournals.push({
                id: `jnl-pcol-adv-${Date.now()}-${Math.floor(10 + Math.random() * 90)}`,
                entryNo: `JNL-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}B`,
                date: colDate,
                refNo: ref,
                debitAccountId: advanceLiabilityAcc.id,
                debitAccountName: advanceLiabilityAcc.name,
                creditAccountId: creditAcc.id,
                creditAccountName: creditAcc.name,
                amount: safeAdvance,
                narration: `Project Due Advance Adjustment: [${targetProj.code}] ${targetProj.clientName} - Adjusted from Customer Advance (${descRef})${note ? ` - ${note}` : ''}`,
                source: 'PROJECT_SALES',
                createdBy: activeStaff?.name || 'Managing Director',
            });
        }

        if (newJournals.length > 0) {
            setJournalEntries(prev => {
                const next = [...newJournals, ...prev];
                try { localStorage.setItem(`${STORAGE_KEY}_JOURNALS`, JSON.stringify(next)); } catch {}
                return next;
            });
        }

        // 3. Accounting Transactions (Cash/Bank in-flow & Advance adjustment)
        const newTxs: AccountingTransaction[] = [];
        if (safeCash > 0) {
            const isBank = paymentMethod.toLowerCase().includes('bank') || paymentMethod.toLowerCase().includes('plc');
            const isMobile = paymentMethod.toLowerCase().includes('bkash') || paymentMethod.toLowerCase().includes('nagad') || paymentMethod.toLowerCase().includes('rocket');
            newTxs.push({
                id: generateUniqueId('tx-prj-col'),
                date: colDate,
                type: 'INCOME',
                category: 'Project Due Collection',
                account: debitAcc.name,
                accountHead: debitAcc.name,
                paymentMethod: paymentMethod,
                paymentAccount: debitAcc.name,
                refNo: ref,
                customerOrSupplier: targetProj.clientName,
                description: note || `Project Due Collected: [${targetProj.code}] ${targetProj.clientName} - ${descRef} (${debitAcc.name})`,
                amount: safeCash,
            });
        }
        if (safeAdvance > 0) {
            newTxs.push({
                id: generateUniqueId('tx-prj-adv'),
                date: colDate,
                type: 'INCOME',
                category: 'Customer Advance Adjustment',
                account: 'Customer Advance',
                accountHead: advanceLiabilityAcc.name,
                paymentMethod: 'Customer Advance',
                paymentAccount: 'Customer Advance',
                refNo: ref,
                customerOrSupplier: targetProj.clientName,
                description: `Project Advance Adjusted: [${targetProj.code}] ${targetProj.clientName} - Adjusted Tk ${safeAdvance.toLocaleString()} from Customer Advance (${descRef})`,
                amount: safeAdvance,
            });
        }

        if (newTxs.length > 0) {
            setTransactions(prev => {
                const next = ensureUniqueTransactions([...newTxs, ...prev]);
                try { localStorage.setItem(`${STORAGE_KEY}_TRANSACTIONS`, JSON.stringify(next)); } catch {}
                return next;
            });
        }

        // 4. Update Chart of Accounts balances directly
        setChartOfAccounts(prev => {
            const next = prev.map(acc => {
                if (safeCash > 0 && acc.id === debitAcc.id) {
                    const delta = acc.normalBalance === 'Debit' ? safeCash : -safeCash;
                    return { ...acc, currentBalance: acc.currentBalance + delta };
                }
                if (acc.id === creditAcc.id) {
                    const delta = acc.normalBalance === 'Debit' ? -finalTotalApplied : finalTotalApplied;
                    return { ...acc, currentBalance: acc.currentBalance + delta };
                }
                if (safeAdvance > 0 && acc.id === advanceLiabilityAcc.id) {
                    const delta = acc.normalBalance === 'Credit' ? -safeAdvance : safeAdvance;
                    return { ...acc, currentBalance: acc.currentBalance + delta };
                }
                return acc;
            });
            try {
                localStorage.setItem(`${STORAGE_KEY}_COA`, JSON.stringify(next));
                localStorage.setItem(`${STORAGE_KEY}_CHART_OF_ACCOUNTS`, JSON.stringify(next));
            } catch {}
            return next;
        });

        // 4b. Sync to linked Sales Invoice and Customer Due
        const linkedInvNo = targetSale.invoiceNo || targetProj.invoiceNo;
        const linkedInvId = targetProj.invoiceId;
        let updatedInvs = latestStateRef.current.invoices || invoices;
        if (linkedInvNo || linkedInvId) {
            updatedInvs = updatedInvs.map(inv => {
                if ((linkedInvId && inv.id === linkedInvId) || (linkedInvNo && inv.invoiceNo === linkedInvNo)) {
                    const newPaid = Math.min(Number(inv.grandTotal) || 0, (Number(inv.paidAmount) || 0) + finalTotalApplied);
                    const newDue = Math.max(0, (Number(inv.grandTotal) || 0) - newPaid);
                    const newStatus: PaymentStatus = newDue <= 0 ? 'Paid' : 'Partial';
                    const existingSplits = { ...(inv.splitPayments || {}) };
                    if (safeCash > 0) {
                        existingSplits[paymentMethod] = (existingSplits[paymentMethod] || 0) + safeCash;
                    }
                    if (safeAdvance > 0) {
                        existingSplits['Customer Advance'] = (existingSplits['Customer Advance'] || 0) + safeAdvance;
                    }
                    if (existingSplits['Due'] !== undefined) {
                        existingSplits['Due'] = Math.max(0, existingSplits['Due'] - finalTotalApplied);
                    }
                    return {
                        ...inv,
                        projectId: inv.projectId || targetProj.id,
                        projectCode: inv.projectCode || targetProj.code,
                        paidAmount: newPaid,
                        dueAmount: newDue,
                        paymentStatus: newStatus,
                        splitPayments: existingSplits,
                    };
                }
                return inv;
            });
            setInvoices(updatedInvs);
            try { localStorage.setItem(`${STORAGE_KEY}_INVOICES`, JSON.stringify(updatedInvs)); } catch {}
        }

        const currentCusts = latestStateRef.current.customers || customers;
        const updatedCusts = currentCusts.map(c => {
            const isMatch = (targetProj.clientName && c.name && c.name.toLowerCase().trim() === targetProj.clientName.toLowerCase().trim()) ||
                            (targetProj.clientPhone && c.phone && c.phone === targetProj.clientPhone) ||
                            (c.company && targetProj.name && targetProj.name.toLowerCase().includes(c.company.toLowerCase()));
            if (isMatch) {
                const clientInvoices = updatedInvs.filter(inv => isInvoiceMatchingCustomer(inv, c));
                const dueAmount = clientInvoices.length > 0
                    ? clientInvoices.reduce((s, inv) => s + (Number(inv.dueAmount) || 0), 0)
                    : Math.max(0, (Number(c.dueAmount) || 0) - finalTotalApplied);
                const currentAdv = Number(c.advanceBalance) || 0;
                const newAdv = Math.max(0, currentAdv - safeAdvance);
                return { ...c, dueAmount, advanceBalance: newAdv };
            }
            return c;
        });
        setCustomers(updatedCusts);
        try { localStorage.setItem(`${STORAGE_KEY}_CUSTOMERS`, JSON.stringify(updatedCusts)); } catch {}

        latestStateRef.current = {
            ...latestStateRef.current,
            invoices: updatedInvs,
            customers: updatedCusts,
        };

        // 5. Add Audit Log
        if (safeAdvance > 0) {
            addAuditLog({
                staffId: activeStaff?.id || 'staff-admin',
                staffName: activeStaff?.name || 'Staff',
                staffRole: activeStaff?.role || 'Managing Director',
                location: 'Office',
                actionType: 'ADVANCE_ADJUSTED' as any,
                entityType: 'Projects',
                refNo: targetProj.code,
                details: `Adjusted payment of Tk ${safeAdvance.toLocaleString()} from Customer Advance for Project ${targetProj.code} (${targetProj.name})`,
                amount: safeAdvance,
                severity: 'success',
            });
        }
        if (safeCash > 0) {
            addAuditLog({
                staffId: activeStaff?.id || 'staff-admin',
                staffName: activeStaff?.name || 'Staff',
                staffRole: activeStaff?.role || 'Managing Director',
                location: 'Office',
                actionType: 'PROJECT_DUE_COLLECTED' as any,
                entityType: 'Projects',
                refNo: targetProj.code,
                details: `Collected Project Due of Tk ${safeCash.toLocaleString()} via ${paymentMethod} for Project ${targetProj.code} (${targetProj.name})`,
                amount: safeCash,
                severity: 'success',
            });
        }

        triggerImmediatePush();
    };

    const deleteProjectExpense = (projectId: string, expenseId: string) => {
        const targetProj = projects.find(p => p.id === projectId);
        const itemToDelete = targetProj?.expenseItems.find(e => e.id === expenseId);
        const code = targetProj?.code;

        if (code && itemToDelete) {
            const matchingJournals = (journalEntries || []).filter(j => j.source === 'PROJECT_EXPENSE' && j.refNo === code && (j.narration.includes(itemToDelete.category) || j.amount === Number(itemToDelete.amount)));
            if (matchingJournals.length > 0) {
                setChartOfAccounts(prev => {
                    const next = prev.map(acc => {
                        let balChange = 0;
                        matchingJournals.forEach(j => {
                            if (acc.id === j.debitAccountId) {
                                balChange -= (acc.normalBalance === 'Debit' ? j.amount : -j.amount);
                            }
                            if (acc.id === j.creditAccountId) {
                                balChange -= (acc.normalBalance === 'Credit' ? j.amount : -j.amount);
                            }
                        });
                        return balChange !== 0 ? { ...acc, currentBalance: acc.currentBalance + balChange } : acc;
                    });
                    try { localStorage.setItem(`${STORAGE_KEY}_COA`, JSON.stringify(next)); } catch {}
                    return next;
                });
            }
            setJournalEntries(prev => {
                const next = prev.filter(j => !(j.source === 'PROJECT_EXPENSE' && j.refNo === code && j.narration.includes(itemToDelete.category)));
                try { localStorage.setItem(`${STORAGE_KEY}_JOURNALS`, JSON.stringify(next)); } catch {}
                return next;
            });
            setTransactions(prev => {
                const next = prev.filter(t => !(t.type === 'EXPENSE' && t.refNo === code && t.category === itemToDelete.category));
                try { localStorage.setItem(`${STORAGE_KEY}_TRANSACTIONS`, JSON.stringify(next)); } catch {}
                return next;
            });
        }

        setProjects((prev) => {
            const next = prev.map((p) => {
                if (p.id === projectId) {
                    const updatedExpenses = p.expenseItems.filter((item) => item.id !== expenseId);
                    return recalculateProject({ ...p, expenseItems: updatedExpenses });
                }
                return p;
            });
            try { localStorage.setItem(`${STORAGE_KEY}_PROJECTS`, JSON.stringify(next)); } catch {}
            return next;
        });
        latestStateRef.current = {
            ...latestStateRef.current,
            projects: (latestStateRef.current.projects || []).map((p: Project) => {
                if (p.id === projectId) {
                    const updatedExpenses = (p.expenseItems || []).filter((item) => item.id !== expenseId);
                    return recalculateProject({ ...p, expenseItems: updatedExpenses });
                }
                return p;
            }),
        };
        triggerImmediatePush();
    };

    const syncProjectsWithAccounting = (): { salesSynced: number; expensesSynced: number; totalAmount: number } => {
        let salesSynced = 0;
        let expensesSynced = 0;
        let totalAmount = 0;

        const revAcc = resolveProjectRevenueAccount();
        const expAcc = resolveProjectExpenseAccount();
        const cashAcc = resolvePaymentAssetAccount('Cash');
        const cogsAcc = chartOfAccounts.find(a => a.classification === 'Expense' && (a.code === '5010' || a.name.toLowerCase().includes('raw') || a.name.toLowerCase().includes('cost')));

        const totalPrjSales = projects.reduce((s, p) => s + (p.totalSales || 0), 0);
        const totalPrjExpenses = projects.reduce((s, p) => s + (p.totalExpenses || 0), 0);

        const newJournals: JournalEntry[] = [];
        const newTxs: AccountingTransaction[] = [];

        // 1. Re-route any existing project expense journals/transactions pointing to wrong accounts (like 5010)
        setJournalEntries(prev => prev.map(j => {
            if (j.source === 'PROJECT_EXPENSE' && expAcc && j.debitAccountId !== expAcc.id) {
                return { ...j, debitAccountId: expAcc.id, debitAccountName: expAcc.name };
            }
            if (j.source === 'PROJECT_SALES' && revAcc && j.creditAccountId !== revAcc.id) {
                return { ...j, creditAccountId: revAcc.id, creditAccountName: revAcc.name };
            }
            return j;
        }));

        setTransactions(prev => prev.map(t => {
            if (t.type === 'EXPENSE' && t.refNo && projects.some(p => p.code === t.refNo) && expAcc && t.accountHead !== expAcc.name) {
                return { ...t, accountHead: expAcc.name };
            }
            if (t.type === 'INCOME' && revAcc && (t.category?.toLowerCase().includes('project') || (t.refNo && projects.some(p => p.code === t.refNo))) && t.accountHead !== revAcc.name) {
                return { ...t, accountHead: revAcc.name };
            }
            return t;
        }));

        // 2. Identify and record any missing project sales and expense items
        projects.forEach(project => {
            (project.salesItems || []).forEach((sale) => {
                const ref = sale.invoiceNo || project.code;
                const alreadyHasJournal = journalEntries.some(j => (j.refNo === ref && j.narration.includes(sale.description)) || j.id.includes(sale.id));
                const alreadyHasTx = transactions.some(t => t.refNo === ref && t.description.includes(sale.description));

                if (!alreadyHasJournal || !alreadyHasTx) {
                    const validBreakdowns = (sale.paymentBreakdown && sale.paymentBreakdown.length > 0)
                        ? sale.paymentBreakdown
                        : [{ id: `pb-${sale.id}`, method: sale.paymentMethod || 'Cash', amount: sale.amount, note: sale.note }];

                    validBreakdowns.forEach((pb, pidx) => {
                        const pbAmt = Number(pb.amount) || 0;
                        if (pbAmt <= 0) return;
                        const assetAcc = resolvePaymentAssetAccount(pb.method);

                        if (!alreadyHasJournal) {
                            newJournals.push({
                                id: `jnl-ps-sync-${sale.id}-${pidx}`,
                                entryNo: `JNL-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}${salesSynced}`,
                                date: sale.date || new Date().toISOString().slice(0, 10),
                                refNo: ref,
                                debitAccountId: assetAcc.id,
                                debitAccountName: assetAcc.name,
                                creditAccountId: revAcc.id,
                                creditAccountName: revAcc.name,
                                amount: pbAmt,
                                narration: `Project Sales Income: [${project.code}] ${project.name} - ${sale.description} (${pb.method})`,
                                source: 'PROJECT_SALES',
                                createdBy: activeStaff?.name || 'System Auto-Sync',
                            });
                        }

                        const isDue = pb.method.toLowerCase().includes('due') || pb.method.toLowerCase().includes('receivable');
                        if (!alreadyHasTx && !isDue) {
                            const isBank = pb.method.toLowerCase().includes('bank') || pb.method.toLowerCase().includes('brac');
                            const isMobile = pb.method.toLowerCase().includes('bkash') || pb.method.toLowerCase().includes('nagad');
                            newTxs.push({
                                id: generateUniqueId('tx-prj-sync-sale'),
                                date: sale.date || new Date().toISOString().slice(0, 10),
                                type: 'INCOME',
                                category: 'Project Revenue',
                                account: isBank ? 'BRAC Bank' : isMobile ? 'bKash / Nagad' : 'Cash in Hand',
                                accountHead: revAcc.name,
                                paymentMethod: pb.method,
                                paymentAccount: pb.method,
                                refNo: ref,
                                customerOrSupplier: project.clientName,
                                description: `Project Income: [${project.code}] ${project.name} - ${sale.description} (${pb.method})`,
                                amount: pbAmt,
                            });
                        }
                        salesSynced++;
                        totalAmount += pbAmt;
                    });
                }
            });

            (project.expenseItems || []).forEach((exp, eidx) => {
                const expAmt = Number(exp.amount) || 0;
                if (expAmt <= 0) return;
                const specificExpAcc = resolveExpenseAccount(exp.category, exp.note);

                const alreadyHasJournal = journalEntries.some(j => j.refNo === project.code && j.narration.includes(exp.category) && j.amount === expAmt);
                const alreadyHasTx = transactions.some(t => t.refNo === project.code && t.category === exp.category && t.amount === expAmt);

                if (!alreadyHasJournal) {
                    newJournals.push({
                        id: `jnl-pe-sync-${exp.id}-${eidx}`,
                        entryNo: `JNL-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}${expensesSynced}`,
                        date: exp.date || new Date().toISOString().slice(0, 10),
                        refNo: project.code,
                        debitAccountId: specificExpAcc.id,
                        debitAccountName: specificExpAcc.name,
                        creditAccountId: cashAcc.id,
                        creditAccountName: cashAcc.name,
                        amount: expAmt,
                        narration: `Project Expense: [${project.code}] ${project.name} - ${exp.category}${exp.note ? `: ${exp.note}` : ''}`,
                        source: 'PROJECT_EXPENSE',
                        createdBy: activeStaff?.name || 'System Auto-Sync',
                    });
                }

                if (!alreadyHasTx) {
                    newTxs.push({
                        id: generateUniqueId('tx-prj-sync-exp'),
                        date: exp.date || new Date().toISOString().slice(0, 10),
                        type: 'EXPENSE',
                        category: exp.category,
                        account: 'Cash in Hand',
                        accountHead: specificExpAcc.name,
                        paymentMethod: 'Cash',
                        paymentAccount: 'Cash Counter / In-Hand',
                        refNo: project.code,
                        customerOrSupplier: project.clientName || 'Vendor/Labor',
                        description: `Project Cost: [${project.code}] ${project.name} - ${exp.category}${exp.note ? ` (${exp.note})` : ''}`,
                        amount: expAmt,
                    });
                }

                if (!alreadyHasJournal || !alreadyHasTx) {
                    expensesSynced++;
                    totalAmount += expAmt;
                }
            });
        });

        if (newJournals.length > 0) {
            setJournalEntries(prev => [...newJournals, ...prev]);
        }
        if (newTxs.length > 0) {
            setTransactions(prev => ensureUniqueTransactions([...newTxs, ...prev]));
        }

        // 3. Align and ensure proper Chart of Accounts balances
        const totalCustomerReceivables = calculateTotalCustomerReceivables(invoices, customers, projects);
        const receivableAcc = chartOfAccounts.find(a => a.classification === 'Asset' && (
            a.id === 'coa-1050' ||
            a.code === '1003' ||
            a.code === '1050' ||
            (a.name.toLowerCase().includes('customer') && a.name.toLowerCase().includes('receivable')) ||
            a.name.toLowerCase().includes('trade debtor') ||
            a.nameBn?.includes('কাস্টমার বকেয়া') ||
            a.nameBn?.includes('প্রাপ্য হিসাব') ||
            (a.name.toLowerCase().includes('receivable') && !a.name.toLowerCase().includes('aggregator') && !a.name.toLowerCase().includes('staff'))
        ));

        setChartOfAccounts(prev => {
            const next = prev.map(acc => {
                // Dedicated Project Expense (5206 / Project Expense)
                if (expAcc && acc.id === expAcc.id) {
                    return { ...acc, currentBalance: (acc.openingBalance || 0) + totalPrjExpenses };
                }
                // 5010 COGS: reclaim incorrectly attributed project expenses
                if (cogsAcc && acc.id === cogsAcc.id) {
                    if (totalPrjExpenses > 0 && acc.currentBalance >= totalPrjExpenses && (expAcc ? expAcc.currentBalance < totalPrjExpenses : true)) {
                        const corrected = Math.max(acc.openingBalance || 0, acc.currentBalance - totalPrjExpenses);
                        return { ...acc, currentBalance: corrected };
                    }
                }
                // Dedicated Project Revenue (4002 / 4051 Project Sales)
                if (revAcc && acc.id === revAcc.id) {
                    return { ...acc, currentBalance: (acc.openingBalance || 0) + totalPrjSales };
                }
                // Dedicated Customer Accounts Receivable Account (1003 / Accounts Receivable - Customers)
                if (receivableAcc && acc.id === receivableAcc.id) {
                    return { ...acc, currentBalance: totalCustomerReceivables > 0 ? totalCustomerReceivables : (acc.openingBalance || 0) };
                }
                // If there are no active project expenses, heal any asset accounts that became negative from orphaned project expenses
                if (totalPrjExpenses === 0 && acc.classification === 'Asset' && acc.currentBalance < 0 && (acc.openingBalance === 0 || acc.openingBalance === undefined)) {
                    return { ...acc, currentBalance: acc.openingBalance || 0 };
                }
                return acc;
            });
            try {
                localStorage.setItem(`${STORAGE_KEY}_COA`, JSON.stringify(next));
                localStorage.setItem(`${STORAGE_KEY}_CHART_OF_ACCOUNTS`, JSON.stringify(next));
            } catch {}
            latestStateRef.current = { ...latestStateRef.current, chartOfAccounts: next };
            return next;
        });

        addAuditLog({
            staffId: activeStaff?.id || 'sys',
            staffName: activeStaff?.name || 'System',
            staffRole: activeStaff?.role || 'Admin',
            location: 'Office',
            actionType: 'COA_UPDATED',
            entityType: 'Accounting',
            details: `Dynamic sync: Revenue [${revAcc.code}] ${revAcc.name} (Tk ${totalPrjSales.toLocaleString()}), Expense [${expAcc.code}] ${expAcc.name} (Tk ${totalPrjExpenses.toLocaleString()}), Receivable [${receivableAcc?.code || '1003'}] (Tk ${totalCustomerReceivables.toLocaleString()})`,
            detailsBn: undefined,
            amount: totalPrjSales + totalPrjExpenses,
            severity: 'info',
        });

        return { salesSynced, expensesSynced, totalAmount: totalPrjSales + totalPrjExpenses };
    };
    // Module Data Clean & Purge
    const cleanModuleData = (moduleKey: 'SALES' | 'QUOTATIONS' | 'PURCHASES' | 'INVENTORY_STOCK' | 'CUSTOM_PRODUCTS' | 'TRANSACTIONS' | 'JOURNALS' | 'AUDIT_LOGS' | 'PROJECTS' | 'ALL' | 'WIPE_ALL_EXCEPT_PRODUCTS' | 'RESET_ALL_TRANSACTIONS') => {
        if (moduleKey === 'SALES') {
            // 1. Reset Invoices
            setInvoices([]);
            try {
                localStorage.setItem(`${STORAGE_KEY}_INVOICES`, JSON.stringify([]));
            } catch {}

            // 2. Reset Quotations
            setQuotations([]);
            try {
                localStorage.setItem(`${STORAGE_KEY}_QUOTATIONS`, JSON.stringify([]));
            } catch {}

            // 3. Reset Customer sales totals & due balances to zero
            const currentCusts = latestStateRef.current.customers || customers;
            const nextCusts = currentCusts.map((c: Customer) => ({
                ...c,
                totalPurchased: 0,
                dueAmount: 0,
            }));
            setCustomers(nextCusts);
            try {
                localStorage.setItem(`${STORAGE_KEY}_CUSTOMERS`, JSON.stringify(nextCusts));
            } catch {}

            // 4. Remove Sales Revenue transactions and POS invoice payment records
            const currentTxs = latestStateRef.current.transactions || transactions;
            const nextTxs = currentTxs.filter((t: AccountingTransaction) => {
                const isSalesCategory = t.category === 'Sales Revenue' || t.category === 'Customer Payment' || t.category === 'Customer Advance Adjustment';
                const isInvoiceRef = Boolean(t.refNo && (t.refNo.startsWith('DCC-INV-') || t.refNo.startsWith('inv-')));
                const isPosDesc = Boolean(t.description && (
                    t.description.startsWith('POS Payment:') ||
                    t.description.startsWith('Sales Invoice payment') ||
                    t.description.startsWith('Invoice Due Payment:') ||
                    t.description.startsWith('Adjusted Tk') ||
                    t.description.includes('Customer Advance')
                ));
                return !(isSalesCategory || isInvoiceRef || isPosDesc);
            });
            setTransactions(nextTxs);
            try {
                localStorage.setItem(`${STORAGE_KEY}_TRANSACTIONS`, JSON.stringify(nextTxs));
            } catch {}

            // 5. Remove Sales stock movements
            const currentMovements = latestStateRef.current.stockMovements || stockMovements;
            const nextMovements = currentMovements.filter((m: StockMovement) => {
                const isSalesReason = Boolean(m.reason && (
                    m.reason.toLowerCase().includes('sales invoice') ||
                    m.reason.toLowerCase().includes('pos sale')
                ));
                const isInvoiceRef = Boolean(m.refNo && (m.refNo.startsWith('DCC-INV-') || m.refNo.startsWith('inv-')));
                return !(isSalesReason || isInvoiceRef);
            });
            setStockMovements(nextMovements);
            try {
                localStorage.setItem(`${STORAGE_KEY}_STOCK_MOVEMENTS`, JSON.stringify(nextMovements));
            } catch {}

            // 6. Audit Log
            addAuditLog({
                staffId: activeStaff?.id || 'admin',
                staffName: activeStaff?.name || 'Staff',
                staffRole: activeStaff?.role || 'Admin',
                location: 'All',
                actionType: 'DATA_CLEANED',
                entityType: 'Sales',
                details: 'Reset and purged all sales data: invoices, POS records, quotations, customer dues, and sales revenue transactions from system.',
                detailsBn: 'সকল সেলস ডেটা রিসেট করা হয়েছে (ইনভয়েস, পিওএস, কোটেশন, কাস্টমার বকেয়া ও সেলস আয়)।',
                severity: 'critical',
            });

            // 7. Update latestStateRef immediately
            latestStateRef.current = {
                ...latestStateRef.current,
                invoices: [],
                quotations: [],
                customers: nextCusts,
                transactions: nextTxs,
                stockMovements: nextMovements,
            };
        }
        else if (moduleKey === 'QUOTATIONS') {
            setQuotations([]);
            try {
                localStorage.setItem(`${STORAGE_KEY}_QUOTATIONS`, JSON.stringify([]));
            } catch {}
            latestStateRef.current = { ...latestStateRef.current, quotations: [] };
            addAuditLog({
                staffId: activeStaff.id,
                staffName: activeStaff.name,
                staffRole: activeStaff.role,
                location: 'All',
                actionType: 'DATA_CLEANED',
                entityType: 'System',
                details: 'Purged/cleaned all quotation records from system.',
                detailsBn: 'সকল কোটেশন রেকর্ড মুছে ফেলা হয়েছে।',
                severity: 'critical',
            });
        }
        else if (moduleKey === 'PURCHASES') {
            const currentSuppliers = latestStateRef.current.suppliers || suppliers;
            const zeroDuesSuppliers = currentSuppliers.map((s: Supplier) => ({
                ...s,
                totalPurchased: 0,
                balancePayable: 0,
                dueAmount: 0,
            }));
            setSuppliers(zeroDuesSuppliers);
            setPurchaseOrders([]);
            try {
                localStorage.setItem(`${STORAGE_KEY}_SUPPLIERS`, JSON.stringify(zeroDuesSuppliers));
                localStorage.setItem(`${STORAGE_KEY}_PURCHASE_ORDERS`, JSON.stringify([]));
            } catch {}
            latestStateRef.current = { ...latestStateRef.current, purchaseOrders: [], suppliers: zeroDuesSuppliers };
            addAuditLog({
                staffId: activeStaff.id,
                staffName: activeStaff.name,
                staffRole: activeStaff.role,
                location: 'All',
                actionType: 'DATA_CLEANED',
                entityType: 'System',
                details: 'Purged/cleaned all purchase orders and vendor procurement records.',
                detailsBn: 'সকল পারচেজ অর্ডার মুছে ফেলা হয়েছে।',
                severity: 'critical',
            });
        }
        else if (moduleKey === 'INVENTORY_STOCK') {
            const zeroStock = products.map((p) => ({ ...p, stockFactory: 0, stockOffice: 0 }));
            setProducts(zeroStock);
            setStockMovements([]);
            try {
                localStorage.setItem(`${STORAGE_KEY}_PRODUCTS`, JSON.stringify(zeroStock));
                localStorage.setItem(`${STORAGE_KEY}_STOCK_MOVEMENTS`, JSON.stringify([]));
            } catch {}
            latestStateRef.current = { ...latestStateRef.current, products: zeroStock, stockMovements: [] };
            addAuditLog({
                staffId: activeStaff.id,
                staffName: activeStaff.name,
                staffRole: activeStaff.role,
                location: 'All',
                actionType: 'DATA_CLEANED',
                entityType: 'System',
                details: 'Zeroed out stock quantities across all factory and office warehouse items.',
                detailsBn: 'স্টক পরিমাণ শূন্য (০) করা হয়েছে।',
                severity: 'critical',
            });
        }
        else if (moduleKey === 'CUSTOM_PRODUCTS') {
            setProducts(INITIAL_PRODUCTS);
            try {
                localStorage.setItem(`${STORAGE_KEY}_PRODUCTS`, JSON.stringify(INITIAL_PRODUCTS));
            } catch {}
            latestStateRef.current = { ...latestStateRef.current, products: INITIAL_PRODUCTS };
            addAuditLog({
                staffId: activeStaff.id,
                staffName: activeStaff.name,
                staffRole: activeStaff.role,
                location: 'All',
                actionType: 'DATA_CLEANED',
                entityType: 'System',
                details: 'Reset product catalog to standard default catalog.',
                detailsBn: 'প্রোডাক্ট ক্যাটালগ রিসেট করা হয়েছে।',
                severity: 'critical',
            });
        }
        else if (moduleKey === 'TRANSACTIONS') {
            setTransactions([]);
            try {
                localStorage.setItem(`${STORAGE_KEY}_TRANSACTIONS`, JSON.stringify([]));
            } catch {}
            latestStateRef.current = { ...latestStateRef.current, transactions: [] };
            addAuditLog({
                staffId: activeStaff.id,
                staffName: activeStaff.name,
                staffRole: activeStaff.role,
                location: 'All',
                actionType: 'DATA_CLEANED',
                entityType: 'System',
                details: 'Purged/cleaned operating cash transactions and expense registers.',
                detailsBn: 'সকল ট্রানজ্যাকশন মুছে ফেলা হয়েছে।',
                severity: 'critical',
            });
        }
        else if (moduleKey === 'JOURNALS') {
            setJournalEntries([]);
            try {
                localStorage.setItem(`${STORAGE_KEY}_JOURNALS`, JSON.stringify([]));
            } catch {}
            latestStateRef.current = { ...latestStateRef.current, journalEntries: [] };
        }
        else if (moduleKey === 'AUDIT_LOGS') {
            setAuditLogs([]);
            try {
                localStorage.setItem(`${STORAGE_KEY}_AUDIT_LOGS`, JSON.stringify([]));
            } catch {}
            latestStateRef.current = { ...latestStateRef.current, auditLogs: [] };
        }
        else if (moduleKey === 'PROJECTS') {
            setProjects([]);
            try {
                localStorage.setItem(`${STORAGE_KEY}_PROJECTS`, JSON.stringify([]));
            } catch {}
            // Also reset Project Expense (5206) and Project Revenue (4002/4051) and restore asset accounts in Chart of Accounts
            const prjJournals = (latestStateRef.current.journalEntries || journalEntries).filter(
                (j: JournalEntry) => j.source === 'PROJECT_EXPENSE' || j.source === 'PROJECT_SALES'
            );
            const cleanedCOA = (latestStateRef.current.chartOfAccounts || chartOfAccounts).map((acc: ChartOfAccount) => {
                const isPrj = acc.code === '5206' || acc.code === '5300' || acc.code === '4002' || acc.code === '4051' || acc.code === '4060' || acc.name.toLowerCase().includes('project');
                if (isPrj) {
                    return { ...acc, currentBalance: acc.openingBalance || 0 };
                }
                let balChange = 0;
                prjJournals.forEach((j: JournalEntry) => {
                    if (acc.id === j.debitAccountId) {
                        balChange -= (acc.normalBalance === 'Debit' ? j.amount : -j.amount);
                    }
                    if (acc.id === j.creditAccountId) {
                        balChange -= (acc.normalBalance === 'Credit' ? j.amount : -j.amount);
                    }
                });
                const restoredBal = balChange !== 0 ? acc.currentBalance + balChange : acc.currentBalance;
                if (acc.classification === 'Asset' && restoredBal < 0 && (acc.openingBalance === 0 || acc.openingBalance === undefined)) {
                    return { ...acc, currentBalance: acc.openingBalance || 0 };
                }
                return balChange !== 0 ? { ...acc, currentBalance: restoredBal } : acc;
            });
            setChartOfAccounts(cleanedCOA);
            try {
                localStorage.setItem(`${STORAGE_KEY}_COA`, JSON.stringify(cleanedCOA));
            } catch {}
            // Remove project transactions and journal vouchers
            const nextTxs = (latestStateRef.current.transactions || transactions).filter((t: AccountingTransaction) => !(t.category?.toLowerCase().includes('project') || t.accountHead?.toLowerCase().includes('project')));
            setTransactions(nextTxs);
            try {
                localStorage.setItem(`${STORAGE_KEY}_TRANSACTIONS`, JSON.stringify(nextTxs));
            } catch {}
            const nextJournals = (latestStateRef.current.journalEntries || journalEntries).filter((j: JournalEntry) => !(j.source === 'PROJECT_EXPENSE' || j.source === 'PROJECT_SALES'));
            setJournalEntries(nextJournals);
            try {
                localStorage.setItem(`${STORAGE_KEY}_JOURNALS`, JSON.stringify(nextJournals));
            } catch {}
            latestStateRef.current = {
                ...latestStateRef.current,
                projects: [],
                chartOfAccounts: cleanedCOA,
                transactions: nextTxs,
                journalEntries: nextJournals,
            };
            addAuditLog({
                staffId: activeStaff.id,
                staffName: activeStaff.name,
                staffRole: activeStaff.role,
                location: 'All',
                actionType: 'DATA_CLEANED',
                entityType: 'Projects',
                details: 'Purged/cleaned all project sales, expense, and profitability records.',
                detailsBn: 'প্রজেক্ট ডেটা মুছে ফেলা হয়েছে।',
                severity: 'critical',
            });
        }
        else if (moduleKey === 'ALL') {
            resetToDefaultData();
        }
        else if (moduleKey === 'WIPE_ALL_EXCEPT_PRODUCTS' || moduleKey === 'RESET_ALL_TRANSACTIONS') {
            const zeroStockProducts = (latestStateRef.current.products || products).map((p: ProductItem) => ({ ...p, stockFactory: 0, stockOffice: 0 }));
            const zeroBalCOA = (latestStateRef.current.chartOfAccounts || chartOfAccounts).map((acc: ChartOfAccount) => ({ ...acc, openingBalance: 0, currentBalance: 0 }));
            const zeroDuesCustomers = (latestStateRef.current.customers || customers).map((c: Customer) => ({ ...c, totalPurchased: 0, dueAmount: 0, advanceBalance: 0 }));
            const zeroDuesSuppliers = (latestStateRef.current.suppliers || suppliers).map((s: Supplier) => ({ ...s, totalPurchased: 0, balancePayable: 0, dueAmount: 0 }));

            setInvoices([]);
            setQuotations([]);
            setPurchaseOrders([]);
            setTransactions([]);
            setStockMovements([]);
            setJournalEntries([]);
            setProjects([]);
            setCustomers(zeroDuesCustomers);
            setSuppliers(zeroDuesSuppliers);
            setProducts(zeroStockProducts);
            setChartOfAccounts(zeroBalCOA);

            try {
                localStorage.setItem(`${STORAGE_KEY}_INVOICES`, JSON.stringify([]));
                localStorage.setItem(`${STORAGE_KEY}_QUOTATIONS`, JSON.stringify([]));
                localStorage.setItem(`${STORAGE_KEY}_PURCHASE_ORDERS`, JSON.stringify([]));
                localStorage.setItem(`${STORAGE_KEY}_TRANSACTIONS`, JSON.stringify([]));
                localStorage.setItem(`${STORAGE_KEY}_STOCK_MOVEMENTS`, JSON.stringify([]));
                localStorage.setItem(`${STORAGE_KEY}_JOURNALS`, JSON.stringify([]));
                localStorage.setItem(`${STORAGE_KEY}_PROJECTS`, JSON.stringify([]));
                localStorage.setItem(`${STORAGE_KEY}_CUSTOMERS`, JSON.stringify(zeroDuesCustomers));
                localStorage.setItem(`${STORAGE_KEY}_SUPPLIERS`, JSON.stringify(zeroDuesSuppliers));
                localStorage.setItem(`${STORAGE_KEY}_PRODUCTS`, JSON.stringify(zeroStockProducts));
                localStorage.setItem(`${STORAGE_KEY}_COA`, JSON.stringify(zeroBalCOA));
            } catch {}

            addAuditLog({
                staffId: activeStaff?.id || 'admin',
                staffName: activeStaff?.name || 'Staff',
                staffRole: activeStaff?.role || 'Admin',
                location: 'All',
                actionType: 'DATA_CLEANED',
                entityType: 'System',
                details: 'Full transactional reset: Wiped all invoices, quotes, POs, accounting transactions, journal entries, projects, and stock movements. Reset customer dues and advances to 0, supplier dues to 0, product stock to 0, and account balances to 0.',
                detailsBn: 'সম্পূর্ণ ট্রানজ্যাকশনাল ডেটা রিসেট করা হয়েছে (বিক্রয়, ক্রয়, ক্যাশ লেনদেন, জার্নাল, প্রজেক্ট, স্টক, কাস্টমার বকেয়া ও অগ্রিম এবং ব্যালেন্স শূন্য)।',
                severity: 'critical',
            });

            latestStateRef.current = {
                ...latestStateRef.current,
                invoices: [],
                quotations: [],
                purchaseOrders: [],
                transactions: [],
                stockMovements: [],
                journalEntries: [],
                projects: [],
                customers: zeroDuesCustomers,
                suppliers: zeroDuesSuppliers,
                products: zeroStockProducts,
                chartOfAccounts: zeroBalCOA,
            };
        }

        // Instant cloud sync push
        isCloudLoadedRef.current = true;
        triggerImmediatePush();
        if (pushToCloudRef.current) {
            pushToCloudRef.current();
        }
    };
    const resetSalesData = () => {
        cleanModuleData('SALES');
    };
    const resetAllTransactionalData = () => {
        cleanModuleData('RESET_ALL_TRANSACTIONS');
    };
    // Utilities
    const resetToDefaultData = () => {
        setProfile(INITIAL_COMPANY_PROFILE);
        setProducts(INITIAL_PRODUCTS);
        setCustomers(INITIAL_CUSTOMERS);
        setSuppliers(INITIAL_SUPPLIERS);
        setInvoices(INITIAL_INVOICES);
        setQuotations(INITIAL_QUOTATIONS);
        setPurchaseOrders(INITIAL_PURCHASE_ORDERS);
        setTransactions(INITIAL_TRANSACTIONS);
        setStockMovements(INITIAL_STOCK_MOVEMENTS);
        setAuditLogs(INITIAL_AUDIT_LOGS);
        setStaffMembers(INITIAL_STAFF_MEMBERS);
        setActiveStaff(INITIAL_STAFF_MEMBERS[0]);
        setUserRoles(INITIAL_USER_ROLES);
        setChartOfAccounts(INITIAL_CHART_OF_ACCOUNTS);
        setExpenseHeads(INITIAL_EXPENSE_HEADS);
        setProductCategories(INITIAL_PRODUCT_CATEGORIES);
        setJournalEntries(INITIAL_JOURNAL_ENTRIES);
        setProjects(INITIAL_PROJECTS);
        setPaymentMethods(INITIAL_PAYMENT_METHODS);
        const operationalKeys = [
            `${STORAGE_KEY}_PRODUCTS`,
            `${STORAGE_KEY}_CUSTOMERS`,
            `${STORAGE_KEY}_SUPPLIERS`,
            `${STORAGE_KEY}_INVOICES`,
            `${STORAGE_KEY}_QUOTATIONS`,
            `${STORAGE_KEY}_PURCHASE_ORDERS`,
            `${STORAGE_KEY}_TRANSACTIONS`,
            `${STORAGE_KEY}_STOCK_MOVEMENTS`,
            `${STORAGE_KEY}_AUDIT_LOGS`,
            `${STORAGE_KEY}_JOURNALS`,
            `${STORAGE_KEY}_PROJECTS`,
        ];
        operationalKeys.forEach((k) => {
            try { localStorage.removeItem(k); } catch {}
        });
        try {
            localStorage.setItem(`${STORAGE_KEY}_STAFF`, JSON.stringify(INITIAL_STAFF_MEMBERS));
            localStorage.setItem(`${STORAGE_KEY}_ROLES`, JSON.stringify(INITIAL_USER_ROLES));
            localStorage.setItem(`${STORAGE_KEY}_COA`, JSON.stringify(INITIAL_CHART_OF_ACCOUNTS));
            localStorage.setItem(`${STORAGE_KEY}_EXPENSE_HEADS`, JSON.stringify(INITIAL_EXPENSE_HEADS));
            localStorage.setItem(`${STORAGE_KEY}_CATEGORIES`, JSON.stringify(INITIAL_PRODUCT_CATEGORIES));
            localStorage.setItem(`${STORAGE_KEY}_PAYMENT_METHODS`, JSON.stringify(INITIAL_PAYMENT_METHODS));
            localStorage.setItem(`${STORAGE_KEY}_PROFILE`, JSON.stringify(INITIAL_COMPANY_PROFILE));
            localStorage.setItem(`${STORAGE_KEY}_ACTIVE_STAFF`, JSON.stringify(INITIAL_STAFF_MEMBERS[0]));
            localStorage.setItem(`${STORAGE_KEY}_IS_AUTHENTICATED`, 'true');
        } catch {}
    };
    // Keep an always-up-to-date ref of state to avoid stale closure bugs during debounced/async cloud sync
    latestStateRef.current = {
        profile,
        products,
        customers,
        suppliers,
        invoices,
        quotations,
        purchaseOrders,
        transactions,
        stockMovements,
        auditLogs,
        staffMembers,
        userRoles,
        chartOfAccounts,
        expenseHeads,
        productCategories,
        journalEntries,
        projects,
        paymentMethods,
    };

    const exportDatabase = (): string => {
        const s = latestStateRef.current;
        const state = {
            profile: s.profile,
            products: s.products,
            customers: s.customers,
            suppliers: s.suppliers,
            invoices: s.invoices,
            quotations: s.quotations,
            purchaseOrders: s.purchaseOrders,
            transactions: s.transactions,
            stockMovements: s.stockMovements,
            auditLogs: s.auditLogs,
            staffMembers: s.staffMembers,
            userRoles: s.userRoles,
            chartOfAccounts: s.chartOfAccounts,
            expenseHeads: s.expenseHeads,
            productCategories: s.productCategories,
            journalEntries: s.journalEntries,
            projects: s.projects,
            paymentMethods: s.paymentMethods,
            exportedAt: new Date().toISOString(),
            version: '2.0',
        };
        return JSON.stringify(state, null, 2);
    };

    const importDatabase = (jsonString: string, _isCloudSync: boolean = false): boolean => {
        try {
            const data = JSON.parse(jsonString);
            if (data.profile) {
                if (data.profile.logoUrl &&
                    (data.profile.logoUrl.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALL') ||
                        data.profile.logoUrl.includes('ALLCAYAAACHp'))) {
                    data.profile.logoUrl = '/dotcolor-logo.svg';
                }
                if (data.profile.name === 'DotColorCommunication Sales, POS & ERP') {
                    data.profile.name = 'Dot Color';
                }
                if (data.profile.footerBrandText === 'DotColorCommunication Sales, POS & ERP') {
                    data.profile.footerBrandText = 'Dot Color';
                }
                setProfile(data.profile);
                try { localStorage.setItem(`${STORAGE_KEY}_PROFILE`, JSON.stringify(data.profile)); } catch {}
            }
            if (data.products && Array.isArray(data.products)) {
                setProducts(data.products);
                try { localStorage.setItem(`${STORAGE_KEY}_PRODUCTS`, JSON.stringify(data.products)); } catch {}
            }
            if (data.customers && Array.isArray(data.customers)) {
                setCustomers(data.customers);
                try { localStorage.setItem(`${STORAGE_KEY}_CUSTOMERS`, JSON.stringify(data.customers)); } catch {}
            }
            if (data.suppliers && Array.isArray(data.suppliers)) {
                const cleanedSuppliers = data.suppliers.map((s: any) => ({
                    ...s,
                    balancePayable: s.balancePayable ?? s.dueAmount ?? 0,
                    dueAmount: s.dueAmount ?? s.balancePayable ?? 0,
                }));
                setSuppliers(cleanedSuppliers);
                try { localStorage.setItem(`${STORAGE_KEY}_SUPPLIERS`, JSON.stringify(cleanedSuppliers)); } catch {}
            }
            if (data.invoices && Array.isArray(data.invoices)) {
                const cleanedInvoices = sanitizeSalesInvoices(data.invoices);
                setInvoices(cleanedInvoices);
                try { localStorage.setItem(`${STORAGE_KEY}_INVOICES`, JSON.stringify(cleanedInvoices)); } catch {}
                data.invoices = cleanedInvoices;
            }
            if (data.quotations && Array.isArray(data.quotations)) {
                setQuotations(data.quotations);
                try { localStorage.setItem(`${STORAGE_KEY}_QUOTATIONS`, JSON.stringify(data.quotations)); } catch {}
            }
            if (data.purchaseOrders && Array.isArray(data.purchaseOrders)) {
                setPurchaseOrders(data.purchaseOrders);
                try { localStorage.setItem(`${STORAGE_KEY}_PURCHASE_ORDERS`, JSON.stringify(data.purchaseOrders)); } catch {}
            }
            if (data.transactions && Array.isArray(data.transactions)) {
                const uniqueTx = ensureUniqueTransactions(data.transactions);
                setTransactions(uniqueTx);
                try { localStorage.setItem(`${STORAGE_KEY}_TRANSACTIONS`, JSON.stringify(uniqueTx)); } catch {}
            }
            if (data.stockMovements && Array.isArray(data.stockMovements)) {
                setStockMovements(data.stockMovements);
                try { localStorage.setItem(`${STORAGE_KEY}_STOCK_MOVEMENTS`, JSON.stringify(data.stockMovements)); } catch {}
            }
            if (data.auditLogs && Array.isArray(data.auditLogs)) {
                setAuditLogs(data.auditLogs);
                try { localStorage.setItem(`${STORAGE_KEY}_AUDIT_LOGS`, JSON.stringify(data.auditLogs)); } catch {}
            }
            if (data.staffMembers && Array.isArray(data.staffMembers) && data.staffMembers.length > 0) {
                setStaffMembers(data.staffMembers);
                try { localStorage.setItem(`${STORAGE_KEY}_STAFF`, JSON.stringify(data.staffMembers)); } catch {}
                setActiveStaff((prev) => {
                    if (prev?.id) {
                        const found = data.staffMembers.find((s: StaffMember) => s.id === prev.id);
                        if (found)
                            return found;
                    }
                    return data.staffMembers[0];
                });
            }
            if (data.userRoles && Array.isArray(data.userRoles) && data.userRoles.length > 0) {
                const sanitized = sanitizeUserRoles(data.userRoles);
                setUserRoles(sanitized);
                try { localStorage.setItem(`${STORAGE_KEY}_ROLES`, JSON.stringify(sanitized)); } catch {}
            }
            if (data.chartOfAccounts && Array.isArray(data.chartOfAccounts)) {
                setChartOfAccounts(data.chartOfAccounts);
                try { localStorage.setItem(`${STORAGE_KEY}_COA`, JSON.stringify(data.chartOfAccounts)); } catch {}
            }
            if (data.expenseHeads && Array.isArray(data.expenseHeads)) {
                setExpenseHeads(data.expenseHeads);
                try { localStorage.setItem(`${STORAGE_KEY}_EXPENSE_HEADS`, JSON.stringify(data.expenseHeads)); } catch {}
            }
            if (data.productCategories && Array.isArray(data.productCategories)) {
                setProductCategories(data.productCategories);
                try { localStorage.setItem(`${STORAGE_KEY}_CATEGORIES`, JSON.stringify(data.productCategories)); } catch {}
            }
            if (data.journalEntries && Array.isArray(data.journalEntries)) {
                setJournalEntries(data.journalEntries);
                try { localStorage.setItem(`${STORAGE_KEY}_JOURNALS`, JSON.stringify(data.journalEntries)); } catch {}
            }
            if (data.projects && Array.isArray(data.projects)) {
                const localProjs = safeGetLocalStorage<Project[]>(`${STORAGE_KEY}_PROJECTS`, []);
                const incomingProjs = data.projects as Project[];
                const mergedProjs = [...incomingProjs];
                localProjs.forEach(lp => {
                    if (!mergedProjs.some(mp => mp.id === lp.id || (mp.code && mp.code === lp.code))) {
                        mergedProjs.push(lp);
                    }
                });
                setProjects(mergedProjs);
                try { localStorage.setItem(`${STORAGE_KEY}_PROJECTS`, JSON.stringify(mergedProjs)); } catch {}
            }
            if (data.paymentMethods && Array.isArray(data.paymentMethods)) {
                setPaymentMethods(data.paymentMethods);
                try { localStorage.setItem(`${STORAGE_KEY}_PAYMENT_METHODS`, JSON.stringify(data.paymentMethods)); } catch {}
            }

            latestStateRef.current = {
                ...latestStateRef.current,
                ...data,
            };
            return true;
        }
        catch (e) {
            console.error('Import error', e);
            return false;
        }
    };

    // Cloud & MongoDB Synchronization State
    const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'offline' | 'error'>('idle');
    const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);
    const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

    const pullFromCloud = async () => {
        if (isSyncingRef.current) return;
        try {
            isSyncingRef.current = true;
            const res = await fetch(`/api/state?t=${Date.now()}`, { cache: 'no-store' });
            if (res.ok) {
                const stateData = await res.json();
                if (stateData.success && stateData.data) {
                    isImportingRef.current = true;
                    importDatabase(JSON.stringify(stateData.data), true);
                    setCloudSyncStatus('synced');
                    setIsCloudConnected(true);
                    if (stateData.updatedAt) {
                        const ts = new Date(stateData.updatedAt).getTime();
                        lastServerUpdatedAtRef.current = ts;
                        setLastSyncedAt(new Date(stateData.updatedAt).toLocaleTimeString());
                    } else {
                        setLastSyncedAt(new Date().toLocaleTimeString());
                    }
                }
            }
        } catch (e) {
            console.warn('Pull from cloud error', e);
        } finally {
            isSyncingRef.current = false;
            setTimeout(() => {
                isImportingRef.current = false;
            }, 300);
        }
    };

    const pushToCloud = async () => {
        if (!isCloudLoadedRef.current || isSyncingRef.current) return;
        try {
            isSyncingRef.current = true;
            setCloudSyncStatus('syncing');
            const payload = { ...latestStateRef.current };
            const res = await fetch('/api/state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: payload, senderTabId: tabIdRef.current }),
            });
            if (res.ok) {
                const data = await res.json();
                setCloudSyncStatus('synced');
                setIsCloudConnected(true);
                if (data.updatedAt) {
                    const ts = new Date(data.updatedAt).getTime();
                    lastServerUpdatedAtRef.current = ts;
                    setLastSyncedAt(new Date(data.updatedAt).toLocaleTimeString());
                } else {
                    setLastSyncedAt(new Date().toLocaleTimeString());
                }
            } else {
                setCloudSyncStatus('offline');
            }
        } catch {
            setCloudSyncStatus('offline');
        } finally {
            isSyncingRef.current = false;
        }
    };

    pushToCloudRef.current = pushToCloud;

    const syncWithCloud = async (options?: { forcePull?: boolean; forcePush?: boolean }) => {
        if (options?.forcePull) {
            await pullFromCloud();
            return;
        }
        if (options?.forcePush) {
            await pushToCloud();
            return;
        }
        // Smart manual sync: check remote metadata first
        try {
            setCloudSyncStatus('syncing');
            const metaRes = await fetch(`/api/state/meta?t=${Date.now()}`, { cache: 'no-store' });
            if (metaRes.ok) {
                const meta = await metaRes.json();
                if (meta.success && meta.updatedAt) {
                    const remoteTs = new Date(meta.updatedAt).getTime();
                    if (remoteTs > lastServerUpdatedAtRef.current) {
                        await pullFromCloud();
                        return;
                    }
                }
            }
            await pushToCloud();
        } catch {
            await pullFromCloud();
        }
    };

    // Initial connection check & pull latest database state
    useEffect(() => {
        let isCancelled = false;
        const checkCloudStatusAndLoad = async () => {
            try {
                const healthRes = await fetch('/api/health');
                if (healthRes.ok) {
                    const healthData = await healthRes.json();
                    if (!isCancelled && healthData.database === 'connected') {
                        setIsCloudConnected(true);
                        setCloudSyncStatus('synced');

                        try {
                            const stateRes = await fetch(`/api/state?t=${Date.now()}`, { cache: 'no-store' });
                            if (stateRes.ok && !isCancelled) {
                                const cloudState = await stateRes.json();
                                if (cloudState.success && cloudState.data) {
                                    const remoteTs = cloudState.updatedAt ? new Date(cloudState.updatedAt).getTime() : 0;
                                    isImportingRef.current = true;
                                    importDatabase(JSON.stringify(cloudState.data), true);
                                    setTimeout(() => { isImportingRef.current = false; }, 300);
                                    lastServerUpdatedAtRef.current = remoteTs || Date.now();
                                    if (cloudState.updatedAt) {
                                        setLastSyncedAt(new Date(cloudState.updatedAt).toLocaleTimeString());
                                    }
                                } else if (!cloudState.data) {
                                    // If database is completely empty on server, push our initial local state to populate database
                                    await pushToCloud();
                                }
                            }
                        } catch (e) {
                            console.warn('Initial cloud state fetch failed', e);
                        }
                    }
                }
            } catch {
                if (!isCancelled) {
                    setIsCloudConnected(false);
                    setCloudSyncStatus('offline');
                }
            } finally {
                isCloudLoadedRef.current = true;
                setTimeout(() => { isImportingRef.current = false; }, 300);
            }
        };
        checkCloudStatusAndLoad();
        return () => {
            isCancelled = true;
        };
    }, []);

    // Real-Time Multi-Device SSE Listener
    useEffect(() => {
        if (typeof window === 'undefined') return;
        let eventSource: EventSource | null = null;
        let reconnectTimeout: any = null;

        const connectSSE = () => {
            try {
                eventSource = new EventSource('/api/state/events');
                eventSource.onmessage = async (e) => {
                    try {
                        const parsed = JSON.parse(e.data);
                        if (parsed.type === 'STATE_UPDATED' && parsed.updatedAt) {
                            if (parsed.senderTabId && parsed.senderTabId === tabIdRef.current) {
                                return;
                            }
                            const remoteTs = new Date(parsed.updatedAt).getTime();
                            if (remoteTs > lastServerUpdatedAtRef.current + 500) {
                                await pullFromCloud();
                            }
                        }
                    } catch {}
                };
                eventSource.onerror = () => {
                    eventSource?.close();
                    reconnectTimeout = setTimeout(connectSSE, 5000);
                };
            } catch {}
        };

        connectSSE();

        return () => {
            if (eventSource) eventSource.close();
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
        };
    }, []);

    // Automatic Real-Time Cloud Auto-Save whenever user inputs or modifies data
    useEffect(() => {
        if (isFirstMountRef.current) {
            isFirstMountRef.current = false;
            return;
        }
        if (isImportingRef.current) return;

        broadcastCrossTabSync();

        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
            if (pushToCloudRef.current) {
                pushToCloudRef.current();
            }
        }, 400);
    }, [
        profile,
        products,
        customers,
        suppliers,
        invoices,
        quotations,
        purchaseOrders,
        transactions,
        stockMovements,
        staffMembers,
        userRoles,
        chartOfAccounts,
        expenseHeads,
        productCategories,
        journalEntries,
        projects,
        paymentMethods,
    ]);
    const accountBalances: AccountBalances = useMemo(() => {
        // Smart classifier for accounts in Chart of Accounts
        const isMobile = (name: string, code?: string) => {
            const n = (name || '').toLowerCase();
            return n.includes('bkash') || n.includes('nagad') || n.includes('rocket') || n.includes('wallet') || n.includes('mobile') || n.includes('mfs') || n.includes('বিকাশ') || n.includes('নগদ') || code === '1030' || code === '1040';
        };
        const isBank = (name: string, code?: string) => {
            const n = (name || '').toLowerCase();
            if (isMobile(name, code)) return false;
            return n.includes('bank') || n.includes('plc') || n.includes('branch') || n.includes('ব্যাংক') || n.includes('city') || n.includes('brac') || n.includes('eastern') || n.includes('islami') || n.includes('dutch') || n.includes('dbbl') || code === '1020';
        };
        const isCash = (name: string, code?: string) => {
            if (isMobile(name, code) || isBank(name, code)) return false;
            const n = (name || '').toLowerCase();
            return n.includes('cash') || n.includes('ক্যাশ') || n.includes('counter') || n.includes('drawer') || code === '1010';
        };

        const assetAccounts = (chartOfAccounts || []).filter(acc => acc.classification === 'Asset');
        
        let cash = 0;
        let bank = 0;
        let mobile = 0;

        assetAccounts.forEach(acc => {
            const balance = (acc.openingBalance !== undefined && acc.openingBalance !== null)
                ? (Number(acc.openingBalance) || 0)
                : Math.max(0, Number(acc.currentBalance) || 0);

            if (isMobile(acc.name, acc.code)) {
                mobile += balance;
            } else if (isBank(acc.name, acc.code)) {
                bank += balance;
            } else if (isCash(acc.name, acc.code)) {
                cash += balance;
            }
        });

        // Fallback for bank if not identified
        if (bank === 0) {
            const bankAcc = assetAccounts.find(a => a.code === '1020' || isBank(a.name, a.code));
            if (bankAcc) {
                bank = bankAcc.openingBalance ?? bankAcc.currentBalance ?? 0;
            }
        }

        // Apply ledger transactions
        transactions.forEach((tx) => {
            const acct = (tx.paymentAccount || tx.account || tx.accountHead || tx.paymentMethod || '').toLowerCase();
            if (isAdvanceAdjustmentTransaction(tx) || acct.includes('advance') || acct.includes('অগ্রিম')) {
                return; // Internal advance adjustment does not change cash/bank/mobile liquid balances
            }
            const delta = tx.type === 'INCOME' ? tx.amount : tx.type === 'EXPENSE' ? -tx.amount : 0;
            
            if (acct.includes('bkash') || acct.includes('nagad') || acct.includes('rocket') || acct.includes('wallet') || acct.includes('mobile') || acct.includes('বিকাশ') || acct.includes('নগদ')) {
                mobile += delta;
            } else if (acct.includes('bank') || acct.includes('brac') || acct.includes('city') || acct.includes('southeast') || acct.includes('card') || acct.includes('cheque') || acct.includes('plc') || (profile.bankName && acct.includes(profile.bankName.toLowerCase()))) {
                bank += delta;
            } else {
                cash += delta;
            }
        });

        // Reconcile sales invoice cash/bank payments that might not be recorded as ledger transactions
        const recordedInvoiceRefs = new Set(
            transactions
                .filter(t => t.type === 'INCOME' && t.refNo)
                .map(t => (t.refNo || '').toLowerCase().trim())
        );

        (invoices || []).forEach(inv => {
            const invRef = (inv.invoiceNo || '').toLowerCase().trim();
            if (invRef && recordedInvoiceRefs.has(invRef)) {
                return; // Already accounted for via ledger transaction
            }
            const pmLower = (inv.paymentMethod || '').toLowerCase();
            const isBankPm = pmLower.includes('bank') || pmLower.includes('card');
            const isMobilePm = pmLower.includes('bkash') || pmLower.includes('nagad') || pmLower.includes('wallet');

            if (inv.splitPayments) {
                if ((inv.splitPayments.cash || 0) > 0) cash += Number(inv.splitPayments.cash) || 0;
                if ((inv.splitPayments.card || 0) > 0) bank += Number(inv.splitPayments.card) || 0;
                if ((inv.splitPayments.bkash || 0) > 0) mobile += Number(inv.splitPayments.bkash) || 0;
                if ((inv.splitPayments.nagad || 0) > 0) mobile += Number(inv.splitPayments.nagad) || 0;
            } else if ((inv.paidAmount || 0) > 0) {
                if (isBankPm) bank += Number(inv.paidAmount) || 0;
                else if (isMobilePm) mobile += Number(inv.paidAmount) || 0;
                else cash += Number(inv.paidAmount) || 0;
            }
        });

        const mfsData = getMfsAccountsBreakdown(chartOfAccounts, transactions, invoices, projects);
        const bankData = getBankAccountsBreakdown(chartOfAccounts, transactions, invoices, projects);
        const cashData = getCashAccountsBreakdown(chartOfAccounts, transactions, invoices, projects);
        const dynamicBankTotal = bankData.reduce((acc, b) => acc + b.balance, 0);

        return {
            cash: Math.max(0, cashData.accounts.length > 0 ? cashData.total : cash),
            bank: Math.max(0, bankData.length > 0 ? dynamicBankTotal : bank),
            mobile: Math.max(0, mfsData.accounts.length > 0 ? mfsData.total : mobile),
            factoryCash: 0,
            bkash: mfsData.bkash,
            nagad: mfsData.nagad,
            bankBreakdown: bankData,
        };
    }, [transactions, chartOfAccounts, profile.bankName, invoices, projects]);
    return (<AppContext.Provider value={{
            profile,
            products,
            customers,
            suppliers,
            invoices,
            quotations,
            purchaseOrders,
            transactions,
            stockMovements,
            accountBalances,
            language,
            activeLocation,
            setLanguage,
            setActiveLocation,
            updateProfile,
            paymentMethods,
            addPaymentMethod,
            updatePaymentMethod,
            deletePaymentMethod,
            togglePaymentMethod,
            setDefaultPaymentMethod,
            auditLogs,
            staffMembers,
            activeStaff,
            setActiveStaff,
            isAuthenticated,
            login,
            logout,
            addAuditLog,
            addStaffMember,
            updateStaffMember,
            deleteStaffMember,
            userRoles,
            systemPermissions: ALL_SYSTEM_PERMISSIONS,
            addUserRole,
            updateUserRole,
            deleteUserRole,
            checkPermission,
            addInvoice,
            updateInvoice,
            deleteInvoice,
            collectInvoicePayment,
            adjustCustomerAdvance,
            updateProductionStatus,
            addQuotation,
            updateQuotation,
            updateQuotationStatus,
            deleteQuotation,
            convertQuotationToInvoice,
            productCategories,
            addProductCategory,
            updateProductCategory,
            deleteProductCategory,
            addProduct,
            bulkImportProducts,
            updateProduct,
            deleteProduct,
            adjustStock,
            addPurchaseOrder,
            updatePurchaseOrder,
            deletePurchaseOrder,
            receivePurchaseOrder,
            payPurchaseOrder,
            paySupplierDue,
            paySupplier: paySupplierDue,
            addCustomer,
            updateCustomer,
            deleteCustomer,
            addSupplier,
            updateSupplier,
            deleteSupplier,
            chartOfAccounts,
            addChartOfAccount,
            updateChartOfAccount,
            deleteChartOfAccount,
            expenseHeads,
            addExpenseHead,
            updateExpenseHead,
            deleteExpenseHead,
            journalEntries,
            addJournalEntry,
            updateJournalEntry,
            generateJournalsFromTransactions,
            restoreDefaultExpenseHeads,
            addTransaction,
            updateTransaction,
            deleteTransaction,
            projects,
            addProject,
            updateProject,
            deleteProject,
            addProjectSales,
            collectProjectDue,
            addProjectExpense,
            addProjectExpenses,
            deleteProjectSales,
            deleteProjectExpense,
            syncProjectsWithAccounting,
            createProjectFromInvoice,
            linkInvoiceToProject,
            unlinkInvoiceFromProject,
            generateInvoiceForProject,
            syncProjectInvoice,
            cleanModuleData,
            resetSalesData,
            resetAllTransactionalData,
            resetToDefaultData,
            exportDatabase,
            importDatabase,
            cloudSyncStatus,
            isCloudConnected,
            lastSyncedAt,
            syncWithCloud,
        }}>
      {children}
    </AppContext.Provider>);
};
export const useApp = () => {
    const context = useContext(AppContext);
    if (!context)
        throw new Error('useApp must be used within an AppProvider');
    return context;
};
