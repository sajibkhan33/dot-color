import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Project, ProjectExpenseItem, ProjectSalesItem } from '../types';
import { FolderKanban, Plus, Search, Filter, TrendingUp, TrendingDown, DollarSign, Receipt, CheckCircle2, Clock, Briefcase, Layers, Edit2, Trash2, ChevronDown, ChevronUp, FileSpreadsheet, Printer, Calendar, User, Phone, BookOpen, PieChart, Tag, CreditCard, Wallet, Landmark, Banknote, Smartphone, History, FileText, X, RotateCw } from 'lucide-react';
import { getPaymentMethodLiveBalance, isInvoiceMatchingCustomer } from '../utils/accountUtils';
export interface SalesPaymentRow {
    id: string;
    method: string;
    amount: number | '';
    note: string;
}
export interface ExpenseBreakdownRow {
    id: string;
    category: string;
    categorySearch: string;
    amount: number | '';
    note: string;
    isDropdownOpen: boolean;
    linkedAccountId?: string;
    paymentMethod?: string;
}
export interface ProjectManagementModuleProps {
    onOpenInvoiceModal?: (id: string, mode?: 'invoice' | 'challan' | 'pos', options?: { autoPrint?: boolean; isPadMode?: boolean }) => void;
}
export const ProjectManagementModule: React.FC<ProjectManagementModuleProps> = ({ onOpenInvoiceModal }) => {
    const { projects, addProject, updateProject, deleteProject, addProjectSales, collectProjectDue, addProjectExpense, addProjectExpenses, deleteProjectSales, deleteProjectExpense, syncProjectsWithAccounting, journalEntries = [], chartOfAccounts = [], expenseHeads = [], language, profile, paymentMethods = [], invoices = [], linkInvoiceToProject, unlinkInvoiceFromProject, createProjectFromInvoice, generateInvoiceForProject, syncProjectInvoice, customers = [], transactions = [], accountBalances, checkPermission, activeStaff } = useApp();

    const isSuperAdmin = (activeStaff?.role || '').toLowerCase() === 'super admin' ||
        (activeStaff?.role || '').toLowerCase() === 'superadmin' ||
        activeStaff?.customRoleId === 'role-superadmin' ||
        (activeStaff?.name || '').toLowerCase().includes('super admin');
    const canManageProjects = isSuperAdmin || Boolean(checkPermission && checkPermission('projects.manage'));
    const isBn = language === 'bn';
    const [searchTerm, setSearchType] = useState(() => {
        try {
            const saved = sessionStorage.getItem('PROJECT_SEARCH_TERM');
            if (saved) {
                sessionStorage.removeItem('PROJECT_SEARCH_TERM');
                return saved;
            }
        } catch {}
        return '';
    });
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

    // Auto-expand project if matched by search term from invoice navigation
    useEffect(() => {
        if (searchTerm && projects && projects.length > 0) {
            const matched = projects.find(p => p.code.toLowerCase().includes(searchTerm.toLowerCase()));
            if (matched) {
                setExpandedProjectId(matched.id);
            }
        }
    }, [searchTerm, projects]);

    // Background auto-alignment with Accounting COA on module mount
    useEffect(() => {
        if (syncProjectsWithAccounting) {
            syncProjectsWithAccounting();
        }
    }, []);
    const [syncNotice, setSyncNotice] = useState<string | null>(null);
    // Modals state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showSalesModal, setShowSalesModal] = useState<string | null>(null); // projectId
    const [showExpenseModal, setShowExpenseModal] = useState<string | null>(null); // projectId
    const [collectingDueSale, setCollectingDueSale] = useState<{
        project: Project;
        sale: ProjectSalesItem;
        dueAmount: number;
    } | null>(null);
    const [adjustAdvanceAmount, setAdjustAdvanceAmount] = useState<number>(0);
    const [collectDueForm, setCollectDueForm] = useState({
        amount: '' as number | '',
        paymentMethod: 'Cash in Hand',
        date: new Date().toISOString().split('T')[0],
        referenceNo: '',
        note: '',
    });
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [linkingProject, setLinkingProject] = useState<Project | null>(null);
    const [linkInvoiceForm, setLinkInvoiceForm] = useState({
        invoiceId: '',
        chartOfAccountId: 'coa-4002',
        syncSalesItem: true,
    });
    // New Project Form State
    const [newProject, setNewProject] = useState({
        name: '',
        nameBn: '',
        clientName: '',
        clientPhone: '',
        budget: 0,
        status: 'In Progress' as Project['status'],
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        notes: '',
        invoiceId: '',
        chartOfAccountId: 'coa-4002',
        includeSalesItem: true,
        autoGenerateInvoice: true,
    });
    // Dynamic Payment method options for sales breakdown
    const activePaymentMethods = useMemo(() => {
        return (paymentMethods || []).filter((p) => p.isEnabled);
    }, [paymentMethods]);
    const depositPaymentMethods = useMemo(() => {
        const filtered = activePaymentMethods.filter(pm => {
            const m = (pm.name || '').toLowerCase();
            return !m.includes('due') && !m.includes('receivable');
        });
        if (filtered.length > 0) return filtered;
        return [
            { id: 'Cash', name: 'Cash in Hand', nameBn: 'হাতে নগদ', isEnabled: true, type: 'cash' as const },
        ];
    }, [activePaymentMethods]);
    const paymentMethodOptions = useMemo(() => {
        if (activePaymentMethods.length === 0) {
            return [
                { id: 'Cash', nameEn: 'Cash in Hand', nameBn: "Cash" },
                { id: 'Due', nameEn: 'Due / Receivable', nameBn: "DueReceivable" },
            ];
        }
        const list = activePaymentMethods.map((pm) => ({
            id: pm.name,
            nameEn: pm.name,
            nameBn: pm.nameBn ? `${pm.nameBn} (${pm.name})` : pm.name,
        }));
        if (!list.some((item) => item.id.toLowerCase() === 'due')) {
            list.push({ id: 'Due', nameEn: 'Due / Receivable', nameBn: "DueReceivable" });
        }
        if (!list.some((item) => item.id.toLowerCase() === 'other')) {
            list.push({ id: 'Other', nameEn: 'Other / Adjustment', nameBn: "Other" });
        }
        return list;
    }, [activePaymentMethods]);
    // Sales Form State with Multi-Payment Breakdown
    const [salesForm, setSalesForm] = useState({
        invoiceNo: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        clientName: '',
        generalNote: '',
        paymentRows: [
            { id: 'pay-1', method: 'Cash', amount: '' as number | '', note: '' },
        ] as SalesPaymentRow[],
    });
    const totalSalesAmount = useMemo(() => {
        return salesForm.paymentRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    }, [salesForm.paymentRows]);
    // Expense Form State with Multi-Category Breakdown Rows & Notes Per Row
    const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
    const [expenseGeneralNote, setExpenseGeneralNote] = useState('');
    const [expenseRows, setExpenseRows] = useState<ExpenseBreakdownRow[]>([
        {
            id: 'exp-1',
            category: '',
            categorySearch: '',
            amount: '' as number | '',
            note: '',
            isDropdownOpen: false,
            linkedAccountId: '',
            paymentMethod: 'Cash in Hand',
        },
    ]);
    const totalExpenseAmount = useMemo(() => {
        return expenseRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    }, [expenseRows]);
    const [breakdownSearchTerm, setBreakdownSearchTerm] = useState('');

    const activeProjectForExpense = useMemo(() => {
        if (!showExpenseModal) return null;
        return (projects || []).find(p => p.id === showExpenseModal) || null;
    }, [showExpenseModal, projects]);

    const isSalesRevenueProject = useMemo(() => {
        if (!activeProjectForExpense) return false;
        const coaId = activeProjectForExpense.chartOfAccountId;
        const matchedCoa = (chartOfAccounts || []).find(a => a.id === coaId || a.code === coaId);
        const code = matchedCoa?.code || activeProjectForExpense.projectAccountCode || '';
        const name = (matchedCoa?.name || '').toLowerCase();
        return code === '4001' || name.includes('sales revenue') || (name.includes('বিক্রয় আয়') && !name.includes('প্রজেক্ট'));
    }, [activeProjectForExpense, chartOfAccounts]);

    const availableExpenseAccounts = useMemo(() => {
        const allExpenseAccounts = (chartOfAccounts || []).filter(a => a.classification === 'Expense' && a.isActive !== false);

        if (isSalesRevenueProject) {
            // Case 2: Project uses Sales Revenue -> Show general company expenses, strictly EXCLUDE [5206] Project Expense
            const generalList = allExpenseAccounts.filter(a => {
                const isProjectExp = a.code === '5206' || a.id === 'coa-5206' || a.name.toLowerCase().includes('project') || (a.nameBn && a.nameBn.includes('প্রজেক্ট'));
                return !isProjectExp;
            });
            if (generalList.length > 0) {
                return [...generalList].sort((a, b) => a.code.localeCompare(b.code));
            }
            return allExpenseAccounts;
        }

        // Case 1 (Default): Project uses Project Sales (4002) -> ONLY show [5206] Project Expense
        const projectSpecificList = allExpenseAccounts.filter(a => {
            return a.code === '5206' || a.id === 'coa-5206' || a.name.toLowerCase().includes('project') || (a.nameBn && a.nameBn.includes('প্রজেক্ট'));
        });

        if (projectSpecificList.length > 0) {
            return projectSpecificList;
        }

        return [
            { id: 'coa-5206', code: '5206', name: 'Project Expense', nameBn: 'প্রজেক্ট খরচ' } as any,
        ];
    }, [chartOfAccounts, isSalesRevenueProject]);

    const defaultProjectExpAcc = useMemo(() => {
        if (availableExpenseAccounts.length > 0) {
            return availableExpenseAccounts[0];
        }
        return { code: '5206', name: 'Project Expense', id: 'coa-5206' };
    }, [availableExpenseAccounts]);

    const availablePaymentAccounts = useMemo(() => {
        const list = (chartOfAccounts || []).filter(a => a.classification === 'Asset' && !a.name.toLowerCase().includes('receivable') && (
            a.code === '1001' || a.code === '1010' || a.code === '1006' || a.code === '1020' || a.code === '1040' ||
            (a.name || '').toLowerCase().includes('cash') || (a.name || '').toLowerCase().includes('bank') || (a.name || '').toLowerCase().includes('bkash') || (a.name || '').toLowerCase().includes('nagad') || (a.name || '').toLowerCase().includes('wallet')
        ));
        if (list.length === 0) {
            return [
                { id: 'pay-cash', code: '1001', name: 'Cash in Hand' },
                { id: 'pay-bank', code: '1006', name: 'Bank' },
                { id: 'pay-mfs', code: '1040', name: 'bKash / Nagad' },
            ];
        }
        return list;
    }, [chartOfAccounts]);

    const collectPaymentAccounts = useMemo(() => {
        const accounts: string[] = [];
        availablePaymentAccounts.forEach(a => {
            if (!accounts.includes(a.name) && !a.name.toLowerCase().includes('due') && !a.name.toLowerCase().includes('receivable')) {
                accounts.push(a.name);
            }
        });
        (activePaymentMethods || []).forEach(pm => {
            if (!accounts.includes(pm.name) && !pm.name.toLowerCase().includes('due') && !pm.name.toLowerCase().includes('receivable')) {
                accounts.push(pm.name);
            }
        });
        if (accounts.length === 0) {
            accounts.push('Cash in Hand', 'City Bank PLC', 'Southeast Bank', 'Nagad', 'bKash');
        }
        return accounts;
    }, [availablePaymentAccounts, activePaymentMethods]);



    const availableRevenueAccounts = useMemo(() => {
        const revs = (chartOfAccounts || []).filter(a => a.classification === 'Revenue' && a.isActive !== false);
        if (revs.length === 0) {
            return [
                { id: 'coa-4002', code: '4002', name: 'Project Sales', nameBn: 'প্রজেক্ট সেলস' },
                { id: 'coa-4051', code: '4051', name: 'Project Sales Income', nameBn: 'প্রজেক্ট সেলস ইনকাম' },
                { id: 'coa-4010', code: '4010', name: 'Digital Printing & Flex Banner Sales', nameBn: 'ডিজিটাল প্রিন্টিং বিক্রয়' },
            ];
        }
        return [...revs].sort((a, b) => {
            const isPrjA = a.code === '4002' || a.code === '4051' || a.id === 'coa-4002' || a.id === 'coa-4051' || a.name.toLowerCase().includes('project');
            const isPrjB = b.code === '4002' || b.code === '4051' || b.id === 'coa-4002' || b.id === 'coa-4051' || b.name.toLowerCase().includes('project');
            if (isPrjA && !isPrjB) return -1;
            if (!isPrjA && isPrjB) return 1;
            return a.code.localeCompare(b.code);
        });
    }, [chartOfAccounts]);

    const defaultProjectRevAccId = useMemo(() => {
        const found = availableRevenueAccounts.find(a => 
            a.code === '4002' || 
            a.code === '4051' || 
            a.id === 'coa-4002' || 
            a.id === 'coa-4051' || 
            a.name.toLowerCase().includes('project') || 
            (a.nameBn && a.nameBn.includes('প্রজেক্ট'))
        );
        return found ? found.id : (availableRevenueAccounts[0]?.id || 'coa-4002');
    }, [availableRevenueAccounts]);

    useEffect(() => {
        if (defaultProjectRevAccId) {
            setNewProject(prev => {
                if (!prev.chartOfAccountId || prev.chartOfAccountId === 'coa-4051' || prev.chartOfAccountId === 'coa-4001') {
                    return { ...prev, chartOfAccountId: defaultProjectRevAccId };
                }
                return prev;
            });
            setLinkInvoiceForm(prev => {
                if (!prev.chartOfAccountId || prev.chartOfAccountId === 'coa-4051' || prev.chartOfAccountId === 'coa-4001') {
                    return { ...prev, chartOfAccountId: defaultProjectRevAccId };
                }
                return prev;
            });
        }
    }, [defaultProjectRevAccId]);

    const projectRevAcc = useMemo(() => {
        return chartOfAccounts.find(a => a.classification === 'Revenue' && (a.code === '4002' || a.code === '4051' || a.id === 'coa-4002' || a.id === 'coa-4051' || a.name.toLowerCase().includes('project') || a.code === '4060')) || { code: '4002', name: 'Project Sales', id: 'coa-4002' };
    }, [chartOfAccounts]);

    const projectExpAcc = useMemo(() => {
        return chartOfAccounts.find(a => a.classification === 'Expense' && (a.code === '5206' || a.id === 'coa-5206' || a.name.toLowerCase().includes('project'))) ||
               chartOfAccounts.find(a => a.classification === 'Expense' && a.code === '5100' && a.name.toLowerCase().includes('project')) ||
               chartOfAccounts.find(a => a.classification === 'Expense') ||
               { code: '5206', name: 'Project Expense', id: 'coa-5206' };
    }, [chartOfAccounts]);

    const getResolvedCOA = (_categoryName?: string, _note?: string) => {
        return projectExpAcc;
    };

    const getResolvedPaymentCOA = (method: string) => {
        const m = (method || '').toLowerCase();
        if (m.includes('bank') || m.includes('brac') || m.includes('city') || m.includes('card')) {
            const acc = chartOfAccounts.find(a => a.classification === 'Asset' && (a.code === '1006' || a.code === '1030' || a.code === '1020' || a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('plc')));
            if (acc) return { code: acc.code, name: acc.name };
            return { code: '1006', name: 'Bank Account' };
        }
        if (m.includes('bkash') || m.includes('nagad') || m.includes('rocket') || m.includes('mfs')) {
            const acc = chartOfAccounts.find(a => a.classification === 'Asset' && (a.code === '1040' || a.code === '1030' || a.name.toLowerCase().includes('bkash') || a.name.toLowerCase().includes('nagad') || a.name.toLowerCase().includes('wallet')) && !a.name.toLowerCase().includes('receivable'));
            if (acc) return { code: acc.code, name: acc.name };
            return { code: '1040', name: 'bKash & Nagad Wallet' };
        }
        if (m.includes('due') || m.includes('receivable')) {
            const acc = chartOfAccounts.find(a => a.classification === 'Asset' && (a.code === '1003' || a.code === '1004' || a.code === '1050' || a.name.toLowerCase().includes('receivable')));
            if (acc) return { code: acc.code, name: acc.name };
            return { code: '1003', name: 'Accounts Receivable - Customers' };
        }
        const cashAcc = chartOfAccounts.find(a => a.classification === 'Asset' && (a.code === '1010' || a.name.toLowerCase().includes('cash')));
        if (cashAcc) return { code: cashAcc.code, name: cashAcc.name };
        return { code: '1010', name: 'Cash in Hand (Counter)' };
    };

    const activeProjectJournalsCount = useMemo(() => {
        return (journalEntries || []).filter(j => j.source === 'PROJECT_SALES' || j.source === 'PROJECT_EXPENSE' || (j.refNo && j.refNo.startsWith('PRJ-'))).length;
    }, [journalEntries]);
    // Filtered Projects
    const filteredProjects = useMemo(() => {
        return projects.filter((p) => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.nameBn && p.nameBn.includes(searchTerm)) ||
                p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.clientName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [projects, searchTerm, statusFilter]);
    // Overall Metrics
    const metrics = useMemo(() => {
        const totalProjects = projects.length;
        const totalBudget = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
        const totalSales = projects.reduce((sum, p) => sum + (p.totalSales || 0), 0);
        const totalCollected = projects.reduce((sum, p) => sum + (p.totalCollected || 0), 0);
        const totalDue = projects.reduce((sum, p) => sum + (p.totalDue || 0), 0);
        const totalExpenses = projects.reduce((sum, p) => sum + (p.totalExpenses || 0), 0);
        const totalNetProfit = totalSales - totalExpenses;
        const overallMargin = totalSales > 0 ? (totalNetProfit / totalSales) * 100 : 0;
        return {
            totalProjects,
            totalBudget,
            totalSales,
            totalCollected,
            totalDue,
            totalExpenses,
            totalNetProfit,
            overallMargin,
        };
    }, [projects]);
    // Helper for Category Bengalis
    const getCategoryLabel = (cat: string) => {
        switch (cat) {
            case 'Conveyance':
                return 'Conveyance';
            case 'Labor Charge':
                return 'Labor Charge';
            case 'Entertainment':
                return 'Entertainment';
            case 'Raw Materials Purchase':
                return 'Raw Materials Purchase';
            case 'Subcontract':
                return 'Subcontract';
            default:
                return 'Utility & Others';
        }
    };
    const handleCreateProjectSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProject.name || !newProject.clientName)
            return;
        if (editingProject) {
            updateProject(editingProject.id, {
                name: newProject.name,
                nameBn: newProject.nameBn,
                clientName: newProject.clientName,
                clientPhone: newProject.clientPhone,
                budget: Number(newProject.budget),
                status: newProject.status,
                startDate: newProject.startDate,
                endDate: newProject.endDate,
                notes: newProject.notes,
                chartOfAccountId: newProject.chartOfAccountId,
            });
            setEditingProject(null);
        }
        else if (newProject.invoiceId) {
            createProjectFromInvoice(newProject.invoiceId, {
                name: newProject.name,
                nameBn: newProject.nameBn,
                budget: Number(newProject.budget),
                status: newProject.status,
                startDate: newProject.startDate,
                endDate: newProject.endDate,
                notes: newProject.notes,
                chartOfAccountId: newProject.chartOfAccountId,
                includeAsSalesItem: newProject.includeSalesItem,
            });
            setSyncNotice(`Project created against invoice with unified Chart of Accounts.`);
            setTimeout(() => setSyncNotice(null), 1500);
        }
        else {
            const created = addProject({
                name: newProject.name,
                nameBn: newProject.nameBn,
                clientName: newProject.clientName,
                clientPhone: newProject.clientPhone,
                budget: Number(newProject.budget),
                status: newProject.status,
                startDate: newProject.startDate,
                endDate: newProject.endDate,
                notes: newProject.notes,
                chartOfAccountId: newProject.chartOfAccountId,
                salesItems: [],
                expenseItems: [],
            });

            if (newProject.autoGenerateInvoice && created && created.id) {
                const inv = generateInvoiceForProject(created.id);
                if (inv) {
                    setSyncNotice(`Project created & Sales Invoice #${inv.invoiceNo} generated.`);
                    setTimeout(() => setSyncNotice(null), 2500);
                }
            }
        }
        setShowCreateModal(false);
        setNewProject({
            name: '',
            nameBn: '',
            clientName: '',
            clientPhone: '',
            budget: 0,
            status: 'In Progress',
            startDate: new Date().toISOString().split('T')[0],
            endDate: '',
            notes: '',
            invoiceId: '',
            chartOfAccountId: defaultProjectRevAccId || 'coa-4002',
            includeSalesItem: true,
            autoGenerateInvoice: true,
        });
    };

    const handleLinkInvoiceSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!linkingProject || !linkInvoiceForm.invoiceId) return;
        linkInvoiceToProject(linkingProject.id, linkInvoiceForm.invoiceId, linkInvoiceForm.chartOfAccountId, linkInvoiceForm.syncSalesItem);
        setSyncNotice(`Linked sales invoice to project [${linkingProject.code}] with unified COA.`);
        setTimeout(() => setSyncNotice(null), 1500);
        setLinkingProject(null);
    };
    const handleAddPaymentRow = () => {
        const newId = `pay-${Date.now()}-${salesForm.paymentRows.length + 1}`;
        setSalesForm((prev) => ({
            ...prev,
            paymentRows: [
                ...prev.paymentRows,
                { id: newId, method: 'Bank Transfer', amount: '', note: '' },
            ],
        }));
    };
    const handleRemovePaymentRow = (id: string) => {
        if (salesForm.paymentRows.length <= 1)
            return;
        setSalesForm((prev) => ({
            ...prev,
            paymentRows: prev.paymentRows.filter((r) => r.id !== id),
        }));
    };
    const handleUpdatePaymentRow = (id: string, updates: Partial<SalesPaymentRow>) => {
        setSalesForm((prev) => ({
            ...prev,
            paymentRows: prev.paymentRows.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        }));
    };
    const handleAddSalesSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!showSalesModal)
            return;
        const validPaymentRows = salesForm.paymentRows.filter((r) => Number(r.amount) > 0);
        const calculatedTotal = validPaymentRows.reduce((sum, r) => sum + Number(r.amount), 0);
        if (calculatedTotal <= 0)
            return;
        const primaryMethod = validPaymentRows.length === 1
            ? validPaymentRows[0].method
            :
                'Multiple Payment Methods';
        addProjectSales(showSalesModal, {
            invoiceNo: salesForm.invoiceNo,
            description: salesForm.description || ('Project Billing / Revenue Receipt'),
            amount: calculatedTotal,
            date: salesForm.date,
            clientName: salesForm.clientName,
            note: salesForm.generalNote || validPaymentRows.map(r => `${r.method}: Tk ${r.amount}${r.note ? ` (${r.note})` : ''}`).join(' | '),
            paymentMethod: primaryMethod,
            paymentBreakdown: validPaymentRows.map((r) => ({
                id: r.id,
                method: r.method,
                amount: Number(r.amount),
                note: r.note,
            })),
        });
        setShowSalesModal(null);
    };

    const handleOpenCollectDue = (project: Project, sale: ProjectSalesItem, dueAmount: number) => {
        setCollectingDueSale({ project, sale, dueAmount });
        setAdjustAdvanceAmount(0);
        const defaultMethod = depositPaymentMethods[0]?.name || 'Cash in Hand';
        setCollectDueForm({
            amount: dueAmount,
            paymentMethod: defaultMethod,
            date: new Date().toISOString().split('T')[0],
            referenceNo: '',
            note: '',
        });
    };

    const handleConfirmCollectDue = (e: React.FormEvent) => {
        e.preventDefault();
        if (!collectingDueSale) return;
        const cashAmt = Number(collectDueForm.amount) || 0;
        const advAmt = Number(adjustAdvanceAmount) || 0;
        const totalSettling = cashAmt + advAmt;
        if (totalSettling <= 0) return;

        collectProjectDue(
            collectingDueSale.project.id,
            collectingDueSale.sale.id,
            cashAmt,
            collectDueForm.paymentMethod,
            collectDueForm.date,
            collectDueForm.note,
            collectDueForm.referenceNo,
            advAmt
        );

        setCollectingDueSale(null);
        setAdjustAdvanceAmount(0);
    };

    const handleAddExpenseRow = () => {
        const newId = `exp-${Date.now()}-${expenseRows.length + 1}`;
        setExpenseRows((prev) => [
            ...prev,
            {
                id: newId,
                category: '',
                categorySearch: '',
                amount: '',
                note: '',
                isDropdownOpen: false,
                linkedAccountId: defaultProjectExpAcc.id,
                paymentMethod: 'Cash in Hand',
            },
        ]);
    };
    const handleRemoveExpenseRow = (id: string) => {
        if (expenseRows.length <= 1)
            return;
        setExpenseRows((prev) => prev.filter((r) => r.id !== id));
    };
    const handleUpdateExpenseRow = (id: string, updates: Partial<ExpenseBreakdownRow>) => {
        setExpenseRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    };
    const handleAddExpenseSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!showExpenseModal)
            return;
        const validRows = expenseRows.filter((r) => Number(r.amount) > 0);
        if (validRows.length === 0)
            return;
        const batchId = `exp-batch-${Date.now()}`;
        const itemsToSave: Omit<ProjectExpenseItem, 'id'>[] = validRows.map((r) => {
            const defaultCOA = defaultProjectExpAcc;
            const resolvedAccountId = (r.linkedAccountId && availableExpenseAccounts.some(a => a.id === r.linkedAccountId))
                ? r.linkedAccountId
                : defaultCOA.id;
            const targetCOA = chartOfAccounts.find(a => a.id === resolvedAccountId) || defaultCOA;
            const finalCategory = r.category?.trim() || r.categorySearch?.trim() || targetCOA.name || 'Project Expense';
            const payMethod = r.paymentMethod || 'Cash in Hand';
            const payAcc = chartOfAccounts.find(a => a.name === payMethod || a.id === payMethod) || availablePaymentAccounts.find(p => p.name === payMethod) || { id: 'coa-1001', code: '1001', name: 'Cash in Hand' };

            return {
                category: finalCategory,
                categoryBn: finalCategory,
                amount: Number(r.amount),
                date: expenseDate,
                note: r.note?.trim() || expenseGeneralNote?.trim() || undefined,
                breakdownBatchId: batchId,
                linkedAccountId: targetCOA.id,
                linkedAccountCode: targetCOA.code,
                paymentMethod: payMethod,
                paymentAccountId: payAcc.id,
            };
        });
        addProjectExpenses(showExpenseModal, itemsToSave);
        setShowExpenseModal(null);
    };
    const handleOpenEdit = (p: Project) => {
        setEditingProject(p);
        setNewProject({
            name: p.name,
            nameBn: p.nameBn || '',
            clientName: p.clientName,
            clientPhone: p.clientPhone || '',
            budget: p.budget,
            status: p.status,
            startDate: p.startDate,
            endDate: p.endDate || '',
            notes: p.notes || '',
            invoiceId: p.invoiceId || '',
            chartOfAccountId: p.chartOfAccountId || 'coa-4051',
            includeSalesItem: false,
            autoGenerateInvoice: false,
        });
        setShowCreateModal(true);
    };
    return (<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-200">
            <FolderKanban className="w-6 h-6"/>
          </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {'Projects'}
              </h1>
            </div>
        </div>

        <div className="flex items-center gap-2">
          {canManageProjects && (
            <button type="button" onClick={() => {
              setEditingProject(null);
              setNewProject({
                  name: '',
                  nameBn: '',
                  clientName: '',
                  clientPhone: '',
                  budget: 0,
                  status: 'In Progress',
                  startDate: new Date().toISOString().split('T')[0],
                  endDate: '',
                  notes: '',
                  invoiceId: '',
                  chartOfAccountId: defaultProjectRevAccId || 'coa-4002',
                  includeSalesItem: true,
                  autoGenerateInvoice: true,
              });
              setShowCreateModal(true);
            }} className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer">
              <Plus className="w-4 h-4"/>
              <span>{'Create New Project'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Floating Sync Toaster (Auto-dismisses in 1.5s) */}
      {syncNotice && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-4 transition-all duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{syncNotice}</span>
          <button type="button" onClick={() => setSyncNotice(null)} className="ml-2 text-emerald-300 hover:text-white font-bold text-sm cursor-pointer">✕</button>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Project Budget */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {'Total Project Budget'}
              </p>
              <h3 className="text-xl font-black text-amber-600 mt-1">
                {profile.currencySymbol}
                {metrics.totalBudget.toLocaleString()}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                {metrics.totalProjects} {'Projects Total'}
              </p>
            </div>
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-100">
              <Wallet className="w-5 h-5"/>
            </div>
          </div>
        </div>

        {/* Total Sales/Income */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {'Total Project Income'}
              </p>
              <h3 className="text-xl font-black text-slate-900 mt-1">
                {profile.currencySymbol}
                {metrics.totalSales.toLocaleString()}
              </h3>
              <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
                <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                  Paid: {profile.currencySymbol}{metrics.totalCollected.toLocaleString()}
                </span>
                {metrics.totalDue > 0 && (
                  <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    Due: {profile.currencySymbol}{metrics.totalDue.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100">
              <TrendingUp className="w-5 h-5"/>
            </div>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {'Total Project Expense'}
              </p>
              <h3 className="text-xl font-black text-rose-600 mt-1">
                {profile.currencySymbol}
                {metrics.totalExpenses.toLocaleString()}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                {'Conveyance, labor & materials'}
              </p>
            </div>
            <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600 border border-rose-100">
              <TrendingDown className="w-5 h-5"/>
            </div>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {'Net Project Profit'}
              </p>
              <h3 className={`text-xl font-black mt-1 ${metrics.totalNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {profile.currencySymbol}
                {metrics.totalNetProfit.toLocaleString()}
              </h3>
              <p className="text-[11px] font-bold text-emerald-600 mt-1">
                {'Net Margin Revenue - Cost'}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100">
              <DollarSign className="w-5 h-5"/>
            </div>
          </div>
        </div>

        {/* Overall Profit Margin % */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {'Average Margin %'}
              </p>
              <h3 className="text-xl font-black text-amber-600 mt-1">
                {metrics.overallMargin.toFixed(1)}%
              </h3>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.max(0, metrics.overallMargin))}%` }}/>
              </div>
            </div>
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-100">
              <PieChart className="w-5 h-5"/>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input type="text" value={searchTerm} onChange={(e) => setSearchType(e.target.value)} placeholder={'Search project code, name, client...'} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20"/>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0"/>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 text-slate-700">
            <option value="ALL">{'All Status'}</option>
            <option value="In Progress">{'In Progress'}</option>
            <option value="Completed">{'Completed'}</option>
            <option value="Planning">{'Planning'}</option>
            <option value="On Hold">{'On Hold'}</option>
          </select>
        </div>
      </div>

      {/* Project Cards List */}
      <div className="space-y-4">
        {filteredProjects.length === 0 ? (<div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
            <FolderKanban className="w-12 h-12 text-slate-300 mx-auto"/>
            <h3 className="font-bold text-slate-800 text-base">
              {'No Projects Found'}
            </h3>
            <p className="text-xs text-slate-500">
              {'Create a new project or change filter.'}
            </p>
          </div>) : (filteredProjects.map((project) => {
            const isExpanded = expandedProjectId === project.id;
            // Expense Breakdown per category for this project
            const expenseCategoryBreakdown = project.expenseItems.reduce((acc, exp) => {
                acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount || 0);
                return acc;
            }, {} as Record<string, number>);
            return (<div key={project.id} className={`bg-white rounded-2xl border transition-all duration-200 group ${isExpanded
                    ? 'border-amber-300 shadow-md ring-1 ring-amber-400/20'
                    : 'border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-sm'}`}>
                {/* Main Card Header Bar (Compact ~50% Height) */}
                <div onClick={() => setExpandedProjectId(isExpanded ? null : project.id)} className="p-3 sm:px-4 sm:py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-slate-50/40 hover:bg-slate-50/80 transition-colors cursor-pointer select-none">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <h2
                        className="text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-amber-800 transition-colors line-clamp-1 sm:line-clamp-2"
                        title={isBn && project.nameBn ? project.nameBn : project.name}
                      >
                        {isBn && project.nameBn ? project.nameBn : project.name}
                      </h2>

                      {/* Status pill (always visible) */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        project.status === 'Completed'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : project.status === 'In Progress'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : project.status === 'On Hold'
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}>
                        {isBn && project.statusBn ? project.statusBn : project.status}
                      </span>

                      {/* Mark 1 & 2: Project Code, Invoice & Unified COA Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded-md shrink-0">
                          {project.code}
                        </span>
                        {project.invoiceNo && (
                          <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1" title={`Linked to Sales Invoice #${project.invoiceNo}`}>
                            <Receipt className="w-3 h-3 text-indigo-500" />
                            Inv: #{project.invoiceNo}
                          </span>
                        )}
                        {(() => {
                          const coa = project.chartOfAccountId
                            ? chartOfAccounts.find(a => a.id === project.chartOfAccountId)
                            : projectRevAcc;
                          const code = coa?.code || '4051';
                          const name = coa?.name || 'Project Sales Income';
                          return (
                            <span className={`font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md shrink-0 ${isExpanded ? 'inline-block' : 'hidden md:inline-block'}`} title={`Unified Chart of Accounts Revenue Account #${code} (${name})`}>
                              COA: [{code}] {name}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex items-center gap-x-3 gap-y-1.5 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1 font-semibold text-slate-700 shrink-0">
                        <User className="w-3.5 h-3.5 text-slate-400"/>
                        <span className="truncate max-w-[160px] sm:max-w-none">{project.clientName}</span>
                      </span>
                      {project.clientPhone && (
                        <span className="flex items-center gap-1 font-mono text-[11px] text-slate-500 shrink-0">
                          <Phone className="w-3 h-3 text-slate-400"/>
                          {project.clientPhone}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] shrink-0">
                        <Calendar className="w-3 h-3 text-slate-400"/>
                        {project.startDate} {project.endDate ? `➔ ${project.endDate}` : ''}
                      </span>
                      {/* Budget Badge */}
                      <span className="inline-flex items-center gap-1 font-extrabold text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg shrink-0">
                        <Wallet className="w-3 h-3 text-amber-600"/>
                        <span>Budget: {profile.currencySymbol}{(Number(project.budget) || 0).toLocaleString()}</span>
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Profitability Numbers Bar + Actions */}
                  <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 justify-between xl:justify-end flex-wrap xl:flex-nowrap">
                    {/* Profitability Numbers Bar (Compact & Sleek) */}
                    <div className="flex items-center gap-3 sm:gap-4 bg-white px-3 py-1.5 rounded-xl border border-slate-200/90 shadow-2xs">
                      <div>
                        <p className="text-[9px] font-bold text-amber-600 uppercase leading-none mb-0.5">
                          {'Budget'}
                        </p>
                        <p className="text-xs sm:text-sm font-black text-amber-700 leading-none">
                          {profile.currencySymbol}
                          {(Number(project.budget) || 0).toLocaleString()}
                        </p>
                      </div>

                      <div className="h-6 w-px bg-slate-200"/>

                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-0.5">
                          {'Sales Income'}
                        </p>
                        <p className="text-xs sm:text-sm font-black text-slate-900 leading-none">
                          {profile.currencySymbol}
                          {project.totalSales.toLocaleString()}
                        </p>
                        {(project.totalDue || 0) > 0 && (
                          <p className="text-[9px] font-extrabold text-amber-600 mt-0.5 leading-none">
                            Due: {profile.currencySymbol}{(project.totalDue || 0).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className="h-6 w-px bg-slate-200"/>

                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-0.5">
                          {'Total Cost'}
                        </p>
                        <p className="text-xs sm:text-sm font-black text-rose-600 leading-none">
                          {profile.currencySymbol}
                          {project.totalExpenses.toLocaleString()}
                        </p>
                      </div>

                      <div className="h-6 w-px bg-slate-200"/>

                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-0.5">
                          {'Net Profit'}
                        </p>
                        <p className={`text-xs sm:text-sm font-black leading-none ${project.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {profile.currencySymbol}
                          {project.netProfit.toLocaleString()}
                        </p>
                      </div>

                      <div className="hidden sm:block h-6 w-px bg-slate-200"/>

                      <div className="hidden sm:block">
                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-0.5">
                          {'Margin %'}
                        </p>
                        <p className="text-[11px] font-extrabold text-amber-600 leading-none">
                          {project.profitMargin.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {!project.invoiceId ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const inv = generateInvoiceForProject(project.id);
                              if (inv) {
                                setSyncNotice(`Generated Sales Invoice #${inv.invoiceNo} for project [${project.code}]`);
                                setTimeout(() => setSyncNotice(null), 2500);
                              }
                            }}
                            className="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-300 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="Generate an official Sales Invoice (DCC-INV) in Sales & Orders"
                          >
                            <FileText className="w-3 h-3 text-emerald-600" />
                            <span>+ Generate Invoice</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setLinkingProject(project);
                              setLinkInvoiceForm({
                                invoiceId: '',
                                chartOfAccountId: project.chartOfAccountId || 'coa-4051',
                                syncSalesItem: project.totalSales === 0,
                              });
                            }}
                            className="px-2 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1"
                            title="Link this project to an existing Sales Invoice & unify COA"
                          >
                            <Receipt className="w-3 h-3 text-indigo-600" />
                            <span>+ Link Invoice</span>
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenInvoiceModal && project.invoiceId) {
                                onOpenInvoiceModal(project.invoiceId, 'invoice', { autoPrint: false });
                              } else {
                                window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'sales' }));
                              }
                            }}
                            className="px-2 py-1 text-[10px] font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1"
                            title={`Linked to Sales Invoice #${project.invoiceNo} (Click to View / Print Invoice)`}
                          >
                            <Printer className="w-3 h-3 text-indigo-600" />
                            <span>#{project.invoiceNo}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              syncProjectInvoice(project.id);
                              setSyncNotice(`Invoice #${project.invoiceNo} synced with current project sales.`);
                              setTimeout(() => setSyncNotice(null), 1500);
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="Sync / Update Linked Invoice with Project Sales"
                          >
                            <RotateCw className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Unlink Sales Invoice #${project.invoiceNo} from this project?`)) {
                                unlinkInvoiceFromProject(project.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Unlink Sales Invoice"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {canManageProjects && (
                        <button type="button" onClick={() => {
                          setShowSalesModal(project.id);
                          setSalesForm({
                              invoiceNo: project.invoiceNo || '',
                              description: '',
                              date: new Date().toISOString().split('T')[0],
                              clientName: project.clientName,
                              generalNote: '',
                              paymentRows: [
                                  { id: `pay-${Date.now()}-1`, method: 'Cash', amount: '', note: '' },
                              ],
                          });
                        }} className="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer">
                          + {'Add Sales'}
                        </button>
                      )}

                      {canManageProjects && (
                        <button type="button" onClick={() => {
                          const isSalesRevProj = (() => {
                              const coaId = project.chartOfAccountId;
                              const matched = (chartOfAccounts || []).find(a => a.id === coaId || a.code === coaId);
                              const code = matched?.code || project.projectAccountCode || '';
                              const name = (matched?.name || '').toLowerCase();
                              return code === '4001' || name.includes('sales revenue') || (name.includes('বিক্রয় আয়') && !name.includes('প্রজেক্ট'));
                          })();
                          const initialCoa = isSalesRevProj
                              ? ((chartOfAccounts || []).find(a => a.classification === 'Expense' && a.code !== '5206' && !a.name.toLowerCase().includes('project') && a.isActive !== false) || projectExpAcc)
                              : projectExpAcc;

                          setShowExpenseModal(project.id);
                          setExpenseDate(new Date().toISOString().split('T')[0]);
                          setExpenseGeneralNote('');
                          setExpenseRows([
                              {
                                  id: `exp-${Date.now()}-1`,
                                  category: '',
                                  categorySearch: '',
                                  amount: '',
                                  note: '',
                                  isDropdownOpen: false,
                                  linkedAccountId: initialCoa.id,
                                  paymentMethod: 'Cash in Hand',
                              },
                          ]);
                        }} className="px-2 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer">
                          + {'Add Expense'}
                        </button>
                      )}

                      {canManageProjects && (
                        <button type="button" onClick={() => handleOpenEdit(project)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer" title="Edit Project">
                          <Edit2 className="w-3.5 h-3.5"/>
                        </button>
                      )}

                      {canManageProjects && (
                        <button type="button" onClick={() => setProjectToDelete(project)} className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer" title="Delete Project">
                          <Trash2 className="w-3.5 h-3.5"/>
                        </button>
                      )}

                      <button type="button" onClick={() => setExpandedProjectId(isExpanded ? null : project.id)} className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors cursor-pointer" title={isExpanded ? 'Collapse' : 'Expand full details'}>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mark 3: Category-wise Expense Quick Bar (Hidden first, shown on hover or click) */}
                <div className={`px-4 sm:px-5 py-2 border-t border-slate-100 bg-slate-50/40 text-xs transition-all duration-200 ${isExpanded ? 'flex' : 'hidden group-hover:flex'} items-center justify-between gap-3 flex-wrap animate-in fade-in duration-150`}>
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    <span className="font-bold text-slate-700 text-[11px] shrink-0">
                      {'Expense Breakdown:'}
                    </span>

                    {/* Breakdown Live Search Input Box */}
                    <div className="relative flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none"/>
                      <input type="text" value={breakdownSearchTerm} onChange={(e) => setBreakdownSearchTerm(e.target.value)} placeholder={'Filter breakdown...'} className="pl-7 pr-6 py-1 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold text-slate-800 w-32 sm:w-44 shadow-2xs"/>
                      {breakdownSearchTerm && (<button type="button" onClick={() => setBreakdownSearchTerm('')} className="absolute right-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer">
                          ✕
                        </button>)}
                    </div>

                    {Object.keys(expenseCategoryBreakdown).length === 0 ? (<span className="text-[11px] text-slate-400 font-medium italic">
                        {'No expenses recorded yet'}
                      </span>) : (Object.entries(expenseCategoryBreakdown)
                    .filter(([catName]) => !breakdownSearchTerm ||
                    catName.toLowerCase().includes(breakdownSearchTerm.toLowerCase()))
                    .map(([catName, amt]) => {
                      const coa = getResolvedCOA(catName);
                      return (<span key={catName} className="bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs" title={`Mapped to COA Account [${coa.code}] ${coa.name}`}>
                             <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"/>
                             <span className="font-mono text-[10px] text-slate-400 font-bold">[{coa.code}]</span>
                             <span>{catName}:</span>
                             <span className="font-extrabold text-slate-900 font-mono">
                               {profile.currencySymbol}{(amt as number).toLocaleString()}
                             </span>
                           </span>);
                    }))}
                  </div>

                  {!isExpanded && (<span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                      {'Click to expand full ledger ➔'}
                    </span>)}
                </div>

                {/* Expanded Itemized View */}
                {isExpanded && (<div className="p-5 border-t border-slate-200 bg-slate-50/60 space-y-5 animate-in fade-in duration-150">
                    {/* Project Budget & Financial Overview Banner */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-200">
                          <Wallet className="w-5 h-5"/>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {'Estimated Project Budget'}
                          </p>
                          <h4 className="text-lg font-black text-amber-700 leading-tight">
                            {profile.currencySymbol}{(Number(project.budget) || 0).toLocaleString()}
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs">
                        <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                          <span className="text-slate-500 font-semibold">Total Billed: </span>
                          <span className="font-extrabold text-slate-900 font-mono">
                            {profile.currencySymbol}{project.totalSales.toLocaleString()}
                          </span>
                        </div>
                        <div className="bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                          <span className="text-rose-600 font-semibold">Total Expenses: </span>
                          <span className="font-extrabold text-rose-700 font-mono">
                            {profile.currencySymbol}{project.totalExpenses.toLocaleString()}
                          </span>
                        </div>
                        <div className="bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                          <span className="text-emerald-700 font-semibold">Net Profit: </span>
                          <span className="font-extrabold text-emerald-800 font-mono">
                            {profile.currencySymbol}{project.netProfit.toLocaleString()}
                          </span>
                        </div>
                        <div className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                          <span className="text-blue-700 font-semibold">Budget Balance: </span>
                          <span className={`font-extrabold font-mono ${(Number(project.budget) || 0) - project.totalExpenses >= 0 ? 'text-blue-800' : 'text-rose-700'}`}>
                            {profile.currencySymbol}{((Number(project.budget) || 0) - project.totalExpenses).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Itemized Sales Table */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4 text-emerald-600"/>
                            <span>{'Itemized Project Income'}</span>
                          </h4>
                          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            {profile.currencySymbol}
                            {project.totalSales.toLocaleString()}
                          </span>
                        </div>

                        {project.salesItems.length === 0 ? (<p className="text-xs text-slate-400 italic py-3 text-center">
                            {'No sales entries recorded yet.'}
                          </p>) : (<div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="text-[10px] text-slate-400 font-bold border-b border-slate-100">
                                  <th className="py-1.5">Date & Description</th>
                                  <th className="py-1.5 text-right">Tk</th>
                                  <th className="py-1.5 text-center">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {project.salesItems.map((sales) => {
                                    const itemDue = sales.dueAmount !== undefined
                                      ? Number(sales.dueAmount)
                                      : (() => {
                                          const dueRow = (sales.paymentBreakdown || []).find(b => {
                                            const m = (b.method || '').toLowerCase();
                                            return m.includes('due') || m.includes('receivable');
                                          });
                                          const dueInitial = dueRow ? Number(dueRow.amount) || 0 : 0;
                                          const pastCols = (sales.collections || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
                                          return Math.max(0, dueInitial - pastCols);
                                        })();

                                    return (<tr key={sales.id} className="hover:bg-slate-50">
                                      <td className="py-2 max-w-sm">
                                        <div className="font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                          <span className="line-clamp-2" title={sales.description}>{sales.description}</span>
                                          {itemDue > 0 ? (
                                            <span className="inline-flex items-center text-[9px] font-bold bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                                              Due Remaining: {profile.currencySymbol}{itemDue.toLocaleString()}
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center text-[9px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                                              ✓ Paid
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                          {sales.date} {sales.invoiceNo ? `• ${sales.invoiceNo}` : ''}
                                        </div>
                                        {sales.paymentBreakdown && sales.paymentBreakdown.length > 0 ? (<div className="flex flex-wrap gap-1 mt-1">
                                            {sales.paymentBreakdown.map((pb, pidx) => {
                                              const isDue = (pb.method || '').toLowerCase().includes('due') || (pb.method || '').toLowerCase().includes('receivable');
                                              return (
                                                <span key={pidx} className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${isDue ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                                                  <span>{pb.method}:</span>
                                                  <span className="font-mono">{profile.currencySymbol}{pb.amount.toLocaleString()}</span>
                                                  {pb.note && <span className="text-slate-500 font-normal">({pb.note})</span>}
                                                </span>
                                              );
                                            })}
                                          </div>) : sales.paymentMethod ? (<div className="mt-1">
                                            <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-1.5 py-0.5 rounded">
                                              {sales.paymentMethod}
                                            </span>
                                          </div>) : null}

                                        {sales.collections && sales.collections.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {sales.collections.map((col, cidx) => (
                                              <span key={cidx} className="inline-flex items-center gap-1 text-[9px] bg-blue-50 text-blue-800 font-semibold px-1.5 py-0.5 rounded border border-blue-200">
                                                <span>✓ Collected {profile.currencySymbol}{col.amount.toLocaleString()} via {col.paymentMethod} ({col.date})</span>
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-2 text-right font-extrabold text-slate-900">
                                        {profile.currencySymbol}
                                        {sales.amount.toLocaleString()}
                                      </td>
                                      <td className="py-2 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                          {itemDue > 0 && (
                                            <button
                                              type="button"
                                              onClick={() => handleOpenCollectDue(project, sales, itemDue)}
                                              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded px-2 py-0.5 shadow-2xs transition-colors cursor-pointer"
                                              title="Collect / Adjust Project Due"
                                            >
                                              <DollarSign className="w-3 h-3" />
                                              <span>+ Collect Due</span>
                                            </button>
                                          )}
                                          <button type="button" onClick={() => deleteProjectSales(project.id, sales.id)} className="text-slate-300 hover:text-rose-600 p-1" title="Delete Sale">
                                            <Trash2 className="w-3.5 h-3.5"/>
                                          </button>
                                        </div>
                                      </td>
                                    </tr>);
                                  })}
                              </tbody>
                            </table>
                          </div>)}
                      </div>

                      {/* Itemized Expense Table */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <TrendingDown className="w-4 h-4 text-rose-600"/>
                            <span>{'Itemized Project Expenses'}</span>
                          </h4>
                          <span className="text-[10px] font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                            {profile.currencySymbol}
                            {project.totalExpenses.toLocaleString()}
                          </span>
                        </div>

                        {project.expenseItems.length === 0 ? (<p className="text-xs text-slate-400 italic py-3 text-center">
                            {'No expense entries recorded yet.'}
                          </p>) : (<div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="text-[10px] text-slate-400 font-bold border-b border-slate-100">
                                  <th className="py-1.5">& Description</th>
                                  <th className="py-1.5 text-right">Tk</th>
                                  <th className="py-1.5 text-center">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {project.expenseItems.map((exp) => (<tr key={exp.id} className="hover:bg-slate-50">
                                    <td className="py-2">
                                      <div className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"/>
                                        <span>{exp.categoryBn || exp.category}</span>
                                        {(() => {
                                          const coa = getResolvedCOA(exp.category, exp.note);
                                          return (
                                            <span className="font-mono text-[9px] text-slate-500 font-bold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded" title={`Linked to COA [${coa.code}] ${coa.name}`}>
                                              [{coa.code}]
                                            </span>
                                          );
                                        })()}
                                      </div>
                                      {exp.note && (<div className="text-[11px] text-slate-700 pl-3 font-medium bg-amber-50/60 py-0.5 px-1.5 rounded border-l-2 border-amber-400 my-0.5">
                                          📝 {exp.note}
                                        </div>)}
                                      <div className="text-[10px] text-slate-400 pl-3">{exp.date}</div>
                                    </td>
                                    <td className="py-2 text-right font-extrabold text-rose-600">
                                      {profile.currencySymbol}
                                      {exp.amount.toLocaleString()}
                                    </td>
                                    <td className="py-2 text-center">
                                      <button type="button" onClick={() => deleteProjectExpense(project.id, exp.id)} className="text-slate-300 hover:text-rose-600 p-1">
                                        <Trash2 className="w-3.5 h-3.5"/>
                                      </button>
                                    </td>
                                  </tr>))}
                              </tbody>
                            </table>
                          </div>)}
                      </div>
                    </div>
                  </div>)}
              </div>);
        }))}
      </div>

      {/* CREATE / EDIT PROJECT MODAL */}
      {showCreateModal && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateProjectSubmit} className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingProject
                ?
                    'Edit Project'
                :
                    'Create New Project'}
              </h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {!editingProject && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-indigo-950 flex items-center gap-1.5 text-xs">
                      <Receipt className="w-4 h-4 text-indigo-600" />
                      <span>Create Against Sales Invoice (Optional)</span>
                    </label>
                    <span className="text-[10px] font-semibold text-indigo-600 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                      Unified COA
                    </span>
                  </div>

                  <select
                    value={newProject.invoiceId}
                    onChange={(e) => {
                      const selectedInvId = e.target.value;
                      if (!selectedInvId) {
                        setNewProject(prev => ({
                          ...prev,
                          invoiceId: '',
                        }));
                        return;
                      }
                      const inv = invoices.find(i => i.id === selectedInvId);
                      if (inv) {
                        setNewProject(prev => ({
                          ...prev,
                          invoiceId: inv.id,
                          name: prev.name || `${inv.customerName} - Project #${inv.invoiceNo}`,
                          clientName: inv.customerName,
                          clientPhone: inv.customerPhone || prev.clientPhone,
                          budget: inv.grandTotal || prev.budget,
                          startDate: inv.date || prev.startDate,
                          chartOfAccountId: inv.chartOfAccountId || prev.chartOfAccountId || 'coa-4051',
                        }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-xl text-xs font-bold text-indigo-950 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- None (Create Independent Project) --</option>
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNo} — {inv.customerName} (Total: {profile.currencySymbol}{inv.grandTotal.toLocaleString()} | Due: {profile.currencySymbol}{inv.dueAmount.toLocaleString()}) {inv.projectId ? ' [Already Linked]' : ''}
                      </option>
                    ))}
                  </select>

                  {newProject.invoiceId && (() => {
                    const selectedInv = invoices.find(i => i.id === newProject.invoiceId);
                    if (!selectedInv) return null;
                    return (
                      <div className="space-y-2 pt-1 border-t border-indigo-200/60">
                        <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-indigo-100 text-center">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Invoice Total</span>
                            <span className="font-extrabold text-slate-900 text-xs">{profile.currencySymbol}{selectedInv.grandTotal.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Collected / Paid</span>
                            <span className="font-extrabold text-emerald-600 text-xs">{profile.currencySymbol}{selectedInv.paidAmount.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Due Amount</span>
                            <span className="font-extrabold text-amber-600 text-xs">{profile.currencySymbol}{selectedInv.dueAmount.toLocaleString()}</span>
                          </div>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={newProject.includeSalesItem}
                            onChange={(e) => setNewProject(prev => ({ ...prev, includeSalesItem: e.target.checked }))}
                            className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="font-bold text-slate-800 text-[11px]">
                            Import invoice billing into project sales (Total: {profile.currencySymbol}{selectedInv.grandTotal.toLocaleString()})
                          </span>
                        </label>
                      </div>
                    );
                  })()}
                  {!newProject.invoiceId && (
                    <div className="pt-2 border-t border-indigo-200/60">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newProject.autoGenerateInvoice}
                          onChange={(e) => setNewProject(prev => ({ ...prev, autoGenerateInvoice: e.target.checked }))}
                          className="mt-0.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-indigo-950 block">
                            Auto-generate Official Sales Invoice in Sales & Orders
                          </span>
                          <span className="text-[11px] text-indigo-700">
                            An official invoice (DCC-INV) will be automatically created and linked in Sales & Orders upon saving.
                          </span>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* UNIFIED CHART OF ACCOUNTS REVENUE HEAD */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
                    <Landmark className="w-4 h-4 text-emerald-600" />
                    <span>Unified Chart of Accounts Head *</span>
                  </label>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Single COA Entry
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 font-medium">
                  Project revenue and linked sales invoice will be recorded under this single COA revenue head.
                </p>
                <select
                  value={newProject.chartOfAccountId}
                  onChange={(e) => setNewProject({ ...newProject, chartOfAccountId: e.target.value })}
                  className="w-full px-3 py-2 border border-emerald-300 bg-white rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  {availableRevenueAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      [{acc.code}] {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Project Name *'}
                  </label>
                  <input type="text" required value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} placeholder="e.g. Port City Univ 3D Signage Project" className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"/>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Bengali Name'}
                  </label>
                  <input type="text" value={newProject.nameBn} onChange={(e) => setNewProject({ ...newProject, nameBn: e.target.value })} placeholder="Project name in Bengali (optional)" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Client Name *'}
                  </label>
                  <input type="text" required value={newProject.clientName} onChange={(e) => setNewProject({ ...newProject, clientName: e.target.value })} placeholder="e.g. BSRM Steel Ltd" className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"/>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Client Phone'}
                  </label>
                  <input type="tel" value={newProject.clientPhone} onChange={(e) => setNewProject({ ...newProject, clientPhone: e.target.value })} placeholder="01819-XXXXXX" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Project Budget'}
                  </label>
                  <input type="number" min="0" value={newProject.budget} onChange={(e) => setNewProject({ ...newProject, budget: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"/>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Status'}
                  </label>
                  <select value={newProject.status} onChange={(e) => setNewProject({ ...newProject, status: e.target.value as any })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold">
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Planning">Planning</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Start Date'}
                  </label>
                  <input type="date" value={newProject.startDate} onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'End Date'}
                  </label>
                  <input type="date" value={newProject.endDate} onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Notes / Description'}
                </label>
                <textarea
                  rows={2}
                  value={newProject.notes}
                  onChange={(e) => setNewProject({ ...newProject, notes: e.target.value })}
                  placeholder="Additional project details or work order references..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {'Cancel'}
              </button>
              <button type="submit" className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm">
                {editingProject ? ('Update') : 'Save Project'}
              </button>
            </div>
          </form>
        </div>)}

      {/* ADD SALES MODAL - PAYMENT METHOD BREAKDOWN WITH NOTE PER ROW */}
      {showSalesModal && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleAddSalesSubmit} className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <TrendingUp className="w-4 h-4"/>
                </div>
                <div>
                  <div>{'Add Project Sales Income'}</div>
                  <div className="text-[11px] font-normal text-slate-500">
                    {'Sales Amount Breakdown by Payment Method'}
                  </div>
                </div>
              </h3>
              <button type="button" onClick={() => setShowSalesModal(null)} className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 rounded-lg hover:bg-slate-100">
                ✕
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Invoice / Bill Ref No.'}
                  </label>
                  <input type="text" value={salesForm.invoiceNo} onChange={(e) => setSalesForm({ ...salesForm, invoiceNo: e.target.value })} placeholder="e.g. DCC-INV-2026-1003" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Date'}
                  </label>
                  <input type="date" value={salesForm.date} onChange={(e) => setSalesForm({ ...salesForm, date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium"/>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Description *'}
                </label>
                <input type="text" required value={salesForm.description} onChange={(e) => setSalesForm({ ...salesForm, description: e.target.value })} placeholder="e.g. 3D Acrylic Lettering Job Billing / Milestone 1" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
              </div>

              {/* SALES AMOUNT BREAKDOWN BY PAYMENT METHOD */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600"/>
                    <span>{'Sales Amount Payment Method Breakdown *'}</span>
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {'Split across Cash, Bank, Mobile etc.'}
                  </span>
                </div>

                <div className="space-y-3">
                  {salesForm.paymentRows.map((pRow, idx) => (<div key={pRow.id} className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-slate-600 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-black">
                            #{idx + 1}
                          </span>
                          <span>{`Payment Method #${idx + 1}`}</span>
                        </span>

                        {salesForm.paymentRows.length > 1 && (<button type="button" onClick={() => handleRemovePaymentRow(pRow.id)} className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors" title="Remove row">
                            <Trash2 className="w-3.5 h-3.5"/>
                          </button>)}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">
                            {'Payment Method'}
                          </label>
                          <select value={pRow.method} onChange={(e) => handleUpdatePaymentRow(pRow.id, { method: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-semibold text-slate-800 bg-white">
                            {paymentMethodOptions.map((opt) => (<option key={opt.id} value={opt.id}>
                                {opt.nameEn}
                              </option>))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">
                            {"AmountTk  *"}
                          </label>
                          <input type="number" min="1" required value={pRow.amount} onChange={(e) => handleUpdatePaymentRow(pRow.id, { amount: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="0" className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-bold text-emerald-700 bg-white"/>
                        </div>
                      </div>

                      {/* Under each row: Note / Description option */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                          {'Note / Reference / Description'}
                        </label>
                        <input type="text" value={pRow.note} onChange={(e) => handleUpdatePaymentRow(pRow.id, { note: e.target.value })} placeholder={'e.g. Bank slip no / Trx ID / Cheque #...'} className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px] bg-slate-50 focus:bg-white text-slate-800"/>
                      </div>

                      {/* Real-time COA Alignment indicator */}
                      {(() => {
                        const payCOA = getResolvedPaymentCOA(pRow.method);
                        return (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 flex-wrap">
                            <span className="text-emerald-700">COA Debit:</span>
                            <span className="font-mono font-black text-slate-800">[{payCOA.code}] {payCOA.name}</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-blue-700">COA Credit:</span>
                            <span className="font-mono font-black text-slate-800">[{projectRevAcc.code}] {projectRevAcc.name}</span>
                          </div>
                        );
                      })()}
                    </div>))}
                </div>

                <div className="flex justify-between items-center pt-1">
                  <button type="button" onClick={handleAddPaymentRow} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-100/70 hover:bg-emerald-200 rounded-xl transition-colors cursor-pointer">
                    <Plus className="w-3.5 h-3.5"/>
                    <span>{'+ Add Payment Method'}</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Sales Total Display */}
              <div className="bg-emerald-50 border-2 border-emerald-200 p-3.5 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 block">
                    {'Total Sales Amount:'}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-medium">
                    {salesForm.paymentRows
                .filter((r) => Number(r.amount) > 0)
                .map((r) => `${r.method} (Tk ${Number(r.amount).toLocaleString()})`)
                .join(' + ') || ('Enter amount')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-emerald-800 font-mono">
                    *{profile.currencySymbol}{totalSalesAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button type="button" onClick={() => setShowSalesModal(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                {'Cancel'}
              </button>
              <button type="submit" disabled={totalSalesAmount <= 0} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all">
                {`Record Sales (*${totalSalesAmount.toLocaleString()})`}
              </button>
            </div>
          </form>
        </div>)}

      {/* ADD EXPENSE MODAL - MULTI-BREAKDOWN WITH REAL-TIME SUM & NOTE PER ROW */}
      {showExpenseModal && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleAddExpenseSubmit} className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700">
                  <TrendingDown className="w-4 h-4"/>
                </div>
                <div>
                  <div>{'Record Project Expense Breakdown'}</div>
                  <div className="text-[11px] font-normal text-slate-500">
                    {'Multi-row expense categories, amounts & notes per row'}
                  </div>
                </div>
              </h3>
              <button type="button" onClick={() => setShowExpenseModal(null)} className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 rounded-lg hover:bg-slate-100">
                ✕
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Expense Date'}
                  </label>
                  <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium"/>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Voucher / Ref No. (Optional)'}
                  </label>
                  <input type="text" value={expenseGeneralNote} onChange={(e) => setExpenseGeneralNote(e.target.value)} placeholder="e.g. VOUCHER-OCT-004" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>
              </div>

              {/* MULTI-ROW BREAKDOWN ITEMS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-rose-600"/>
                    <span>{'Expense Breakdown Rows *'}</span>
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {'Type expense name & amount freely'}
                  </span>
                </div>

                {expenseRows.map((eRow, idx) => {
                  return (<div key={eRow.id} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5 relative">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center text-[10px] font-black">
                            #{idx + 1}
                          </span>
                          <span>{`Expense Row #${idx + 1}`}</span>
                        </span>

                        {expenseRows.length > 1 && (<button type="button" onClick={() => handleRemoveExpenseRow(eRow.id)} className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer" title="Remove row">
                            <Trash2 className="w-3.5 h-3.5"/>
                          </button>)}
                      </div>

                      {/* Row Inputs: Category (Free Text Input) + Amount */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">
                            {'Expense Name / Category (Optional)'}
                          </label>
                          <input
                            type="text"
                            value={eRow.category}
                            onChange={(e) => handleUpdateExpenseRow(eRow.id, {
                              category: e.target.value,
                              categorySearch: e.target.value,
                            })}
                            placeholder="e.g. Labour Charge, Transport, Site fitting (Default: Project Expense)"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">
                            {"Amount (Tk) *"}
                          </label>
                          <input type="number" min="1" required value={eRow.amount} onChange={(e) => handleUpdateExpenseRow(eRow.id, {
                        amount: e.target.value === '' ? '' : Number(e.target.value),
                    })} placeholder="0" className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-black text-rose-600 bg-white"/>
                        </div>
                      </div>

                      {/* PROTETA ROW ER NECE NOTE / DESCRIPTION LIKAR OPTION */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          {'Note / Description'}
                        </label>
                        <input type="text" value={eRow.note} onChange={(e) => handleUpdateExpenseRow(eRow.id, { note: e.target.value })} placeholder={'e.g. Additional details, bill voucher ref, specific notes...'} className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-[11px] bg-white text-slate-800 placeholder-slate-400"/>
                      </div>

                      {/* Dynamic COA & Payment Account Linking */}
                      {(() => {
                        const defaultCOAId = defaultProjectExpAcc.id;
                        const selectedCOAId = (eRow.linkedAccountId && availableExpenseAccounts.some(a => a.id === eRow.linkedAccountId))
                            ? eRow.linkedAccountId
                            : defaultCOAId;
                        const currentPayment = eRow.paymentMethod || 'Cash in Hand';

                        return (
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-amber-600" />
                                <span>🔗 Linked Accounting Accounts</span>
                              </span>
                              <span className="text-[9px] text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                Default: [{defaultProjectExpAcc.code}] {defaultProjectExpAcc.name}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {/* Debit Account: COA Expense Head */}
                              <div>
                                <label className="text-[10px] font-bold text-rose-700 flex items-center gap-1 mb-1">
                                  <span>Debit Account (Expense Head) *</span>
                                </label>
                                <select
                                  value={selectedCOAId}
                                  onChange={(e) => {
                                    handleUpdateExpenseRow(eRow.id, { linkedAccountId: e.target.value });
                                  }}
                                  className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-rose-50/50 border border-rose-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
                                >
                                  {availableExpenseAccounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                      [{acc.code}] {acc.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Credit Account: Payment Source */}
                              <div>
                                <label className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 mb-1">
                                  <span>Paid Via / Credit (Payment Source) *</span>
                                </label>
                                <select
                                  value={currentPayment}
                                  onChange={(e) => {
                                    handleUpdateExpenseRow(eRow.id, { paymentMethod: e.target.value });
                                  }}
                                  className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-emerald-50/50 border border-emerald-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                >
                                  {availablePaymentAccounts.map((pm) => (
                                    <option key={pm.id} value={pm.name}>
                                      [{pm.code}] {pm.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>);
            })}

                {/* Add Row Button */}
                <div className="flex justify-between items-center pt-1">
                  <button type="button" onClick={handleAddExpenseRow} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-colors cursor-pointer">
                    <Plus className="w-3.5 h-3.5"/>
                    <span>{'+ Add Breakdown Row'}</span>
                  </button>
                </div>
              </div>

              {/* DYNAMIC SUM DISPLAY: Expense Amount *2100 taka hobe */}
              <div className="bg-rose-50 border-2 border-rose-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <span className="text-xs font-extrabold text-rose-900 block">
                    {'Total Expense Amount:'}
                  </span>
                  <div className="text-[11px] text-rose-700 font-medium flex flex-wrap gap-1 mt-0.5">
                    {expenseRows
                .filter((r) => Number(r.amount) > 0)
                .map((r) => `${r.category || ('Item')} (Tk ${Number(r.amount).toLocaleString()})`)
                .join(' + ') || ('Enter breakdown amounts')}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-2xl font-black text-rose-600 font-mono">
                    *{profile.currencySymbol}{totalExpenseAmount.toLocaleString()}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 block">
                    {'BDT'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button type="button" onClick={() => setShowExpenseModal(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                {'Cancel'}
              </button>
              <button type="submit" disabled={totalExpenseAmount <= 0} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all">
                {`Record Expenses (*${totalExpenseAmount.toLocaleString()})`}
              </button>
            </div>
          </form>
        </div>)}

      {/* COLLECT PROJECT DUE MODAL (Sales Invoice Style) */}
      {collectingDueSale && (() => {
        const modalCustomer = customers.find(c => {
          if (collectingDueSale.sale.invoiceNo) {
            const inv = invoices.find(i => i.invoiceNo === collectingDueSale.sale.invoiceNo);
            if (inv && isInvoiceMatchingCustomer(inv, c)) return true;
          }
          if (collectingDueSale.project.invoiceNo || collectingDueSale.project.invoiceId) {
            const inv = invoices.find(i => (collectingDueSale.project.invoiceId && i.id === collectingDueSale.project.invoiceId) || (collectingDueSale.project.invoiceNo && i.invoiceNo === collectingDueSale.project.invoiceNo));
            if (inv && isInvoiceMatchingCustomer(inv, c)) return true;
          }
          const cName = (c.name || '').toLowerCase().trim();
          const pClient = (collectingDueSale.project.clientName || '').toLowerCase().trim();
          if (pClient && cName && (cName === pClient || cName.includes(pClient) || pClient.includes(cName))) return true;
          const cPhone = (c.phone || '').replace(/\D/g, '');
          const pPhone = (collectingDueSale.project.clientPhone || '').replace(/\D/g, '');
          if (pPhone && cPhone && cPhone === pPhone) return true;
          if (c.company && collectingDueSale.project.name && collectingDueSale.project.name.toLowerCase().includes(c.company.toLowerCase())) return true;
          return false;
        });

        const availableAdvance = Number(modalCustomer?.advanceBalance) || 0;
        const maxAdvanceCanUse = Math.min(availableAdvance, collectingDueSale.dueAmount);
        const remainingDueForChannel = Math.max(0, collectingDueSale.dueAmount - adjustAdvanceAmount);
        const cashAmountNum = Number(collectDueForm.amount) || 0;
        const totalSettling = cashAmountNum + (adjustAdvanceAmount || 0);

        // Prior payments list (from item collections and initial non-due breakdown payments)
        const priorCollections = (collectingDueSale.sale.collections || []).map(col => ({
          id: col.id,
          channel: col.paymentMethod,
          amount: col.amount,
          date: col.date,
          description: col.note || (col.referenceNo ? `Ref: ${col.referenceNo}` : ''),
        }));

        const initialNonDueBreakdowns = (collectingDueSale.sale.paymentBreakdown || []).filter(pb => {
          const m = (pb.method || '').toLowerCase();
          return !m.includes('due') && !m.includes('receivable') && Number(pb.amount) > 0;
        }).map((pb, idx) => ({
          id: `initial-pb-${idx}`,
          channel: pb.method,
          amount: Number(pb.amount) || 0,
          date: collectingDueSale.sale.date,
          description: pb.note || 'Initial Payment at Billing',
        }));

        const allPaymentHistory = [...initialNonDueBreakdowns, ...priorCollections];
        const totalPaidSoFar = Math.max(0, (Number(collectingDueSale.sale.amount) || 0) - collectingDueSale.dueAmount);

        const selectedPm = depositPaymentMethods.find(p => p.name === collectDueForm.paymentMethod || p.id === collectDueForm.paymentMethod) || depositPaymentMethods[0];
        const selectedBal = selectedPm ? getPaymentMethodLiveBalance(selectedPm, chartOfAccounts, transactions, invoices, accountBalances, projects, journalEntries) : 0;

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <form onSubmit={handleConfirmCollectDue} className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div>
                  <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-emerald-600" />
                    <span>Collect Project Due</span>
                  </h3>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Project: {collectingDueSale.project.code} • {collectingDueSale.project.name}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCollectingDueSale(null);
                    setAdjustAdvanceAmount(0);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto flex-1 pr-1 my-3 space-y-4 text-xs scrollbar-thin">
                {/* Customer & Billing Financial Overview */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-extrabold text-slate-900 text-sm">
                        {collectingDueSale.project.clientName}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        {collectingDueSale.project.clientPhone && (
                          <div className="flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{collectingDueSale.project.clientPhone}</span>
                          </div>
                        )}
                        {collectingDueSale.sale.invoiceNo && (
                          <span className="font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 rounded">
                            Inv: #{collectingDueSale.sale.invoiceNo}
                          </span>
                        )}
                      </div>
                      {collectingDueSale.sale.description && (
                        <div className="text-[11px] text-slate-600 mt-1 font-medium">
                          Item: {collectingDueSale.sale.description}
                        </div>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 ${
                      collectingDueSale.dueAmount <= 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {collectingDueSale.dueAmount <= 0 ? 'Fully Paid' : 'Due Pending'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/70 text-center">
                    <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Billed</div>
                      <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5">
                        {profile.currencySymbol}{Number(collectingDueSale.sale.amount).toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                      <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Total Paid</div>
                      <div className="text-xs sm:text-sm font-black text-emerald-700 mt-0.5">
                        {profile.currencySymbol}{totalPaidSoFar.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-rose-200/70 bg-rose-50/30">
                      <div className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">Current Due</div>
                      <div className="text-xs sm:text-sm font-black text-rose-600 mt-0.5">
                        {profile.currencySymbol}{collectingDueSale.dueAmount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prior Payments Breakdown / Channels Used */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                      <History className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Payment History ({allPaymentHistory.length} receipts)</span>
                    </div>
                    <span className="text-[10.5px] font-semibold text-slate-500">
                      Collected: {profile.currencySymbol}{totalPaidSoFar.toLocaleString()}
                    </span>
                  </div>

                  {allPaymentHistory.length === 0 ? (
                    <div className="p-3 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                      No prior payments received for this project billing.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                      {allPaymentHistory.map((item, idx) => (
                        <div key={item.id || idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100/70 border border-slate-200 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded-md bg-white border border-slate-200 text-slate-700">
                              {item.channel.toLowerCase().includes('advance') ? (
                                <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                              ) : item.channel.toLowerCase().includes('cash') ? (
                                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                              ) : item.channel.toLowerCase().includes('bkash') || item.channel.toLowerCase().includes('nagad') ? (
                                <Smartphone className="w-3.5 h-3.5 text-pink-600" />
                              ) : (
                                <Landmark className="w-3.5 h-3.5 text-blue-600" />
                              )}
                            </span>
                            <div>
                              <div className="font-extrabold text-slate-800 text-[11.5px]">
                                {item.channel}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {item.date} {item.description ? `• ${item.description}` : ''}
                              </div>
                            </div>
                          </div>
                          <div className="font-black text-emerald-700 text-xs whitespace-nowrap">
                            +{profile.currencySymbol}{item.amount.toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Customer Advance Adjustment Box */}
                {availableAdvance > 0 && (
                  <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                          <Landmark className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="font-extrabold text-slate-800 text-xs">Customer Advance Balance</div>
                          <div className="text-[11px] text-indigo-700 font-bold">
                            Available Credit: {profile.currencySymbol}{availableAdvance.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {maxAdvanceCanUse > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustAdvanceAmount(maxAdvanceCanUse);
                            setCollectDueForm(prev => ({
                              ...prev,
                              amount: Math.max(0, collectingDueSale.dueAmount - maxAdvanceCanUse)
                            }));
                          }}
                          className="text-[10.5px] font-extrabold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 hover:border-indigo-300 px-2.5 py-1 rounded-lg cursor-pointer transition-colors shadow-2xs"
                        >
                          Use Full Advance ({profile.currencySymbol}{maxAdvanceCanUse.toLocaleString()})
                        </button>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700 block text-[11px]">
                          Adjust from Advance ({profile.currencySymbol})
                        </label>
                        {adjustAdvanceAmount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustAdvanceAmount(0);
                              setCollectDueForm(prev => ({
                                ...prev,
                                amount: collectingDueSale.dueAmount
                              }));
                            }}
                            className="text-[10px] text-rose-600 hover:underline font-bold cursor-pointer"
                          >
                            Clear Advance
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max={maxAdvanceCanUse}
                        value={adjustAdvanceAmount === 0 ? '' : adjustAdvanceAmount}
                        onChange={(e) => {
                          const val = Math.min(maxAdvanceCanUse, Math.max(0, Number(e.target.value) || 0));
                          setAdjustAdvanceAmount(val);
                          const curCash = Number(collectDueForm.amount) || 0;
                          if (curCash + val > collectingDueSale.dueAmount) {
                            setCollectDueForm(prev => ({
                              ...prev,
                              amount: Math.max(0, collectingDueSale.dueAmount - val)
                            }));
                          }
                        }}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-indigo-200 rounded-xl font-black text-sm text-indigo-700 bg-white focus:ring-1 focus:ring-indigo-400 focus:outline-hidden"
                      />
                    </div>
                  </div>
                )}

                {/* New Due Collection Form Controls */}
                <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">
                      {adjustAdvanceAmount > 0 ? 'Additional Cash / Channel Collection' : 'New Collection Details'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (availableAdvance > 0 && adjustAdvanceAmount === 0) {
                          setAdjustAdvanceAmount(maxAdvanceCanUse);
                          setCollectDueForm(prev => ({
                            ...prev,
                            amount: Math.max(0, collectingDueSale.dueAmount - maxAdvanceCanUse)
                          }));
                        } else {
                          setCollectDueForm(prev => ({
                            ...prev,
                            amount: remainingDueForChannel
                          }));
                        }
                      }}
                      className="text-[10.5px] font-extrabold text-amber-700 hover:text-amber-800 underline cursor-pointer"
                    >
                      {adjustAdvanceAmount > 0
                        ? `Collect Remaining (${profile.currencySymbol}${remainingDueForChannel.toLocaleString()})`
                        : `Collect Full Due (${profile.currencySymbol}${collectingDueSale.dueAmount.toLocaleString()})`}
                    </button>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {adjustAdvanceAmount > 0 ? 'Amount to Collect from Channel' : 'Amount to Collect *'}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max={remainingDueForChannel}
                      value={collectDueForm.amount === 0 && adjustAdvanceAmount > 0 ? 0 : (collectDueForm.amount || '')}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setCollectDueForm(prev => ({
                          ...prev,
                          amount: Math.min(remainingDueForChannel, val)
                        }));
                      }}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-black text-base text-emerald-700 bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700 block">
                        Deposit Into Payment Channel *
                      </label>
                      {selectedPm && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Live: {profile.currencySymbol}{selectedBal.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <select
                      value={collectDueForm.paymentMethod}
                      onChange={(e) => setCollectDueForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      disabled={cashAmountNum <= 0 && adjustAdvanceAmount > 0}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium text-xs bg-white cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {depositPaymentMethods.map((pm) => {
                        const bal = getPaymentMethodLiveBalance(pm, chartOfAccounts, transactions, invoices, accountBalances, projects, journalEntries);
                        return (
                          <option key={pm.id} value={pm.name}>
                            {pm.name} — [{profile.currencySymbol}{bal.toLocaleString()}]
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Collection Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={collectDueForm.date}
                        onChange={(e) => setCollectDueForm(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium bg-white"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Reference / Cheque No
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Cheque #58129 / Trx-9382"
                        value={collectDueForm.referenceNo}
                        onChange={(e) => setCollectDueForm(prev => ({ ...prev, referenceNo: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Note / Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Paid via mobile banking"
                      value={collectDueForm.note}
                      onChange={(e) => setCollectDueForm(prev => ({ ...prev, note: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium bg-white"
                    />
                  </div>

                  {/* Settlement Summary Breakdown */}
                  <div className="bg-white p-2.5 rounded-lg border border-amber-200/60 text-xs space-y-1">
                    {adjustAdvanceAmount > 0 && (
                      <div className="flex justify-between text-indigo-700 font-bold">
                        <span>Advance Adjusted:</span>
                        <span>+{profile.currencySymbol}{adjustAdvanceAmount.toLocaleString()}</span>
                      </div>
                    )}
                    {cashAmountNum > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Channel Collection ({collectDueForm.paymentMethod}):</span>
                        <span>+{profile.currencySymbol}{cashAmountNum.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-900 font-black pt-1 border-t border-slate-100">
                      <span>Total Payment Applied:</span>
                      <span className="text-emerald-700">+{profile.currencySymbol}{totalSettling.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 font-semibold text-[11px]">
                      <span>Remaining Due After Settlement:</span>
                      <span className={collectingDueSale.dueAmount - totalSettling > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                        {profile.currencySymbol}{Math.max(0, collectingDueSale.dueAmount - totalSettling).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCollectingDueSale(null);
                    setAdjustAdvanceAmount(0);
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={totalSettling <= 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer transition-colors"
                >
                  {adjustAdvanceAmount > 0 && cashAmountNum <= 0
                    ? `Confirm Advance Adjustment (${profile.currencySymbol}${adjustAdvanceAmount.toLocaleString()})`
                    : adjustAdvanceAmount > 0 && cashAmountNum > 0
                    ? `Confirm Collection & Adjustment`
                    : `Confirm Collection (${profile.currencySymbol}${cashAmountNum.toLocaleString()})`}
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* LINK SALES INVOICE TO PROJECT MODAL */}
      {linkingProject && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleLinkInvoiceSubmit}
            className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Link Sales Invoice & Unify COA
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Project: <span className="font-bold text-slate-800">{linkingProject.name}</span> [{linkingProject.code}]
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLinkingProject(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Select Invoice */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Sales Invoice *
                </label>
                <select
                  required
                  value={linkInvoiceForm.invoiceId}
                  onChange={(e) => setLinkInvoiceForm(prev => ({ ...prev, invoiceId: e.target.value }))}
                  className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-xl text-xs font-bold text-indigo-950 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select an Invoice to Link --</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNo} — {inv.customerName} (Total: {profile.currencySymbol}{inv.grandTotal.toLocaleString()} | Due: {profile.currencySymbol}{inv.dueAmount.toLocaleString()}) {inv.projectId ? ` [Linked to ${inv.projectCode || 'another project'}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {linkInvoiceForm.invoiceId && (() => {
                const selectedInv = invoices.find(i => i.id === linkInvoiceForm.invoiceId);
                if (!selectedInv) return null;
                return (
                  <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-200 space-y-2">
                    <div className="flex items-center justify-between font-bold text-indigo-950 text-xs">
                      <span>Invoice #{selectedInv.invoiceNo}</span>
                      <span>Date: {selectedInv.date}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 bg-white p-2 rounded-lg border border-indigo-100 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Total Amount</span>
                        <span className="font-extrabold text-slate-900">{profile.currencySymbol}{selectedInv.grandTotal.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Paid</span>
                        <span className="font-extrabold text-emerald-600">{profile.currencySymbol}{selectedInv.paidAmount.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Due</span>
                        <span className="font-extrabold text-amber-600">{profile.currencySymbol}{selectedInv.dueAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Select Unified COA */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
                    <Landmark className="w-4 h-4 text-emerald-600" />
                    <span>Unified Chart of Accounts Head *</span>
                  </label>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Single Account
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 font-medium">
                  Project revenue and linked invoice will be recorded under this single COA head without duplicate entries.
                </p>
                <select
                  value={linkInvoiceForm.chartOfAccountId}
                  onChange={(e) => setLinkInvoiceForm(prev => ({ ...prev, chartOfAccountId: e.target.value }))}
                  className="w-full px-3 py-2 border border-emerald-300 bg-white rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  {availableRevenueAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      [{acc.code}] {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sync Sales Checkbox */}
              <label className="flex items-start gap-2.5 cursor-pointer p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <input
                  type="checkbox"
                  checked={linkInvoiceForm.syncSalesItem}
                  onChange={(e) => setLinkInvoiceForm(prev => ({ ...prev, syncSalesItem: e.target.checked }))}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 block text-xs">
                    Import invoice billing into project sales
                  </span>
                  <span className="text-[11px] text-slate-500 block leading-tight">
                    Invoice total and balance due will be synchronized with Project Sales Income and Accounts Receivable.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setLinkingProject(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!linkInvoiceForm.invoiceId}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Link & Unify COA</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {projectToDelete && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600">
              <Trash2 className="w-6 h-6"/>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {'Confirm Project Deletion'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {`Are you sure you want to delete project "${projectToDelete.name}"?`}
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button type="button" onClick={() => setProjectToDelete(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {'Cancel'}
              </button>
              <button type="button" onClick={() => {
                deleteProject(projectToDelete.id);
                setProjectToDelete(null);
            }} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold">
                {'Delete'}
              </button>
            </div>
          </div>
        </div>)}
    </div>);
};
