import React, { useState, useEffect, useMemo } from 'react';
import { ChartOfAccount, AccountingTransaction, SalesInvoice, PurchaseOrder, Product, Customer, Language, CompanyProfile, } from '../../types';
import { Scale, TrendingUp, FileText, DollarSign, CheckCircle2, AlertCircle, Building, ArrowDownRight, ArrowUpRight, Edit2, } from 'lucide-react';
import { calculateSingleAccountBalance, calculateTotalCustomerReceivables, calculateTotalSupplierPayables, isSupplierPaymentTransaction, calculateInventoryValuation, isProjectTransaction, isDueReceivableTransaction, isAdvanceDepositTransaction, isAdvanceAdjustmentTransaction } from '../../utils/accountUtils';
import { useApp } from '../../context/AppContext';
interface IFRSStatementsProps {
    reportId: string;
    chartOfAccounts: ChartOfAccount[];
    transactions: AccountingTransaction[];
    invoices: SalesInvoice[];
    purchaseOrders: PurchaseOrder[];
    products: Product[];
    customers: Customer[];
    profile: CompanyProfile;
    language: Language;
}
export const IFRSStatements: React.FC<IFRSStatementsProps> = ({ reportId, chartOfAccounts, transactions, invoices, purchaseOrders, products, customers, profile, language, }) => {
    const { updateProfile, journalEntries = [], projects = [] } = useApp();
    const isBn = language === 'bn';
    const currency = profile.currencySymbol || "Tk";
    const configuredTaxRate = profile.incomeTaxRate !== undefined ? profile.incomeTaxRate : 0;
    const [taxRate, setTaxRate] = useState<number>(configuredTaxRate);
    const [isEditingTax, setIsEditingTax] = useState(false);
    const [taxRateInput, setTaxRateInput] = useState<string>(String(configuredTaxRate));

    useEffect(() => {
        if (!isEditingTax) {
            const currentRate = profile.incomeTaxRate !== undefined ? profile.incomeTaxRate : 0;
            setTaxRate(currentRate);
            setTaxRateInput(String(currentRate));
        }
    }, [profile.incomeTaxRate, isEditingTax]);

    const isWiped = useMemo(() => {
        const pettyCashAcc = (chartOfAccounts || []).find((acc) => acc.id === 'coa-1010');
        return !pettyCashAcc || (pettyCashAcc.openingBalance || 0) === 0;
    }, [chartOfAccounts]);
    // -------------------------------------------------------------
    // CALCULATIONS ACROSS SYSTEM
    // -------------------------------------------------------------
    // Gross Revenue & Discounts
    const grossSalesRevenue = useMemo(() => {
        const invoiceTotal = invoices.reduce((sum, inv) => sum + (inv.subtotal || inv.grandTotal), 0);
        
        // Direct non-invoiced operating income transactions from Financial Ledger
        const directIncomeTotal = (transactions || [])
            .filter((t) => {
                if (t.type !== 'INCOME') return false;
                if (isDueReceivableTransaction(t)) return false;
                if (isAdvanceDepositTransaction(t)) return false;
                if (isAdvanceAdjustmentTransaction(t)) return false;
                // Exclude invoice-matching transactions
                if (t.refNo && invoices.some(i => i.invoiceNo && i.invoiceNo.toLowerCase().trim() === t.refNo.toLowerCase().trim())) return false;
                const desc = (t.description || '').toLowerCase();
                if (desc.includes('due collection') || desc.includes('customer due') || desc.includes('invoice #')) return false;
                return true;
            })
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        return invoiceTotal + directIncomeTotal;
    }, [invoices, transactions]);
    const salesDiscounts = useMemo(() => {
        return invoices.reduce((sum, inv) => sum + (inv.discount || 0), 0);
    }, [invoices]);
    const netSalesRevenue = grossSalesRevenue - salesDiscounts;
    // Inventory & COGS
    const invAcc = useMemo(() => {
        return (chartOfAccounts || []).find(a => 
            a.code === '1002' || a.code === '1060' || 
            a.id === 'coa-1002' || a.id === 'coa-1060' ||
            (a.name || '').toLowerCase().includes('raw material') ||
            (a.name || '').toLowerCase().includes('inventory')
        );
    }, [chartOfAccounts]);

    const closingStockValuation = useMemo(() => {
        const calculated = calculateInventoryValuation(products, purchaseOrders, invAcc, journalEntries);
        if (calculated > 0) return calculated;
        return products.reduce((sum, p) => sum + (p.stockOffice + p.stockFactory) * (p.costPrice || 0), 0);
    }, [products, purchaseOrders, invAcc, journalEntries]);

    const rawMaterialPurchases = useMemo(() => {
        return purchaseOrders.reduce((sum, po) => sum + (po.totalAmount || 0), 0);
    }, [purchaseOrders]);
    // Opening stock (baseline estimation for period)
    const openingStockValuation = useMemo(() => {
        return (invAcc?.openingBalance || 0);
    }, [invAcc]);
    const directProductionLabor = useMemo(() => {
        return (transactions || [])
            .filter((t) => t.type === 'EXPENSE' && ((t.category || '').toLowerCase().includes('production labor') || (t.category || '').toLowerCase().includes('factory labor')))
            .reduce((s, t) => s + t.amount, 0);
    }, [transactions]);
    // COGS = Opening Stock + Purchases + Direct Labor - Closing Stock
    const costOfGoodsSold = useMemo(() => {
        const cogsFromStock = Math.max(0, openingStockValuation + rawMaterialPurchases + directProductionLabor - closingStockValuation);
        // Only use poExp as a fallback if NO purchase orders and NO inventory tracking exists at all
        if (rawMaterialPurchases === 0 && closingStockValuation === 0 && openingStockValuation === 0) {
            const poExp = (transactions || []).filter(t => t.type === 'EXPENSE' && !isSupplierPaymentTransaction(t) && (t.category?.toLowerCase().includes('raw') || t.category?.toLowerCase().includes('purchase'))).reduce((s, t) => s + t.amount, 0);
            return poExp;
        }
        return cogsFromStock;
    }, [openingStockValuation, rawMaterialPurchases, directProductionLabor, closingStockValuation, transactions]);
    const grossProfit = netSalesRevenue - costOfGoodsSold;
    const grossMarginPct = netSalesRevenue > 0 ? (grossProfit / netSalesRevenue) * 100 : 0;
    // Itemized Operating Expenses from transactions & chart of accounts
    const operatingExpensesList = useMemo(() => {
        const map = new Map<string, { name: string; nameBn?: string; amount: number }>();
        (transactions || []).filter((t) => {
            if (t.type !== 'EXPENSE') return false;
            // 1. Exclude supplier debt payments / PO settlements (they belong to Accounts Payable & COGS, never OPEX)
            if (isSupplierPaymentTransaction(t)) return false;
            const cat = (t.category || '').toLowerCase();
            const desc = (t.description || '').toLowerCase();
            if (cat.includes('raw') || cat.includes('purchase') || cat.includes('po payment') || desc.includes('payment for purchase order') || desc.includes('supplier')) {
                return false;
            }
            // 2. Exclude direct factory labor (already handled in COGS Section 2)
            if (cat.includes('production labor') || cat.includes('factory labor')) {
                return false;
            }
            // 3. Exclude finance costs / bank charges (handled in Finance Costs Section 4)
            if (cat.includes('bank') || cat.includes('finance') || desc.includes('charge') || desc.includes('interest')) {
                return false;
            }
            return true;
        }).forEach((t) => {
            const cat = t.category || t.accountHead || 'General Operational Expense';
            const existing = map.get(cat);
            if (existing) {
                existing.amount += (Number(t.amount) || 0);
            } else {
                map.set(cat, { name: cat, nameBn: t.categoryBn, amount: Number(t.amount) || 0 });
            }
        });
        if (map.size === 0) {
            (chartOfAccounts || []).filter(a => a.classification === 'Expense' && a.code !== '5001' && a.code !== '5010' && !a.name.toLowerCase().includes('cost of goods') && !a.name.toLowerCase().includes('cogs') && (a.openingBalance || a.currentBalance)).forEach(a => {
                map.set(a.name, { name: a.name, nameBn: a.nameBn, amount: Math.max(0, a.currentBalance || a.openingBalance || 0) });
            });
        }
        return Array.from(map.values());
    }, [transactions, chartOfAccounts]);
    const totalOperatingExpenses = operatingExpensesList.reduce((s, e) => s + e.amount, 0);
    const operatingProfitEBIT = grossProfit - totalOperatingExpenses;
    const financeCosts = useMemo(() => {
        return (transactions || [])
            .filter((t) => t.type === 'EXPENSE' && ((t.category || '').toLowerCase().includes('bank') || (t.category || '').toLowerCase().includes('finance') || (t.description || '').toLowerCase().includes('charge')))
            .reduce((s, t) => s + t.amount, 0);
    }, [transactions]);
    const netProfitBeforeTax = operatingProfitEBIT - financeCosts;
    const taxProvision = Math.max(0, Math.round(netProfitBeforeTax * (taxRate / 100)));
    const netProfitForThePeriod = netProfitBeforeTax - taxProvision;
    const netMarginPct = netSalesRevenue > 0 ? (netProfitForThePeriod / netSalesRevenue) * 100 : 0;
    // -------------------------------------------------------------
    // 16. TRIAL BALANCE
    // -------------------------------------------------------------
    const trialBalanceAccounts = useMemo(() => {
        const totalReceivables = calculateTotalCustomerReceivables(invoices, customers, []);
        const totalPayables = calculateTotalSupplierPayables([], purchaseOrders);
        const totalAdvances = (customers || []).reduce((sum, c) => sum + (c.advanceBalance || 0), 0);

        let cogsAssigned = false;

        const accounts = (chartOfAccounts || []).map((acc) => {
            const nameLower = (acc.name || '').toLowerCase();
            let debit = 0;
            let credit = 0;

            if (acc.classification === 'Asset') {
                if (acc.code === '1003' || acc.code === '1050' || nameLower.includes('receivable')) {
                    debit = totalReceivables > 0 ? totalReceivables : (acc.openingBalance || 0);
                } else if (acc.code === '1002' || acc.code === '1060' || acc.code === '1070' || nameLower.includes('inventory') || nameLower.includes('stock')) {
                    debit = closingStockValuation > 0 ? closingStockValuation : (acc.openingBalance || 0);
                } else {
                    debit = calculateSingleAccountBalance(acc, transactions, invoices, [], journalEntries);
                }
            } else if (acc.classification === 'Liability') {
                if (acc.code === '2001' || acc.code === '2010' || nameLower.includes('payable')) {
                    credit = totalPayables > 0 ? totalPayables : (acc.openingBalance || 0);
                } else if (acc.code === '2002' || acc.code === '2020' || nameLower.includes('advance')) {
                    credit = totalAdvances > 0 ? totalAdvances : (acc.openingBalance || 0);
                } else {
                    credit = acc.currentBalance || acc.openingBalance || 0;
                }
            } else if (acc.classification === 'Equity') {
                const isDrawings = acc.normalBalance === 'Debit' || nameLower.includes('drawing') || (acc.nameBn || '').includes('উত্তোলন');
                if (isDrawings) {
                    let journalDrawingsDelta = 0;
                    (journalEntries || []).forEach(j => {
                        if (j.source === 'PROJECT_SALES' || j.source === 'PROJECT_EXPENSE' || j.source === 'EXPENSE' || j.source === 'SALES' || j.source === 'PURCHASE' || j.source === 'LEDGER_SYNC') return;
                        const isDebit = (j.debitAccountId === acc.id || j.debitAccountId === acc.code || (j.debitAccountName && j.debitAccountName.toLowerCase().trim() === nameLower));
                        const isCredit = (j.creditAccountId === acc.id || j.creditAccountId === acc.code || (j.creditAccountName && j.creditAccountName.toLowerCase().trim() === nameLower));
                        const amt = Number(j.amount) || 0;
                        if (isDebit && !isCredit) journalDrawingsDelta += amt;
                        else if (isCredit && !isDebit) journalDrawingsDelta -= amt;
                    });
                    const txDrawings = (transactions || [])
                        .filter(t => t.type === 'EXPENSE' && ((t.category || '').toLowerCase().includes('drawing') || (t.description || '').toLowerCase().includes('drawing') || (t.accountHead || '').toLowerCase().includes('drawing')))
                        .reduce((s, t) => s + t.amount, 0);
                    debit = Math.max(0, (acc.openingBalance || 0) + journalDrawingsDelta + txDrawings);
                } else {
                    let journalEquityDelta = 0;
                    (journalEntries || []).forEach(j => {
                        if (j.source === 'PROJECT_SALES' || j.source === 'PROJECT_EXPENSE' || j.source === 'EXPENSE' || j.source === 'SALES' || j.source === 'PURCHASE' || j.source === 'LEDGER_SYNC') return;
                        if (j.refNo && (transactions || []).some(t => t.refNo && t.refNo.toLowerCase().trim() === j.refNo.toLowerCase().trim())) return;
                        const isDebit = (j.debitAccountId === acc.id || j.debitAccountId === acc.code || (j.debitAccountName && j.debitAccountName.toLowerCase().trim() === nameLower));
                        const isCredit = (j.creditAccountId === acc.id || j.creditAccountId === acc.code || (j.creditAccountName && j.creditAccountName.toLowerCase().trim() === nameLower));
                        const amt = Number(j.amount) || 0;
                        if (isCredit && !isDebit) journalEquityDelta += amt;
                        else if (isDebit && !isCredit) journalEquityDelta -= amt;
                    });
                    credit = Math.max(0, (acc.openingBalance || 0) + journalEquityDelta);
                }
            } else if (acc.classification === 'Revenue') {
                const isPrj = acc.code === '4002' || acc.code === '4051' || acc.code === '4060' || nameLower.includes('project') || (acc.nameBn || '').includes('প্রজেক্ট');
                if (isPrj) {
                    const prjInvSales = (invoices || [])
                        .filter(i => i.projectId || i.projectCode)
                        .reduce((s, i) => s + (Number(i.grandTotal) || (Number(i.paidAmount) + Number(i.dueAmount)) || 0), 0);
                    
                    const prjTxSales = (transactions || [])
                        .filter(t => t.type === 'INCOME' && !isDueReceivableTransaction(t) && !isAdvanceDepositTransaction(t) && !isAdvanceAdjustmentTransaction(t) && (
                            isProjectTransaction(t) || 
                            (t.category && t.category.toLowerCase().includes('project')) ||
                            (t.accountHead && t.accountHead.toLowerCase().includes('project')) ||
                            (t.refNo && (t.refNo.toUpperCase().startsWith('PRJ-') || (projects || []).some(p => p.code === t.refNo)))
                        ))
                        .reduce((s, t) => s + (Number(t.amount) || 0), 0);

                    let journalPrjDelta = 0;
                    (journalEntries || []).forEach(j => {
                        const isCredit = (j.creditAccountId === acc.id || j.creditAccountId === acc.code || (j.creditAccountName && j.creditAccountName.toLowerCase().trim() === nameLower) || (j.creditAccountName && j.creditAccountName.toLowerCase().includes('project')));
                        const isDebit = (j.debitAccountId === acc.id || j.debitAccountId === acc.code || (j.debitAccountName && j.debitAccountName.toLowerCase().trim() === nameLower) || (j.debitAccountName && j.debitAccountName.toLowerCase().includes('project')));
                        const amt = Number(j.amount) || 0;
                        if (isCredit && !isDebit) journalPrjDelta += amt;
                        else if (isDebit && !isCredit) journalPrjDelta -= amt;
                    });

                    credit = Math.max(
                        (acc.openingBalance || 0) + (acc.currentBalance || 0),
                        (acc.openingBalance || 0) + prjInvSales,
                        (acc.openingBalance || 0) + prjTxSales,
                        (acc.openingBalance || 0) + journalPrjDelta
                    );
                } else if (acc.code === '4001' || acc.code === '4010' || nameLower.includes('sales')) {
                    const nonPrjSales = (invoices || [])
                        .filter(i => !i.projectId && !i.projectCode)
                        .reduce((s, i) => s + (Number(i.grandTotal) || (Number(i.paidAmount) + Number(i.dueAmount)) || 0), 0);
                    credit = (acc.openingBalance || 0) + (nonPrjSales > 0 ? nonPrjSales : (acc.currentBalance || 0));
                } else {
                    credit = (acc.openingBalance || 0) + (acc.currentBalance || 0);
                }
            } else if (acc.classification === 'Expense') {
                const isCogs = (
                    acc.code === '5001' ||
                    acc.code === '5010' ||
                    acc.id === 'coa-5001' ||
                    acc.id === 'coa-5010' ||
                    nameLower.includes('cost of goods') ||
                    nameLower.includes('cogs') ||
                    (acc.nameBn || '').includes('বিক্রিত পণ্যের ব্যয়')
                );
                if (isCogs && !cogsAssigned) {
                    cogsAssigned = true;
                    debit = costOfGoodsSold > 0 ? costOfGoodsSold : ((acc.openingBalance || 0) + (acc.currentBalance || 0));
                } else {
                    debit = (acc.openingBalance || 0) + (acc.currentBalance || 0);
                }
            }

            return {
                code: acc.code,
                name: acc.name,
                nameBn: acc.nameBn,
                type: acc.classification,
                debit,
                credit,
            };
        });

        if (!cogsAssigned && costOfGoodsSold > 0) {
            accounts.push({
                code: '5010',
                name: 'Cost of Goods Sold - Raw Materials & Inks',
                nameBn: 'বিক্রিত পণ্যের ব্যয় (কাঁচামাল ও কালি)',
                type: 'Expense',
                debit: costOfGoodsSold,
                credit: 0,
            });
        }

        return accounts;
    }, [chartOfAccounts, invoices, purchaseOrders, products, customers, transactions, closingStockValuation, costOfGoodsSold, netSalesRevenue, netProfitForThePeriod, journalEntries, projects]);
    // -------------------------------------------------------------
    // 18. IFRS BALANCE SHEET (STATEMENT OF FINANCIAL POSITION)
    // -------------------------------------------------------------
    const balanceSheetData = useMemo(() => {
        const totalReceivables = calculateTotalCustomerReceivables(invoices, customers, []);
        const totalPayables = calculateTotalSupplierPayables([], purchaseOrders);
        const totalAdvances = (customers || []).reduce((sum, c) => sum + (c.advanceBalance || 0), 0);

        // ASSETS
        const nonCurrentAssets = (chartOfAccounts || [])
            .filter((acc) => acc.classification === 'Asset' && (acc.accountGroup === 'Fixed Assets' || acc.code.startsWith('11') || acc.code.startsWith('12') || acc.code.startsWith('15')))
            .map((acc) => ({ name: acc.name, amount: acc.openingBalance || acc.currentBalance || 0 }));

        const totalNonCurrentAssets = nonCurrentAssets.reduce((s, a) => s + a.amount, 0);

        const liquidCashAndBank = (chartOfAccounts || [])
            .filter((acc) => acc.classification === 'Asset' && !(
                acc.accountGroup === 'Fixed Assets' || 
                acc.code.startsWith('11') || acc.code.startsWith('12') || acc.code.startsWith('15') || 
                acc.code === '1002' || acc.code === '1003' || acc.code === '1050' || acc.code === '1060' || acc.code === '1070' ||
                (acc.name || '').toLowerCase().includes('inventory') ||
                (acc.name || '').toLowerCase().includes('receivable') ||
                (acc.name || '').toLowerCase().includes('raw material')
            ))
            .reduce((s, acc) => s + calculateSingleAccountBalance(acc, transactions, invoices, [], journalEntries), 0);

        const currentAssets = [
            { name: 'Inventories at Cost (Raw Materials & Stock)', amount: closingStockValuation },
            { name: 'Trade & Other Receivables (Customer Dues)', amount: totalReceivables },
            { name: 'Cash and Cash Equivalents (Counter Cash, Bank & Wallets)', amount: liquidCashAndBank },
        ];
        const totalCurrentAssets = currentAssets.reduce((s, a) => s + a.amount, 0);
        const totalAssets = totalNonCurrentAssets + totalCurrentAssets;

        // LIABILITIES
        const nonCurrentLiabilities = (chartOfAccounts || [])
            .filter((acc) => acc.classification === 'Liability' && (acc.accountGroup === 'Long-term Liabilities' || acc.code.startsWith('25')))
            .map((acc) => ({ name: acc.name, amount: acc.openingBalance || acc.currentBalance || 0 }));

        const totalNonCurrentLiabilities = nonCurrentLiabilities.reduce((s, l) => s + l.amount, 0);

        const currentLiabilities = [
            { name: 'Trade Payables (Suppliers & Raw Material Vendors)', amount: totalPayables },
            { name: 'Customer Advances & Prepayment Deposits Held', amount: totalAdvances },
        ];

        (chartOfAccounts || [])
            .filter((acc) => acc.classification === 'Liability' && !(
                acc.accountGroup === 'Long-term Liabilities' || 
                acc.code.startsWith('25') || 
                acc.code === '2001' || acc.code === '2010' ||
                acc.code === '2002' || acc.code === '2020' ||
                (acc.name || '').toLowerCase().includes('payable') ||
                (acc.name || '').toLowerCase().includes('supplier') ||
                (acc.name || '').toLowerCase().includes('advance')
            ))
            .forEach((acc) => {
                const bal = acc.openingBalance || acc.currentBalance || 0;
                if (bal > 0) currentLiabilities.push({ name: acc.name, amount: bal });
            });

        const totalCurrentLiabilities = currentLiabilities.reduce((s, l) => s + l.amount, 0);
        const totalLiabilities = totalNonCurrentLiabilities + totalCurrentLiabilities;

        // EQUITY
        const capitalAcc = (chartOfAccounts || []).find((a) => a.code === '3001' || a.code === '3010' || a.name.toLowerCase().includes('capital'));
        let journalCapitalDelta = 0;
        if (capitalAcc) {
            const capNameLower = (capitalAcc.name || '').toLowerCase().trim();
            (journalEntries || []).forEach(j => {
                if (j.source === 'PROJECT_SALES' || j.source === 'PROJECT_EXPENSE' || j.source === 'EXPENSE' || j.source === 'SALES' || j.source === 'PURCHASE' || j.source === 'LEDGER_SYNC') return;
                if (j.refNo && (transactions || []).some(t => t.refNo && t.refNo.toLowerCase().trim() === j.refNo.toLowerCase().trim())) return;
                const isDebit = (j.debitAccountId === capitalAcc.id || j.debitAccountId === capitalAcc.code || (j.debitAccountName && j.debitAccountName.toLowerCase().trim() === capNameLower));
                const isCredit = (j.creditAccountId === capitalAcc.id || j.creditAccountId === capitalAcc.code || (j.creditAccountName && j.creditAccountName.toLowerCase().trim() === capNameLower));
                const amt = Number(j.amount) || 0;
                if (isCredit && !isDebit) journalCapitalDelta += amt;
                else if (isDebit && !isCredit) journalCapitalDelta -= amt;
            });
        }
        const ownerCapital = capitalAcc 
            ? Math.max(0, (capitalAcc.openingBalance || 0) + journalCapitalDelta) 
            : 0;

        const currentPeriodEarnings = netProfitForThePeriod;
        const retainedAcc = (chartOfAccounts || []).find((a) => a.classification === 'Equity' && (a.id === 'coa-3020' || a.name.toLowerCase().includes('retained') || (a.nameBn || '').includes('সংরক্ষিত')));
        const openingRetained = Number(retainedAcc?.openingBalance) || 0;
        // Prior accumulated retained earnings (opening balance from previous fiscal years)
        const retainedEarnings = openingRetained;

        // Owner's Drawings (Contra-Equity reduction)
        const drawingAcc = (chartOfAccounts || []).find((a) => a.classification === 'Equity' && (a.normalBalance === 'Debit' || a.name.toLowerCase().includes('drawing') || (a.nameBn || '').includes('উত্তোলন')));
        let journalDrawingsDelta = 0;
        if (drawingAcc) {
            const drawNameLower = (drawingAcc.name || '').toLowerCase().trim();
            (journalEntries || []).forEach(j => {
                if (j.source === 'PROJECT_SALES' || j.source === 'PROJECT_EXPENSE' || j.source === 'EXPENSE' || j.source === 'SALES' || j.source === 'PURCHASE' || j.source === 'LEDGER_SYNC') return;
                const isDebit = (j.debitAccountId === drawingAcc.id || j.debitAccountId === drawingAcc.code || (j.debitAccountName && j.debitAccountName.toLowerCase().trim() === drawNameLower));
                const isCredit = (j.creditAccountId === drawingAcc.id || j.creditAccountId === drawingAcc.code || (j.creditAccountName && j.creditAccountName.toLowerCase().trim() === drawNameLower));
                const amt = Number(j.amount) || 0;
                if (isDebit && !isCredit) journalDrawingsDelta += amt;
                else if (isCredit && !isDebit) journalDrawingsDelta -= amt;
            });
        }
        const txDrawings = (transactions || [])
            .filter(t => t.type === 'EXPENSE' && ((t.category || '').toLowerCase().includes('drawing') || (t.description || '').toLowerCase().includes('drawing') || (t.accountHead || '').toLowerCase().includes('drawing')))
            .reduce((s, t) => s + t.amount, 0);
        const ownerDrawings = drawingAcc 
            ? Math.max(0, (drawingAcc.openingBalance || 0) + journalDrawingsDelta + txDrawings) 
            : 0;

        const totalEquity = ownerCapital + retainedEarnings + currentPeriodEarnings - ownerDrawings;

        return {
            nonCurrentAssets,
            totalNonCurrentAssets,
            currentAssets,
            totalCurrentAssets,
            totalAssets,
            nonCurrentLiabilities,
            totalNonCurrentLiabilities,
            currentLiabilities,
            totalCurrentLiabilities,
            totalLiabilities,
            ownerCapital,
            retainedEarnings,
            currentPeriodEarnings,
            ownerDrawings,
            totalEquity,
            totalEquityAndLiabilities: totalEquity + totalLiabilities,
        };
    }, [chartOfAccounts, invoices, purchaseOrders, customers, transactions, closingStockValuation, netProfitForThePeriod, journalEntries]);
    // -------------------------------------------------------------
    // 19. STATEMENT OF CASH FLOWS (IAS 7)
    // -------------------------------------------------------------
    const cashFlowData = useMemo(() => {
        // 1. Operating Activities
        const customerReceiptsFromTx = (transactions || []).filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
        const cashReceiptsFromCustomers = Math.max(customerReceiptsFromTx, invoices.reduce((s, inv) => s + (inv.paidAmount || 0), 0));

        const supplierPaymentsFromTx = (transactions || []).filter(t => t.type === 'EXPENSE' && isSupplierPaymentTransaction(t)).reduce((s, t) => s + t.amount, 0);
        const cashPaidToSuppliers = Math.max(supplierPaymentsFromTx, purchaseOrders.reduce((s, po) => s + (po.paidAmount || 0), 0));

        const cashPaidForExpenses = (transactions || [])
            .filter((t) => t.type === 'EXPENSE' && !isSupplierPaymentTransaction(t))
            .reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const netCashOperating = cashReceiptsFromCustomers - cashPaidToSuppliers - cashPaidForExpenses;

        // 2. Investing Activities (Purchase/sale of fixed assets from transactions)
        const capitalExpenditureMachinery = (transactions || [])
            .filter((t) => t.type === 'EXPENSE' && ((t.category || '').toLowerCase().includes('machinery') || (t.category || '').toLowerCase().includes('equipment')))
            .reduce((s, t) => s - (Number(t.amount) || 0), 0);
        const netCashInvesting = capitalExpenditureMachinery;

        // 3. Financing Activities (Capital contributions, Loan repayments & owner drawings)
        let capitalInfusions = 0;
        (journalEntries || []).forEach(j => {
            if (j.source === 'PROJECT_SALES' || j.source === 'PROJECT_EXPENSE' || j.source === 'EXPENSE' || j.source === 'SALES' || j.source === 'PURCHASE' || j.source === 'LEDGER_SYNC') return;
            const cName = (j.creditAccountName || '').toLowerCase();
            const cId = (j.creditAccountId || '').toLowerCase();
            if (cId === 'coa-3001' || cId === '3001' || cName.includes('capital') || cName.includes('মূলধন')) {
                capitalInfusions += Number(j.amount) || 0;
            }
        });

        const loanRepayments = (transactions || [])
            .filter((t) => t.type === 'EXPENSE' && ((t.category || '').toLowerCase().includes('loan') || (t.category || '').toLowerCase().includes('borrowing')))
            .reduce((s, t) => s - (Number(t.amount) || 0), 0);

        const txDrawings = (transactions || [])
            .filter((t) => t.type === 'EXPENSE' && ((t.category || '').toLowerCase().includes('drawing') || (t.category || '').toLowerCase().includes('owner drawing')))
            .reduce((s, t) => s - (Number(t.amount) || 0), 0);

        let journalDrawings = 0;
        (journalEntries || []).forEach(j => {
            if (j.source === 'PROJECT_SALES' || j.source === 'PROJECT_EXPENSE' || j.source === 'EXPENSE' || j.source === 'SALES' || j.source === 'PURCHASE' || j.source === 'LEDGER_SYNC') return;
            const dName = (j.debitAccountName || '').toLowerCase();
            const dId = (j.debitAccountId || '').toLowerCase();
            if (dId === 'coa-3002' || dId === '3002' || dName.includes('drawing') || dName.includes('উত্তোলন')) {
                journalDrawings -= Number(j.amount) || 0;
            }
        });

        const ownerDrawings = txDrawings + journalDrawings;
        const netCashFinancing = capitalInfusions + loanRepayments + ownerDrawings;

        const netChangeInCash = netCashOperating + netCashInvesting + netCashFinancing;

        // Opening cash & bank balance from chart of accounts
        const openingCash = (chartOfAccounts || [])
            .filter((a) => a.classification === 'Asset' && !(
                a.accountGroup === 'Fixed Assets' || 
                a.code.startsWith('11') || a.code.startsWith('12') || a.code.startsWith('15') || 
                a.code === '1002' || a.code === '1003' || a.code === '1050' || a.code === '1060' || a.code === '1070' ||
                (a.name || '').toLowerCase().includes('inventory') ||
                (a.name || '').toLowerCase().includes('receivable') ||
                (a.name || '').toLowerCase().includes('raw material')
            ))
            .reduce((s, a) => s + (Number(a.openingBalance) || 0), 0);

        const closingCash = openingCash + netChangeInCash;

        return {
            cashReceiptsFromCustomers,
            cashPaidToSuppliers,
            cashPaidForExpenses,
            netCashOperating,
            capitalExpenditureMachinery,
            netCashInvesting,
            capitalInfusions,
            loanRepayments,
            ownerDrawings,
            netCashFinancing,
            netChangeInCash,
            openingCash,
            closingCash,
        };
    }, [invoices, purchaseOrders, transactions, chartOfAccounts, journalEntries]);
    const totalTbDebits = useMemo(() => trialBalanceAccounts.reduce((s, a) => s + a.debit, 0), [trialBalanceAccounts]);
    const totalTbCredits = useMemo(() => trialBalanceAccounts.reduce((s, a) => s + a.credit, 0), [trialBalanceAccounts]);
    const isTbBalanced = Math.abs(totalTbDebits - totalTbCredits) < 0.01;

    return (<div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* REPORT 16: TRIAL BALANCE */}
      {/* ------------------------------------------------------------- */}
      {reportId === 'trial-balance' && (<div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {'General Ledger Trial Balance'}
              </h3>
              <p className="text-xs text-slate-500">
                {'Verification of double-entry ledger parity across Assets, Liabilities, Equity, Revenue, and Expenses'}
              </p>
            </div>
            {isTbBalanced ? (
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600"/>
                <span>{isBn ? "রেওয়ামিল গাণিতিকভাবে শতভাগ ব্যালেন্সড" : "Trial Balance is Mathematically Balanced"}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-rose-50 text-rose-800 px-3 py-1.5 rounded-lg border border-rose-200 text-xs font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600"/>
                <span>{isBn ? `রেওয়ামিলে গরমিল: ${currency} ${Math.abs(totalTbDebits - totalTbCredits).toLocaleString()}` : `Trial Balance Out of Balance: ${currency} ${Math.abs(totalTbDebits - totalTbCredits).toLocaleString()}`}</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">{'Code'}</th>
                    <th className="py-3 px-4">{'Account Title'}</th>
                    <th className="py-3 px-4">{'Classification'}</th>
                    <th className="py-3 px-4 text-right">{"Debit BalanceTk"}</th>
                    <th className="py-3 px-4 text-right">{"Credit BalanceTk"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trialBalanceAccounts.map((acc, idx) => (<tr key={acc.code} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-700">{acc.code}</td>
                      <td className="py-2.5 px-4">
                        <span className="font-semibold text-slate-900 block">{acc.name}</span>
                        {acc.nameBn && <span className="text-[11px] text-slate-500 block">{acc.nameBn}</span>}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${acc.type === 'Asset'
                    ? 'bg-blue-50 text-blue-700'
                    : acc.type === 'Liability'
                        ? 'bg-rose-50 text-rose-700'
                        : acc.type === 'Equity'
                            ? 'bg-purple-50 text-purple-700'
                            : acc.type === 'Revenue'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'}`}>
                          {acc.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        {acc.debit > 0 ? `${currency} ${acc.debit.toLocaleString()}` : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        {acc.credit > 0 ? `${currency} ${acc.credit.toLocaleString()}` : '-'}
                      </td>
                    </tr>))}
                </tbody>
                <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300 text-sm">
                  <tr>
                    <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider text-xs">
                      {'Grand Total Balances:'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900">
                      {currency} {trialBalanceAccounts.reduce((s, a) => s + a.debit, 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900">
                      {currency} {trialBalanceAccounts.reduce((s, a) => s + a.credit, 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>)}

      {/* ------------------------------------------------------------- */}
      {/* REPORT 17: PROFIT & LOSS ACCOUNT (IFRS IAS 1) */}
      {/* ------------------------------------------------------------- */}
      {reportId === 'profit-loss' && (<div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200">
                  IFRS / IAS 1 Compliant Income Statement
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {'Statement of Profit or Loss'}
                </h3>
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[11px] text-slate-400 block">{'Gross Margin'}</span>
                  <span className="font-bold text-slate-900 text-base">{grossMarginPct.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">{'Tax Provision'}</span>
                  <span className="font-bold text-rose-600 text-base">{taxRate}%</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">{'Net Profit for Period'}</span>
                  <span className="font-black text-emerald-700 text-xl">
                    {currency} {netProfitForThePeriod.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-5">{'Particulars'}</th>
                  <th className="py-3 px-5 text-right font-mono">{'Note / Subtotal'}</th>
                  <th className="py-3 px-5 text-right font-mono">{"TotalTk"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* REVENUE */}
                <tr className="bg-slate-50/40">
                  <td colSpan={3} className="py-2.5 px-5 font-bold uppercase tracking-wider text-[11px] text-slate-700">
                    1. {'Revenue from Contracts with Customers'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-5 pl-8 text-slate-800">{'Gross Sales Revenue'}</td>
                  <td className="py-2 px-5 text-right font-mono text-slate-600">{currency} {grossSalesRevenue.toLocaleString()}</td>
                  <td className="py-2 px-5 text-right font-mono text-slate-400">-</td>
                </tr>
                <tr>
                  <td className="py-2 px-5 pl-8 text-rose-600">{'Less: Sales Discounts & Allowances'}</td>
                  <td className="py-2 px-5 text-right font-mono text-rose-600">({currency} {salesDiscounts.toLocaleString()})</td>
                  <td className="py-2 px-5 text-right font-mono text-slate-400">-</td>
                </tr>
                <tr className="bg-slate-50/60 font-bold">
                  <td className="py-2.5 px-5 pl-8 text-slate-900">{'Net Revenue / Sales Turnover'}</td>
                  <td className="py-2.5 px-5 text-right font-mono text-slate-400">-</td>
                  <td className="py-2.5 px-5 text-right font-mono text-slate-900 text-sm">{currency} {netSalesRevenue.toLocaleString()}</td>
                </tr>

                {/* COGS */}
                <tr className="bg-slate-50/40">
                  <td colSpan={3} className="py-2.5 px-5 font-bold uppercase tracking-wider text-[11px] text-slate-700">
                    2. {'Cost of Goods Sold (COGS)'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-5 pl-8 text-slate-700">{'Opening Raw Materials & Stock'}</td>
                  <td className="py-2 px-5 text-right font-mono text-slate-600">{currency} {openingStockValuation.toLocaleString()}</td>
                  <td className="py-2 px-5 text-right font-mono text-slate-400">-</td>
                </tr>
                <tr>
                  <td className="py-2 px-5 pl-8 text-slate-700">{'Add: Raw Material Purchases'}</td>
                  <td className="py-2 px-5 text-right font-mono text-slate-600">{currency} {rawMaterialPurchases.toLocaleString()}</td>
                  <td className="py-2 px-5 text-right font-mono text-slate-400">-</td>
                </tr>
                <tr>
                  <td className="py-2 px-5 pl-8 text-slate-700">{'Add: Direct Production Labor'}</td>
                  <td className="py-2 px-5 text-right font-mono text-slate-600">{currency} {directProductionLabor.toLocaleString()}</td>
                  <td className="py-2 px-5 text-right font-mono text-slate-400">-</td>
                </tr>
                <tr>
                  <td className="py-2 px-5 pl-8 text-emerald-700">{'Less: Closing Inventory at Cost'}</td>
                  <td className="py-2 px-5 text-right font-mono text-emerald-700">({currency} {closingStockValuation.toLocaleString()})</td>
                  <td className="py-2 px-5 text-right font-mono text-slate-400">-</td>
                </tr>
                <tr className="bg-slate-50/60 font-bold">
                  <td className="py-2.5 px-5 pl-8 text-rose-700">{'Total Cost of Sales'}</td>
                  <td className="py-2.5 px-5 text-right font-mono text-slate-400">-</td>
                  <td className="py-2.5 px-5 text-right font-mono text-rose-700">({currency} {costOfGoodsSold.toLocaleString()})</td>
                </tr>

                {/* GROSS PROFIT */}
                <tr className="bg-emerald-50/60 font-black border-y-2 border-emerald-200 text-sm">
                  <td className="py-3 px-5 text-emerald-900 uppercase">
                    {'GROSS PROFIT'} ({grossMarginPct.toFixed(1)}%)
                  </td>
                  <td className="py-3 px-5 text-right font-mono text-slate-400">-</td>
                  <td className="py-3 px-5 text-right font-mono text-emerald-800 text-base">
                    {currency} {grossProfit.toLocaleString()}
                  </td>
                </tr>

                {/* OPERATING EXPENSES */}
                <tr className="bg-slate-50/40">
                  <td colSpan={3} className="py-2.5 px-5 font-bold uppercase tracking-wider text-[11px] text-slate-700">
                    3. {'Operating & Administrative Expenses'}
                  </td>
                </tr>
                {operatingExpensesList.map((exp) => (<tr key={exp.name}>
                    <td className="py-2 px-5 pl-8 text-slate-700">
                      {exp.name}
                    </td>
                    <td className="py-2 px-5 text-right font-mono text-slate-600">{currency} {exp.amount.toLocaleString()}</td>
                    <td className="py-2 px-5 text-right font-mono text-slate-400">-</td>
                  </tr>))}
                <tr className="bg-slate-50/60 font-bold">
                  <td className="py-2.5 px-5 pl-8 text-rose-700">{'Total Operating Expenses'}</td>
                  <td className="py-2.5 px-5 text-right font-mono text-slate-400">-</td>
                  <td className="py-2.5 px-5 text-right font-mono text-rose-700">({currency} {totalOperatingExpenses.toLocaleString()})</td>
                </tr>

                {/* OPERATING PROFIT EBIT */}
                <tr className="bg-slate-100 font-bold text-slate-900 border-t border-slate-300">
                  <td className="py-2.5 px-5 uppercase">
                    {'OPERATING PROFIT (EBIT)'}
                  </td>
                  <td className="py-2.5 px-5 text-right font-mono text-slate-400">-</td>
                  <td className="py-2.5 px-5 text-right font-mono text-slate-900 text-sm">
                    {currency} {operatingProfitEBIT.toLocaleString()}
                  </td>
                </tr>

                {/* FINANCE & TAX */}
                <tr>
                  <td className="py-2 px-5 pl-8 text-slate-700">{'Finance Costs / Bank Interest'}</td>
                  <td className="py-2 px-5 text-right font-mono text-slate-400">-</td>
                  <td className="py-2 px-5 text-right font-mono text-rose-600">({currency} {financeCosts.toLocaleString()})</td>
                </tr>
                <tr className="font-semibold text-slate-800">
                  <td className="py-2 px-5 pl-8">{'Net Profit Before Tax'}</td>
                  <td className="py-2 px-5 text-right font-mono text-slate-400">-</td>
                  <td className="py-2 px-5 text-right font-mono text-slate-900">{currency} {netProfitBeforeTax.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-2 px-5 pl-8 text-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <span>{'Income Tax Expense / Provision'} ({taxRate}%)</span>
                      {!isEditingTax ? (
                        <button
                          type="button"
                          onClick={() => {
                            setTaxRateInput(String(taxRate));
                            setIsEditingTax(true);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md cursor-pointer transition-colors print:hidden"
                          title={isBn ? "ট্যাক্স রেট পরিবর্তন করুন" : "Change Corporate Tax Rate"}
                        >
                          <Edit2 className="w-3 h-3 text-amber-600" />
                          <span>{isBn ? "পরিবর্তন" : "Change %"}</span>
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 print:hidden">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={taxRateInput}
                            onChange={(e) => setTaxRateInput(e.target.value)}
                            className="w-16 px-2 py-0.5 text-xs font-mono font-bold border border-amber-400 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            autoFocus
                          />
                          <span className="text-xs font-bold text-slate-600">%</span>
                          <button
                            type="button"
                            onClick={() => {
                              const parsed = Math.max(0, Math.min(100, Number(taxRateInput) || 0));
                              setTaxRate(parsed);
                              updateProfile({ incomeTaxRate: parsed });
                              setIsEditingTax(false);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md cursor-pointer shadow-2xs"
                            title={isBn ? "কোম্পানি প্রোফাইলে সেভ করুন" : "Save as default in Company Profile"}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{isBn ? "সংরক্ষণ" : "Save"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTaxRateInput(String(taxRate));
                              setIsEditingTax(false);
                            }}
                            className="px-2 py-0.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md cursor-pointer"
                          >
                            {isBn ? "বাতিল" : "Cancel"}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-5 text-right font-mono text-slate-400">-</td>
                  <td className="py-2 px-5 text-right font-mono text-rose-600">({currency} {taxProvision.toLocaleString()})</td>
                </tr>

                {/* NET PROFIT */}
                <tr className="bg-emerald-100/70 font-black border-y-2 border-emerald-400 text-sm text-emerald-950">
                  <td className="py-3.5 px-5 uppercase">
                    {'NET PROFIT FOR THE PERIOD'}
                  </td>
                  <td className="py-3.5 px-5 text-right font-mono text-emerald-800 font-bold">
                    Margin: {netMarginPct.toFixed(1)}%
                  </td>
                  <td className="py-3.5 px-5 text-right font-mono text-emerald-900 text-lg">
                    {currency} {netProfitForThePeriod.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>)}

      {/* ------------------------------------------------------------- */}
      {/* REPORT 18: IFRS BALANCE SHEET */}
      {/* ------------------------------------------------------------- */}
      {reportId === 'balance-sheet' && (<div className="space-y-6">
          <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                IFRS / IAS 1 Financial Position Statement
              </span>
              <h3 className="text-base font-bold mt-0.5">
                {'Statement of Financial Position (Balance Sheet)'}
              </h3>
            </div>
            {Math.abs(balanceSheetData.totalAssets - balanceSheetData.totalEquityAndLiabilities) < 0.01 ? (
              <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-500/30 text-xs font-bold font-mono">
                <CheckCircle2 className="w-4 h-4 text-emerald-400"/>
                <span>{isBn ? "মোট সম্পদ = মোট ইকুইটি ও দায় (ব্যালেন্সড)" : "Total Assets === Total Equity & Liabilities"}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-rose-500/20 text-rose-300 px-3 py-1.5 rounded-lg border border-rose-500/30 text-xs font-bold font-mono">
                <AlertCircle className="w-4 h-4 text-rose-400"/>
                <span>{isBn ? `ব্যালেন্স শিটে গরমিল: ${currency} ${Math.abs(balanceSheetData.totalAssets - balanceSheetData.totalEquityAndLiabilities).toLocaleString()}` : `Balance Sheet Mismatch: ${currency} ${Math.abs(balanceSheetData.totalAssets - balanceSheetData.totalEquityAndLiabilities).toLocaleString()}`}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ASSETS */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-3 bg-slate-100 border-b border-slate-200">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    1. {'ASSETS'}
                  </h4>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      {'Non-Current Assets:'}
                    </span>
                    <div className="space-y-2">
                      {balanceSheetData.nonCurrentAssets.map((item) => (<div key={item.name} className="flex justify-between text-xs py-1 border-b border-slate-100">
                          <span className="text-slate-700">{item.name}</span>
                          <span className="font-mono font-bold text-slate-900 shrink-0 ml-2">
                            {currency} {item.amount.toLocaleString()}
                          </span>
                        </div>))}
                      <div className="flex justify-between text-xs font-bold text-slate-800 pt-1">
                        <span>{'Total Non-Current Assets:'}</span>
                        <span className="font-mono">{currency} {balanceSheetData.totalNonCurrentAssets.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      {'Current Assets:'}
                    </span>
                    <div className="space-y-2">
                      {balanceSheetData.currentAssets.map((item) => (<div key={item.name} className="flex justify-between text-xs py-1 border-b border-slate-100">
                          <span className="text-slate-700">{item.name}</span>
                          <span className="font-mono font-bold text-slate-900 shrink-0 ml-2">
                            {currency} {item.amount.toLocaleString()}
                          </span>
                        </div>))}
                      <div className="flex justify-between text-xs font-bold text-slate-800 pt-1">
                        <span>{'Total Current Assets:'}</span>
                        <span className="font-mono">{currency} {balanceSheetData.totalCurrentAssets.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-100 border-t-2 border-slate-300 flex justify-between items-center font-black text-slate-900 text-sm">
                <span className="uppercase">{'TOTAL ASSETS:'}</span>
                <span className="font-mono text-base text-slate-900">
                  {currency} {balanceSheetData.totalAssets.toLocaleString()}
                </span>
              </div>
            </div>

            {/* EQUITY & LIABILITIES */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-3 bg-slate-100 border-b border-slate-200">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    2. {'EQUITY & LIABILITIES'}
                  </h4>
                </div>
                <div className="p-4 space-y-4">
                  {/* EQUITY */}
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      {'Owner’s Equity:'}
                    </span>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs py-1 border-b border-slate-100">
                        <span className="text-slate-700">{'Owner’s Capital'}</span>
                        <span className="font-mono font-bold text-slate-900">{currency} {balanceSheetData.ownerCapital.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1 border-b border-slate-100">
                        <span className="text-slate-700">{'Retained Earnings'}</span>
                        <span className="font-mono font-bold text-slate-900">{currency} {balanceSheetData.retainedEarnings.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1 border-b border-slate-100">
                        <span className="text-slate-700">{'Current Period Net Profit'}</span>
                        <span className="font-mono font-bold text-emerald-700">{currency} {balanceSheetData.currentPeriodEarnings.toLocaleString()}</span>
                      </div>
                      {balanceSheetData.ownerDrawings > 0 && (
                        <div className="flex justify-between text-xs py-1 border-b border-slate-100 text-rose-600">
                          <span>{isBn ? 'বাদ: মালিকের ব্যক্তিগত উত্তোলন' : 'Less: Owner’s Personal Drawings'}</span>
                          <span className="font-mono font-bold">-{currency} {balanceSheetData.ownerDrawings.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs font-bold text-slate-800 pt-1">
                        <span>{'Total Equity:'}</span>
                        <span className="font-mono">{currency} {balanceSheetData.totalEquity.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* LIABILITIES */}
                  <div className="pt-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      {'Liabilities:'}
                    </span>
                    <div className="space-y-2">
                      {balanceSheetData.nonCurrentLiabilities.map((item) => (<div key={item.name} className="flex justify-between text-xs py-1 border-b border-slate-100">
                          <span className="text-slate-700">{item.name}</span>
                          <span className="font-mono font-bold text-slate-900 shrink-0 ml-2">
                            {currency} {item.amount.toLocaleString()}
                          </span>
                        </div>))}
                      {balanceSheetData.currentLiabilities.map((item) => (<div key={item.name} className="flex justify-between text-xs py-1 border-b border-slate-100">
                          <span className="text-slate-700">{item.name}</span>
                          <span className="font-mono font-bold text-slate-900 shrink-0 ml-2">
                            {currency} {item.amount.toLocaleString()}
                          </span>
                        </div>))}
                      <div className="flex justify-between text-xs font-bold text-slate-800 pt-1">
                        <span>{'Total Liabilities:'}</span>
                        <span className="font-mono">{currency} {balanceSheetData.totalLiabilities.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-100 border-t-2 border-slate-300 flex justify-between items-center font-black text-slate-900 text-sm">
                <span className="uppercase">{'TOTAL EQUITY & LIABILITIES:'}</span>
                <span className="font-mono text-base text-slate-900">
                  {currency} {balanceSheetData.totalEquityAndLiabilities.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>)}

      {/* ------------------------------------------------------------- */}
      {/* REPORT 19: CASH FLOW STATEMENT (IAS 7) */}
      {/* ------------------------------------------------------------- */}
      {reportId === 'cash-flow' && (<div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                  IAS 7 Compliant Statement of Cash Flows
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {'Statement of Cash Flows (IAS 7)'}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">{'Cash & Cash Equivalents at End'}</span>
                <span className="font-black text-emerald-700 text-xl">
                  {currency} {cashFlowData.closingCash.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-5">{'Cash Flow Activities'}</th>
                  <th className="py-3 px-5 text-right font-mono">{"SubtotalTk"}</th>
                  <th className="py-3 px-5 text-right font-mono">{"Net AmountTk"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* 1. OPERATING */}
                <tr className="bg-slate-50/40">
                  <td colSpan={3} className="py-2.5 px-5 font-bold uppercase tracking-wider text-[11px] text-slate-800">
                    1. {'Cash Flows from Operating Activities'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-5 pl-8 text-slate-800">{'Cash receipts from customer sales'}</td>
                  <td className="py-2 px-5 text-right font-mono text-emerald-700 font-bold">
                    +{currency} {cashFlowData.cashReceiptsFromCustomers.toLocaleString()}
                  </td>
                  <td className="py-2 px-5 text-right font-mono text-slate-400">-</td>
                </tr>
                <tr>
                  <td className="py-2 px-5 pl-8 text-slate-800">{'Cash paid to raw material suppliers'}</td>
                  <td className="py-2 px-5 text-right font-mono text-rose-600">
                    -{currency} {cashFlowData.cashPaidToSuppliers.toLocaleString()}
                  </td>
                  <td className="py-2 px-5 text-right font-mono text-slate-400">-</td>
                </tr>
                <tr>
                  <td className="py-2 px-5 pl-8 text-slate-800">{'Cash paid for salaries, rent & utilities'}</td>
                  <td className="py-2 px-5 text-right font-mono text-rose-600">
                    -{currency} {cashFlowData.cashPaidForExpenses.toLocaleString()}
                  </td>
                  <td className="py-2 px-5 text-right font-mono text-slate-400">-</td>
                </tr>
                <tr className="bg-slate-50/60 font-bold">
                  <td className="py-2.5 px-5 pl-8 text-slate-900">{'Net cash generated from operating activities'}</td>
                  <td className="py-2.5 px-5 text-right font-mono text-slate-400">-</td>
                  <td className="py-2.5 px-5 text-right font-mono text-emerald-700 font-bold text-sm">
                    {currency} {cashFlowData.netCashOperating.toLocaleString()}
                  </td>
                </tr>

                {/* 2. INVESTING */}
                <tr className="bg-slate-50/40">
                  <td colSpan={3} className="py-2.5 px-5 font-bold uppercase tracking-wider text-[11px] text-slate-800">
                    2. {'Cash Flows from Investing Activities'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-5 pl-8 text-slate-800">{'Acquisition & overhaul of plant machinery'}</td>
                  <td className="py-2 px-5 text-right font-mono text-rose-600">
                    {currency} {cashFlowData.capitalExpenditureMachinery.toLocaleString()}
                  </td>
                  <td className="py-2 px-5 text-right font-mono text-slate-400">-</td>
                </tr>
                <tr className="bg-slate-50/60 font-bold">
                  <td className="py-2.5 px-5 pl-8 text-slate-900">{'Net cash used in investing activities'}</td>
                  <td className="py-2.5 px-5 text-right font-mono text-slate-400">-</td>
                  <td className="py-2.5 px-5 text-right font-mono text-rose-700 font-bold text-sm">
                    {currency} {cashFlowData.netCashInvesting.toLocaleString()}
                  </td>
                </tr>

                {/* 3. FINANCING */}
                <tr className="bg-slate-50/40">
                  <td colSpan={3} className="py-2.5 px-5 font-bold uppercase tracking-wider text-[11px] text-slate-800">
                    3. {'Cash Flows from Financing Activities'}
                  </td>
                </tr>
                {cashFlowData.capitalInfusions > 0 && (
                  <tr>
                    <td className="py-2 px-5 pl-8 text-slate-800">{'Capital contribution by owner'}</td>
                    <td className="py-2 px-5 text-right font-mono text-emerald-600">
                      +{currency} {cashFlowData.capitalInfusions.toLocaleString()}
                    </td>
                    <td className="py-2 px-5 text-right font-mono text-slate-400">-</td>
                  </tr>
                )}
                <tr>
                  <td className="py-2 px-5 pl-8 text-slate-800">{'Repayment of bank borrowings'}</td>
                  <td className="py-2 px-5 text-right font-mono text-rose-600">
                    {currency} {cashFlowData.loanRepayments.toLocaleString()}
                  </td>
                  <td className="py-2 px-5 text-right font-mono text-slate-400">-</td>
                </tr>
                <tr>
                  <td className="py-2 px-5 pl-8 text-slate-800">{'Owner’s drawings'}</td>
                  <td className="py-2 px-5 text-right font-mono text-rose-600">
                    {currency} {cashFlowData.ownerDrawings.toLocaleString()}
                  </td>
                  <td className="py-2 px-5 text-right font-mono text-slate-400">-</td>
                </tr>
                <tr className="bg-slate-50/60 font-bold">
                  <td className="py-2.5 px-5 pl-8 text-slate-900">{'Net cash used in financing activities'}</td>
                  <td className="py-2.5 px-5 text-right font-mono text-slate-400">-</td>
                  <td className="py-2.5 px-5 text-right font-mono text-rose-700 font-bold text-sm">
                    {currency} {cashFlowData.netCashFinancing.toLocaleString()}
                  </td>
                </tr>

                {/* NET RECONCILIATION */}
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300 text-sm">
                  <td className="py-3 px-5 uppercase">
                    {'Net Increase / (Decrease) in Cash and Equivalents'}
                  </td>
                  <td className="py-3 px-5 text-right font-mono text-slate-400">-</td>
                  <td className="py-3 px-5 text-right font-mono text-emerald-800 text-base">
                    {cashFlowData.netChangeInCash >= 0 ? '+' : ''}
                    {currency} {cashFlowData.netChangeInCash.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-5 pl-8 font-semibold text-slate-700">
                    {'Cash and cash equivalents at beginning of period'}
                  </td>
                  <td className="py-2.5 px-5 text-right font-mono text-slate-400">-</td>
                  <td className="py-2.5 px-5 text-right font-mono font-bold text-slate-800 text-sm">
                    {currency} {cashFlowData.openingCash.toLocaleString()}
                  </td>
                </tr>
                <tr className="bg-emerald-50/80 font-black text-emerald-950 border-t border-emerald-300 text-sm">
                  <td className="py-3.5 px-5 uppercase">
                    {'Cash and cash equivalents at end of period'}
                  </td>
                  <td className="py-3.5 px-5 text-right font-mono text-slate-400">-</td>
                  <td className="py-3.5 px-5 text-right font-mono text-emerald-900 text-lg">
                    {currency} {cashFlowData.closingCash.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>)}
    </div>);
};
