import React from 'react';
import { SalesInvoice, AccountingTransaction, AuditLogEntry, CompanyProfile, Language } from '../types';
import { BrandLogo } from './BrandLogo';
import { DocumentHeader } from './DocumentHeader';
import { exportSalesToExcel, exportAccountingToExcel, exportAuditTrailToExcel } from '../utils/exportUtils';
import { isAdvanceAdjustmentTransaction } from '../utils/accountUtils';
import { Printer, X, FileSpreadsheet, FileText, Calendar, DollarSign, TrendingUp, Receipt, Phone, Mail, MapPin, ShieldCheck, UserCheck, } from 'lucide-react';
interface ReportPrintModalProps {
    type: 'sales' | 'accounting' | 'audit';
    salesData?: SalesInvoice[];
    accountingData?: AccountingTransaction[];
    auditData?: AuditLogEntry[];
    profile: CompanyProfile;
    language: Language;
    dateRangeText: string;
    onClose: () => void;
}
export const ReportPrintModal: React.FC<ReportPrintModalProps> = ({ type, salesData = [], accountingData = [], auditData = [], profile, language, dateRangeText, onClose, }) => {
    const handlePrint = () => {
        window.print();
    };
    const handleExcelExport = () => {
        if (type === 'sales') {
            exportSalesToExcel(salesData, profile, dateRangeText);
        }
        else if (type === 'accounting') {
            const income = accountingData
                .filter((t) => t.type === 'INCOME' && !isAdvanceAdjustmentTransaction(t))
                .reduce((acc, t) => acc + t.amount, 0);
            const expense = accountingData
                .filter((t) => t.type === 'EXPENSE')
                .reduce((acc, t) => acc + t.amount, 0);
            exportAccountingToExcel(accountingData, profile, dateRangeText, {
                income,
                expense,
                net: income - expense,
            });
        }
        else {
            exportAuditTrailToExcel(auditData, profile, dateRangeText);
        }
    };
    // Calculations for Sales
    const salesTotalRevenue = salesData.reduce((acc, inv) => acc + (inv.grandTotal || 0), 0);
    const salesTotalPaid = salesData.reduce((acc, inv) => acc + (inv.paidAmount || 0), 0);
    const salesTotalDue = salesData.reduce((acc, inv) => acc + (inv.dueAmount || 0), 0);
    const salesTotalInvoices = salesData.length;
    // Calculations for Accounting
    const totalIncome = accountingData
        .filter((tx) => tx.type === 'INCOME' && !isAdvanceAdjustmentTransaction(tx))
        .reduce((acc, tx) => acc + tx.amount, 0);
    const totalExpense = accountingData
        .filter((tx) => tx.type === 'EXPENSE')
        .reduce((acc, tx) => acc + tx.amount, 0);
    const netMargin = totalIncome - totalExpense;
    // Calculations for Audit
    const auditTotalEvents = auditData.length;
    const auditTotalAmount = auditData.reduce((acc, log) => acc + (log.amount || 0), 0);
    const auditUniqueStaff = new Set(auditData.map((l) => l.staffId)).size;
    const reportTitleEn = type === 'sales'
        ? 'Sales & Commercial Revenue Performance Report'
        : type === 'accounting'
            ? 'General Accounting Ledger & Financial Statement'
            : 'Staff Activity & Internal Audit Trail Report';
    const reportTitleBn = type === 'sales'
        ? "" : type === 'accounting'
        ? "Description Report" : "Actions";
    return (<div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-transparent print:static">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[96vh] flex flex-col shadow-2xl border border-slate-200 print:border-none print:shadow-none print:max-w-none print:max-h-none print:rounded-none print:w-full">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="print:hidden p-3 sm:p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              {type === 'sales' ? (<FileText className="w-5 h-5"/>) : type === 'accounting' ? (<TrendingUp className="w-5 h-5"/>) : (<ShieldCheck className="w-5 h-5 text-blue-600"/>)}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                {reportTitleEn}
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600"/>
                {dateRangeText}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Download Excel Button */}
            <button type="button" onClick={handleExcelExport} className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs flex items-center gap-1.5 transition-all">
              <FileSpreadsheet className="w-4 h-4"/>
              <span>{'Export Excel'}</span>
            </button>

            {/* Print / Save as PDF Button */}
            <button type="button" onClick={handlePrint} className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 text-white hover:bg-black shadow-xs flex items-center gap-1.5 transition-all">
              <Printer className="w-4 h-4 text-amber-400"/>
              <span>{'Print / Save PDF'}</span>
            </button>

            {/* Close Button */}
            <button type="button" onClick={onClose} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors" aria-label="Close modal">
              <X className="w-5 h-5"/>
            </button>
          </div>
        </div>

        {/* Printable Document Sheet */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 print:p-0 print:overflow-visible bg-white">
          <div className="max-w-4xl mx-auto space-y-6 text-slate-900">
            {/* Official Document Header with Logo on Left and QR Code on Right */}
            <DocumentHeader documentTitle={reportTitleEn} documentSubtitle={`Period: ${dateRangeText} • Generated: ${new Date().toLocaleString()}`}/>

            {/* Financial Summary KPI Cards (For print and screen) */}
            {type === 'sales' ? (<div className="grid grid-cols-4 gap-3 text-center">
                <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    {'Total Invoices'}
                  </span>
                  <span className="text-base sm:text-lg font-black text-slate-900">
                    {salesTotalInvoices}
                  </span>
                </div>
                <div className="border border-amber-200 rounded-lg p-2.5 bg-amber-50/50">
                  <span className="text-[10px] uppercase font-bold text-amber-700 block">
                    {'Gross Sales'}
                  </span>
                  <span className="text-base sm:text-lg font-black text-amber-700">
                    {profile.currencySymbol}{salesTotalRevenue.toLocaleString()}
                  </span>
                </div>
                <div className="border border-emerald-200 rounded-lg p-2.5 bg-emerald-50/50">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                    {'Total Collected'}
                  </span>
                  <span className="text-base sm:text-lg font-black text-emerald-700">
                    {profile.currencySymbol}{salesTotalPaid.toLocaleString()}
                  </span>
                </div>
                <div className="border border-rose-200 rounded-lg p-2.5 bg-rose-50/50">
                  <span className="text-[10px] uppercase font-bold text-rose-700 block">
                    {'Outstanding Due'}
                  </span>
                  <span className="text-base sm:text-lg font-black text-rose-700">
                    {profile.currencySymbol}{salesTotalDue.toLocaleString()}
                  </span>
                </div>
              </div>) : type === 'accounting' ? (<div className="grid grid-cols-4 gap-3 text-center">
                <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    {'Total Entries'}
                  </span>
                  <span className="text-base sm:text-lg font-black text-slate-900">
                    {accountingData.length}
                  </span>
                </div>
                <div className="border border-emerald-200 rounded-lg p-2.5 bg-emerald-50/50">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                    {'Total Inflow'}
                  </span>
                  <span className="text-base sm:text-lg font-black text-emerald-700">
                    {profile.currencySymbol}{totalIncome.toLocaleString()}
                  </span>
                </div>
                <div className="border border-rose-200 rounded-lg p-2.5 bg-rose-50/50">
                  <span className="text-[10px] uppercase font-bold text-rose-700 block">
                    {'Total Outflow'}
                  </span>
                  <span className="text-base sm:text-lg font-black text-rose-700">
                    {profile.currencySymbol}{totalExpense.toLocaleString()}
                  </span>
                </div>
                <div className={`border rounded-lg p-2.5 ${netMargin >= 0 ? 'border-blue-200 bg-blue-50/50 text-blue-700' : 'border-rose-200 bg-rose-50/50 text-rose-700'}`}>
                  <span className="text-[10px] uppercase font-bold block">
                    {'Net Operating'}
                  </span>
                  <span className="text-base sm:text-lg font-black">
                    {profile.currencySymbol}{netMargin.toLocaleString()}
                  </span>
                </div>
              </div>) : (<div className="grid grid-cols-4 gap-3 text-center">
                <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    {'Audited Events'}
                  </span>
                  <span className="text-base sm:text-lg font-black text-slate-900">
                    {auditTotalEvents}
                  </span>
                </div>
                <div className="border border-blue-200 rounded-lg p-2.5 bg-blue-50/50">
                  <span className="text-[10px] uppercase font-bold text-blue-700 block">
                    {'Audited Volume'}
                  </span>
                  <span className="text-base sm:text-lg font-black text-blue-700">
                    {profile.currencySymbol}{auditTotalAmount.toLocaleString()}
                  </span>
                </div>
                <div className="border border-purple-200 rounded-lg p-2.5 bg-purple-50/50">
                  <span className="text-[10px] uppercase font-bold text-purple-700 block">
                    {'Active Staff'}
                  </span>
                  <span className="text-base sm:text-lg font-black text-purple-700">
                    {auditUniqueStaff}
                  </span>
                </div>
                <div className="border border-emerald-200 rounded-lg p-2.5 bg-emerald-50/50">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                    {'Integrity Status'}
                  </span>
                  <span className="text-sm sm:text-base font-black text-emerald-700">
                    {'Verified & Active'}
                  </span>
                </div>
              </div>)}

            {/* Main Data Table */}
            <div className="border border-slate-300 rounded-lg overflow-hidden">
              {type === 'sales' ? (<table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-2 border-r border-slate-200 text-center w-8">SL</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">Invoice No</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">Date</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">Customer</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">Items Detail</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200 text-right">Total</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200 text-right">Paid</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200 text-right">Due</th>
                      <th className="py-2.5 px-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {salesData.length === 0 ? (<tr>
                        <td colSpan={9} className="py-6 text-center text-slate-400">
                          {'No sales records found for this period'}
                        </td>
                      </tr>) : (salesData.map((inv, idx) => (<tr key={inv.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-slate-100/50 print:bg-transparent`} style={{ pageBreakInside: 'avoid' }}>
                          <td className="py-2 px-2 text-center text-slate-500 border-r border-slate-200 text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-2.5 font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                            {inv.invoiceNo}
                          </td>
                          <td className="py-2 px-2.5 text-slate-600 border-r border-slate-200 whitespace-nowrap">
                            {inv.date}
                          </td>
                          <td className="py-2 px-2.5 border-r border-slate-200">
                            <div className="font-semibold text-slate-900 leading-tight">
                              {inv.customerName}
                            </div>
                            {inv.customerPhone && (<div className="text-[10px] text-slate-500">{inv.customerPhone}</div>)}
                          </td>
                          <td className="py-2 px-2.5 border-r border-slate-200 max-w-[200px] truncate text-[11px] text-slate-600">
                            {inv.items.map((i) => `${i.name} (x${i.qty})`).join(', ')}
                          </td>
                          <td className="py-2 px-2.5 text-right font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                            {profile.currencySymbol}{inv.grandTotal.toLocaleString()}
                          </td>
                          <td className="py-2 px-2.5 text-right font-bold text-emerald-600 border-r border-slate-200 whitespace-nowrap">
                            {profile.currencySymbol}{inv.paidAmount.toLocaleString()}
                          </td>
                          <td className="py-2 px-2.5 text-right font-bold text-rose-600 border-r border-slate-200 whitespace-nowrap">
                            {profile.currencySymbol}{inv.dueAmount.toLocaleString()}
                          </td>
                          <td className="py-2 px-2.5 text-center whitespace-nowrap text-[10px]">
                            <span className={`px-1.5 py-0.5 rounded font-bold ${inv.paymentStatus === 'Paid'
                    ? 'bg-emerald-100 text-emerald-800'
                    : inv.paymentStatus === 'Partial'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'}`}>
                              {inv.paymentStatus}
                            </span>
                          </td>
                        </tr>)))}
                  </tbody>
                  {salesData.length > 0 && (<tfoot>
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                        <td colSpan={5} className="py-2.5 px-3 text-right uppercase text-[11px]">
                          {'Summary Grand Total:'}
                        </td>
                        <td className="py-2.5 px-2.5 text-right border-r border-slate-300">
                          {profile.currencySymbol}{salesTotalRevenue.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2.5 text-right text-emerald-700 border-r border-slate-300">
                          {profile.currencySymbol}{salesTotalPaid.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2.5 text-right text-rose-700 border-r border-slate-300">
                          {profile.currencySymbol}{salesTotalDue.toLocaleString()}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>)}
                </table>) : type === 'accounting' ? (<table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-2 border-r border-slate-200 text-center w-8">SL</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">Date</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">Ref No</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">Type</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">Category</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">Description / Particulars</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">Account</th>
                      <th className="py-2.5 px-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {accountingData.length === 0 ? (<tr>
                        <td colSpan={8} className="py-6 text-center text-slate-400">
                          {'No accounting entries found for this period'}
                        </td>
                      </tr>) : (accountingData.map((tx, idx) => (<tr key={`${tx.id || 'tx'}-${idx}`} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-slate-100/50 print:bg-transparent`} style={{ pageBreakInside: 'avoid' }}>
                          <td className="py-2 px-2 text-center text-slate-500 border-r border-slate-200 text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-2.5 text-slate-600 border-r border-slate-200 whitespace-nowrap">
                            {tx.date}
                          </td>
                          <td className="py-2 px-2.5 font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                            {tx.refNo || 'N/A'}
                          </td>
                          <td className="py-2 px-2.5 border-r border-slate-200 whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tx.type === 'INCOME'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'}`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-slate-700 font-medium border-r border-slate-200">
                            {tx.category}
                          </td>
                          <td className="py-2 px-2.5 text-slate-800 border-r border-slate-200 max-w-[220px]">
                            {tx.description}
                          </td>
                          <td className="py-2 px-2.5 text-slate-600 border-r border-slate-200 whitespace-nowrap">
                            {tx.account}
                          </td>
                          <td className="py-2 px-2.5 text-right font-bold whitespace-nowrap">
                            <span className={tx.type === 'INCOME' ? 'text-emerald-700' : 'text-rose-700'}>
                              {tx.type === 'INCOME' ? '+' : '-'} {profile.currencySymbol}{tx.amount.toLocaleString()}
                            </span>
                          </td>
                        </tr>)))}
                  </tbody>
                  {accountingData.length > 0 && (<tfoot>
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                        <td colSpan={7} className="py-2.5 px-3 text-right uppercase text-[11px]">
                          {'Net Inflow / Surplus:'}
                        </td>
                        <td className="py-2.5 px-2.5 text-right">
                          <span className={netMargin >= 0 ? 'text-blue-700' : 'text-rose-700'}>
                            {profile.currencySymbol}{netMargin.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    </tfoot>)}
                </table>) : (<table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-2 border-r border-slate-200 text-center w-8">SL</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">Timestamp</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">Staff Member & Role</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">Action Type</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">Ref / Doc #</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">Particulars / Details</th>
                      <th className="py-2.5 px-2.5 text-right">Amount</th>
                      <th className="py-2.5 px-2.5 text-center">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {auditData.length === 0 ? (<tr>
                        <td colSpan={8} className="py-6 text-center text-slate-400">
                          {'No audit records found'}
                        </td>
                      </tr>) : (auditData.map((log, idx) => (<tr key={log.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-slate-100/50 print:bg-transparent`} style={{ pageBreakInside: 'avoid' }}>
                          <td className="py-2 px-2 text-center text-slate-500 border-r border-slate-200 text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-2.5 text-slate-600 border-r border-slate-200 whitespace-nowrap font-mono text-[11px]">
                            {log.timestamp}
                          </td>
                          <td className="py-2 px-2.5 border-r border-slate-200 whitespace-nowrap">
                            <span className="font-bold text-slate-900 block">{log.staffName}</span>
                            <span className="text-[10px] text-slate-500">{log.staffRole}</span>
                          </td>
                          <td className="py-2 px-2.5 border-r border-slate-200 whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              {log.actionType}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 font-bold font-mono text-slate-800 border-r border-slate-200 whitespace-nowrap">
                            {log.refNo || '—'}
                          </td>
                          <td className="py-2 px-2.5 text-slate-800 border-r border-slate-200 max-w-[240px]">
                            {log.details}
                          </td>
                          <td className="py-2 px-2.5 text-right font-bold whitespace-nowrap border-r border-slate-200">
                            {log.amount !== undefined ? (<span>
                                {profile.currencySymbol}{log.amount.toLocaleString()}
                              </span>) : (<span className="text-slate-300">—</span>)}
                          </td>
                          <td className="py-2 px-2 text-center whitespace-nowrap text-[11px]">
                            {log.location}
                          </td>
                        </tr>)))}
                  </tbody>
                  {auditData.length > 0 && (<tfoot>
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                        <td colSpan={6} className="py-2.5 px-3 text-right uppercase text-[11px]">
                          {'Total Audited Monetary Volume:'}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-bold text-blue-800 border-r border-slate-300">
                          {profile.currencySymbol}{auditTotalAmount.toLocaleString()}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>)}
                </table>)}
            </div>

            {/* Official Verification Signatures for Professional Printouts */}
            <div className="pt-10 pb-4 border-t border-slate-200 mt-8" style={{ pageBreakInside: 'avoid' }}>
              <div className="grid grid-cols-3 gap-8 text-center text-xs">
                <div>
                  <div className="border-t border-slate-400 pt-1.5 w-44 mx-auto font-bold text-slate-800">
                    {'Prepared By (Accounts)'}
                  </div>
                  <span className="text-[10px] text-slate-400">Officer / Accountant</span>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1.5 w-44 mx-auto font-bold text-slate-800">
                    {'Audited & Verified By'}
                  </div>
                  <span className="text-[10px] text-slate-400">Head of Finance & Operations</span>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1.5 w-44 mx-auto font-bold text-slate-800">
                    {'Managing Director / Authorized'}
                  </div>
                  <span className="text-[10px] text-slate-400">{profile.name}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-400 mt-6 print:mt-4">
                This report is electronically generated and certified by {profile.name} ERP System.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);
};
