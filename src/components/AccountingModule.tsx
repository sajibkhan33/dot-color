import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { AccountType, TransactionType } from '../types';
import { Wallet, Building, Smartphone, TrendingUp, TrendingDown, Plus, ArrowUpRight, ArrowDownLeft, Search, Filter, DollarSign, Calendar, Layers, FileSpreadsheet, Printer, SlidersHorizontal, RefreshCw, BookOpen, Trash2, Edit2, Eye, AlertCircle, Briefcase, FolderKanban, Receipt, CheckCircle2, CreditCard } from 'lucide-react';
import { exportAccountingToExcel } from '../utils/exportUtils';
import { ReportPrintModal } from './ReportPrintModal';
import { ChartOfAccountsManager } from './ChartOfAccountsManager';
import { ExpenseHeadManager } from './ExpenseHeadManager';
import { JournalEntriesManager } from './JournalEntriesManager';
import { getBankAccountsBreakdown, getMfsAccountsBreakdown, getPaymentMethodLiveBalance, calculateSingleAccountBalance, isAdvanceAdjustmentTransaction, isDueReceivableTransaction, resolveExpenseAccount, matchChannelToAccount, isSupplierPaymentTransaction } from '../utils/accountUtils';
export const AccountingModule: React.FC = () => {
    const { accountBalances: rawBalances, transactions, chartOfAccounts, expenseHeads, journalEntries, profile, language, invoices = [], paymentMethods = [], customers = [], updateCustomer, addTransaction, updateTransaction, deleteTransaction, projects = [], addProjectExpense, addProject, addProjectSales, collectProjectDue, generateInvoiceForProject, checkPermission, activeStaff, addJournalEntry } = useApp();

    const isSuperAdmin = (activeStaff?.role || '').toLowerCase() === 'super admin' ||
        (activeStaff?.role || '').toLowerCase() === 'superadmin' ||
        activeStaff?.customRoleId === 'role-superadmin' ||
        (activeStaff?.name || '').toLowerCase().includes('super admin');
    const canAddIncome = isSuperAdmin || Boolean(checkPermission && checkPermission('accounting.add_income'));
    const canAddExpense = isSuperAdmin || Boolean(checkPermission && checkPermission('accounting.add_expense'));
    const canEditTransaction = isSuperAdmin || Boolean(checkPermission && checkPermission('accounting.edit_transaction'));
    const canDeleteTransaction = isSuperAdmin || Boolean(checkPermission && checkPermission('accounting.delete_transaction'));
    const canManageCOA = isSuperAdmin || Boolean(checkPermission && checkPermission('accounting.chart_of_accounts'));
    const canManageExpenseHeads = isSuperAdmin || Boolean(checkPermission && checkPermission('accounting.manage_expense_heads'));
    const canExportReports = isSuperAdmin || Boolean(checkPermission && checkPermission('accounting.export_reports'));

    const accountBalances = {
        cash: rawBalances?.cash ?? 0,
        bank: rawBalances?.bank ?? 0,
        mobile: rawBalances?.mobile ?? 0,
        bkash: rawBalances?.bkash ?? 0,
        nagad: rawBalances?.nagad ?? 0,
    };

    const mfsInfo = useMemo(() => {
        return getMfsAccountsBreakdown(chartOfAccounts, transactions, invoices, projects, journalEntries);
    }, [chartOfAccounts, transactions, invoices, projects, journalEntries]);

    const bankInfo = useMemo(() => {
        return getBankAccountsBreakdown(chartOfAccounts, transactions, invoices, projects, journalEntries);
    }, [chartOfAccounts, transactions, invoices, projects, journalEntries]);

    const bankBreakdownText = bankInfo.length > 0
        ? bankInfo.map(b => `${b.name.replace(/ PLC| Bank/gi, '')}: ${profile.currencySymbol}${b.balance.toLocaleString()}`).join(' • ')
        : `${profile.bankName || 'City Bank PLC'} • ${(profile.bankAccount ? profile.bankAccount.slice(-6) : '314001')}`;

    const mfsBreakdownText = `bKash: ${profile.currencySymbol}${(rawBalances?.bkash ?? mfsInfo.bkash).toLocaleString()} • Nagad: ${profile.currencySymbol}${(rawBalances?.nagad ?? mfsInfo.nagad).toLocaleString()}`;

    const activePaymentMethods = useMemo(() => {
        const list = (paymentMethods || []).filter((p) => p.isEnabled);
        return list.length > 0 ? list : [{ id: 'pm-cash', name: 'Cash', nameBn: 'নগদ ক্যাশ', type: 'cash' as const, isEnabled: true }];
    }, [paymentMethods]);

    // Unified dynamic payment channels strictly matching Payment Gateways & Methods
    const availablePaymentAccounts = useMemo(() => {
        const list: Array<{ id: string; name: string; nameBn?: string; balance: number }> = [];
        const seen = new Set<string>();

        // Track all payment methods configured in Settings -> Payment Gateways & Methods (both active and inactive)
        const configuredPmIds = new Set<string>();
        const configuredPmNames = new Set<string>();
        const configuredPmCodes = new Set<string>();
        const hasConfiguredCash = (paymentMethods || []).some(
            (p) => p.type === 'cash' || p.name.toLowerCase().trim() === 'cash'
        );

        (paymentMethods || []).forEach((pm) => {
            if (pm.id) configuredPmIds.add(pm.id.toLowerCase().trim());
            if (pm.name) configuredPmNames.add(pm.name.toLowerCase().trim());
            if (pm.linkedAccountId) configuredPmCodes.add(pm.linkedAccountId.toLowerCase().trim());
        });

        // 1. From active Payment Methods (Settings -> Payment Gateways & Methods) - Authoritative
        (activePaymentMethods || []).forEach((pm) => {
            const key = pm.name.trim().toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                if (pm.type === 'cash' || key === 'cash') {
                    seen.add('cash');
                    seen.add('cash in hand');
                    seen.add('নগদ ক্যাশ');
                    seen.add('ফ্যাক্টরি ক্যাশ');
                    seen.add('factory cash in hand');
                }
                const bal = getPaymentMethodLiveBalance(pm, chartOfAccounts, transactions, invoices, accountBalances, projects, journalEntries);
                list.push({
                    id: pm.id,
                    name: pm.name,
                    nameBn: pm.nameBn,
                    balance: bal,
                });
            }
        });

        // Helper to check if a COA account matches any configured payment method (active or inactive)
        const matchesAnyConfiguredPm = (acc: any) => {
            const accName = (acc.name || '').toLowerCase().trim();
            const accCode = (acc.code || '').toLowerCase().trim();
            const accId = (acc.id || '').toLowerCase().trim();

            if (configuredPmIds.has(accId) || configuredPmCodes.has(accCode) || configuredPmCodes.has(accId)) {
                return true;
            }
            if (configuredPmNames.has(accName)) {
                return true;
            }

            // Cash aliases: If cash is configured in Settings, any COA cash account maps to it
            if (hasConfiguredCash) {
                if (
                    accName === 'cash' ||
                    accName === 'cash in hand' ||
                    accName.includes('cash in hand') ||
                    accName.includes('office cash') ||
                    accName.includes('factory cash') ||
                    accName.includes('cash counter') ||
                    acc.code === '1001' ||
                    acc.code === '1010' ||
                    acc.code === '1020' ||
                    (acc.nameBn && acc.nameBn.includes('ক্যাশ'))
                ) {
                    return true;
                }
            }

            // Check against each configured PM
            for (const pm of (paymentMethods || [])) {
                const pmName = pm.name.toLowerCase().trim();
                if (pm.type === 'mfs') {
                    if (pmName.includes('nagad') && (accName.includes('nagad') || accCode === '1005' || acc.nameBn?.includes('নগদ'))) return true;
                    if (pmName.includes('bkash') && (accName.includes('bkash') || accCode === '1004' || acc.nameBn?.includes('বিকাশ'))) return true;
                    if (pmName.includes('rocket') && (accName.includes('rocket') || accCode === '1006')) return true;
                }
                if (pm.type === 'bank') {
                    if (pmName.includes('city') && accName.includes('city')) return true;
                    if (pmName.includes('southeast') && accName.includes('southeast')) return true;
                    if (pmName.includes('brac') && accName.includes('brac')) return true;
                }
            }

            return false;
        };

        // 2. Only include non-configured additional Asset accounts from Chart of Accounts
        (chartOfAccounts || [])
            .filter((acc) => {
                if (acc.classification !== 'Asset' || !acc.isActive) return false;
                // If it matches any configured payment method (whether active or inactive), SKIP IT!
                if (matchesAnyConfiguredPm(acc)) return false;

                const n = acc.name.toLowerCase();
                return (
                    n.includes('cash') || n.includes('bank') || n.includes('plc') ||
                    n.includes('wallet') || n.includes('mfs')
                );
            })
            .forEach((acc) => {
                const key = acc.name.trim().toLowerCase();
                if (!seen.has(key)) {
                    seen.add(key);
                    const bal = calculateSingleAccountBalance(acc, transactions, invoices, projects);
                    list.push({
                        id: acc.id,
                        name: acc.name,
                        nameBn: acc.nameBn,
                        balance: bal,
                    });
                }
            });

        if (list.length === 0) {
            list.push({ id: 'pm-cash', name: 'Cash', balance: accountBalances.cash });
        }
        return list;
    }, [activePaymentMethods, paymentMethods, chartOfAccounts, transactions, invoices, accountBalances, projects]);

    const [accountingTab, setAccountingTab] = useState<'ledger' | 'coa' | 'expense-heads' | 'journals'>('ledger');
    const [filterType, setFilterType] = useState<string>('ALL');
    const [filterAccount, setFilterAccount] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    // Date Range Filters
    const [filterDatePreset, setFilterDatePreset] = useState<'ALL' | 'TODAY' | '7D' | 'THIS_MONTH' | 'LAST_30' | 'CUSTOM'>('ALL');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [showCustomDate, setShowCustomDate] = useState<boolean>(false);
    const [showReportModal, setShowReportModal] = useState<boolean>(false);
    // New Transaction / Expense Modal
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [expenseTitle, setExpenseTitle] = useState('');
    const [expenseCategory, setExpenseCategory] = useState('Rent & Utilities');
    const [expenseAmount, setExpenseAmount] = useState<number>(1000);
    const [expenseAccount, setExpenseAccount] = useState<string>('');
    const [expenseNote, setExpenseNote] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');

    const isProjectExpense = useMemo(() => {
        const cat = (expenseCategory || '').toLowerCase();
        return cat.includes('project') || cat.includes('প্রজেক্ট');
    }, [expenseCategory]);

    useEffect(() => {
        if (!isProjectExpense) {
            if (selectedProjectId) {
                setSelectedProjectId('');
            }
        } else {
            if (!selectedProjectId && projects.length === 1) {
                setSelectedProjectId(projects[0].id);
            }
        }
    }, [isProjectExpense, projects, selectedProjectId]);

    // Dynamically unified expense categories from active Expense Heads AND Chart of Accounts
    const availableExpenseOptions = useMemo(() => {
        const list: { id: string; name: string; nameBn?: string; group: string }[] = [];
        const seen = new Set<string>();
        const linkedCoaIds = new Set<string>();

        const isProj = (name?: string, nameBn?: string, code?: string) => {
            const n = (name || '').toLowerCase();
            const bn = (nameBn || '').toLowerCase();
            const c = (code || '').toUpperCase();
            return (
                n.includes('project') ||
                bn.includes('প্রজেক্ট') ||
                c === '5206' ||
                c === 'EH-PRJ' ||
                c === 'EH-PROJ'
            );
        };

        // 1. From active Expense Heads
        (expenseHeads || [])
            .filter((h) => h.isActive)
            .forEach((h) => {
                if (h.linkedAccountId) {
                    linkedCoaIds.add(h.linkedAccountId.toLowerCase().trim());
                }

                if (isProj(h.name, h.nameBn, h.code)) {
                    if (!seen.has('__project_expense__')) {
                        seen.add('__project_expense__');
                        seen.add(h.name.trim().toLowerCase());
                        seen.add('project expense');
                        list.push({
                            id: `eh-${h.id}`,
                            name: 'Project Expense',
                            nameBn: 'প্রজেক্ট খরচ',
                            group: 'Project Expenses',
                        });
                    }
                    return;
                }

                const key = h.name.trim().toLowerCase();
                if (!seen.has(key)) {
                    seen.add(key);
                    list.push({
                        id: `eh-${h.id}`,
                        name: h.name,
                        nameBn: h.nameBn,
                        group: h.category ? `Expense Head (${h.category})` : 'Expense Heads',
                    });
                }
            });

        // 2. From active Chart of Accounts (Expense classification)
        (chartOfAccounts || [])
            .filter((a) => a.classification === 'Expense' && a.isActive)
            .forEach((a) => {
                // If already represented by a linked Expense Head, do not duplicate
                if (linkedCoaIds.has(a.id.toLowerCase().trim()) || (a.code && linkedCoaIds.has(a.code.toLowerCase().trim()))) {
                    return;
                }

                if (isProj(a.name, a.nameBn, a.code)) {
                    if (!seen.has('__project_expense__')) {
                        seen.add('__project_expense__');
                        seen.add(a.name.trim().toLowerCase());
                        seen.add('project expense');
                        list.push({
                            id: `coa-${a.id}`,
                            name: 'Project Expense',
                            nameBn: 'প্রজেক্ট খরচ',
                            group: 'Project Expenses',
                        });
                    }
                    return;
                }

                const key = a.name.trim().toLowerCase();
                if (!seen.has(key)) {
                    seen.add(key);
                    list.push({
                        id: `coa-${a.id}`,
                        name: a.name,
                        nameBn: a.nameBn,
                        group: a.accountGroup || 'Chart of Accounts',
                    });
                }
            });

        return list;
    }, [expenseHeads, chartOfAccounts]);

    useEffect(() => {
        if (availableExpenseOptions.length > 0) {
            const exists = availableExpenseOptions.some((o) => o.name === expenseCategory);
            if (!exists) {
                setExpenseCategory(availableExpenseOptions[0].name);
            }
        }
    }, [availableExpenseOptions, expenseCategory]);

    // Dynamically unified income categories from active Revenue & Advance accounts in Chart of Accounts
    const availableIncomeOptions = useMemo(() => {
        const list: { id: string; name: string; nameBn?: string; group: string }[] = [];
        const seen = new Set<string>();

        // 1. ALL active Revenue heads directly from Chart of Accounts (dynamically reflects user additions/deletions)
        (chartOfAccounts || [])
            .filter((a) => a.classification === 'Revenue' && a.isActive)
            .forEach((a) => {
                const key = a.name.toLowerCase().trim();
                if (!seen.has(key)) {
                    seen.add(key);
                    list.push({
                        id: a.id,
                        name: a.name,
                        nameBn: a.nameBn,
                        group: a.accountGroup || 'Operating Revenue',
                    });
                }
            });

        // 2. Active Customer Advance liability heads from Chart of Accounts
        (chartOfAccounts || [])
            .filter((a) => a.classification === 'Liability' && a.isActive && (a.code === '2020' || a.id === 'coa-2020' || a.name.toLowerCase().includes('advance') || a.nameBn?.includes('অগ্রিম')))
            .forEach((a) => {
                const key = a.name.toLowerCase().trim();
                if (!seen.has(key)) {
                    seen.add(key);
                    list.push({
                        id: a.id,
                        name: a.name,
                        nameBn: a.nameBn,
                        group: 'Customer Advance',
                    });
                }
            });

        // Fallback only if Chart of Accounts is completely empty
        if (list.length === 0) {
            list.push({ id: 'fallback-sales', name: 'Sales Revenue', nameBn: 'বিক্রয় আয়', group: 'Operating Revenue' });
        }

        return list;
    }, [chartOfAccounts]);

    // New Income/Receipt Modal
    const [showIncomeModal, setShowIncomeModal] = useState(false);
    const [incomeTitle, setIncomeTitle] = useState('');
    const [incomeCategory, setIncomeCategory] = useState('Sales Revenue');
    const [incomeAmount, setIncomeAmount] = useState<number>(5000);
    const [incomeAccount, setIncomeAccount] = useState<string>('');
    const [incomeCustomerId, setIncomeCustomerId] = useState<string>('');

    // Project Sales & Due Collection in Income Modal
    const [projectIncomeMode, setProjectIncomeMode] = useState<'existing' | 'new' | 'direct'>('existing');
    const [selectedIncomeProjectId, setSelectedIncomeProjectId] = useState<string>('');
    const [projectIncomeAction, setProjectIncomeAction] = useState<'collect_due' | 'new_sales'>('collect_due');
    const [newProjName, setNewProjName] = useState<string>('');
    const [newProjClientName, setNewProjClientName] = useState<string>('');
    const [newProjClientPhone, setNewProjClientPhone] = useState<string>('');
    const [newProjBudget, setNewProjBudget] = useState<number>(5000);

    const isProjectIncome = useMemo(() => {
        const cat = (incomeCategory || '').toLowerCase();
        return cat.includes('project') || cat.includes('প্রজেক্ট');
    }, [incomeCategory]);

    useEffect(() => {
        if (isProjectIncome) {
            if (projects.length === 0) {
                setProjectIncomeMode('new');
            } else if (!selectedIncomeProjectId) {
                const projWithDue = projects.find((p) => {
                    const due = (p.salesItems || []).reduce((sum, s) => {
                        const d = s.dueAmount !== undefined ? Number(s.dueAmount) : Math.max(0, Number(s.amount) - (Number(s.paidAmount) || 0));
                        return sum + d;
                    }, 0);
                    return due > 0;
                });
                setSelectedIncomeProjectId(projWithDue ? projWithDue.id : projects[0].id);
            }
        }
    }, [isProjectIncome, projects, selectedIncomeProjectId]);

    useEffect(() => {
        if (showIncomeModal && !incomeAccount && availablePaymentAccounts.length > 0) {
            setIncomeAccount(availablePaymentAccounts[0].name);
        }
    }, [showIncomeModal, incomeAccount, availablePaymentAccounts]);

    const selectedIncomeProject = useMemo(() => {
        return projects.find((p) => p.id === selectedIncomeProjectId);
    }, [projects, selectedIncomeProjectId]);

    const selectedProjectDue = useMemo(() => {
        if (!selectedIncomeProject) return 0;
        return (selectedIncomeProject.salesItems || []).reduce((sum, s) => {
            if (s.dueAmount !== undefined) return sum + (Number(s.dueAmount) || 0);
            const breakdowns = s.paymentBreakdown || [];
            const dueRow = breakdowns.find((b) => {
                const m = (b.method || '').toLowerCase();
                return m.includes('due') || m.includes('receivable');
            });
            const dueInitial = dueRow ? Number(dueRow.amount) || 0 : 0;
            const pastCollections = (s.collections || []).reduce((csum, c) => csum + (Number(c.amount) || 0), 0);
            return sum + Math.max(0, dueInitial - pastCollections);
        }, 0);
    }, [selectedIncomeProject]);

    // Smartly set action and auto-suggest description & amount when project is selected
    useEffect(() => {
        if (isProjectIncome && projectIncomeMode === 'existing' && selectedIncomeProject) {
            if (selectedProjectDue > 0) {
                setProjectIncomeAction('collect_due');
                if (!incomeTitle || incomeTitle.startsWith('Project Due Collection:') || incomeTitle.startsWith('Project Sales:') || incomeTitle.startsWith('Received Advance Cash')) {
                    setIncomeTitle(`Project Due Collection: [${selectedIncomeProject.code}] ${selectedIncomeProject.name} (${selectedIncomeProject.clientName})`);
                }
            } else {
                setProjectIncomeAction('new_sales');
                if (!incomeTitle || incomeTitle.startsWith('Project Due Collection:') || incomeTitle.startsWith('Project Sales:') || incomeTitle.startsWith('Received Advance Cash')) {
                    setIncomeTitle(`Project Sales: [${selectedIncomeProject.code}] ${selectedIncomeProject.name} - Billing`);
                }
            }
        }
    }, [isProjectIncome, projectIncomeMode, selectedIncomeProjectId, selectedProjectDue]);

    useEffect(() => {
        if (isProjectIncome && projectIncomeMode === 'new' && newProjName) {
            if (!incomeTitle || incomeTitle.startsWith('Project Due Collection:') || incomeTitle.startsWith('Project Sales:') || incomeTitle.startsWith('Received Advance Cash')) {
                setIncomeTitle(`Project Sales: ${newProjName}${newProjClientName ? ` (${newProjClientName})` : ''}`);
            }
        }
    }, [isProjectIncome, projectIncomeMode, newProjName, newProjClientName]);

    useEffect(() => {
        if (availableIncomeOptions.length > 0) {
            const exists = availableIncomeOptions.some((o) => o.name === incomeCategory);
            if (!exists) {
                setIncomeCategory(availableIncomeOptions[0].name);
            }
        }
    }, [availableIncomeOptions, incomeCategory]);

    useEffect(() => {
        if (availablePaymentAccounts.length > 0) {
            if (!expenseAccount || !availablePaymentAccounts.some((a) => a.name === expenseAccount)) {
                setExpenseAccount(availablePaymentAccounts[0].name);
            }
            if (!incomeAccount || !availablePaymentAccounts.some((a) => a.name === incomeAccount)) {
                setIncomeAccount(availablePaymentAccounts[0].name);
            }
        }
    }, [availablePaymentAccounts, expenseAccount, incomeAccount]);
    // Edit/View/Delete states for Ledger Transactions
    const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
    const [viewingTransaction, setViewingTransaction] = useState<any | null>(null);
    const [txToDelete, setTxToDelete] = useState<any | null>(null);
    // Edit form states
    const [editTxDate, setEditTxDate] = useState('');
    const [editTxDescription, setEditTxDescription] = useState(''); // narration
    const [editTxCategory, setEditTxCategory] = useState('');
    const [editTxAmount, setEditTxAmount] = useState<number>(0);
    const [editTxAccount, setEditTxAccount] = useState<string>('Cash');
    const [editTxType, setEditTxType] = useState<TransactionType>('EXPENSE');
    const [editTxRefNo, setEditTxRefNo] = useState('');
    const handleDatePreset = (preset: 'ALL' | 'TODAY' | '7D' | 'THIS_MONTH' | 'LAST_30' | 'CUSTOM') => {
        setFilterDatePreset(preset);
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        if (preset === 'ALL') {
            setStartDate('');
            setEndDate('');
            setShowCustomDate(false);
        }
        else if (preset === 'TODAY') {
            setStartDate(today);
            setEndDate(today);
            setShowCustomDate(false);
        }
        else if (preset === '7D') {
            const d = new Date();
            d.setDate(d.getDate() - 6);
            setStartDate(d.toISOString().slice(0, 10));
            setEndDate(today);
            setShowCustomDate(false);
        }
        else if (preset === 'THIS_MONTH') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
            setStartDate(firstDay);
            setEndDate(today);
            setShowCustomDate(false);
        }
        else if (preset === 'LAST_30') {
            const d = new Date();
            d.setDate(d.getDate() - 29);
            setStartDate(d.toISOString().slice(0, 10));
            setEndDate(today);
            setShowCustomDate(false);
        }
        else if (preset === 'CUSTOM') {
            setShowCustomDate(true);
        }
    };
    // Total Liquid Funds
    const totalFunds = accountBalances.cash + accountBalances.bank + accountBalances.mobile;
    // Filtered transactions
    const filteredTransactions = transactions.filter((tx) => {
        const matchType = filterType === 'ALL' 
            ? true 
            : filterType === 'PAYMENT'
                ? (tx.type === 'EXPENSE' && isSupplierPaymentTransaction(tx))
                : filterType === 'EXPENSE'
                    ? (tx.type === 'EXPENSE' && !isSupplierPaymentTransaction(tx))
                    : tx.type === filterType;
        const txAcct = (tx.paymentAccount || tx.account || tx.accountHead || tx.paymentMethod || '').toLowerCase();
        const fAcct = filterAccount.toLowerCase();
        const matchAccount = filterAccount === 'ALL' ? true : (
            txAcct === fAcct ||
            txAcct.includes(fAcct) ||
            fAcct.includes(txAcct) ||
            (fAcct.includes('cash') && txAcct.includes('cash'))
        );
        const matchDate = (!startDate || tx.date >= startDate) && (!endDate || tx.date <= endDate);
        const q = (searchQuery || '').toLowerCase().trim();
        const matchSearch = !q ||
            (tx.description && tx.description.toLowerCase().includes(q)) ||
            (tx.category && tx.category.toLowerCase().includes(q)) ||
            (tx.refNo && tx.refNo.toLowerCase().includes(q)) ||
            (txAcct && txAcct.includes(q));
        return matchType && matchAccount && matchDate && matchSearch;
    });
    // Calculate totals from transactions, with fallback for any unrecorded invoices
    const recordedInvoiceRefs = new Set(
        transactions
            .filter((t) => t.type === 'INCOME' && t.refNo)
            .map((t) => (t.refNo || '').toLowerCase().trim())
    );

    const projectLinkedInvoiceNos = useMemo(() => new Set([
        ...(projects || []).map(p => (p.invoiceNo || '').toLowerCase().trim()).filter(Boolean),
        ...(projects || []).flatMap(p => (p.salesItems || []).map(s => (s.invoiceNo || '').toLowerCase().trim())).filter(Boolean),
        ...(invoices || []).filter(inv => inv.projectId || inv.projectCode).map(inv => (inv.invoiceNo || '').toLowerCase().trim()).filter(Boolean),
    ]), [projects, invoices]);

    const unrecordedInvoiceIncome = (invoices || [])
        .filter((inv) => {
            const invRef = (inv.invoiceNo || '').toLowerCase().trim();
            if (inv.projectId || inv.projectCode || projectLinkedInvoiceNos.has(invRef)) return false;
            if (invRef && recordedInvoiceRefs.has(invRef)) return false;
            const matchDate = (!startDate || inv.date >= startDate) && (!endDate || inv.date <= endDate);
            return matchDate;
        })
        .reduce((acc, inv) => acc + (Number(inv.paidAmount) || 0), 0);

    const txIncome = filteredTransactions
        .filter((tx) => tx.type === 'INCOME' && !isAdvanceAdjustmentTransaction(tx) && !isDueReceivableTransaction(tx))
        .reduce((acc, tx) => acc + tx.amount, 0);

    const totalIncome = txIncome + unrecordedInvoiceIncome;

    // Supplier & Product Payments (Procurement Outflow - Assets/Payables settlement until journaled to expense)
    const totalSupplierPayments = filteredTransactions
        .filter((tx) => tx.type === 'EXPENSE' && isSupplierPaymentTransaction(tx))
        .reduce((acc, tx) => acc + tx.amount, 0);

    // Direct Operating Expenses (Office rent, utilities, overheads)
    const directOperatingExpenses = filteredTransactions
        .filter((tx) => tx.type === 'EXPENSE' && !isSupplierPaymentTransaction(tx))
        .reduce((acc, tx) => acc + tx.amount, 0);

    // Journal Voucher adjustments that merged/recognized expenses (e.g. raw materials consumed -> COGS)
    let journalExpenseDelta = 0;
    (journalEntries || []).forEach((j) => {
        if (
            j.source === 'PROJECT_EXPENSE' || 
            j.source === 'EXPENSE' || 
            j.source === 'SALES' || 
            j.source === 'PURCHASE' || 
            j.source === 'LEDGER_SYNC'
        ) return;
        const jRef = (j.refNo || '').toLowerCase().trim();
        if (jRef && recordedInvoiceRefs.has(jRef)) return;
        const matchDate = (!startDate || j.date >= startDate) && (!endDate || j.date <= endDate);
        if (!matchDate) return;

        const debitAcc = (chartOfAccounts || []).find(a => 
            a.id === j.debitAccountId || 
            a.code === j.debitAccountId || 
            (a.name && a.name.toLowerCase().trim() === (j.debitAccountName || '').toLowerCase().trim())
        );
        if (debitAcc && debitAcc.classification === 'Expense') {
            journalExpenseDelta += Number(j.amount) || 0;
        }
    });

    const totalOperatingExpense = directOperatingExpenses + journalExpenseDelta;
    const totalOutflow = totalSupplierPayments + directOperatingExpenses;
    const totalExpense = totalOperatingExpense;
    const netOperatingBalance = totalIncome - totalOutflow;
    const dateRangeLabel = startDate && endDate
        ? `${startDate} to ${endDate}`
        : startDate
            ? `From ${startDate}`
            : endDate
                ? `Up to ${endDate}`
                : 'All Time Records';
    const handleExcelExport = () => {
        exportAccountingToExcel(filteredTransactions, profile, dateRangeLabel, {
            income: totalIncome,
            expense: totalOutflow,
            net: netOperatingBalance,
        });
    };
    const handleCreateExpense = (e: React.FormEvent) => {
        e.preventDefault();
        if (!expenseTitle || expenseAmount <= 0)
            return;
        const selectedAccount = expenseAccount || availablePaymentAccounts[0]?.name || 'Cash';
        const targetAccObj = availablePaymentAccounts.find((a) => a.name === selectedAccount || a.id === selectedAccount);
        if (targetAccObj && Number(expenseAmount) > Number(targetAccObj.balance || 0)) {
            alert(`Insufficient funds in ${targetAccObj.name}! Available balance is ${profile.currencySymbol}${targetAccObj.balance.toLocaleString()}. You cannot record an expense exceeding available funds.`);
            return;
        }

        if (isProjectExpense && selectedProjectId) {
            const matchedExpCoa = resolveExpenseAccount(expenseCategory, expenseTitle, chartOfAccounts, expenseHeads) ||
                chartOfAccounts.find(a => 
                    a.name.toLowerCase() === expenseCategory.toLowerCase() ||
                    (isProjectExpense && (a.code === '5206' || a.name.toLowerCase().includes('project')))
                );
            const matchedPayCoa = chartOfAccounts.find(a => 
                a.name.toLowerCase() === selectedAccount.toLowerCase() ||
                (selectedAccount.toLowerCase().includes('cash') && (a.code === '1001' || a.code === '1010' || a.name.toLowerCase().includes('cash')))
            );

            addProjectExpense(selectedProjectId, {
                category: expenseCategory,
                amount: expenseAmount,
                note: expenseTitle + (expenseNote ? ` • ${expenseNote}` : ''),
                date: new Date().toISOString().slice(0, 10),
                paymentMethod: selectedAccount,
                linkedAccountId: matchedExpCoa?.id,
                paymentAccountId: matchedPayCoa?.id,
            });
        } else {
            const expRef = `EXP-${Date.now().toString().slice(-4)}`;
            const debitExp = resolveExpenseAccount(expenseCategory, expenseTitle, chartOfAccounts, expenseHeads, true);

            addTransaction({
                date: new Date().toISOString().slice(0, 10),
                type: 'EXPENSE',
                category: expenseCategory,
                description: expenseTitle,
                amount: expenseAmount,
                account: selectedAccount,
                paymentAccount: selectedAccount,
                accountHead: debitExp?.name || selectedAccount,
                paymentMethod: selectedAccount,
                refNo: expRef,
            });

            const creditAsset = matchChannelToAccount(selectedAccount, chartOfAccounts, paymentMethods) ||
                chartOfAccounts.find(a => a.classification === 'Asset' && (
                    a.name.toLowerCase() === selectedAccount.toLowerCase() ||
                    (selectedAccount.toLowerCase().includes('cash') && (a.code === '1001' || a.code === '1010' || a.name.toLowerCase().includes('cash'))) ||
                    (selectedAccount.toLowerCase().includes('bkash') && a.code === '1007') ||
                    (selectedAccount.toLowerCase().includes('nagad') && a.code === '1006') ||
                    (selectedAccount.toLowerCase().includes('city') && a.name.toLowerCase().includes('city')) ||
                    (selectedAccount.toLowerCase().includes('southeast') && a.name.toLowerCase().includes('southeast'))
                )) ||
                chartOfAccounts.find(a => a.classification === 'Asset');

            if (debitExp && creditAsset && addJournalEntry) {
                addJournalEntry({
                    date: new Date().toISOString().slice(0, 10),
                    refNo: expRef,
                    debitAccountId: debitExp.id,
                    debitAccountName: debitExp.name,
                    creditAccountId: creditAsset.id,
                    creditAccountName: creditAsset.name,
                    amount: expenseAmount,
                    narration: expenseTitle + (expenseNote ? ` • ${expenseNote}` : ''),
                    source: 'EXPENSE',
                    createdBy: activeStaff?.name || 'Managing Director',
                });
            }
        }

        setShowExpenseModal(false);
        setExpenseTitle('');
        setExpenseAmount(1000);
        setExpenseNote('');
        setSelectedProjectId('');
    };
    const handleCreateIncome = (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = Number(incomeAmount);
        if (numAmount <= 0) return;
        const selectedAccount = incomeAccount || availablePaymentAccounts[0]?.name || 'Cash';
        const today = new Date().toISOString().slice(0, 10);

        if (isProjectIncome && projectIncomeMode === 'existing' && selectedIncomeProject) {
            if (projectIncomeAction === 'collect_due') {
                const saleWithDue = (selectedIncomeProject.salesItems || []).find((s) => {
                    const d = s.dueAmount !== undefined
                        ? Number(s.dueAmount)
                        : (Number(s.amount) - (Number(s.paidAmount) || 0));
                    return d > 0;
                }) || selectedIncomeProject.salesItems?.[0];

                if (saleWithDue) {
                    collectProjectDue(
                        selectedIncomeProject.id,
                        saleWithDue.id,
                        numAmount,
                        selectedAccount,
                        today,
                        incomeTitle || `Project Due Collection: [${selectedIncomeProject.code}] ${selectedIncomeProject.name}`,
                        `COL-${Date.now().toString().slice(-4)}`
                    );
                } else {
                    addProjectSales(selectedIncomeProject.id, {
                        description: incomeTitle || `${selectedIncomeProject.name} - Due Collection`,
                        amount: numAmount,
                        date: today,
                        clientName: selectedIncomeProject.clientName,
                        paymentMethod: selectedAccount,
                        paymentBreakdown: [{
                            id: `pb-${Date.now()}`,
                            method: selectedAccount,
                            amount: numAmount,
                        }],
                        paidAmount: numAmount,
                        dueAmount: 0,
                    });
                }
            } else {
                addProjectSales(selectedIncomeProject.id, {
                    description: incomeTitle || `${selectedIncomeProject.name} - Project Sales`,
                    amount: numAmount,
                    date: today,
                    clientName: selectedIncomeProject.clientName,
                    paymentMethod: selectedAccount,
                    paymentBreakdown: [{
                        id: `pb-${Date.now()}`,
                        method: selectedAccount,
                        amount: numAmount,
                    }],
                    paidAmount: numAmount,
                    dueAmount: 0,
                });
            }
        } else if (isProjectIncome && projectIncomeMode === 'new') {
            const projTitle = newProjName.trim() || incomeTitle.trim() || 'New Project';
            const cName = newProjClientName.trim() || 'Walk-in Client';
            const budgetVal = Math.max(Number(newProjBudget) || 0, numAmount);
            const paidVal = numAmount;
            const dueVal = Math.max(0, budgetVal - paidVal);

            const createdProj = addProject({
                name: projTitle,
                clientName: cName,
                clientPhone: newProjClientPhone.trim() || undefined,
                startDate: today,
                status: 'In Progress',
                budget: budgetVal,
                salesItems: [{
                    id: `ps-${Date.now()}`,
                    description: incomeTitle || `${projTitle} - Project Sales Contract`,
                    amount: budgetVal,
                    date: today,
                    clientName: cName,
                    paymentMethod: selectedAccount,
                    paymentBreakdown: [
                        { id: `pb-1-${Date.now()}`, method: selectedAccount, amount: paidVal },
                        ...(dueVal > 0 ? [{ id: `pb-2-${Date.now()}`, method: 'Due', amount: dueVal }] : []),
                    ],
                    paidAmount: paidVal,
                    dueAmount: dueVal,
                }],
                expenseItems: [],
            });

            // Auto-generate official Sales Invoice in Sales & Orders tab
            if (createdProj && createdProj.id) {
                generateInvoiceForProject(createdProj.id, {
                    title: `${projTitle} - Sales Contract`,
                    date: today,
                    skipLedgerTransaction: true,
                });
            }
        } else {
            if (!incomeTitle) return;
            const incRef = `INC-${Date.now().toString().slice(-4)}`;
            addTransaction({
                date: today,
                type: 'INCOME',
                category: incomeCategory,
                description: incomeTitle,
                amount: numAmount,
                account: selectedAccount,
                paymentAccount: selectedAccount,
                accountHead: selectedAccount,
                paymentMethod: selectedAccount,
                refNo: incRef,
            });

            // Automatically post matching double-entry Journal Voucher immediately!
            const debitAsset = chartOfAccounts.find(a => 
                a.name.toLowerCase() === selectedAccount.toLowerCase() ||
                (selectedAccount.toLowerCase().includes('cash') && (a.code === '1001' || a.code === '1010' || a.name.toLowerCase().includes('cash'))) ||
                (selectedAccount.toLowerCase().includes('bkash') && a.code === '1007') ||
                (selectedAccount.toLowerCase().includes('nagad') && a.code === '1006')
            ) || chartOfAccounts.find(a => a.classification === 'Asset') || chartOfAccounts[0];

            const isAdv = incomeCategory.toLowerCase().includes('advance') || incomeCategory.includes('অগ্রিম');
            const creditHead = chartOfAccounts.find(a => {
                if (isAdv) {
                    return a.classification === 'Liability' && (a.code === '2002' || a.code === '2020' || a.name.toLowerCase().includes('advance'));
                }
                return a.classification === 'Revenue' && (
                    a.name.toLowerCase() === incomeCategory.toLowerCase() ||
                    (incomeCategory.toLowerCase().includes('sales') && (a.code === '4001' || a.code === '4010'))
                );
            }) || chartOfAccounts.find(a => a.classification === (isAdv ? 'Liability' : 'Revenue')) || chartOfAccounts[0];

            if (debitAsset && creditHead && addJournalEntry) {
                addJournalEntry({
                    date: today,
                    refNo: incRef,
                    debitAccountId: debitAsset.id,
                    debitAccountName: debitAsset.name,
                    creditAccountId: creditHead.id,
                    creditAccountName: creditHead.name,
                    amount: numAmount,
                    narration: incomeTitle,
                    source: isAdv ? 'CUSTOMER_PAYMENT' : 'SALES',
                    createdBy: activeStaff?.name || 'Managing Director',
                });
            }

            if (incomeCustomerId) {
                const cust = customers.find((c) => c.id === incomeCustomerId);
                if (cust) {
                    updateCustomer(cust.id, {
                        advanceBalance: (Number(cust.advanceBalance) || 0) + numAmount,
                    });
                }
            }
        }

        setShowIncomeModal(false);
        setIncomeTitle('');
        setIncomeAmount(5000);
        setIncomeCustomerId('');
        setSelectedIncomeProjectId('');
        setNewProjName('');
        setNewProjClientName('');
        setNewProjClientPhone('');
        setNewProjBudget(5000);
        setProjectIncomeMode('existing');
        setProjectIncomeAction('collect_due');
    };
    const handleOpenEditTx = (tx: any) => {
        setEditingTransaction(tx);
        setEditTxDate(tx.date);
        setEditTxDescription(tx.description);
        setEditTxCategory(tx.category);
        setEditTxAmount(tx.amount);
        setEditTxAccount(tx.paymentAccount || tx.account || tx.accountHead || tx.paymentMethod || availablePaymentAccounts[0]?.name || 'Cash');
        setEditTxType(tx.type);
        setEditTxRefNo(tx.refNo || '');
    };
    const handleSaveEditTx = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTransaction)
            return;
        let cleanDescription = editTxDescription;
        const oldAcc = editingTransaction.paymentAccount || editingTransaction.account || '';
        if (oldAcc && editTxAccount && oldAcc !== editTxAccount) {
            cleanDescription = cleanDescription.replace(new RegExp(`\\(${oldAcc}\\)`, 'gi'), `(${editTxAccount})`);
        }
        updateTransaction(editingTransaction.id, {
            date: editTxDate,
            description: cleanDescription,
            category: editTxCategory,
            amount: Number(editTxAmount),
            account: editTxAccount,
            paymentAccount: editTxAccount,
            accountHead: editTxAccount,
            paymentMethod: editTxAccount,
            type: editTxType,
            refNo: editTxRefNo,
        });
        setEditingTransaction(null);
    };
    return (<div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5">
      {/* Account Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Liquidity */}
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">
              {'Total Liquid Balance'}
            </span>
            <Wallet className="w-4 h-4 text-amber-400"/>
          </div>
          <div className="text-xl sm:text-2xl font-black mt-2">
            {profile.currencySymbol}
            {totalFunds.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            {'Cash + Bank + bKash'}
          </span>
        </div>

        {/* Cash in Hand */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {'Cash in Hand'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4"/>
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 mt-2">
            {profile.currencySymbol}
            {accountBalances.cash.toLocaleString()}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold block mt-1">
            {'Store & Factory Counters'}
          </span>
        </div>

        {/* Bank Account */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {'Bank Account'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building className="w-4 h-4"/>
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 mt-2">
            {profile.currencySymbol}
            {accountBalances.bank.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500 block mt-1 truncate" title={bankBreakdownText}>
            {bankBreakdownText}
          </span>
        </div>

        {/* Mobile Banking */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {'bKash / Nagad Wallet'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center">
              <Smartphone className="w-4 h-4"/>
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 mt-2">
            {profile.currencySymbol}
            {accountBalances.mobile.toLocaleString()}
          </div>
          <span className="text-[11px] text-pink-600 font-semibold block mt-1 truncate" title={mfsBreakdownText}>
            {mfsBreakdownText}
          </span>
        </div>
      </div>

      {/* P&L Performance Banner */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ArrowDownLeft className="w-5 h-5"/>
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold">
              {'Total Inflow / Revenue'}
            </span>
            <div className="text-lg font-black text-emerald-700">
              +{profile.currencySymbol}
              {totalIncome.toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-400">Sales & Due Collections</span>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-3 sm:pt-0 sm:pl-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5"/>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-semibold">
                {'Supplier & Product Payments'}
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.2 rounded">
                Payment
              </span>
            </div>
            <div className="text-lg font-black text-blue-600">
              -{profile.currencySymbol}
              {totalSupplierPayments.toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-400">Awaiting JV Expense Merge</span>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-3 sm:pt-0 sm:pl-4">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-5 h-5"/>
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold">
              {'Operating Expenses'}
            </span>
            <div className="text-lg font-black text-rose-600">
              -{profile.currencySymbol}
              {totalOperatingExpense.toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-400">Office & Direct Expenses</span>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-3 sm:pt-0 sm:pl-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5"/>
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold">
              {'Net Operating Balance'}
            </span>
            <div className={`text-lg font-black ${netOperatingBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
              {profile.currencySymbol}
              {netOperatingBalance.toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-400">Total Outflow: -{profile.currencySymbol}{totalOutflow.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs: General Ledger, COA, Expense Heads, Journals, Staff Audit Trail */}
      <div id="accounting-nav-tabs" className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button type="button" id="tab-accounting-ledger" onClick={() => setAccountingTab('ledger')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${accountingTab === 'ledger'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'}`}>
          <BookOpen className={`w-4 h-4 ${accountingTab === 'ledger' ? 'text-amber-400' : 'text-slate-500'}`}/>
          <span>{'Financial Ledger'}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${accountingTab === 'ledger' ? 'bg-slate-800 text-amber-300' : 'bg-slate-100 text-slate-600'}`}>
            {transactions.length}
          </span>
        </button>

        {canManageCOA && (
          <button type="button" id="tab-accounting-coa" onClick={() => setAccountingTab('coa')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${accountingTab === 'coa'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'}`}>
            <Layers className={`w-4 h-4 ${accountingTab === 'coa' ? 'text-amber-400' : 'text-slate-500'}`}/>
            <span>{'Chart of Accounts'}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${accountingTab === 'coa' ? 'bg-slate-800 text-amber-300' : 'bg-slate-100 text-slate-600'}`}>
              {chartOfAccounts.length}
            </span>
          </button>
        )}

        {canManageExpenseHeads && (
          <button type="button" id="tab-accounting-expense-heads" onClick={() => setAccountingTab('expense-heads')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${accountingTab === 'expense-heads'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'}`}>
            <DollarSign className={`w-4 h-4 ${accountingTab === 'expense-heads' ? 'text-amber-400' : 'text-slate-500'}`}/>
            <span>{'Expense Heads'}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${accountingTab === 'expense-heads' ? 'bg-slate-800 text-amber-300' : 'bg-slate-100 text-slate-600'}`}>
              {expenseHeads.length}
            </span>
          </button>
        )}

        <button type="button" id="tab-accounting-journals" onClick={() => setAccountingTab('journals')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${accountingTab === 'journals'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'}`}>
          <FileSpreadsheet className={`w-4 h-4 ${accountingTab === 'journals' ? 'text-amber-400' : 'text-slate-500'}`}/>
          <span>{'Journal Vouchers'}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${accountingTab === 'journals' ? 'bg-slate-800 text-amber-300' : 'bg-slate-100 text-slate-600'}`}>
            {journalEntries.length}
          </span>
        </button>
      </div>

      {accountingTab === 'coa' && canManageCOA && <ChartOfAccountsManager />}
      {accountingTab === 'expense-heads' && canManageExpenseHeads && <ExpenseHeadManager />}
      {accountingTab === 'journals' && <JournalEntriesManager />}

      {(accountingTab === 'ledger' || (!canManageCOA && accountingTab === 'coa') || (!canManageExpenseHeads && accountingTab === 'expense-heads')) && (
        /* General Ledger Section */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Header & Controls */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              {'Financial Ledger Journal'}
            </h3>
            <p className="text-xs text-slate-500">
              {'Automated entries from Sales Invoices, Purchase Orders & Direct Expenses'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Export Excel (.xlsx) */}
            {canExportReports && (
              <button type="button" onClick={handleExcelExport} className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs flex items-center gap-1.5 transition-all" title={'Download Excel Ledger'}>
                <FileSpreadsheet className="w-4 h-4"/>
                <span>{'Excel'}</span>
              </button>
            )}

            {/* Print / PDF Report */}
            {canExportReports && (
              <button type="button" onClick={() => setShowReportModal(true)} className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-2xs flex items-center gap-1.5 transition-all" title={'Print / Save PDF Report'}>
                <Printer className="w-4 h-4 text-amber-400"/>
                <span>{'PDF / Print'}</span>
              </button>
            )}

            {canAddIncome && (
              <button type="button" onClick={() => setShowIncomeModal(true)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all">
                <Plus className="w-4 h-4"/>
                <span>{'+ Record Income'}</span>
              </button>
            )}

            {canAddExpense && (
              <button type="button" onClick={() => setShowExpenseModal(true)} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all">
                <Plus className="w-4 h-4 text-amber-400"/>
                <span>{'+ Record Expense'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={'Search description or ref#...'} className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"/>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Date Preset Buttons */}
            <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200">
              {([
                { id: 'ALL', labelEn: 'All', labelBn: "" },
                { id: 'TODAY', labelEn: 'Today', labelBn: "" },
                { id: '7D', labelEn: '7 Days', labelBn: "" },
                { id: 'THIS_MONTH', labelEn: 'Month', labelBn: "" },
                { id: 'CUSTOM', labelEn: 'Custom', labelBn: "" },
            ] as const).map((p) => (<button key={p.id} type="button" onClick={() => handleDatePreset(p.id)} className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all ${filterDatePreset === p.id
                    ? 'bg-amber-100 text-amber-900'
                    : 'text-slate-600 hover:text-slate-900'}`}>
                  {p.labelEn}
                </button>))}
            </div>

            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold">
              <option value="ALL">{'All Types'}</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
              <option value="PAYMENT">Supplier / PO Payment</option>
              <option value="TRANSFER">Transfer</option>
            </select>

            <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold">
              <option value="ALL">{'All Accounts'}</option>
              {availablePaymentAccounts.map((acc) => (
                <option key={acc.id} value={acc.name}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Date Range Filter Inputs */}
        {(showCustomDate || filterDatePreset === 'CUSTOM') && (<div className="bg-amber-50/60 border-b border-amber-200/70 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600"/>
              <span>{'Custom Date Range:'}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-amber-200">
                <span className="text-slate-500 text-[11px] font-medium">
                  {'From:'}
                </span>
                <input type="date" value={startDate} onChange={(e) => {
                    setStartDate(e.target.value);
                    setFilterDatePreset('CUSTOM');
                }} className="text-xs font-semibold text-slate-800 outline-none bg-transparent"/>
              </div>

              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-amber-200">
                <span className="text-slate-500 text-[11px] font-medium">
                  {'To:'}
                </span>
                <input type="date" value={endDate} onChange={(e) => {
                    setEndDate(e.target.value);
                    setFilterDatePreset('CUSTOM');
                }} className="text-xs font-semibold text-slate-800 outline-none bg-transparent"/>
              </div>

              <button type="button" onClick={() => handleDatePreset('ALL')} className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 text-xs font-medium flex items-center gap-1">
                <RefreshCw className="w-3 h-3"/>
                <span>{'Reset'}</span>
              </button>
            </div>
          </div>)}

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4"></th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4"></th>
                <th className="py-3 px-4 text-center"></th>
                <th className="py-3 px-4 text-right">Tk</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map((tx, idx) => (<tr key={`${tx.id || 'tx'}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{tx.date}</td>
                  <td className="py-3 px-4 font-mono text-slate-600 font-semibold">{tx.refNo}</td>
                  <td className="py-3 px-4 max-w-md">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                      <span className="line-clamp-2" title={tx.description}>{tx.description}</span>
                      {(tx.projectId || tx.projectCode) && (
                        <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          <Briefcase className="w-2.5 h-2.5 text-amber-600" />
                          <span>{tx.projectCode || tx.refNo}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-amber-700 font-medium">{tx.category}</div>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-700">{tx.paymentAccount || tx.account || tx.accountHead || 'Cash in Hand'}</td>
                  <td className="py-3 px-4 text-center">
                    {tx.type === 'INCOME' ? (
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                        INCOME
                      </span>
                    ) : isSupplierPaymentTransaction(tx) ? (
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800" title="Supplier / Product Payment (Awaiting JV Expense Merge)">
                        PAYMENT
                      </span>
                    ) : tx.type === 'EXPENSE' ? (
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">
                        EXPENSE
                      </span>
                    ) : (
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                        {tx.type}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-black text-sm ${tx.type === 'INCOME'
                    ? 'text-emerald-700'
                    : isSupplierPaymentTransaction(tx)
                        ? 'text-blue-700'
                        : tx.type === 'EXPENSE'
                            ? 'text-rose-600'
                            : 'text-slate-900'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'}
                      {profile.currencySymbol}
                      {tx.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right flex items-center justify-end gap-1">
                    <button type="button" onClick={() => setViewingTransaction(tx)} className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors animate-fade-in" title={'View Details'}>
                      <Eye className="w-3.5 h-3.5"/>
                    </button>

                    {canEditTransaction && (
                      <button type="button" onClick={() => handleOpenEditTx(tx)} className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors animate-fade-in" title={'Edit Transaction'}>
                        <Edit2 className="w-3.5 h-3.5"/>
                      </button>
                    )}

                    {canDeleteTransaction && (
                      <button type="button" onClick={() => setTxToDelete(tx)} className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    )}
                  </td>
                </tr>))}

              {filteredTransactions.length === 0 && (<tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    {'No transactions recorded'}
                  </td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </div>)}

      {/* RECORD EXPENSE MODAL */}
      {showExpenseModal && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateExpense} className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {'Record Operating Expense'}
              </h3>
              <button type="button" onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Expense Description *'}
                </label>
                <input type="text" required value={expenseTitle} onChange={(e) => setExpenseTitle(e.target.value)} placeholder="e.g. Factory Electricity Bill / Machine Servicing" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Expense Category / Account *'}
                  </label>
                  <select value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium">
                    {availableExpenseOptions && availableExpenseOptions.length > 0 ? (
                      availableExpenseOptions.map((opt) => (
                        <option key={opt.id} value={opt.name}>
                          {opt.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Rent & Utilities">Rent & Utilities</option>
                        <option value="Payroll & Wages">Payroll & Wages</option>
                        <option value="Machine Maintenance">Maintenance</option>
                        <option value="Conveyance & Transport">Transport</option>
                        <option value="Entertainment & Tea">Tea/Refreshment</option>
                        <option value="Miscellaneous">Misc</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Amount *'}
                  </label>
                  <input type="number" step="any" min="1" required value={expenseAmount} onChange={(e) => setExpenseAmount(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-black text-rose-600 text-sm"/>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 block">
                      {'Paid From Account *'}
                    </label>
                    {(() => {
                      const selectedAcc = availablePaymentAccounts.find((a) => a.name === expenseAccount || a.id === expenseAccount) || availablePaymentAccounts[0];
                      if (!selectedAcc) return null;
                      return (
                        <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          Live: {profile.currencySymbol}{selectedAcc.balance.toLocaleString()}
                        </span>
                      );
                    })()}
                  </div>
                  <select value={expenseAccount} onChange={(e) => setExpenseAccount(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium text-xs">
                    {availablePaymentAccounts.map((acc) => (
                      <option key={acc.id} value={acc.name}>
                        {acc.name} — [{profile.currencySymbol}{acc.balance.toLocaleString()}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Project Linking Section (Only visible when Category is Project Expense) */}
              {isProjectExpense && (
                <div className="p-3.5 rounded-xl border transition-all bg-amber-50/70 border-amber-300 ring-1 ring-amber-300/40">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Briefcase className="w-4 h-4 text-amber-600" />
                    <span>Link to Project (Optional)</span>
                    {isProjectExpense && (
                      <span className="text-amber-800 text-[10px] bg-amber-100 font-extrabold px-1.5 py-0.5 rounded border border-amber-300">
                        Project Expense
                      </span>
                    )}
                  </label>
                  {selectedProjectId && (
                    <button
                      type="button"
                      onClick={() => setSelectedProjectId('')}
                      className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      Clear Project Link
                    </button>
                  )}
                </div>

                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium text-xs bg-white cursor-pointer focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                >
                  <option value="">
                    {isProjectExpense
                      ? '-- Select a Project --'
                      : '-- No Project Linked (General Operating Expense) --'}
                  </option>
                  {projects.map((proj) => {
                    const isCompleted = proj.status === 'Completed';
                    return (
                      <option key={proj.id} value={proj.id}>
                        [{proj.code}] {proj.name} — {proj.clientName} {isCompleted ? '(Completed)' : `(${proj.status})`}
                      </option>
                    );
                  })}
                </select>

                {/* Selected Project Info Preview */}
                {(() => {
                  const p = projects.find((item) => item.id === selectedProjectId);
                  if (!p) {
                    if (isProjectExpense && projects.length > 0) {
                      return (
                        <p className="text-[10.5px] text-amber-800 mt-2 flex items-center gap-1.5 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            Tip: Linking a project will automatically add this expense to the project cost sheet and update its net profit.
                          </span>
                        </p>
                      );
                    }
                    return null;
                  }

                  const newTotalCost = (Number(p.totalExpenses) || 0) + (Number(expenseAmount) || 0);

                  return (
                    <div className="mt-2.5 p-2.5 bg-white rounded-lg border border-amber-200 text-[11px] space-y-1.5 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                          <span className="font-mono text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                            {p.code}
                          </span>
                          <span className="truncate max-w-[280px] sm:max-w-md">{p.name}</span>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          p.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {p.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-center">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Client</span>
                          <span className="font-bold text-slate-700 truncate block">{p.clientName}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Project Budget</span>
                          <span className="font-bold text-amber-700">{profile.currencySymbol}{(Number(p.budget) || 0).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Current Cost</span>
                          <span className="font-bold text-slate-600">{profile.currencySymbol}{(Number(p.totalExpenses) || 0).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-rose-600 block font-bold">New Cost After</span>
                          <span className="font-black text-rose-700 font-mono">
                            {profile.currencySymbol}{newTotalCost.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <p className="text-[10.5px] text-emerald-700 font-semibold pt-1 flex items-center gap-1 border-t border-slate-100">
                        <span>✓ This expense is linked directly to [{p.code}] {p.name} and synced with Project Management.</span>
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
            </div>

            {(() => {
              const selectedAcc = availablePaymentAccounts.find((a) => a.name === expenseAccount || a.id === expenseAccount) || availablePaymentAccounts[0];
              const isOverdraft = Boolean(selectedAcc && Number(expenseAmount) > Number(selectedAcc.balance || 0));
              return (
                <>
                  {isOverdraft && selectedAcc && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        {`Expense amount exceeds available balance in ${selectedAcc.name} (${profile.currencySymbol}${selectedAcc.balance.toLocaleString()}). Cannot proceed with negative balance.`}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button type="button" onClick={() => setShowExpenseModal(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                      {'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={expenseAmount <= 0 || isOverdraft}
                      className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-2xs transition-all ${
                        isOverdraft
                          ? 'bg-slate-400 cursor-not-allowed opacity-60'
                          : 'bg-rose-600 hover:bg-rose-700 cursor-pointer'
                      }`}
                    >
                      {isOverdraft
                        ? 'Insufficient Account Balance'
                        : isProjectExpense && selectedProjectId
                        ? `Confirm & Link to Project (${profile.currencySymbol}${(Number(expenseAmount) || 0).toLocaleString()})`
                        : 'Confirm Expense'}
                    </button>
                  </div>
                </>
              );
            })()}
          </form>
        </div>)}

      {/* Professional Accounting Ledger Report Modal */}
      {showReportModal && (<ReportPrintModal type="accounting" accountingData={filteredTransactions} profile={profile} language={language} dateRangeText={dateRangeLabel} onClose={() => setShowReportModal(false)}/>)}
      {/* RECORD INCOME MODAL */}
      {showIncomeModal && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateIncome} className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {'Record Operating Income'}
              </h3>
              <button type="button" onClick={() => setShowIncomeModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Income Description / Narration *'}
                </label>
                <input type="text" required value={incomeTitle} onChange={(e) => setIncomeTitle(e.target.value)} placeholder="e.g. Received Advance Cash from Client / Interest Credit" className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium"/>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Category'}
                  </label>
                  <select value={incomeCategory} onChange={(e) => setIncomeCategory(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium">
                    {availableIncomeOptions.map((opt) => (
                      <option key={opt.id} value={opt.name}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Amount *'}
                  </label>
                  <input type="number" step="any" min="1" required value={incomeAmount} onChange={(e) => setIncomeAmount(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-black text-emerald-600 text-sm"/>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 block">
                      {'Deposit Into Account *'}
                    </label>
                    {(() => {
                      const selectedAcc = availablePaymentAccounts.find((a) => a.name === incomeAccount || a.id === incomeAccount) || availablePaymentAccounts[0];
                      if (!selectedAcc) return null;
                      return (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Live: {profile.currencySymbol}{selectedAcc.balance.toLocaleString()}
                        </span>
                      );
                    })()}
                  </div>
                  <select value={incomeAccount} onChange={(e) => setIncomeAccount(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium text-xs">
                    {availablePaymentAccounts.map((acc) => (
                      <option key={acc.id} value={acc.name}>
                        {acc.name} — [{profile.currencySymbol}{acc.balance.toLocaleString()}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(incomeCategory.toLowerCase().includes('advance') || incomeCategory.includes('অগ্রিম')) && (
                <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200 space-y-1.5">
                  <label className="font-bold text-indigo-950 block text-xs">
                    Link to Client / Customer (Optional)
                  </label>
                  <select
                    value={incomeCustomerId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      setIncomeCustomerId(cid);
                      if (cid && (!incomeTitle || incomeTitle.startsWith('Advance received from'))) {
                        const c = customers.find((x) => x.id === cid);
                        if (c) setIncomeTitle(`Advance received from ${c.name}`);
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl font-medium text-xs text-slate-800"
                  >
                    <option value="">-- No Specific Client (General Advance Deposit) --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''} — Current Advance: {profile.currencySymbol}{(c.advanceBalance || 0).toLocaleString()}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-indigo-600 font-medium">
                    💡 Selecting a client will automatically credit this deposit to their Advance Balance in Registered Clients.
                  </p>
                </div>
              )}

              {/* PROJECT SALES & DUE COLLECTION WORKFLOW */}
              {isProjectIncome && (
                <div className="bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-slate-50 p-4 rounded-xl border border-emerald-200/90 space-y-3.5 shadow-2xs">
                  {/* Mode Selector Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-emerald-200/70">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Briefcase className="w-4 h-4 text-emerald-600" />
                      <span>Project Sales & Due Management</span>
                    </div>

                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-emerald-200 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setProjectIncomeMode('existing')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          projectIncomeMode === 'existing'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <FolderKanban className="w-3.5 h-3.5" />
                        <span>Link Existing Project</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProjectIncomeMode('new')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          projectIncomeMode === 'new'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create New Project</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProjectIncomeMode('direct')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          projectIncomeMode === 'direct'
                            ? 'bg-slate-700 text-white shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <span>Direct Sales</span>
                      </button>
                    </div>
                  </div>

                  {/* MODE 1: EXISTING PROJECT & DUE COLLECTION */}
                  {projectIncomeMode === 'existing' && (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-700 text-xs">
                            Select Existing Project *
                          </label>
                          {selectedIncomeProjectId && (
                            <button
                              type="button"
                              onClick={() => setSelectedIncomeProjectId('')}
                              className="text-[10.5px] font-bold text-rose-600 hover:underline cursor-pointer"
                            >
                              Clear Selection
                            </button>
                          )}
                        </div>
                        <select
                          value={selectedIncomeProjectId}
                          onChange={(e) => setSelectedIncomeProjectId(e.target.value)}
                          className="w-full px-3 py-2 border border-emerald-300 rounded-xl font-medium text-xs bg-white cursor-pointer focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                        >
                          <option value="">-- Choose a Project to Link --</option>
                          {projects.map((proj) => {
                            const due = (proj.salesItems || []).reduce((s, si) => {
                              const d = si.dueAmount !== undefined
                                ? Number(si.dueAmount)
                                : Math.max(0, Number(si.amount) - (Number(si.paidAmount) || 0));
                              return s + d;
                            }, 0);
                            return (
                              <option key={proj.id} value={proj.id}>
                                [{proj.code}] {proj.name} — {proj.clientName} {due > 0 ? `(Due: ${profile.currencySymbol}${due.toLocaleString()})` : '(Fully Paid)'}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Selected Project Details & Due Collection Card */}
                      {selectedIncomeProject && (
                        <div className="p-3.5 bg-white rounded-xl border border-emerald-200/90 shadow-2xs space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="font-extrabold text-slate-900 flex items-center gap-2">
                              <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                                {selectedIncomeProject.code}
                              </span>
                              <span className="truncate max-w-[280px] sm:max-w-md">{selectedIncomeProject.name}</span>
                            </div>
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              selectedProjectDue > 0
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {selectedProjectDue > 0 ? `Due: ${profile.currencySymbol}${selectedProjectDue.toLocaleString()}` : 'Fully Paid'}
                            </span>
                          </div>

                          {/* Metrics Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2 border-y border-slate-100 text-center">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-medium">Client</span>
                              <span className="font-bold text-slate-700 truncate block">{selectedIncomeProject.clientName}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-medium">Project Budget</span>
                              <span className="font-bold text-slate-800">{profile.currencySymbol}{(Number(selectedIncomeProject.budget) || 0).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-medium">Total Invoiced</span>
                              <span className="font-bold text-emerald-700">{profile.currencySymbol}{(Number(selectedIncomeProject.totalSales) || 0).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-rose-500 block font-bold">Outstanding Due</span>
                              <span className="font-black text-rose-600 font-mono">
                                {profile.currencySymbol}{selectedProjectDue.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Action Type: Collect Due vs Add New Sales Billing */}
                          <div className="space-y-2 pt-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <label className="text-[11px] font-bold text-slate-700">Income Type for this Project:</label>
                              <div className="flex items-center gap-3">
                                <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-slate-800">
                                  <input
                                    type="radio"
                                    name="projectIncomeAction"
                                    value="collect_due"
                                    checked={projectIncomeAction === 'collect_due'}
                                    onChange={() => setProjectIncomeAction('collect_due')}
                                    className="text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span>Collect Due</span>
                                </label>
                                <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-slate-800">
                                  <input
                                    type="radio"
                                    name="projectIncomeAction"
                                    value="new_sales"
                                    checked={projectIncomeAction === 'new_sales'}
                                    onChange={() => setProjectIncomeAction('new_sales')}
                                    className="text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span>New Sales Billing</span>
                                </label>
                              </div>
                            </div>

                            {projectIncomeAction === 'collect_due' ? (
                              <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200 text-xs space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-rose-900 font-semibold">
                                    💡 Current Due: <strong className="text-rose-700 font-black">{profile.currencySymbol}{selectedProjectDue.toLocaleString()}</strong>
                                  </span>
                                  {selectedProjectDue > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIncomeAmount(selectedProjectDue);
                                        setIncomeTitle(`Project Due Collection: [${selectedIncomeProject.code}] ${selectedIncomeProject.name} (${selectedIncomeProject.clientName})`);
                                      }}
                                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                                    >
                                      <span>⚡ Fill Full Due ({profile.currencySymbol}{selectedProjectDue.toLocaleString()})</span>
                                    </button>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-600 flex items-center justify-between pt-1.5 border-t border-rose-200/60">
                                  <span>Remaining Due After Collection:</span>
                                  <span className="font-bold text-slate-800 font-mono">
                                    {profile.currencySymbol}{Math.max(0, selectedProjectDue - (Number(incomeAmount) || 0)).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200 text-xs">
                                <span className="text-emerald-900 font-medium">
                                  ✓ This amount will be recorded as new sales revenue for [{selectedIncomeProject.code}] {selectedIncomeProject.name}.
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* MODE 2: CREATE NEW PROJECT */}
                  {projectIncomeMode === 'new' && (
                    <div className="space-y-3 bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs animate-in fade-in duration-150">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                        <Plus className="w-4 h-4 text-emerald-600" />
                        <span>New Project Details & Initial Sales Booking</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Project Name / Title *</label>
                          <input
                            type="text"
                            required
                            value={newProjName}
                            onChange={(e) => setNewProjName(e.target.value)}
                            placeholder="e.g. Bashundhara Outdoor Billboard Fabrication"
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Client / Company Name *</label>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              required
                              value={newProjClientName}
                              onChange={(e) => setNewProjClientName(e.target.value)}
                              placeholder="e.g. BSRM Limited / Walk-in Corporate"
                              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                            />
                            {customers.length > 0 && (
                              <select
                                value=""
                                onChange={(e) => {
                                  const cust = customers.find((c) => c.id === e.target.value);
                                  if (cust) {
                                    setNewProjClientName(cust.company || cust.name);
                                    setNewProjClientPhone(cust.phone || '');
                                  }
                                }}
                                className="px-2 py-1 border border-slate-200 rounded-xl text-slate-600 text-xs font-medium bg-slate-50 cursor-pointer"
                                title="Pick from registered clients"
                              >
                                <option value="">Pick Client...</option>
                                {customers.map((c) => (
                                  <option key={c.id} value={c.id}>{c.company ? `${c.company} (${c.name})` : c.name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Client Phone (Optional)</label>
                          <input
                            type="text"
                            value={newProjClientPhone}
                            onChange={(e) => setNewProjClientPhone(e.target.value)}
                            placeholder="e.g. 01819-000000"
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Total Project Sales Contract / Budget *</label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={newProjBudget}
                            onChange={(e) => setNewProjBudget(Number(e.target.value))}
                            placeholder="e.g. 50000"
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      {/* Calculation summary */}
                      <div className="p-2.5 bg-emerald-50/70 rounded-lg border border-emerald-200 text-xs flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span>Total Budget: <strong className="font-mono text-slate-900">{profile.currencySymbol}{(Number(newProjBudget) || 0).toLocaleString()}</strong></span>
                          <span>Paid / Deposit: <strong className="font-mono text-emerald-700">{profile.currencySymbol}{(Number(incomeAmount) || 0).toLocaleString()}</strong></span>
                        </div>
                        <div>
                          <span className="text-rose-700 font-bold">
                            Remaining Due: {profile.currencySymbol}{Math.max(0, (Number(newProjBudget) || 0) - (Number(incomeAmount) || 0)).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Auto-generate Sales Invoice Notice */}
                      <div className="flex items-center gap-2 p-2 bg-indigo-50/80 rounded-lg border border-indigo-200 text-[11px] text-indigo-900 font-medium">
                        <Receipt className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>An official Sales Invoice (DCC-INV) will be automatically created and linked in <strong>Sales & Orders</strong> upon saving.</span>
                      </div>
                    </div>
                  )}

                  {/* MODE 3: DIRECT SALES */}
                  {projectIncomeMode === 'direct' && (
                    <p className="text-[11px] text-slate-500 italic p-2 bg-white rounded-lg border border-slate-200">
                      ℹ️ Will be recorded as general project sales in the ledger without linking to a specific project.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowIncomeModal(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {'Cancel'}
              </button>
              <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isProjectIncome && projectIncomeMode === 'existing' && selectedIncomeProject
                  ? (projectIncomeAction === 'collect_due'
                      ? `Collect Project Due (${profile.currencySymbol}${(Number(incomeAmount) || 0).toLocaleString()})`
                      : `Record Project Billing (${profile.currencySymbol}${(Number(incomeAmount) || 0).toLocaleString()})`)
                  : isProjectIncome && projectIncomeMode === 'new'
                    ? `Create Project & Record Income (${profile.currencySymbol}${(Number(incomeAmount) || 0).toLocaleString()})`
                    : 'Confirm Income'}
              </button>
            </div>
          </form>
        </div>)}

      {/* VIEW TRANSACTION DETAILS MODAL */}
      {viewingTransaction && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold border ${viewingTransaction.type === 'INCOME'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                  {viewingTransaction.type}
                </span>
                <h3 className="font-bold text-slate-900 text-sm mt-1">
                  {'Ledger Transaction Details'}
                </h3>
              </div>
              <button type="button" onClick={() => setViewingTransaction(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-2 bg-slate-50 p-4 rounded-xl">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 text-[10px] block">{'Date'}</span>
                  <span className="font-bold text-slate-800 font-mono">{viewingTransaction.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">{'Reference'}</span>
                  <span className="font-bold text-slate-800 font-mono">{viewingTransaction.refNo || 'N/A'}</span>
                </div>
              </div>

              <div className="border-t border-slate-200/60 my-2 pt-2">
                <span className="text-slate-400 text-[10px] block">{'Description / Narration'}</span>
                <span className="font-bold text-slate-950 text-xs break-words">{viewingTransaction.description}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-slate-200/60 pt-2">
                <div>
                  <span className="text-slate-400 text-[10px] block">{'Category'}</span>
                  <span className="font-bold text-amber-700 font-sans">{viewingTransaction.category}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">{'Paid/Received Via'}</span>
                  <span className="font-bold text-slate-700">{viewingTransaction.account || 'N/A'}</span>
                </div>
              </div>

              <div className="border-t border-slate-200/60 pt-2 flex justify-between items-center">
                <span className="text-slate-500 font-bold">{'Total Amount:'}</span>
                <span className={`text-base font-black font-mono ${viewingTransaction.type === 'INCOME' ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {viewingTransaction.type === 'INCOME' ? '+' : '-'} {profile.currencySymbol}{viewingTransaction.amount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              {canEditTransaction && (
                <button type="button" onClick={() => {
                  handleOpenEditTx(viewingTransaction);
                  setViewingTransaction(null);
                }} className="px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100">
                  {'Edit'}
                </button>
              )}
              <button type="button" onClick={() => setViewingTransaction(null)} className="px-5 py-2 bg-slate-900 text-white rounded-xl font-bold">
                {'Close'}
              </button>
            </div>
          </div>
        </div>)}

      {/* EDIT TRANSACTION MODAL */}
      {editingTransaction && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveEditTx} className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-blue-600"/>
                {'Edit Ledger Transaction'}
              </h3>
              <button type="button" onClick={() => setEditingTransaction(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Transaction Type *'}
                  </label>
                  <select value={editTxType} onChange={(e) => setEditTxType(e.target.value as TransactionType)} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold">
                    <option value="INCOME">INCOME</option>
                    <option value="EXPENSE">EXPENSE</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Date *'}
                  </label>
                  <input type="date" required value={editTxDate} onChange={(e) => setEditTxDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold"/>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Narration / Description *'}
                </label>
                <input type="text" required value={editTxDescription} onChange={(e) => setEditTxDescription(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium"/>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Category *'}
                  </label>
                  <input type="text" required value={editTxCategory} onChange={(e) => setEditTxCategory(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Amount *'}
                  </label>
                  <input type="number" step="any" min="1" required value={editTxAmount} onChange={(e) => setEditTxAmount(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-black text-slate-800 font-mono text-sm"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Reference / Voucher No'}
                  </label>
                  <input type="text" value={editTxRefNo} onChange={(e) => setEditTxRefNo(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"/>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 block">
                      {'Fund Account *'}
                    </label>
                    {(() => {
                      const selectedAcc = availablePaymentAccounts.find((a) => a.name === editTxAccount || a.id === editTxAccount) || availablePaymentAccounts[0];
                      if (!selectedAcc) return null;
                      return (
                        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          Live: {profile.currencySymbol}{selectedAcc.balance.toLocaleString()}
                        </span>
                      );
                    })()}
                  </div>
                  <select value={editTxAccount} onChange={(e) => setEditTxAccount(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium text-xs">
                    {availablePaymentAccounts.map((acc) => (
                      <option key={acc.id} value={acc.name}>
                        {acc.name} — [{profile.currencySymbol}{acc.balance.toLocaleString()}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setEditingTransaction(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {'Cancel'}
              </button>
              <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs">
                {'Save Changes'}
              </button>
            </div>
          </form>
        </div>)}

      {/* LEDGER TRANSACTION DELETE CONFIRM MODAL */}
      {txToDelete && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="w-6 h-6"/>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {'Confirm Transaction Deletion'}
              </h3>
              <p className="text-slate-500 text-xs mt-1">
                {`Are you sure you want to delete the transaction "${txToDelete.description}" from the ledger? This action cannot be undone.`}
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button type="button" onClick={() => setTxToDelete(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {'Cancel'}
              </button>
              <button type="button" onClick={() => {
                deleteTransaction(txToDelete.id);
                setTxToDelete(null);
            }} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-2xs">
                {'Delete'}
              </button>
            </div>
          </div>
        </div>)}
    </div>);
};
