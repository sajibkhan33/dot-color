import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ChartOfAccount, SalesInvoice } from '../types';
import { BookOpen, Plus, Search, Filter, Edit2, Trash2, Lock, CheckCircle2, AlertCircle, X, FileText, Printer, ArrowUpDown, Download, Upload, } from 'lucide-react';
import * as XLSX from 'xlsx';
import { calculateSingleAccountBalance, calculateTotalCustomerReceivables, calculateTotalSupplierPayables, calculateInventoryValuation, isInvoiceTransaction, isProjectTransaction, isAdvanceAdjustmentTransaction, isAdvanceDepositTransaction, isProjectDueCollectionTransaction, isDueReceivableTransaction, doesTransactionMatchExpenseAccount, resolveExpenseAccount, isSupplierPaymentTransaction } from '../utils/accountUtils';
export const ChartOfAccountsManager: React.FC = () => {
    const { chartOfAccounts, expenseHeads = [], invoices = [], transactions = [], accountBalances, suppliers = [], customers = [], purchaseOrders = [], products = [], journalEntries = [], language, profile, activeStaff, addChartOfAccount, updateChartOfAccount, deleteChartOfAccount, checkPermission, projects = [], syncProjectsWithAccounting } = useApp();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterClassification, setFilterClassification] = useState<string>('ALL');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);
    const [accountToDelete, setAccountToDelete] = useState<ChartOfAccount | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Auto-align projects on COA mount
    useEffect(() => {
        if (syncProjectsWithAccounting) {
            syncProjectsWithAccounting();
        }
    }, []);

    // Form state
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        nameBn: '',
        classification: 'Asset' as ChartOfAccount['classification'],
        accountGroup: 'Current Assets',
        normalBalance: 'Debit' as 'Debit' | 'Credit',
        openingBalance: 0,
        description: '',
    });
    const isSuperAdmin = (activeStaff?.role || '').toLowerCase() === 'super admin' ||
        (activeStaff?.role || '').toLowerCase() === 'superadmin' ||
        activeStaff?.customRoleId === 'role-superadmin' ||
        (activeStaff?.name || '').toLowerCase().includes('super admin');
    const canManageCOA = isSuperAdmin || Boolean(checkPermission && (checkPermission('accounting.chart_of_accounts') || checkPermission('ACCOUNTING_MANAGE_COA')));
    const canEditAccount = isSuperAdmin || Boolean(checkPermission && checkPermission('accounting.edit_transaction'));
    const canDeleteAccount = isSuperAdmin || Boolean(checkPermission && checkPermission('accounting.delete_transaction'));

    // Real-time dynamic Chart of Accounts synced with Ledger Transactions, Projects & Balances
    const liveAccounts = useMemo(() => {
        const totalTxIncome = (transactions || []).filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
        const totalSupplierDue = calculateTotalSupplierPayables(suppliers, purchaseOrders);
        const totalCustomerDue = calculateTotalCustomerReceivables(invoices, customers, projects);
        const totalCustomerAdvance = (customers || []).reduce((s, c) => s + (Number(c.advanceBalance) || 0), 0);
        const isInvLinkedToProject = (inv: SalesInvoice) => {
            const invNo = (inv.invoiceNo || '').toLowerCase().trim();
            return Boolean(
                inv.projectId ||
                inv.projectCode ||
                projectLinkedInvoiceIds.has(inv.id) ||
                (invNo && projectLinkedInvoiceNos.has(invNo))
            );
        };

        const projectLinkedInvoiceNos = new Set([
            ...(projects || []).map(p => (p.invoiceNo || '').toLowerCase().trim()).filter(Boolean),
            ...(projects || []).flatMap(p => (p.salesItems || []).map(s => (s.invoiceNo || '').toLowerCase().trim())).filter(Boolean),
            ...(invoices || []).filter(inv => inv.projectId || inv.projectCode).map(inv => (inv.invoiceNo || '').toLowerCase().trim()).filter(Boolean),
        ]);
        const projectLinkedInvoiceIds = new Set([
            ...(projects || []).map(p => p.invoiceId).filter(Boolean) as string[],
            ...(invoices || []).filter(inv => inv.projectId || inv.projectCode).map(inv => inv.id).filter(Boolean) as string[],
        ]);

        const projectInvoicesTotal = (invoices || [])
            .filter(inv => isInvLinkedToProject(inv))
            .reduce((s, inv) => s + (Number(inv.grandTotal) || (Number(inv.paidAmount) + Number(inv.dueAmount)) || 0), 0);
        const totalProjectSales = Math.max((projects || []).reduce((s, p) => s + (p.totalSales || 0), 0), projectInvoicesTotal);
        const totalProjectExpenses = (projects || []).reduce((s, p) => s + (p.totalExpenses || 0), 0);

        const nonProjectInvoices = (invoices || []).filter(inv => !isInvLinkedToProject(inv));
        const totalNonProjectInvoiceSales = nonProjectInvoices.reduce((s, inv) => s + (Number(inv.grandTotal) || (Number(inv.paidAmount) + Number(inv.dueAmount)) || 0), 0);
        const totalInvoiceSales = (invoices || []).reduce((s, inv) => s + (Number(inv.grandTotal) || (Number(inv.paidAmount) + Number(inv.dueAmount)) || 0), 0);

        // Dynamic detection of primary advance liability account (e.g. 2020 or 2002 Customer Advance)
        const advanceAccounts = chartOfAccounts.filter(a => 
            a.classification === 'Liability' && (
                a.code === '2020' || 
                a.code === '2002' || 
                a.id === 'coa-2020' || 
                (a.name || '').toLowerCase().includes('advance') || 
                (a.name || '').toLowerCase().includes('deposit') || 
                a.nameBn?.includes('অগ্রিম')
            )
        );
        const primaryAdvanceAccId = (
            advanceAccounts.find(a => a.id === 'coa-2020') ||
            advanceAccounts.find(a => (a.name || '').toLowerCase().includes('customer advance') || a.nameBn?.includes('কাস্টমার অগ্রিম')) ||
            advanceAccounts.find(a => a.code === '2020') ||
            advanceAccounts.find(a => a.code === '2002') ||
            advanceAccounts[0]
        )?.id;

        // Dynamic detection of primary accounts that survives renaming or re-coding
        const nonProjectRevenueAccounts = chartOfAccounts.filter(a => 
            a.classification === 'Revenue' && 
            !a.name.toLowerCase().includes('project') && 
            !a.nameBn?.includes('প্রজেক্ট') && 
            a.code !== '4002' && 
            a.code !== '4051' &&
            a.code !== '4060' &&
            a.id !== 'coa-4002' &&
            a.id !== 'coa-4051'
        );
        const primarySalesAccountId = (
            nonProjectRevenueAccounts.find(a => a.id === 'coa-4001') ||
            nonProjectRevenueAccounts.find(a => a.isSystem) ||
            nonProjectRevenueAccounts.find(a => a.code === '4001' || a.code === '4010') ||
            nonProjectRevenueAccounts.find(a => a.name.toLowerCase().includes('sales') || a.nameBn?.includes('বিক্রয়') || a.nameBn?.includes('বিক্রয়')) ||
            nonProjectRevenueAccounts[0]
        )?.id;

        return chartOfAccounts.map(acc => {
            const nameLower = (acc.name || '').toLowerCase();
            const nameBn = (acc.nameBn || '').toLowerCase();
            let liveBal = acc.currentBalance;

            if (acc.classification === 'Asset') {
                // 1. Customer Accounts Receivable (Trade Debtors / Customer Due)
                const isCustomerReceivable = (
                    acc.id === 'coa-1050' ||
                    acc.code === '1003' ||
                    acc.code === '1050' ||
                    (nameLower.includes('customer') && nameLower.includes('receivable')) ||
                    nameLower.includes('trade debtor') ||
                    nameBn.includes('কাস্টমার বকেয়া') ||
                    nameBn.includes('প্রাপ্য হিসাব') ||
                    (nameLower.includes('receivable') && !nameLower.includes('aggregator') && !nameLower.includes('staff'))
                );

                // 2. Inventory / Raw Materials (Must NEVER be overwritten by Bank or Cash)
                const isInventory = (
                    acc.id === 'coa-1060' ||
                    acc.id === 'coa-1070' ||
                    acc.code === '1002' ||
                    acc.code === '1060' ||
                    acc.code === '1070' ||
                    nameLower.includes('raw material') ||
                    nameLower.includes('inventory') ||
                    nameLower.includes('finished goods') ||
                    nameLower.includes('stock') ||
                    nameBn.includes('কাঁচামাল') ||
                    nameBn.includes('ইনভেন্টরি')
                );

                if (isCustomerReceivable) {
                    liveBal = totalCustomerDue > 0 ? totalCustomerDue : (acc.openingBalance || 0);
                } else if (isInventory) {
                    liveBal = calculateInventoryValuation(products, purchaseOrders, acc, journalEntries);
                } else {
                    // Dynamic individual live balance calculation for Cash, City Bank PLC, Southeast Bank, Nagad, bKash, etc.
                    liveBal = calculateSingleAccountBalance(acc, transactions, invoices, projects, journalEntries);
                }
            } else if (acc.classification === 'Liability') {
                const isPayable = acc.code === '2001' || acc.code === '2010' || nameLower.includes('payable') || nameLower.includes('supplier') || nameBn.includes('দেনা') || nameBn.includes('প্রদেয়');
                const isAdvanceLiability = acc.code === '2020' || acc.code === '2002' || acc.id === 'coa-2020' || nameLower.includes('advance') || nameLower.includes('deposit') || nameBn.includes('অগ্রিম');

                if (isPayable) {
                    liveBal = totalSupplierDue > 0 ? totalSupplierDue : (acc.openingBalance || 0);
                } else if (isAdvanceLiability) {
                    const matchingAdvance = (transactions || [])
                        .filter(t => t.type === 'INCOME' && !isInvoiceTransaction(t) && (
                            (t.category && (t.category.toLowerCase().includes('advance') || t.category.toLowerCase().includes('অগ্রিম') || nameLower.includes(t.category.toLowerCase()))) ||
                            (t.description && (t.description.toLowerCase().includes('advance') || t.description.toLowerCase().includes('অগ্রিম')))
                        ))
                        .reduce((s, t) => s + t.amount, 0);

                    const matchingAdvanceAdjusted = (transactions || [])
                        .filter(t => (
                            (t.category && (t.category.toLowerCase().includes('advance adjust') || t.category.toLowerCase().includes('অগ্রিম সমন্বয়') || t.category.toLowerCase().includes('advance adjustment'))) ||
                            (t.description && (t.description.toLowerCase().includes('advance adjust') || t.description.toLowerCase().includes('adjusted from advance') || t.description.toLowerCase().includes('advance adjustment')))
                        ))
                        .reduce((s, t) => s + t.amount, 0);

                    const netMatchingAdvance = Math.max(0, (acc.openingBalance || 0) + matchingAdvance - matchingAdvanceAdjusted);

                    if (acc.id === primaryAdvanceAccId || advanceAccounts.length <= 1) {
                        liveBal = totalCustomerAdvance > 0 
                            ? totalCustomerAdvance 
                            : netMatchingAdvance;
                    } else {
                        liveBal = netMatchingAdvance;
                    }
                }
            } else if (acc.classification === 'Revenue') {
                const isProjectRev = (
                    acc.id === 'coa-4002' || 
                    acc.id === 'coa-4051' || 
                    acc.code === '4002' || 
                    acc.code === '4051' || 
                    acc.code === '4060' || 
                    nameLower.includes('project') || 
                    nameBn.includes('প্রজেক্ট')
                );
                const isSalesRev = !isProjectRev && (
                    acc.id === primarySalesAccountId || 
                    acc.code === '4001' || 
                    acc.code === '4010' || 
                    acc.id === 'coa-4001' ||
                    nameLower.includes('sales revenue') || 
                    nameLower.trim() === 'sales' ||
                    (nameLower.includes('sales') && !nameLower.includes('project')) || 
                    ((nameBn.includes('বিক্রয়') || nameBn.includes('বিক্রয়')) && !nameBn.includes('প্রজেক্ট'))
                );

                // Matching projects for this COA head
                const matchingProjects = (projects || []).filter(p => 
                    p.chartOfAccountId === acc.id || 
                    (isProjectRev && (!p.chartOfAccountId || p.chartOfAccountId === 'coa-4051' || p.chartOfAccountId === 'coa-4002' || p.chartOfAccountId === acc.id))
                );
                const matchingProjectSales = matchingProjects.reduce((s, p) => s + (p.totalSales || 0), 0);
                const matchingProjectInvoices = (invoices || []).filter(inv => {
                    if (!isInvLinkedToProject(inv)) return false;
                    const invPrj = (projects || []).find(p => p.id === inv.projectId || p.code === inv.projectCode || p.code === inv.projectId);
                    if (!invPrj) return isProjectRev;
                    return invPrj.chartOfAccountId === acc.id || isProjectRev;
                });
                const matchingProjectInvoiceSales = matchingProjectInvoices.reduce((s, inv) => s + (Number(inv.grandTotal) || (Number(inv.paidAmount) + Number(inv.dueAmount)) || 0), 0);
                const effectiveProjectSales = Math.max(matchingProjectSales, matchingProjectInvoiceSales);

                if (isProjectRev || matchingProjects.length > 0) {
                    // Standalone project revenue transactions that are NOT due collections, NOT unpaid receivable due bookings, and NOT already part of matchingProjects
                    const standaloneProjectRevenue = (transactions || [])
                        .filter(t => 
                            t.type === 'INCOME' && 
                            !isProjectDueCollectionTransaction(t) && 
                            !isDueReceivableTransaction(t) && 
                            !isAdvanceAdjustmentTransaction(t) && 
                            (t.accountHead === acc.name || (t.category && t.category.toLowerCase().includes('project revenue'))) && 
                            !matchingProjects.some(p => (p.code && t.refNo && p.code.toLowerCase() === t.refNo.toLowerCase()) || (t.description && p.code && t.description.toLowerCase().includes(p.code.toLowerCase())))
                        )
                        .reduce((s, t) => s + (Number(t.amount) || 0), 0);

                    const allPrjTxRevenue = (transactions || [])
                        .filter(t => 
                            t.type === 'INCOME' && 
                            !isDueReceivableTransaction(t) && 
                            !isAdvanceDepositTransaction(t) && 
                            !isAdvanceAdjustmentTransaction(t) && (
                                isProjectTransaction(t) || 
                                (t.category && t.category.toLowerCase().includes('project')) ||
                                (t.accountHead && t.accountHead.toLowerCase().includes('project')) ||
                                (t.refNo && (t.refNo.toUpperCase().startsWith('PRJ-') || (projects || []).some(p => p.code === t.refNo)))
                            )
                        )
                        .reduce((s, t) => s + (Number(t.amount) || 0), 0);

                    liveBal = (acc.openingBalance || 0) + Math.max(effectiveProjectSales + standaloneProjectRevenue, allPrjTxRevenue);
                } else if (isSalesRev) {
                    // Non-project invoice sales
                    const invoiceSalesFromTx = (transactions || [])
                        .filter(t => 
                            t.type === 'INCOME' && 
                            isInvoiceTransaction(t) && 
                            !isProjectTransaction(t) && 
                            !isProjectDueCollectionTransaction(t) && 
                            !(t.category || '').toLowerCase().includes('project') && 
                            !projectLinkedInvoiceNos.has((t.refNo || '').toLowerCase().trim()) && 
                            !(t.refNo || '').toUpperCase().startsWith('COL-') && 
                            !(t.refNo || '').toUpperCase().startsWith('PRJ-')
                        )
                        .reduce((s, t) => s + t.amount, 0);
                    const effectiveInvoiceSales = Math.max(totalNonProjectInvoiceSales, invoiceSalesFromTx);

                    // Direct non-invoice operating incomes (e.g. scrap sales, counter direct sales, INC- vouchers)
                    const directMatchingSales = (transactions || [])
                        .filter(t => 
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
                                    nameLower.includes(t.category.toLowerCase()) || 
                                    (acc.nameBn && acc.nameBn.toLowerCase().includes(t.category.toLowerCase())) || 
                                    t.category.toLowerCase().includes('sales') || 
                                    t.category.toLowerCase().includes('বিক্রয়')
                                )) ||
                                // Default INC- direct incomes to primary sales revenue if not explicitly claimed by another specific active COA revenue head
                                (t.refNo?.startsWith('INC-') && !chartOfAccounts.some(otherAcc => 
                                    otherAcc.id !== acc.id && 
                                    otherAcc.classification === 'Revenue' && 
                                    otherAcc.name.toLowerCase() === (t.category || '').toLowerCase()
                                ))
                            )
                        )
                        .reduce((s, t) => s + t.amount, 0);

                    liveBal = (acc.openingBalance || 0) + effectiveInvoiceSales + directMatchingSales;
                } else {
                    // Other specific revenue accounts (dynamically matching any category added by the user)
                    const matchingDirect = (transactions || [])
                        .filter(t => 
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
                                    nameLower.includes(t.category.toLowerCase()) || 
                                    t.category.toLowerCase().includes(nameLower) ||
                                    (acc.nameBn && acc.nameBn.toLowerCase().includes(t.category.toLowerCase())) ||
                                    (acc.nameBn && t.category.toLowerCase().includes(acc.nameBn.toLowerCase()))
                                )) ||
                                (t.accountHead && (
                                    nameLower.includes(t.accountHead.toLowerCase()) || 
                                    t.accountHead.toLowerCase().includes(nameLower) ||
                                    (acc.nameBn && acc.nameBn.toLowerCase().includes(t.accountHead.toLowerCase())) ||
                                    (acc.nameBn && t.accountHead.toLowerCase().includes(acc.nameBn.toLowerCase()))
                                )) ||
                                (t.description && (
                                    nameLower.includes(t.description.toLowerCase()) || 
                                    t.description.toLowerCase().includes(nameLower) ||
                                    (acc.nameBn && acc.nameBn.toLowerCase().includes(t.description.toLowerCase())) ||
                                    (acc.nameBn && t.description.toLowerCase().includes(acc.nameBn.toLowerCase()))
                                ))
                            )
                        )
                        .reduce((s, t) => s + t.amount, 0);

                    liveBal = Math.max(acc.currentBalance, (acc.openingBalance || 0) + matchingDirect);
                }
            } else if (acc.classification === 'Expense') {
                const isProjectExp = (
                    acc.id === 'coa-5206' || 
                    acc.code === '5206' ||
                    nameLower.includes('project') || 
                    nameBn.includes('প্রজেক্ট')
                );

                const isPrjTx = (t: any) => (
                    isProjectTransaction(t) || 
                    (t.refNo && (t.refNo.startsWith('PRJ-') || (projects || []).some(p => p.code === t.refNo)))
                );

                const isCogs = (
                    acc.code === '5001' ||
                    acc.code === '5010' ||
                    acc.id === 'coa-5001' ||
                    acc.id === 'coa-5010' ||
                    nameLower.includes('cost of goods') ||
                    nameLower.includes('cogs') ||
                    (nameLower.includes('raw material') && acc.classification === 'Expense') ||
                    nameBn.includes('বিক্রিত পণ্যের ব্যয়')
                );

                // Calculate net impact from posted Journal Entries (Debit increases Expense, Credit decreases Expense)
                // Exclude journal entries that originate from transactions already counted in ledger (EXPENSE, SALES, PURCHASE, LEDGER_SYNC, PROJECT_*)
                let journalExpDelta = 0;
                (journalEntries || []).forEach(j => {
                    if (j.source === 'PROJECT_SALES' || j.source === 'PROJECT_EXPENSE' || j.source === 'EXPENSE' || j.source === 'SALES' || j.source === 'PURCHASE' || j.source === 'LEDGER_SYNC') return;
                    if (j.refNo && (transactions || []).some(t => t.refNo && t.refNo.toLowerCase().trim() === j.refNo.toLowerCase().trim())) return;
                    // Purchase orders are warehouse inventory receipts, not operational expenses
                    const refUpper = `${j.refNo || ''} ${(j as any).reference || ''} ${j.narration || ''}`.toUpperCase();
                    if (refUpper.includes('PO-') || refUpper.includes('DCC-PO-')) return;
                    const dName = (j.debitAccountName || '').toLowerCase().trim();
                    const cName = (j.creditAccountName || '').toLowerCase().trim();
                    const amt = Number(j.amount) || 0;

                    const isDebit = Boolean(
                        (acc.id && j.debitAccountId === acc.id) ||
                        (acc.code && (j.debitAccountId === acc.code || (j as any).debitAccountCode === acc.code)) ||
                        (dName && (
                            dName === nameLower ||
                            (isCogs && (
                                dName.includes('cost of goods') ||
                                dName.includes('cogs') ||
                                (dName.includes('raw material') && (dName.includes('cost') || dName.includes('sold') || dName.includes('expense'))) ||
                                dName.includes('বিক্রিত পণ্যের ব্যয়')
                            ))
                        ))
                    );

                    const isCredit = Boolean(
                        (acc.id && j.creditAccountId === acc.id) ||
                        (acc.code && (j.creditAccountId === acc.code || (j as any).creditAccountCode === acc.code)) ||
                        (cName && (
                            cName === nameLower ||
                            (isCogs && (
                                cName.includes('cost of goods') ||
                                cName.includes('cogs') ||
                                (cName.includes('raw material') && (cName.includes('cost') || cName.includes('sold') || cName.includes('expense'))) ||
                                cName.includes('বিক্রিত পণ্যের ব্যয়')
                            ))
                        ))
                    );

                    if (isDebit && !isCredit) journalExpDelta += amt;
                    else if (isCredit && !isDebit) journalExpDelta -= amt;
                });

                if (isProjectExp) {
                    const projectMatching = (transactions || [])
                        .filter(t => t.type === 'EXPENSE' && (
                            isPrjTx(t) ||
                            (t.category && (t.category.toLowerCase().includes('project') || t.category.toLowerCase().includes('প্রজেক্ট'))) ||
                            (t.accountHead && (t.accountHead.toLowerCase().includes('project') || t.accountHead.toLowerCase().includes('প্রজেক্ট')))
                        ))
                        .reduce((s, t) => s + t.amount, 0);
                    liveBal = (acc.openingBalance || 0) + Math.max(projectMatching, totalProjectExpenses, journalExpDelta);
                } else if (isCogs) {
                    const poExpenses = (transactions || [])
                        .filter(t => t.type === 'EXPENSE' && !isPrjTx(t) && !isSupplierPaymentTransaction(t) && (
                            (t.category && (t.category.toLowerCase().includes('raw') || t.category.toLowerCase().includes('purchase'))) ||
                            (t.description && (t.description.toLowerCase().includes('purchase') || t.description.toLowerCase().includes('raw')))
                        ))
                        .reduce((s, t) => s + t.amount, 0);
                    const baseCogs = (acc.currentBalance === totalProjectExpenses && totalProjectExpenses > 0)
                        ? (acc.openingBalance || 0)
                        : (acc.currentBalance > totalProjectExpenses ? acc.currentBalance - totalProjectExpenses : acc.currentBalance);
                    const closingStockVal = (products || []).reduce((sum, p) => sum + ((Number(p.costPrice) || 0) * (Number(p.stockOffice || 0) + Number(p.stockFactory || 0))), 0);
                    const rawPurchases = (purchaseOrders || []).filter(po => (po.status || '').toLowerCase() !== 'cancelled').reduce((s, po) => s + (Number(po.totalAmount) || Number((po as any).total) || 0), 0);
                    const cogsFromStock = Math.max(0, rawPurchases - closingStockVal);
                    liveBal = Math.max(baseCogs, cogsFromStock, poExpenses, (acc.openingBalance || 0) + journalExpDelta);
                } else {
                    const matching = (transactions || [])
                        .filter(t => t.type === 'EXPENSE' && !isPrjTx(t) && (
                            doesTransactionMatchExpenseAccount(t, acc, expenseHeads, chartOfAccounts, journalEntries)
                        ))
                        .reduce((s, t) => s + t.amount, 0);

                    liveBal = (acc.openingBalance || 0) + matching + journalExpDelta;
                }
            } else if (acc.classification === 'Equity') {
                const isRetainedEarnings = (
                    acc.id === 'coa-3020' ||
                    nameLower.includes('retained') ||
                    nameBn.includes('সংরক্ষিত')
                );
                const isDrawings = (
                    acc.normalBalance === 'Debit' ||
                    nameLower.includes('drawing') ||
                    nameBn.includes('উত্তোলন')
                );

                if (isDrawings) {
                    let journalDrawingsDelta = 0;
                    (journalEntries || []).forEach(j => {
                        if (j.source === 'PROJECT_SALES' || j.source === 'PROJECT_EXPENSE' || j.source === 'EXPENSE' || j.source === 'SALES' || j.source === 'PURCHASE' || j.source === 'LEDGER_SYNC') return;
                        const isDebit = (
                            j.debitAccountId === acc.id ||
                            j.debitAccountId === acc.code ||
                            (j.debitAccountName && j.debitAccountName.toLowerCase().trim() === nameLower)
                        );
                        const isCredit = (
                            j.creditAccountId === acc.id ||
                            j.creditAccountId === acc.code ||
                            (j.creditAccountName && j.creditAccountName.toLowerCase().trim() === nameLower)
                        );
                        const amt = Number(j.amount) || 0;
                        if (isDebit && !isCredit) journalDrawingsDelta += amt;
                        else if (isCredit && !isDebit) journalDrawingsDelta -= amt;
                    });
                    const txDrawings = (transactions || [])
                        .filter(t => t.type === 'EXPENSE' && ((t.category || '').toLowerCase().includes('drawing') || (t.description || '').toLowerCase().includes('drawing') || (t.accountHead || '').toLowerCase().includes('drawing')))
                        .reduce((s, t) => s + t.amount, 0);
                    liveBal = Math.max(0, (acc.openingBalance || 0) + journalDrawingsDelta + txDrawings);
                } else {
                    let journalEquityDelta = 0;
                    (journalEntries || []).forEach(j => {
                        if (j.source === 'PROJECT_SALES' || j.source === 'PROJECT_EXPENSE' || j.source === 'EXPENSE' || j.source === 'SALES' || j.source === 'PURCHASE' || j.source === 'LEDGER_SYNC') return;
                        if (j.refNo && (transactions || []).some(t => t.refNo && t.refNo.toLowerCase().trim() === j.refNo.toLowerCase().trim())) return;
                        const isDebit = (
                            j.debitAccountId === acc.id ||
                            j.debitAccountId === acc.code ||
                            (j.debitAccountName && j.debitAccountName.toLowerCase().trim() === nameLower)
                        );
                        const isCredit = (
                            j.creditAccountId === acc.id ||
                            j.creditAccountId === acc.code ||
                            (j.creditAccountName && j.creditAccountName.toLowerCase().trim() === nameLower)
                        );
                        const amt = Number(j.amount) || 0;
                        if (isCredit && !isDebit) journalEquityDelta += amt;
                        else if (isDebit && !isCredit) journalEquityDelta -= amt;
                    });

                    if (isRetainedEarnings) {
                    const directIncomes = (transactions || [])
                        .filter(t => t.type === 'INCOME' && 
                            !isInvoiceTransaction(t) && 
                            !isProjectTransaction(t) && 
                            !isProjectDueCollectionTransaction(t) && 
                            !isAdvanceDepositTransaction(t) && 
                            !isAdvanceAdjustmentTransaction(t) &&
                            !(t.category || '').toLowerCase().includes('advance') &&
                            !(t.category || '').includes('অগ্রিম') &&
                            !(t.category || '').toLowerCase().includes('project') &&
                            !(t.description || '').toLowerCase().includes('project')
                        )
                        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
                    const totalOperationalRevenue = totalNonProjectInvoiceSales + totalProjectSales + directIncomes;

                    // Resolve Cost of Goods Sold so Retained Earnings matches IFRS Net Operating Profit
                    const cogsAccObj = (chartOfAccounts || []).find(a => a.classification === 'Expense' && (
                        a.code === '5001' || a.code === '5010' || a.id === 'coa-5001' || a.id === 'coa-5010' ||
                        (a.name || '').toLowerCase().includes('cost of goods') ||
                        (a.name || '').toLowerCase().includes('cogs') ||
                        ((a.name || '').toLowerCase().includes('raw material') && a.classification === 'Expense')
                    ));
                    let liveCogsBal = 0;
                    if (cogsAccObj) {
                        let journalCogsDelta = 0;
                        (journalEntries || []).forEach(j => {
                            if (j.source === 'PROJECT_SALES' || j.source === 'PROJECT_EXPENSE' || j.source === 'EXPENSE' || j.source === 'SALES' || j.source === 'PURCHASE' || j.source === 'LEDGER_SYNC') return;
                            if (j.refNo && (transactions || []).some(t => t.refNo && t.refNo.toLowerCase().trim() === j.refNo.toLowerCase().trim())) return;
                            const dName = (j.debitAccountName || '').toLowerCase().trim();
                            const cName = (j.creditAccountName || '').toLowerCase().trim();
                            const amt = Number(j.amount) || 0;
                            const isDebit = Boolean(
                                (cogsAccObj.id && j.debitAccountId === cogsAccObj.id) ||
                                (cogsAccObj.code && (j.debitAccountId === cogsAccObj.code || (j as any).debitAccountCode === cogsAccObj.code)) ||
                                dName.includes('cost of goods') || dName.includes('cogs')
                            );
                            const isCredit = Boolean(
                                (cogsAccObj.id && j.creditAccountId === cogsAccObj.id) ||
                                (cogsAccObj.code && (j.creditAccountId === cogsAccObj.code || (j as any).creditAccountCode === cogsAccObj.code)) ||
                                cName.includes('cost of goods') || cName.includes('cogs')
                            );
                            if (isDebit && !isCredit) journalCogsDelta += amt;
                            else if (isCredit && !isDebit) journalCogsDelta -= amt;
                        });
                        liveCogsBal = Math.max(cogsAccObj.currentBalance || 0, (cogsAccObj.openingBalance || 0) + journalCogsDelta);
                    }

                    const generalExpensesTotal = (transactions || [])
                        .filter(t => t.type === 'EXPENSE' && !isSupplierPaymentTransaction(t))
                        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
                    const totalOperationalExpenses = generalExpensesTotal + liveCogsBal;
                    const netOperatingProfit = totalOperationalRevenue - totalOperationalExpenses;
                    liveBal = (acc.openingBalance || 0) + netOperatingProfit + journalEquityDelta;
                } else {
                    liveBal = Math.max(0, (acc.openingBalance || 0) + journalEquityDelta);
                }
            }
        }

            return {
                ...acc,
                currentBalance: liveBal,
            };
        });
    }, [chartOfAccounts, transactions, accountBalances, suppliers, customers, projects, invoices, purchaseOrders, products, journalEntries]);

    // Classification stats
    const stats = useMemo(() => {
        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;
        let totalRevenue = 0;
        let totalExpenses = 0;
        let salesRevenue = 0;
        let projectRevenue = 0;
        let generalExpenses = 0;
        let projectExpenses = 0;
        liveAccounts.forEach((acc) => {
            if (acc.classification === 'Asset')
                totalAssets += acc.currentBalance;
            else if (acc.classification === 'Liability')
                totalLiabilities += acc.currentBalance;
            else if (acc.classification === 'Equity') {
                const isContra = acc.normalBalance === 'Debit' || acc.code === '3002' || (acc.name || '').toLowerCase().includes('drawing') || (acc.nameBn || '').includes('উত্তোলন');
                if (isContra) {
                    totalEquity -= acc.currentBalance;
                } else {
                    totalEquity += acc.currentBalance;
                }
            }
            else if (acc.classification === 'Revenue') {
                totalRevenue += acc.currentBalance;
                const isPrj = (
                    acc.code === '4002' || 
                    acc.code === '4051' || 
                    acc.code === '4060' || 
                    acc.id === 'coa-4002' || 
                    acc.id === 'coa-4051' || 
                    (acc.name || '').toLowerCase().includes('project') || 
                    (acc.nameBn || '').includes('প্রজেক্ট')
                );
                if (isPrj) {
                    projectRevenue += acc.currentBalance;
                } else {
                    salesRevenue += acc.currentBalance;
                }
            }
            else if (acc.classification === 'Expense') {
                totalExpenses += acc.currentBalance;
                const isPrj = (
                    acc.code === '5206' || 
                    acc.id === 'coa-5206' || 
                    (acc.name || '').toLowerCase().includes('project') || 
                    (acc.nameBn || '').includes('প্রজেক্ট')
                );
                if (isPrj) {
                    projectExpenses += acc.currentBalance;
                } else {
                    generalExpenses += acc.currentBalance;
                }
            }
        });

        const txExpense = (transactions || []).filter(t => t.type === 'EXPENSE' && !isSupplierPaymentTransaction(t)).reduce((s, t) => s + t.amount, 0);

        return { 
            totalAssets, 
            totalLiabilities, 
            totalEquity, 
            totalRevenue, 
            salesRevenue,
            projectRevenue,
            generalExpenses,
            projectExpenses,
            totalExpenses: Math.max(totalExpenses, txExpense) 
        };
    }, [liveAccounts, transactions]);

    const filteredAccounts = useMemo(() => {
        return liveAccounts.filter((acc) => {
            if (filterClassification !== 'ALL' && acc.classification !== filterClassification) {
                return false;
            }
            const q = searchQuery.toLowerCase().trim();
            if (!q)
                return true;
            return (acc.code.toLowerCase().includes(q) ||
                acc.name.toLowerCase().includes(q) ||
                (acc.nameBn && acc.nameBn.includes(q)) ||
                acc.accountGroup.toLowerCase().includes(q));
        });
    }, [liveAccounts, filterClassification, searchQuery]);

    const filteredAccountsTotal = useMemo(() => {
        return filteredAccounts.reduce((sum, acc) => sum + (Number(acc.currentBalance) || 0), 0);
    }, [filteredAccounts]);
    const generateNextCode = (cls: string, group: string): string => {
        // 1. Find max code within exact same Classification + Account Group
        const sameGroupAccounts = chartOfAccounts.filter((a) => a.classification === cls && a.accountGroup.toLowerCase() === group.toLowerCase());
        if (sameGroupAccounts.length > 0) {
            const maxCode = Math.max(...sameGroupAccounts.map((a) => parseInt(a.code, 10) || 0));
            return (maxCode + 1).toString();
        }
        // 2. If no exact match for group, find max code within Classification
        const sameClsAccounts = chartOfAccounts.filter((a) => a.classification === cls);
        if (sameClsAccounts.length > 0) {
            const maxCode = Math.max(...sameClsAccounts.map((a) => parseInt(a.code, 10) || 0));
            // Start a new block of 100
            const nextBlock = Math.floor(maxCode / 100) * 100 + 100;
            return Math.max(maxCode + 1, nextBlock).toString();
        }
        // 3. Fallback defaults
        switch (cls) {
            case 'Asset': return '1001';
            case 'Liability': return '2001';
            case 'Equity': return '3001';
            case 'Revenue': return '4001';
            case 'Expense': return '5001';
            default: return '1001';
        }
    };
    const handleOpenAdd = () => {
        const defaultCls = 'Asset';
        const defaultGroup = 'Current Assets';
        const nextCode = generateNextCode(defaultCls, defaultGroup);
        setFormData({
            code: nextCode,
            name: '',
            nameBn: '',
            classification: defaultCls,
            accountGroup: defaultGroup,
            normalBalance: 'Debit',
            openingBalance: 0,
            description: '',
        });
        setEditingAccount(null);
        setShowAddModal(true);
        setDeleteError(null);
    };
    const handleOpenEdit = (acc: ChartOfAccount) => {
        setFormData({
            code: acc.code,
            name: acc.name,
            nameBn: acc.nameBn || '',
            classification: acc.classification,
            accountGroup: acc.accountGroup,
            normalBalance: acc.normalBalance,
            openingBalance: acc.openingBalance,
            description: acc.description || '',
        });
        setEditingAccount(acc);
        setShowAddModal(true);
        setDeleteError(null);
    };
    const handleExportExcel = () => {
        const data = liveAccounts.map(acc => ({
            Code: acc.code,
            'Name (EN)': acc.name,
            'Name (BN)': acc.nameBn || '',
            Classification: acc.classification,
            'Account Group': acc.accountGroup,
            'Normal Balance': acc.normalBalance,
            'Opening Balance': acc.openingBalance,
            'Current Balance': acc.currentBalance,
            Description: acc.description || ''
        }));
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Chart of Accounts');
        XLSX.writeFile(workbook, 'Chart_of_Accounts.xlsx');
    };
    const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json<any>(ws);
                data.forEach((row: any) => {
                    if (!row['Code'] || !row['Name (EN)'])
                        return;
                    const existingAcc = chartOfAccounts.find(a => a.code === row['Code']?.toString());
                    const accData = {
                        code: row['Code']?.toString(),
                        name: row['Name (EN)']?.toString() || '',
                        nameBn: row['Name (BN)']?.toString() || '',
                        classification: (row['Classification'] as ChartOfAccount['classification']) || 'Asset',
                        accountGroup: row['Account Group']?.toString() || 'Current Assets',
                        normalBalance: (row['Normal Balance'] as 'Debit' | 'Credit') || 'Debit',
                        openingBalance: Number(row['Opening Balance']) || 0,
                        description: row['Description']?.toString() || '',
                    };
                    if (existingAcc) {
                        updateChartOfAccount(existingAcc.id, accData);
                    }
                    else {
                        addChartOfAccount({ ...accData, isActive: true });
                    }
                });
            }
            catch (error) {
                console.error('Error importing Excel:', error);
                setDeleteError('Failed to parse Excel file');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = ''; // reset input
    };
    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.code.trim() || !formData.name.trim())
            return;
        if (editingAccount) {
            updateChartOfAccount(editingAccount.id, {
                code: formData.code.trim(),
                name: formData.name.trim(),
                nameBn: formData.nameBn.trim(),
                classification: formData.classification,
                accountGroup: formData.accountGroup.trim(),
                normalBalance: formData.normalBalance,
                openingBalance: Number(formData.openingBalance) || 0,
                description: formData.description.trim(),
            });
        }
        else {
            addChartOfAccount({
                code: formData.code.trim(),
                name: formData.name.trim(),
                nameBn: formData.nameBn.trim(),
                classification: formData.classification,
                accountGroup: formData.accountGroup.trim(),
                normalBalance: formData.normalBalance,
                openingBalance: Number(formData.openingBalance) || 0,
                description: formData.description.trim(),
                isActive: true,
            });
        }
        setShowAddModal(false);
    };
    const handleConfirmDelete = (id: string) => {
        const res = deleteChartOfAccount(id, true);
        if (res.success) {
            setAccountToDelete(null);
            setDeleteError(null);
        } else {
            setDeleteError(res.message || 'Failed to delete account');
        }
    };
    const getClassificationBadge = (cls: ChartOfAccount['classification']) => {
        switch (cls) {
            case 'Asset':
                return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'Liability':
                return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'Equity':
                return 'bg-purple-50 text-purple-700 border-purple-200';
            case 'Revenue':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'Expense':
                return 'bg-rose-50 text-rose-700 border-rose-200';
            default:
                return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };
    return (<div className="space-y-4">
      {deleteError && (<div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0"/>
            <span>{deleteError}</span>
          </div>
          <button type="button" onClick={() => setDeleteError(null)} className="text-rose-500 hover:text-rose-800">
            ✕
          </button>
        </div>)}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 block">
            {'Total Assets'}
          </span>
          <span className="text-base sm:text-lg font-black text-blue-600">
            {profile.currencySymbol}{stats.totalAssets.toLocaleString()}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 block">
            {'Total Liabilities'}
          </span>
          <span className="text-base sm:text-lg font-black text-amber-600">
            {profile.currencySymbol}{stats.totalLiabilities.toLocaleString()}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 block">
            {'Owner Equity'}
          </span>
          <span className="text-base sm:text-lg font-black text-purple-600">
            {profile.currencySymbol}{stats.totalEquity.toLocaleString()}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 block">
            {'Operating Revenue'}
          </span>
          <span className="text-base sm:text-lg font-black text-emerald-600">
            {profile.currencySymbol}{stats.totalRevenue.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 font-semibold block mt-0.5 truncate" title={`Sales Revenue: ${profile.currencySymbol}${stats.salesRevenue.toLocaleString()} + Project Sales: ${profile.currencySymbol}${stats.projectRevenue.toLocaleString()}`}>
            Sales: {profile.currencySymbol}{stats.salesRevenue.toLocaleString()} + Prj: {profile.currencySymbol}{stats.projectRevenue.toLocaleString()}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold text-slate-500 block">
            {'Operating Expenses'}
          </span>
          <span className="text-base sm:text-lg font-black text-rose-600">
            {profile.currencySymbol}{stats.totalExpenses.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 font-semibold block mt-0.5 truncate" title={`General Expenses: ${profile.currencySymbol}${stats.generalExpenses.toLocaleString()} + Project Expenses: ${profile.currencySymbol}${stats.projectExpenses.toLocaleString()}`}>
            General: {profile.currencySymbol}{stats.generalExpenses.toLocaleString()} + Prj: {profile.currencySymbol}{stats.projectExpenses.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Action Header & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"/>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={'Search account code or name...'} className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-900"/>
          </div>

          {/* Classification Filter */}
          <div className="flex items-center gap-1">
            {['ALL', 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].map((cls) => (<button key={cls} type="button" onClick={() => setFilterClassification(cls)} className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterClassification === cls
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {cls === 'ALL' ? ('All') : cls}
              </button>))}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <input type="file" accept=".xlsx, .xls, .csv" id="coa-upload" className="hidden" onChange={handleImportExcel}/>
          <label htmlFor="coa-upload" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer">
            <Upload className="w-3.5 h-3.5"/>
            <span>{'Upload'}</span>
          </label>
          
          <button type="button" onClick={handleExportExcel} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
            <Download className="w-3.5 h-3.5"/>
            <span>{'Excel'}</span>
          </button>

          <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
            <Printer className="w-3.5 h-3.5"/>
            <span>{'Print'}</span>
          </button>

          {canManageCOA && (<button type="button" id="btn-add-coa-head" onClick={handleOpenAdd} className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-all">
              <Plus className="w-4 h-4"/>
              <span>{'Add Account Head'}</span>
            </button>)}
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Account Group</th>
                <th className="py-3 px-4 text-center">Normal Bal</th>
                <th className="py-3 px-4 text-right">Current Balance</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccounts.length === 0 ? (<tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                    {'No chart of account entries match your filter.'}
                  </td>
                </tr>) : (filteredAccounts.map((acc) => (<tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {acc.code}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{acc.name}</div>
                      {acc.nameBn && <div className="text-[11px] text-slate-500">{acc.nameBn}</div>}
                      {acc.description && (<div className="text-[10px] text-slate-400 truncate max-w-xs">{acc.description}</div>)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getClassificationBadge(acc.classification)}`}>
                        {acc.classification}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-600">{acc.accountGroup}</td>
                    <td className="py-3 px-4 text-center font-mono text-[11px] font-semibold text-slate-500">
                      {acc.normalBalance}
                    </td>
                    <td className="py-3 px-4 text-right font-black font-mono text-slate-900 text-[13px]">
                      {profile.currencySymbol}{acc.currentBalance.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {acc.isSystem ? (<span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          <Lock className="w-3 h-3"/> System
                        </span>) : (<span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          <CheckCircle2 className="w-3 h-3"/> Active
                        </span>)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canEditAccount && (
                          <button type="button" onClick={() => handleOpenEdit(acc)} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg" title="Edit">
                            <Edit2 className="w-3.5 h-3.5"/>
                          </button>
                        )}
                        {acc.isSystem ? (
                          <span className="p-1.5 text-slate-300 cursor-not-allowed" title="System account is core to the ERP and cannot be deleted">
                            <Lock className="w-3.5 h-3.5"/>
                          </span>
                        ) : canDeleteAccount ? (
                          <button type="button" onClick={() => { setDeleteError(null); setAccountToDelete(acc); }} className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer" title="Delete">
                            <Trash2 className="w-3.5 h-3.5"/>
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>)))}
            </tbody>
            {filteredAccounts.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50/90 border-t-2 border-slate-300 font-bold">
                  <td colSpan={5} className="py-3.5 px-4 text-right text-xs uppercase tracking-wider text-slate-700">
                    {filterClassification === 'ALL'
                      ? 'Total Balance (Filtered Accounts):'
                      : `Total ${filterClassification}:`}
                  </td>
                  <td className="py-3.5 px-4 text-right font-black font-mono text-emerald-700 text-sm">
                    {profile.currencySymbol}{filteredAccountsTotal.toLocaleString()}
                  </td>
                  <td colSpan={2} className="py-3.5 px-4 text-center text-[11px] text-slate-500 font-medium">
                    {filteredAccounts.length} {filteredAccounts.length === 1 ? 'Account' : 'Accounts'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Add / Edit COA Modal */}
      {showAddModal && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleFormSubmit} className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-600"/>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingAccount
                ?
                    'Edit Account Head'
                :
                    'Add Chart of Account Head'}
                </h3>
              </div>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Account Code *'}
                  </label>
                  <input type="text" required value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="e.g. 1010" className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold"/>
                </div>
                <div className="col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Classification *'}
                  </label>
                  <select value={formData.classification} onChange={(e) => {
                const cls = e.target.value as ChartOfAccount['classification'];
                const newGroup = cls === 'Asset'
                    ? 'Current Assets'
                    : cls === 'Liability'
                        ? 'Current Liabilities'
                        : cls === 'Equity'
                            ? 'Capital & Reserves'
                            : cls === 'Revenue'
                                ? 'Operating Revenue'
                                : 'Operating Expense';
                const newCode = !editingAccount ? generateNextCode(cls, newGroup) : formData.code;
                setFormData({
                    ...formData,
                    code: newCode,
                    classification: cls,
                    normalBalance: cls === 'Asset' || cls === 'Expense' ? 'Debit' : 'Credit',
                    accountGroup: newGroup,
                });
            }} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold">
                    <option value="Asset">Asset</option>
                    <option value="Liability">Liability</option>
                    <option value="Equity">Equity</option>
                    <option value="Revenue">Revenue</option>
                    <option value="Expense">Expense</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Account Name (EN) *'}
                  </label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Equipment & Machinery" className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold"/>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Account Name (BN)'}
                  </label>
                  <input type="text" value={formData.nameBn} onChange={(e) => setFormData({ ...formData, nameBn: e.target.value })} placeholder="e.g. প্রজেক্ট খরচ" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Account Group'}
                  </label>
                  <select value={formData.accountGroup} onChange={(e) => {
                const newGroup = e.target.value;
                const newCode = !editingAccount ? generateNextCode(formData.classification, newGroup) : formData.code;
                setFormData({ ...formData, accountGroup: newGroup, code: newCode });
            }} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold bg-white">
                    {formData.classification === 'Asset' && (<>
                        <option value="Current Assets">Current Assets</option>
                        <option value="Fixed Assets">Fixed Assets</option>
                        <option value="Non-Current Assets">Non-Current Assets</option>
                      </>)}
                    {formData.classification === 'Liability' && (<>
                        <option value="Current Liabilities">Current Liabilities</option>
                        <option value="Long-Term Liabilities">Long-Term Liabilities</option>
                      </>)}
                    {formData.classification === 'Equity' && (<>
                        <option value="Capital & Reserves">Capital & Reserves</option>
                        <option value="Equity">Equity</option>
                      </>)}
                    {formData.classification === 'Revenue' && (<>
                        <option value="Operating Revenue">Operating Revenue</option>
                        <option value="Non-Operating Revenue">Non-Operating Revenue</option>
                      </>)}
                    {formData.classification === 'Expense' && (<>
                        <option value="Direct Expenses / COGS">Direct Expenses / COGS</option>
                        <option value="Operating Expenses">Operating Expenses</option>
                        <option value="Administrative Expenses">Administrative Expenses</option>
                        <option value="Selling & Distribution">Selling & Distribution</option>
                      </>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Normal Balance'}
                  </label>
                  <select value={formData.normalBalance} onChange={(e) => setFormData({ ...formData, normalBalance: e.target.value as any })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold">
                    <option value="Debit">Debit</option>
                    <option value="Credit">Credit</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Opening Balance (Tk)'}
                  </label>
                  <input type="number" step="any" value={formData.openingBalance} onChange={(e) => setFormData({ ...formData, openingBalance: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold"/>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Description / Notes'}
                </label>
                <textarea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Additional context or accounting notes..." className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {'Cancel'}
              </button>
              <button type="submit" className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs">
                {'Save Account'}
              </button>
            </div>
          </form>
        </div>)}

      {/* Delete Confirmation Modal */}
      {accountToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  Delete Account Head
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-xs font-mono font-bold text-slate-500">[{accountToDelete.code}]</div>
                <div className="text-sm font-bold text-slate-900">{accountToDelete.name}</div>
                <div className="text-xs text-slate-500 font-medium flex items-center justify-between pt-1">
                  <span>Class: <strong>{accountToDelete.classification}</strong></span>
                  <span>Balance: <strong className="font-mono text-slate-900">{profile.currencySymbol}{accountToDelete.currentBalance.toLocaleString()}</strong></span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Permanent Deletion</span>
                </div>
                <p>
                  Deleting this account head will remove it from the Chart of Accounts and clear its linked journal entries so you can create new custom account heads cleanly.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 flex items-center justify-between">
                <span>{deleteError}</span>
                <button type="button" onClick={() => setDeleteError(null)} className="text-rose-500 hover:text-rose-800">✕</button>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete(accountToDelete.id)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm & Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>);
};
