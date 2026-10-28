import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ReportHeader } from './reports/ReportHeader';
import { SalesReports } from './reports/SalesReports';
import { PurchaseReports } from './reports/PurchaseReports';
import { InventoryReports } from './reports/InventoryReports';
import { FinancialReports } from './reports/FinancialReports';
import { IFRSStatements } from './reports/IFRSStatements';
import { exportTableToExcel } from '../utils/reportExportUtils';
import { BarChart3, ShoppingCart, Truck, Package, BookOpen, FileCheck, Calendar, Filter, Search, CheckCircle, Download, Printer, ChevronRight, TrendingUp, Receipt, PiggyBank, Wallet, Scale, DollarSign, FolderKanban, } from 'lucide-react';
export type ReportCategory = 'sales' | 'purchases' | 'inventory' | 'accounting' | 'ifrs';
export interface ReportDefinition {
    id: string;
    category: ReportCategory;
    titleEn: string;
    titleBn: string;
    categoryEn: string;
    categoryBn: string;
    descEn: string;
    descBn: string;
    icon: React.ComponentType<{
        className?: string;
    }>;
}
export const REPORT_REGISTRY: ReportDefinition[] = [
    // 1. SALES
    {
        id: 'item-sales',
        category: 'sales',
        titleEn: 'Item-wise Sales Report',
        titleBn: "Report",
        categoryEn: 'Sales & Invoicing',
        categoryBn: "",
        descEn: 'Quantity, sales value, cost of goods, and gross margin per product/service.',
        descBn: "Quantity, Total ,     \u0964",
        icon: BarChart3,
    },
    {
        id: 'user-sales',
        category: 'sales',
        titleEn: 'User-wise Sales Report',
        titleBn: "Report",
        categoryEn: 'Sales & Invoicing',
        categoryBn: "",
        descEn: 'Sales performance, invoices generated, collections, and dues by staff member.',
        descBn: ",  Tk  \u0964",
        icon: TrendingUp,
    },
    {
        id: 'category-sales',
        category: 'sales',
        titleEn: 'Category-wise Sales Report',
        titleBn: "Report",
        categoryEn: 'Sales & Invoicing',
        categoryBn: "",
        descEn: 'Sales volume and revenue breakdown across printing, sign making, and packaging.',
        descBn: "Print,      Total  Quantity  \u0964",
        icon: ShoppingCart,
    },
    {
        id: 'payment-sales',
        category: 'sales',
        titleEn: 'Payment-wise Sales Report',
        titleBn: "Payment   Report",
        categoryEn: 'Sales & Invoicing',
        categoryBn: "",
        descEn: 'Sales collections grouped by Cash, Bank Transfer, bKash/Nagad, and Cheques.',
        descBn: "Nagad Cash, Bank , bKash\u0964",
        icon: Wallet,
    },
    {
        id: 'customer-sales',
        category: 'sales',
        titleEn: 'Customer-wise Sales Report',
        titleBn: "Report",
        categoryEn: 'Sales & Invoicing',
        categoryBn: "",
        descEn: 'Total business volume, order frequency, total paid, and current due per client.',
        descBn: "Customer     Total , Total   Due \u0964",
        icon: Receipt,
    },
    {
        id: 'customer-receivable',
        category: 'sales',
        titleEn: 'Customer Receivables Report',
        titleBn: "Report",
        categoryEn: 'Sales & Invoicing',
        categoryBn: "",
        descEn: 'Outstanding customer dues with 15/30/60 days aging brackets and follow-up data.',
        descBn: "Total  Tk    \u0964",
        icon: PiggyBank,
    },
    {
        id: 'customer-advance',
        category: 'sales',
        titleEn: 'Customer Advance Report',
        titleBn: "Report",
        categoryEn: 'Sales & Invoicing',
        categoryBn: "",
        descEn: 'Unallocated customer deposits, job advances, and prepayment credits held.',
        descBn: "Tk   Description\u0964",
        icon: DollarSign,
    },
    // 2. PURCHASES
    {
        id: 'purchase-summary',
        category: 'purchases',
        titleEn: 'Purchase Summary Report',
        titleBn: "Report",
        categoryEn: 'Purchases & Procurement',
        categoryBn: "",
        descEn: 'Chronological procurement log, PO status, delivery destination, and costs.',
        descBn: "Order, , Payment    Report\u0964",
        icon: Truck,
    },
    {
        id: 'supplier-purchase',
        category: 'purchases',
        titleEn: 'Supplier-wise Purchase Report',
        titleBn: "Supplier   Report",
        categoryEn: 'Purchases & Procurement',
        categoryBn: "",
        descEn: 'Total raw material spend, order count, and payment history per vendor.',
        descBn: "Total    \u0964",
        icon: Truck,
    },
    {
        id: 'supplier-payable',
        category: 'purchases',
        titleEn: 'Supplier Payables Report',
        titleBn: "Supplier  Report",
        categoryEn: 'Purchases & Procurement',
        categoryBn: "",
        descEn: 'Outstanding vendor liabilities, bills due, and supplier aging brackets.',
        descBn: "Accounts Payable  Payment \u0964",
        icon: Wallet,
    },
    // 3. INVENTORY
    {
        id: 'stock-summary',
        category: 'inventory',
        titleEn: 'Inventory Stock Valuation',
        titleBn: "Report",
        categoryEn: 'Inventory & Warehousing',
        categoryBn: "",
        descEn: 'Finished goods and raw materials at Office & Factory with cost & retail valuations.',
        descBn: "Head Office  Factory     Price  Price Total  \u0964",
        icon: Package,
    },
    {
        id: 'stock-movement',
        category: 'inventory',
        titleEn: 'Inventory Movement Report',
        titleBn: ", , ,",
        categoryEn: 'Inventory & Warehousing',
        categoryBn: "",
        descEn: 'Reconciliation of Opening Stock, Inward Purchases, Sales Dispatches, and Closing Stock.',
        descBn: ",  ,       \u0964",
        icon: Package,
    },
    // 4. ACCOUNTING / FINANCIAL
    {
        id: 'ledger-report',
        category: 'accounting',
        titleEn: 'General Ledger Report',
        titleBn: "Report",
        categoryEn: 'Accounting & Ledger',
        categoryBn: "",
        descEn: 'Account-by-account debit, credit, and running balance ledger audit trail.',
        descBn: ",       \u0964",
        icon: BookOpen,
    },
    {
        id: 'day-book',
        category: 'accounting',
        titleEn: 'Day Book (Daily Register)',
        titleBn: "",
        categoryEn: 'Accounting & Ledger',
        categoryBn: "",
        descEn: 'Chronological record of all cash, bank, and operational transactions on any given day.',
        descBn: "Nagad , Bank      \u0964",
        icon: Calendar,
    },
    {
        id: 'receipts-payments',
        category: 'accounting',
        titleEn: 'Receipts & Payments Account',
        titleBn: "Payment",
        categoryEn: 'Accounting & Ledger',
        categoryBn: "",
        descEn: 'Period cash & bank opening, operational inflows, outflows, and liquid closing balances.',
        descBn: "Nagad  Bank   , Total Nagad , Payment   \u0964",
        icon: Scale,
    },
    {
        id: 'project-profitability',
        category: 'accounting',
        titleEn: 'Projects Report',
        titleBn: "Report",
        categoryEn: 'Accounting & Ledger',
        categoryBn: "",
        descEn: 'Project-wise sales, expense breakdown, and net profit report.',
        descBn: ",      Report\u0964",
        icon: FolderKanban,
    },
    // 5. IFRS STATEMENTS
    {
        id: 'trial-balance',
        category: 'ifrs',
        titleEn: 'Trial Balance',
        titleBn: "",
        categoryEn: 'IFRS Financial Statements',
        categoryBn: "IFRS",
        descEn: 'Debit and credit balance verification of all nominal, real, and personal accounts.',
        descBn: "\u0964",
        icon: Scale,
    },
    {
        id: 'profit-loss',
        category: 'ifrs',
        titleEn: 'Profit & Loss Account (IFRS)',
        titleBn: "IFRS",
        categoryEn: 'IFRS Financial Statements',
        categoryBn: "IFRS",
        descEn: 'Turnover, Cost of Goods Sold, Gross Profit, Operating Expenses, EBIT, and Net Profit.',
        descBn: "COGS, Total ,     \u0964",
        icon: TrendingUp,
    },
    {
        id: 'balance-sheet',
        category: 'ifrs',
        titleEn: 'Balance Sheet (IFRS)',
        titleBn: "- IFRS",
        categoryEn: 'IFRS Financial Statements',
        categoryBn: "IFRS",
        descEn: 'Statement of Financial Position: Non-Current/Current Assets, Liabilities, and Owner Equity.',
        descBn: ",        \u0964",
        icon: FileCheck,
    },
    {
        id: 'cash-flow',
        category: 'ifrs',
        titleEn: 'Statement of Cash Flows',
        titleBn: "IAS 7",
        categoryEn: 'IFRS Financial Statements',
        categoryBn: "IFRS",
        descEn: 'Cash flows categorized into Operating Activities, Investing, and Financing Activities.',
        descBn: ",       Nagad   Description\u0964",
        icon: Wallet,
    },
];
export const ReportModule: React.FC = () => {
    const { invoices, customers, products, purchaseOrders, suppliers, stockMovements, transactions, chartOfAccounts, staffMembers, profile, language, activeLocation, checkPermission, activeStaff } = useApp();
    const isBn = language === 'bn';
    const isSuperAdmin = (activeStaff?.role || '').toLowerCase() === 'super admin' ||
        (activeStaff?.role || '').toLowerCase() === 'superadmin' ||
        activeStaff?.customRoleId === 'role-superadmin' ||
        (activeStaff?.name || '').toLowerCase().includes('super admin');
    const canExportReports = isSuperAdmin || Boolean(checkPermission && checkPermission('accounting.export_reports'));
    // Active Selected Report
    const [activeReportId, setActiveReportId] = useState<string>('item-sales');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategoryTab, setSelectedCategoryTab] = useState<ReportCategory | 'ALL'>('ALL');
    const [dateRangeFilter, setDateRangeFilter] = useState<'ALL' | 'TODAY' | 'THIS_MONTH' | 'THIS_YEAR'>('THIS_MONTH');
    const [locationFilter, setLocationFilter] = useState<string>('ALL');
    const activeReport = useMemo(() => {
        return REPORT_REGISTRY.find((r) => r.id === activeReportId) || REPORT_REGISTRY[0];
    }, [activeReportId]);
    // Filtered reports for sidebar search
    const filteredReportsList = useMemo(() => {
        return REPORT_REGISTRY.filter((r) => {
            const matchCat = selectedCategoryTab === 'ALL' || r.category === selectedCategoryTab;
            const matchSearch = r.titleEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.titleBn.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.descEn.toLowerCase().includes(searchQuery.toLowerCase());
            return matchCat && matchSearch;
        });
    }, [selectedCategoryTab, searchQuery]);
    // Date range label
    const dateRangeText = useMemo(() => {
        const now = new Date();
        if (dateRangeFilter === 'TODAY') {
            return now.toISOString().slice(0, 10);
        }
        if (dateRangeFilter === 'THIS_MONTH') {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${monthNames[now.getMonth()]} 01 - ${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
        }
        if (dateRangeFilter === 'THIS_YEAR') {
            return `Jan 01, ${now.getFullYear()} - Dec 31, ${now.getFullYear()}`;
        }
        return 'All Time / Complete Fiscal Period';
    }, [dateRangeFilter, isBn]);
    // Print Handler
    const handlePrint = () => {
        window.print();
    };
    // Excel Export Handler
    const handleExportExcel = () => {
        const headerInfo = {
            reportTitle: activeReport.titleEn,
            reportTitleBn: activeReport.titleBn,
            periodText: dateRangeText,
            companyProfile: profile,
        };
        if (activeReportId === 'item-sales') {
            const map = new Map<string, {
                name: string;
                cat: string;
                qty: number;
                rev: number;
                cost: number;
                unit: string;
            }>();
            invoices.forEach((inv) => {
                inv.items.forEach((it) => {
                    const k = it.productId || it.name;
                    const cur = map.get(k) || { name: it.name, cat: it.category || 'General', qty: 0, rev: 0, cost: 0, unit: it.unit || 'pcs' };
                    const q = it.qty || 1;
                    cur.qty += q;
                    cur.rev += it.totalPrice || it.unitPrice * q;
                    cur.cost += (it.costPrice || 0) * q;
                    map.set(k, cur);
                });
            });
            const cols = ['Item Name', 'Category', 'Quantity Sold', 'Unit', 'Sales Revenue (BDT)', 'Cost Value (BDT)', 'Gross Profit (BDT)', 'Margin %'];
            const rows = Array.from(map.values()).map((row) => {
                const profit = row.rev - row.cost;
                const margin = row.rev > 0 ? ((profit / row.rev) * 100).toFixed(1) + '%' : '0%';
                return [row.name, row.cat, row.qty, row.unit, row.rev, row.cost, profit, margin];
            });
            exportTableToExcel('Item_Sales_Report', 'Item Sales', headerInfo, cols, rows);
        }
        else if (activeReportId === 'customer-receivable') {
            const cols = ['Invoice No', 'Date', 'Customer Name', 'Phone', 'Bill Amount (BDT)', 'Paid (BDT)', 'Due Outstanding (BDT)'];
            const rows = invoices
                .filter((i) => (i.dueAmount || 0) > 0)
                .map((i) => [i.invoiceNo, i.date, i.customerName, i.customerPhone, i.grandTotal, i.paidAmount, i.dueAmount]);
            exportTableToExcel('Customer_Receivables', 'Receivables', headerInfo, cols, rows);
        }
        else if (activeReportId === 'stock-movement') {
            const cols = ['Item Code', 'Item Description', 'Unit', 'Opening Stock', 'Purchase In (+)', 'Sales Out (-)', 'Closing Stock', 'Cost Rate (BDT)', 'Closing Valuation (BDT)'];
            const rows = products.map((p) => {
                const inQty = stockMovements.filter((sm) => sm.productId === p.id && sm.type === 'IN').reduce((s, m) => s + m.qty, 0);
                const outQty = stockMovements.filter((sm) => sm.productId === p.id && sm.type === 'OUT').reduce((s, m) => s + m.qty, 0);
                const currentClosing = (p.stockOffice || 0) + (p.stockFactory || 0);
                const opening = Math.max(0, currentClosing + outQty - inQty);
                return [p.code, p.name, p.unit, opening, inQty, outQty, currentClosing, p.costPrice, currentClosing * p.costPrice];
            });
            exportTableToExcel('Inventory_Movement', 'Stock Movement', headerInfo, cols, rows);
        }
        else {
            // General fallback export
            const cols = ['Report ID', 'Report Name', 'Generated Time', 'Organization'];
            const rows = [[activeReport.id, activeReport.titleEn, new Date().toLocaleString(), profile.name]];
            exportTableToExcel(activeReport.id, 'Report', headerInfo, cols, rows);
        }
    };
    return (<div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 print:max-w-none print:p-0 print:m-0 space-y-5">
      {/* Top Filter & Module Bar (Screen Only) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/60">
              {'Report Module & Auditing Center'}
            </span>
            <h1 className="text-xl font-black text-slate-900 mt-1">
              {'Enterprise Reporting & Financial Analytics'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {'Complete suite of 19 ERP reports covering Sales, Purchases, Stock Movement, Ledger, and IFRS Statements'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Date Range Picker */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400"/>
              <span className="text-slate-400 font-medium">{'Period:'}</span>
              <select value={dateRangeFilter} onChange={(e) => setDateRangeFilter(e.target.value as any)} className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer">
                <option value="TODAY">{'Today'}</option>
                <option value="THIS_MONTH">{'This Month'}</option>
                <option value="THIS_YEAR">{'This Fiscal Year'}</option>
                <option value="ALL">{'All Time'}</option>
              </select>
            </div>

            {/* Location Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700">
              <Filter className="w-3.5 h-3.5 text-slate-400"/>
              <span className="text-slate-400 font-medium">{'Location:'}</span>
              <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer">
                <option value="ALL">{'Central Warehouse'}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-4 border-t border-slate-100 mt-4">
          <button type="button" onClick={() => setSelectedCategoryTab('ALL')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${selectedCategoryTab === 'ALL'
            ? 'bg-slate-900 text-white shadow-2xs'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {'All 19 Reports'}
          </button>
          <button type="button" onClick={() => setSelectedCategoryTab('sales')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${selectedCategoryTab === 'sales'
            ? 'bg-amber-600 text-white shadow-2xs'
            : 'bg-amber-50 text-amber-800 hover:bg-amber-100'}`}>
            {'Sales & Customer (7)'}
          </button>
          <button type="button" onClick={() => setSelectedCategoryTab('purchases')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${selectedCategoryTab === 'purchases'
            ? 'bg-blue-600 text-white shadow-2xs'
            : 'bg-blue-50 text-blue-800 hover:bg-blue-100'}`}>
            {'Purchases & Vendor (3)'}
          </button>
          <button type="button" onClick={() => setSelectedCategoryTab('inventory')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${selectedCategoryTab === 'inventory'
            ? 'bg-emerald-600 text-white shadow-2xs'
            : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}`}>
            {'Inventory & Movement (2)'}
          </button>
          <button type="button" onClick={() => setSelectedCategoryTab('accounting')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${selectedCategoryTab === 'accounting'
            ? 'bg-purple-600 text-white shadow-2xs'
            : 'bg-purple-50 text-purple-800 hover:bg-purple-100'}`}>
            {'Ledger & Day Book (3)'}
          </button>
          <button type="button" onClick={() => setSelectedCategoryTab('ifrs')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${selectedCategoryTab === 'ifrs'
            ? 'bg-rose-600 text-white shadow-2xs'
            : 'bg-rose-50 text-rose-800 hover:bg-rose-100'}`}>
            {'IFRS Statements (4)'}
          </button>
        </div>
      </div>

      {/* Main Layout: Sidebar of Reports on Left + Active Report Canvas on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Side: Report Selection Index (Screen Only) */}
        <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-xl border border-slate-200 p-3 shadow-2xs space-y-3 print:hidden sticky top-20 self-start">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
            <input type="text" placeholder={'Search reports...'} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"/>
          </div>

          <div className="space-y-1 max-h-[calc(100vh-160px)] overflow-y-auto pr-1">
            {filteredReportsList.map((r, idx) => {
            const isSelected = r.id === activeReportId;
            const Icon = r.icon;
            return (<button key={r.id} type="button" onClick={() => setActiveReportId(r.id)} className={`w-full text-left p-2.5 rounded-lg transition-all flex items-center justify-between gap-3 cursor-pointer ${isSelected
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'hover:bg-slate-50 text-slate-700'}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${isSelected
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-600'}`}>
                      <Icon className="w-4 h-4"/>
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold block truncate">
                        {r.titleEn}
                      </span>
                      <span className={`text-[10px] block truncate ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                        {r.categoryEn}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-amber-400 translate-x-0.5' : 'text-slate-300'}`}/>
                </button>);
        })}
          </div>
        </div>

        {/* Right Side: Active Report Workspace */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-5 min-w-0">
          {/* Header Component with official letterhead & export buttons */}
          <ReportHeader titleEn={activeReport.titleEn} titleBn={activeReport.titleBn} categoryEn={activeReport.categoryEn} categoryBn={activeReport.categoryBn} profile={profile} language={language} dateRangeText={dateRangeText} locationFilter={locationFilter} onPrint={canExportReports ? handlePrint : undefined} onExportExcel={canExportReports ? handleExportExcel : undefined}/>

          {/* Report Body Components */}
          {activeReport.category === 'sales' && (<SalesReports reportId={activeReport.id} invoices={invoices} customers={customers} products={products} staffMembers={staffMembers} profile={profile} language={language}/>)}

          {activeReport.category === 'purchases' && (<PurchaseReports reportId={activeReport.id} purchaseOrders={purchaseOrders} suppliers={suppliers} profile={profile} language={language}/>)}

          {activeReport.category === 'inventory' && (<InventoryReports reportId={activeReport.id} products={products} stockMovements={stockMovements} invoices={invoices} purchaseOrders={purchaseOrders} profile={profile} language={language}/>)}

          {activeReport.category === 'accounting' && (<FinancialReports reportId={activeReport.id} transactions={transactions} chartOfAccounts={chartOfAccounts} profile={profile} language={language}/>)}

          {activeReport.category === 'ifrs' && (<IFRSStatements reportId={activeReport.id} chartOfAccounts={chartOfAccounts} transactions={transactions} invoices={invoices} purchaseOrders={purchaseOrders} products={products} customers={customers} profile={profile} language={language}/>)}

          {/* Official Signatory Box for Printed Reports (visible in print mode & bottom of report) */}
          <div className="pt-10 border-t border-slate-200 mt-10">
            <div className="grid grid-cols-4 gap-6 text-center text-xs text-slate-600">
              <div>
                <div className="border-t border-slate-400 pt-2 font-semibold">
                  {'Prepared By'}
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Sales / Store Accounts</span>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-2 font-semibold">
                  {'Checked By'}
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Internal Audit</span>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-2 font-semibold">
                  {'Senior Accountant'}
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Accounts & Finance</span>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-2 font-semibold">
                  {'Authorized Signatory'}
                </div>
                <span className="text-[10px] text-slate-400 font-mono">{profile.name}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);
};
