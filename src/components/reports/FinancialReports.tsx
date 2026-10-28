import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { AccountingTransaction, ChartOfAccount, Language, CompanyProfile, } from '../../types';
import { BookOpen, Calendar, Layers, Search, ArrowDownLeft, ArrowUpRight, Wallet, Building, FolderKanban, TrendingUp, TrendingDown, } from 'lucide-react';
import { isAdvanceAdjustmentTransaction, isDueReceivableTransaction, getCashAccountsBreakdown, getBankAccountsBreakdown } from '../../utils/accountUtils';
interface FinancialReportsProps {
    reportId: string;
    transactions: AccountingTransaction[];
    chartOfAccounts: ChartOfAccount[];
    profile: CompanyProfile;
    language: Language;
}
export const FinancialReports: React.FC<FinancialReportsProps> = ({ reportId, transactions, chartOfAccounts, profile, language, }) => {
    const { projects, invoices = [], journalEntries = [] } = useApp();
    const isBn = language === 'bn';
    const currency = profile.currencySymbol || "Tk";
    const [selectedAccount, setSelectedAccount] = useState('ALL');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [searchTerm, setSearchTerm] = useState('');
    // -------------------------------------------------------------
    // 13. GENERAL LEDGER REPORT
    // -------------------------------------------------------------
    const normAccountHead = (raw?: string): string => {
        if (!raw) return 'General';
        const l = raw.toLowerCase().trim();
        if (l === 'cash' || l === 'cash in hand' || l === 'cashinhand' || l === 'counter cash' || l === 'office cash' || l === 'pm-cash') {
            return 'Cash In Hand';
        }
        return raw;
    };

    const ledgerAccounts = useMemo(() => {
        const set = new Set<string>();
        (transactions || []).forEach((tx) => {
            if (tx && tx.accountHead) {
                set.add(normAccountHead(tx.accountHead));
            }
        });
        return Array.from(set);
    }, [transactions]);

    const ledgerData = useMemo(() => {
        let runningBalance = 0;
        const filtered = (transactions || [])
            .filter((tx) => {
            if (!tx)
                return false;
            const head = normAccountHead(tx.accountHead);
            const matchAcc = selectedAccount === 'ALL' || head === selectedAccount;
            const matchSearch = (tx.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (tx.voucherNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (tx.reference && tx.reference.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchAcc && matchSearch;
        })
            .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
        return filtered.map((tx) => {
            const isDebit = tx.type === 'DEBIT' || tx.type === 'EXPENSE';
            const debitAmount = isDebit ? tx.amount : 0;
            const creditAmount = !isDebit ? tx.amount : 0;
            runningBalance += creditAmount - debitAmount;
            return {
                ...tx,
                accountHead: normAccountHead(tx.accountHead),
                debitAmount,
                creditAmount,
                runningBalance,
            };
        });
    }, [transactions, selectedAccount, searchTerm]);
    // -------------------------------------------------------------
    // 14. DAY BOOK (DAILY CASH & BANK TRANSACTIONS)
    // -------------------------------------------------------------
    const dayBookData = useMemo(() => {
        // 1. Sort ALL transactions chronologically to calculate the true running balance at each transaction
        const sortedAll = [...(transactions || [])].sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
        let balance = 0;
        const txBalanceMap = new Map<string, number>();
        sortedAll.forEach((tx) => {
            const isDebit = tx.type === 'DEBIT' || tx.type === 'EXPENSE';
            if (isDebit) {
                balance -= tx.amount || 0;
            }
            else {
                balance += tx.amount || 0;
            }
            txBalanceMap.set(tx.id, balance);
        });
        // 2. Filter daily transactions
        const dailyTx = (transactions || [])
            .filter((tx) => (tx.date || '').startsWith(selectedDate))
            .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
        const inflows = dailyTx.filter((t) => (t.type === 'CREDIT' || t.type === 'INCOME') && !isAdvanceAdjustmentTransaction(t) && !isDueReceivableTransaction(t));
        const outflows = dailyTx.filter((t) => t.type === 'DEBIT' || t.type === 'EXPENSE');
        const totalInflow = inflows.reduce((s, t) => s + (t.amount || 0), 0);
        const totalOutflow = outflows.reduce((s, t) => s + (t.amount || 0), 0);
        const netDayMovement = totalInflow - totalOutflow;
        const mappedDailyTx = dailyTx.map((tx) => ({
            ...tx,
            balanceAfter: txBalanceMap.get(tx.id) ?? 0,
        }));
        return {
            dailyTx: mappedDailyTx,
            inflows,
            outflows,
            totalInflow,
            totalOutflow,
            netDayMovement,
        };
    }, [transactions, selectedDate]);
    // -------------------------------------------------------------
    // 15. RECEIPTS & PAYMENTS ACCOUNT
    // -------------------------------------------------------------
    const receiptsAndPaymentsData = useMemo(() => {
        // Receipts (Inflows): Counter Cash Sales, Bank receipts, Due Collections, Capital Injection
        const receiptsMap = new Map<string, number>();
        const paymentsMap = new Map<string, number>();

        const normLiquidHead = (raw?: string): string => {
            if (!raw) return 'Cash In Hand';
            const l = raw.toLowerCase().trim();
            if (l === 'cash' || l === 'cash in hand' || l === 'cashinhand' || l === 'counter cash' || l === 'office cash' || l === 'pm-cash') {
                return 'Cash In Hand';
            }
            return raw;
        };

        // Real opening cash and bank balances dynamically from chart of accounts opening balances
        const openingCash = (chartOfAccounts || []).filter(acc => 
            acc.classification === 'Asset' && 
            (acc.code === '1001' || acc.code === '1010' || acc.name.toLowerCase().includes('cash in hand') || acc.name.toLowerCase() === 'cash') && 
            !acc.name.toLowerCase().includes('bkash') && 
            !acc.name.toLowerCase().includes('nagad')
        ).reduce((sum, acc) => sum + (Number(acc.openingBalance) || 0), 0);

        const openingBank = (chartOfAccounts || []).filter(acc => 
            acc.classification === 'Asset' && 
            ((acc.name || '').toLowerCase().includes('bank') || (acc.name || '').toLowerCase().includes('plc') || (acc.name || '').toLowerCase().includes('bkash') || (acc.name || '').toLowerCase().includes('nagad'))
        ).reduce((sum, acc) => sum + (Number(acc.openingBalance) || 0), 0);

        const totalOpening = openingCash + openingBank;

        // Process ledger transactions
        (transactions || []).forEach((tx) => {
            if (!tx) return;
            const amt = Number(tx.amount) || 0;
            if (amt <= 0) return;

            if ((tx.type === 'CREDIT' || tx.type === 'INCOME') && !isAdvanceAdjustmentTransaction(tx) && !isDueReceivableTransaction(tx)) {
                const rawHead = tx.paymentAccount || tx.accountHead || 'Sales Revenue';
                const head = normLiquidHead(rawHead);
                receiptsMap.set(head, (receiptsMap.get(head) || 0) + amt);
            } else if (tx.type === 'DEBIT' || tx.type === 'EXPENSE') {
                const rawHead = tx.accountHead || tx.category || 'General Expenses';
                const head = normLiquidHead(rawHead);
                paymentsMap.set(head, (paymentsMap.get(head) || 0) + amt);
            }
        });

        // Include non-synced manual journal entries impacting liquid cash/bank (e.g. Owner Capital Injection)
        (journalEntries || []).forEach(j => {
            if (j.source === 'PROJECT_SALES' || j.source === 'PROJECT_EXPENSE' || j.source === 'EXPENSE' || j.source === 'SALES' || j.source === 'PURCHASE' || j.source === 'LEDGER_SYNC') return;
            const amt = Number(j.amount) || 0;
            if (amt <= 0) return;
            const dName = (j.debitAccountName || '').toLowerCase();
            const cName = (j.creditAccountName || '').toLowerCase();

            // Cash/Bank Debited -> Cash Inflow (Receipt)
            if (dName.includes('cash') || dName.includes('bank') || dName.includes('bkash') || dName.includes('nagad')) {
                const head = j.creditAccountName || 'Owner Capital Investment';
                receiptsMap.set(head, (receiptsMap.get(head) || 0) + amt);
            }
            // Cash/Bank Credited -> Cash Outflow (Payment)
            else if (cName.includes('cash') || cName.includes('bank') || cName.includes('bkash') || cName.includes('nagad')) {
                const head = j.debitAccountName || "Owner's Drawings";
                paymentsMap.set(head, (paymentsMap.get(head) || 0) + amt);
            }
        });

        const receiptsList = Array.from(receiptsMap.entries()).map(([head, amount]) => ({ head, amount }));
        const paymentsList = Array.from(paymentsMap.entries()).map(([head, amount]) => ({ head, amount }));

        const totalPeriodReceipts = receiptsList.reduce((s, r) => s + r.amount, 0);
        const totalPeriodPayments = paymentsList.reduce((s, p) => s + p.amount, 0);

        const cashData = getCashAccountsBreakdown(chartOfAccounts, transactions, invoices, projects, journalEntries);
        const bankData = getBankAccountsBreakdown(chartOfAccounts, transactions, invoices, projects, journalEntries);

        const closingCash = cashData.total;
        const closingBank = bankData.reduce((acc, b) => acc + b.balance, 0);
        const totalClosing = closingCash + closingBank;

        const grandTotalReceipts = totalOpening + totalPeriodReceipts;
        const grandTotalPayments = totalPeriodPayments + totalClosing;

        return {
            openingCash,
            openingBank,
            totalOpening,
            receiptsList,
            paymentsList,
            totalPeriodReceipts,
            totalPeriodPayments,
            closingCash,
            closingBank,
            totalClosing,
            grandTotalReceipts,
            grandTotalPayments,
        };
    }, [transactions, chartOfAccounts, invoices, projects, journalEntries]);
    return (<div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* REPORT 13: GENERAL LEDGER REPORT */}
      {/* ------------------------------------------------------------- */}
      {reportId === 'ledger-report' && (<div>
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4 print:hidden">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
              <input type="text" placeholder={'Search voucher, particulars, or reference...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"/>
            </div>
            <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900">
              <option value="ALL">{'All Account Heads'}</option>
              {ledgerAccounts.map((acc) => (<option key={acc} value={acc}>
                  {acc}
                </option>))}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">{'Date & Voucher'}</th>
                    <th className="py-3 px-4">{'Account Head'}</th>
                    <th className="py-3 px-4">{'Particulars / Description'}</th>
                    <th className="py-3 px-4 text-center">{'Method'}</th>
                    <th className="py-3 px-4 text-right text-rose-700">{"DebitTk"}</th>
                    <th className="py-3 px-4 text-right text-emerald-700">{"CreditTk"}</th>
                    <th className="py-3 px-4 text-right font-bold text-slate-900">{"BalanceTk"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerData.length === 0 ? (<tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        {'No ledger transactions recorded'}
                      </td>
                    </tr>) : (ledgerData.map((row, idx) => (<tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-slate-900 font-bold block">{row.voucherNo}</span>
                          <span className="text-[11px] text-slate-400 font-mono">{row.date}</span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">{row.accountHead}</td>
                        <td className="py-3 px-4 max-w-sm">
                          <span className="text-slate-800 block">{row.description}</span>
                          {row.reference && (<span className="text-[10px] text-slate-400 font-mono block">Ref: {row.reference}</span>)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {row.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                          {row.debitAmount > 0 ? `${currency} ${row.debitAmount.toLocaleString()}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          {row.creditAmount > 0 ? `${currency} ${row.creditAmount.toLocaleString()}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {currency} {row.runningBalance.toLocaleString()}
                        </td>
                      </tr>)))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={5} className="py-3 px-4 text-right uppercase text-[11px]">
                      {'Total Ledger Summary:'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-700 text-sm">
                      {currency} {ledgerData.reduce((s, r) => s + r.debitAmount, 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700 text-sm">
                      {currency} {ledgerData.reduce((s, r) => s + r.creditAmount, 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">-</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>)}

      {/* ------------------------------------------------------------- */}
      {/* REPORT 14: DAY BOOK */}
      {/* ------------------------------------------------------------- */}
      {reportId === 'day-book' && (<div>
          {/* Day Selector & Daily Totals */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-slate-500"/>
                <div>
                  <span className="text-xs text-slate-500 block">{'Select Date for Day Book'}</span>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="font-bold text-sm text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-slate-900"/>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <span className="text-xs text-slate-400 block">{'Total Inflow'}</span>
                  <span className="font-black text-emerald-700 text-lg">
                    +{currency} {dayBookData.totalInflow.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">{'Total Outflow'}</span>
                  <span className="font-black text-rose-600 text-lg">
                    -{currency} {dayBookData.totalOutflow.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">{'Net Day Movement'}</span>
                  <span className={`font-black text-lg ${dayBookData.netDayMovement >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {dayBookData.netDayMovement >= 0 ? '+' : ''}
                    {currency} {dayBookData.netDayMovement.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">{'Voucher & Time'}</th>
                    <th className="py-3 px-4">{'Account Head'}</th>
                    <th className="py-3 px-4">{'Particulars'}</th>
                    <th className="py-3 px-4 text-center">{'Location'}</th>
                    <th className="py-3 px-4 text-center">{'Method'}</th>
                    <th className="py-3 px-4 text-right">{'Receipt (+)'}</th>
                    <th className="py-3 px-4 text-right">{'Payment (-)'}</th>
                    <th className="py-3 px-4 text-right font-bold">{'Balance'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dayBookData.dailyTx.length === 0 ? (<tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        {`No transactions recorded for ${selectedDate}`}
                      </td>
                    </tr>) : (dayBookData.dailyTx.map((tx, idx) => {
                const isReceipt = tx.type === 'CREDIT' || tx.type === 'INCOME';
                return (<tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-slate-900 block">{tx.voucherNo}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{tx.date}</span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">{tx.accountHead}</td>
                          <td className="py-3 px-4 text-slate-700">{tx.description}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                              {tx.location}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-600">{tx.paymentMethod}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                            {isReceipt ? `+${currency} ${tx.amount.toLocaleString()}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                            {!isReceipt ? `-${currency} ${tx.amount.toLocaleString()}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {currency} {tx.balanceAfter.toLocaleString()}
                          </td>
                        </tr>);
            }))}
                </tbody>
                {dayBookData.dailyTx.length > 0 && (<tfoot className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={6} className="py-3 px-4 text-right uppercase text-[11px]">
                        {'Total for the Day:'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-700 text-sm">
                        +{currency} {dayBookData.totalInflow.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-rose-600 text-sm">
                        -{currency} {dayBookData.totalOutflow.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">-</td>
                    </tr>
                  </tfoot>)}
              </table>
            </div>
          </div>
        </div>)}

      {/* ------------------------------------------------------------- */}
      {/* REPORT 15: RECEIPTS & PAYMENTS ACCOUNT */}
      {/* ------------------------------------------------------------- */}
      {reportId === 'receipts-payments' && (<div className="space-y-6">
          <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold">
                  {'Statement of Receipts and Payments'}
                </h3>
                <p className="text-xs text-slate-400">
                  {'Summary of all cash and bank inflows and outflows with balanced reconciliations'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">{'Closing Liquid Funds'}</span>
                <span className="text-xl font-black text-emerald-400">
                  {currency} {receiptsAndPaymentsData.totalClosing.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT SIDE: RECEIPTS */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    <ArrowDownLeft className="w-4 h-4 text-emerald-600"/>
                    {'Receipts (Inflows)'}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-700">Dr.</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs font-medium space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      {'Opening Balances:'}
                    </span>
                    <div className="flex justify-between text-slate-700">
                      <span>• {'Cash in Hand'}</span>
                      <span className="font-mono font-bold">{currency} {receiptsAndPaymentsData.openingCash.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>• {'Bank Balances'}</span>
                      <span className="font-mono font-bold">{currency} {receiptsAndPaymentsData.openingBank.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      {'Period Receipts:'}
                    </span>
                    {receiptsAndPaymentsData.receiptsList.map((item) => (<div key={item.head} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100">
                        <span className="font-medium text-slate-800">{item.head}</span>
                        <span className="font-mono font-bold text-slate-900">
                          {currency} {item.amount.toLocaleString()}
                        </span>
                      </div>))}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center font-bold text-slate-900 text-sm">
                <span>{'Total Receipts:'}</span>
                <span className="font-mono text-emerald-700 text-base">
                  {currency} {receiptsAndPaymentsData.grandTotalReceipts.toLocaleString()}
                </span>
              </div>
            </div>

            {/* RIGHT SIDE: PAYMENTS */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-3 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                    <ArrowUpRight className="w-4 h-4 text-rose-600"/>
                    {'Payments (Outflows)'}
                  </span>
                  <span className="text-xs font-mono font-bold text-rose-700">Cr.</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      {'Period Payments & Expenses:'}
                    </span>
                    {receiptsAndPaymentsData.paymentsList.map((item) => (<div key={item.head} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100">
                        <span className="font-medium text-slate-800">{item.head}</span>
                        <span className="font-mono font-bold text-slate-900">
                          {currency} {item.amount.toLocaleString()}
                        </span>
                      </div>))}
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs font-medium space-y-1 mt-4">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      {'Closing Balances:'}
                    </span>
                    <div className="flex justify-between text-slate-700">
                      <span>• {'Closing Cash in Hand'}</span>
                      <span className="font-mono font-bold">{currency} {receiptsAndPaymentsData.closingCash.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>• {'Closing Bank Balance'}</span>
                      <span className="font-mono font-bold">{currency} {receiptsAndPaymentsData.closingBank.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center font-bold text-slate-900 text-sm">
                <span>{'Total Payments & Balances:'}</span>
                <span className="font-mono text-slate-900 text-base">
                  {currency} {receiptsAndPaymentsData.grandTotalPayments.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>)}

      {/* ------------------------------------------------------------- */}
      {/* 16. PROJECT-WISE SALES & EXPENSE PROFITABILITY REPORT */}
      {/* ------------------------------------------------------------- */}
      {reportId === 'project-profitability' && (<div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-amber-600"/>
                <h3 className="font-bold text-slate-900 text-base">
                  {'Project-Wise Sales & Expense Profitability Statement'}
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {`Total Projects: ${(projects || []).length}`}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                    <th className="py-3 px-4"></th>
                    <th className="py-3 px-4"></th>
                    <th className="py-3 px-4 text-right">Income Tk</th>
                    <th className="py-3 px-4">Expense Breakdown</th>
                    <th className="py-3 px-4 text-right">Total Exp</th>
                    <th className="py-3 px-4 text-right">Net Profit</th>
                    <th className="py-3 px-4 text-center">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(projects || []).map((p) => {
                const breakdown = p.expenseItems.reduce((acc, exp) => {
                    const catName = exp.categoryBn || exp.category;
                    acc[catName] = (acc[catName] || 0) + Number(exp.amount || 0);
                    return acc;
                }, {} as Record<string, number>);
                return (<tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <div className="font-mono text-[10px] font-bold text-slate-500">{p.code}</div>
                          <div className="font-bold text-slate-900">{isBn && p.nameBn ? p.nameBn : p.name}</div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{p.clientName}</td>
                        <td className="py-3 px-4 text-right font-black text-emerald-700 font-mono">
                          {currency} {p.totalSales.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          {Object.keys(breakdown).length === 0 ? (<span className="text-[11px] text-slate-400 italic"></span>) : (<div className="flex flex-wrap gap-1.5">
                              {Object.entries(breakdown).map(([cName, amt]) => (<span key={cName} className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-200">
                                  <span>{cName}:</span>
                                  <span className="font-bold text-rose-700 font-mono">
                                    {currency}{amt.toLocaleString()}
                                  </span>
                                </span>))}
                            </div>)}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-rose-600 font-mono">
                          {currency} {p.totalExpenses.toLocaleString()}
                        </td>
                        <td className={`py-3 px-4 text-right font-black font-mono text-sm ${p.netProfit >= 0 ? 'text-emerald-700 bg-emerald-50/50' : 'text-rose-700 bg-rose-50/50'}`}>
                          {currency} {p.netProfit.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[11px]">
                            {p.profitMargin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>);
            })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/80 font-black text-slate-900 text-xs border-t-2 border-slate-300">
                    <td colSpan={2} className="py-3 px-4">
                      {'Grand Total (All Projects):'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-800">
                      {currency}{' '}
                      {(projects || []).reduce((sum, p) => sum + p.totalSales, 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-normal italic text-[11px]">
                      {'All custom expense breakdown categories included'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-700">
                      {currency}{' '}
                      {(projects || []).reduce((sum, p) => sum + p.totalExpenses, 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-900 text-sm">
                      {currency}{' '}
                      {(projects || []).reduce((sum, p) => sum + p.netProfit, 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-amber-800">
                      {((projects || []).reduce((sum, p) => sum + p.totalSales, 0) > 0
                ? (((projects || []).reduce((sum, p) => sum + p.netProfit, 0) /
                    (projects || []).reduce((sum, p) => sum + p.totalSales, 0)) *
                    100).toFixed(1)
                : '0.0')}
                      %
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>)}
    </div>);
};
