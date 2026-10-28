import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ExpenseHead } from '../types';
import { Layers, Plus, Search, Edit2, Trash2, Eye, CheckCircle2, XCircle, TrendingDown, DollarSign, AlertCircle, Briefcase, Sliders, } from 'lucide-react';
import { resolveExpenseAccount } from '../utils/accountUtils';
export const ExpenseHeadManager: React.FC = () => {
    const { expenseHeads, chartOfAccounts, language, profile, activeStaff, addExpenseHead, updateExpenseHead, deleteExpenseHead, checkPermission, } = useApp();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('ALL');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingHead, setEditingHead] = useState<ExpenseHead | null>(null);
    const [viewingHead, setViewingHead] = useState<ExpenseHead | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const isSuperAdmin = (activeStaff?.role || '').toLowerCase() === 'super admin' ||
        (activeStaff?.role || '').toLowerCase() === 'superadmin' ||
        activeStaff?.customRoleId === 'role-superadmin' ||
        (activeStaff?.name || '').toLowerCase().includes('super admin');
    const canManageExpenses = isSuperAdmin || Boolean(checkPermission && (checkPermission('accounting.manage_expense_heads') || checkPermission('ACCOUNTING_EXPENSE_HEADS')));
    const canEditExpenseHead = isSuperAdmin || Boolean(checkPermission && checkPermission('accounting.edit_transaction'));
    const canDeleteExpenseHead = isSuperAdmin || Boolean(checkPermission && checkPermission('accounting.delete_transaction'));
    // Form state
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        nameBn: '',
        category: 'General',
        monthlyBudgetLimit: 10000,
        linkedAccountId: '',
        description: '',
        isActive: true,
    });

    // Dynamic expense categories strictly derived from real existing expense heads
    const categories = useMemo(() => {
        const set = new Set<string>();
        (expenseHeads || []).forEach((h) => {
            if (h.category && h.category.trim()) {
                set.add(h.category.trim());
            }
        });
        return Array.from(set).sort();
    }, [expenseHeads]);

    // Comprehensive category suggestions for new expense heads
    const categorySuggestions = useMemo(() => {
        const set = new Set<string>([
            'Operations',
            'Logistics',
            'Payroll',
            'Utilities',
            'Facility',
            'Maintenance',
            'Technology',
            'Projects',
            'Hospitality',
            'Marketing',
            'Administration',
            'Legal & Tax',
            'Wastage',
        ]);
        (expenseHeads || []).forEach((h) => {
            if (h.category && h.category.trim()) {
                set.add(h.category.trim());
            }
        });
        return Array.from(set).sort();
    }, [expenseHeads]);

    // Reset filter if active category was deleted
    useEffect(() => {
        if (filterCategory !== 'ALL' && !categories.includes(filterCategory)) {
            setFilterCategory('ALL');
        }
    }, [categories, filterCategory]);

    const getHeadBudget = (h: ExpenseHead) => Number(h.monthlyBudgetLimit ?? h.budgetMonthly ?? 0);

    const getLinkedCOA = (head: ExpenseHead) => {
        if (head.linkedAccountId) {
            const exact = chartOfAccounts.find(a => 
                a.id === head.linkedAccountId || 
                a.code === head.linkedAccountId || 
                a.code === head.linkedAccountId.replace('coa-', '') ||
                a.id === `coa-${head.linkedAccountId}`
            );
            if (exact) return exact;
        }
        // Intelligent dynamic matching by Head Code, Name or Category
        return resolveExpenseAccount(head.name, head.description, chartOfAccounts, expenseHeads) || null;
    };

    const filteredHeads = useMemo(() => {
        return expenseHeads.filter((head) => {
            if (filterCategory !== 'ALL' && head.category !== filterCategory) {
                return false;
            }
            const q = searchQuery.toLowerCase().trim();
            if (!q)
                return true;
            return (head.name.toLowerCase().includes(q) ||
                (head.nameBn && head.nameBn.includes(q)) ||
                head.code.toLowerCase().includes(q) ||
                head.category.toLowerCase().includes(q));
        });
    }, [expenseHeads, filterCategory, searchQuery]);

    const totalMonthlyBudget = useMemo(() => {
        return expenseHeads.reduce((sum, h) => sum + getHeadBudget(h), 0);
    }, [expenseHeads]);

    const actualLinkedCount = useMemo(() => {
        return expenseHeads.filter((h) => getLinkedCOA(h) !== null).length;
    }, [expenseHeads, chartOfAccounts]);

    const handleOpenAdd = () => {
        const existingNums = expenseHeads
            .map(h => parseInt(h.code.replace(/\D/g, ''), 10))
            .filter(n => !isNaN(n));
        const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : expenseHeads.length + 1;
        const nextCode = `EH-${nextNum.toString().padStart(2, '0')}`;
        setFormData({
            code: nextCode,
            name: '',
            nameBn: '',
            category: categories[0] || 'General',
            monthlyBudgetLimit: 15000,
            linkedAccountId: chartOfAccounts.find((c) => c.classification === 'Expense')?.id || '',
            description: '',
            isActive: true,
        });
        setEditingHead(null);
        setShowAddModal(true);
        setDeleteError(null);
    };

    const handleOpenEdit = (head: ExpenseHead) => {
        const linkedAcc = getLinkedCOA(head);
        setFormData({
            code: head.code,
            name: head.name,
            nameBn: head.nameBn || '',
            category: head.category,
            monthlyBudgetLimit: getHeadBudget(head),
            linkedAccountId: linkedAcc?.id || head.linkedAccountId || '',
            description: head.description || '',
            isActive: head.isActive,
        });
        setEditingHead(head);
        setShowAddModal(true);
        setDeleteError(null);
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.code.trim())
            return;
        const budget = Number(formData.monthlyBudgetLimit) || 0;
        if (editingHead) {
            updateExpenseHead(editingHead.id, {
                code: formData.code.trim(),
                name: formData.name.trim(),
                nameBn: formData.nameBn.trim(),
                category: formData.category,
                budgetMonthly: budget,
                monthlyBudgetLimit: budget,
                linkedAccountId: formData.linkedAccountId || undefined,
                description: formData.description.trim(),
                isActive: formData.isActive,
            });
        }
        else {
            addExpenseHead({
                code: formData.code.trim(),
                name: formData.name.trim(),
                nameBn: formData.nameBn.trim(),
                category: formData.category,
                budgetMonthly: budget,
                monthlyBudgetLimit: budget,
                linkedAccountId: formData.linkedAccountId || undefined,
                description: formData.description.trim(),
                isActive: formData.isActive,
            });
        }
        setShowAddModal(false);
    };
    const handleDelete = (id: string) => {
        const res = deleteExpenseHead(id);
        if (!res.success) {
            setDeleteError(res.message || 'Failed to delete expense head');
            setTimeout(() => setDeleteError(null), 5000);
        }
    };
    const handleToggleStatus = (head: ExpenseHead) => {
        updateExpenseHead(head.id, { isActive: !head.isActive });
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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 block">
            {'Total Expense Heads'}
          </span>
          <div className="text-xl font-black text-slate-900 mt-1">
            {expenseHeads.length} <span className="text-xs font-normal text-slate-400"></span>
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold block mt-1">
            {expenseHeads.filter((h) => h.isActive).length}Active</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 block">
            {'Monthly Budget Cap'}
          </span>
          <div className="text-xl font-black text-rose-600 mt-1">
            {profile.currencySymbol}{totalMonthlyBudget.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">Total</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 block">
            {'Expense Categories'}
          </span>
          <div className="text-xl font-black text-blue-600 mt-1">
            {new Set(expenseHeads.map((h) => h.category)).size} <span className="text-xs font-normal text-slate-400"></span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">Active Categories</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 block">
            {'COA Linked'}
          </span>
          <div className="text-xl font-black text-emerald-600 mt-1">
            {actualLinkedCount} / {expenseHeads.length}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">Accounts Mapped</span>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"/>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={'Search expense head...'} className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"/>
          </div>

          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700">
            <option value="ALL">{'All Categories'} ({expenseHeads.length})</option>
            {categories.map((c) => {
              const count = (expenseHeads || []).filter((h) => h.category === c).length;
              return (
                <option key={c} value={c}>
                  {c} ({count})
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {canManageExpenses && (<button type="button" id="btn-add-expense-head" onClick={handleOpenAdd} className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-all w-full sm:w-auto justify-center cursor-pointer">
              <Plus className="w-4 h-4 text-amber-400"/>
              <span>{'Add New Expense Head'}</span>
            </button>)}
        </div>
      </div>

      {/* Expense Heads Table List (Chart of Accounts style) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                <th className="py-3 px-4">{'Head Code'}</th>
                <th className="py-3 px-4">{'Expense Head Name & Description'}</th>
                <th className="py-3 px-4">{'Category / Group'}</th>
                <th className="py-3 px-4">{'Linked COA Account'}</th>
                <th className="py-3 px-4 text-right">{'Monthly Budget Cap'}</th>
                <th className="py-3 px-4 text-center">{'Status'}</th>
                <th className="py-3 px-4 text-right">{'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHeads.length === 0 ? (<tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                        <Layers className="w-5 h-5"/>
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm">
                        {'No expense heads found'}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {filterCategory !== 'ALL' || searchQuery
                          ? 'No expense heads match your filter criteria.'
                          : 'Create your custom expense heads to organize and track business expenditures.'}
                      </p>
                      {filterCategory !== 'ALL' || searchQuery ? (
                        <button
                          type="button"
                          onClick={() => {
                            setFilterCategory('ALL');
                            setSearchQuery('');
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
                        >
                          <span>Clear Filters</span>
                        </button>
                      ) : (
                        canManageExpenses && (
                          <button
                            type="button"
                            onClick={handleOpenAdd}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-amber-400" />
                            <span>Add New Expense Head</span>
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>) : (filteredHeads.map((head) => {
            const linkedAccount = getLinkedCOA(head);
            const budgetLimit = getHeadBudget(head);
            return (<tr key={head.id} className={`hover:bg-slate-50/80 transition-colors ${!head.isActive ? 'bg-slate-50/40 text-slate-400' : ''}`}>
                      <td className="py-3.5 px-4 align-middle">
                        <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                          {head.code}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 align-middle">
                        <div className="font-bold text-slate-900 text-sm">{head.name}</div>
                        {head.nameBn && (<div className="text-xs text-slate-500 font-medium mt-0.5">{head.nameBn}</div>)}
                        {head.description && (<div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 max-w-sm" title={head.description}>
                            {head.description}
                          </div>)}
                      </td>

                      <td className="py-3.5 px-4 align-middle">
                        <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {head.category}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 align-middle">
                        {linkedAccount ? (<div className="text-xs">
                            <span className="font-mono text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 border border-slate-200 mr-1.5">
                              {linkedAccount.code}
                            </span>
                            <span className="font-medium text-slate-800">{linkedAccount.name}</span>
                          </div>) : (<span className="inline-flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                            {head.linkedAccountId ? `COA #${head.linkedAccountId.replace('coa-', '')} Pending` : 'Not linked'}
                          </span>)}
                      </td>

                      <td className="py-3.5 px-4 text-right align-middle font-mono font-bold text-slate-900 text-[13px]">
                        {budgetLimit > 0 ? (<span className="text-rose-600">
                            {profile.currencySymbol}{budgetLimit.toLocaleString()}
                          </span>) : (<span className="text-slate-400 text-xs font-normal">
                            {'Unlimited'}
                          </span>)}
                      </td>

                      <td className="py-3.5 px-4 text-center align-middle">
                        <button type="button" onClick={() => handleToggleStatus(head)} className="focus:outline-hidden cursor-pointer" title={head.isActive ? 'Active - Click to Deactivate' : 'Inactive - Click to Activate'}>
                          {head.isActive ? (<span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 hover:bg-emerald-100 transition-colors">
                              <CheckCircle2 className="w-3 h-3"/> Active
                            </span>) : (<span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 hover:bg-slate-200 transition-colors">
                              <XCircle className="w-3 h-3"/> Inactive
                            </span>)}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right align-middle">
                        <div className="flex items-center justify-end gap-1.5">
                          <button type="button" onClick={() => setViewingHead(head)} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors" title={'View'}>
                            <Eye className="w-3.5 h-3.5"/>
                          </button>
                          {canEditExpenseHead && (
                            <button type="button" onClick={() => handleOpenEdit(head)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200 transition-colors" title={'Edit'}>
                              <Edit2 className="w-3.5 h-3.5"/>
                            </button>
                          )}
                          {canDeleteExpenseHead && (
                            <button type="button" onClick={() => handleDelete(head.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors" title={'Delete'}>
                              <Trash2 className="w-3.5 h-3.5"/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>);
        }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Expense Head Modal */}
      {showAddModal && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleFormSubmit} className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-600"/>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingHead
                ?
                    'Edit Expense Head'
                :
                    'Add New Expense Head'}
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
                    {'Head Code *'}
                  </label>
                  <input type="text" required value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold"/>
                </div>
                <div className="col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Category Group *'}
                  </label>
                  <input
                    type="text"
                    required
                    list="expense-category-suggestions"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Enter or pick category (e.g. Operations, Office, Factory)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold text-slate-800"
                  />
                  <datalist id="expense-category-suggestions">
                    {categorySuggestions.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Expense Head Name (EN) *'}
                </label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Generator Fuel & Octane" className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold"/>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Expense Head Name (BN)'}
                </label>
                <input type="text" value={formData.nameBn} onChange={(e) => setFormData({ ...formData, nameBn: e.target.value })} placeholder=":" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {"Monthly BudgetTk"}
                  </label>
                  <input type="number" step="any" value={formData.monthlyBudgetLimit} onChange={(e) => setFormData({ ...formData, monthlyBudgetLimit: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold text-rose-600"/>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Linked COA Head'}
                  </label>
                  <select value={formData.linkedAccountId} onChange={(e) => setFormData({ ...formData, linkedAccountId: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium">
                    <option value="">-- {'None / Default'} --</option>
                    {chartOfAccounts
                .filter((a) => a.classification === 'Expense')
                .map((a) => (<option key={a.id} value={a.id}>
                          [{a.code}] {a.name}
                        </option>))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Description'}
                </label>
                <textarea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Short policy notes or budget details..." className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="head-active-toggle" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="rounded text-slate-900 focus:ring-slate-900 h-4 w-4"/>
                <label htmlFor="head-active-toggle" className="font-bold text-slate-700 cursor-pointer">
                  {'Set as Active Expense Head'}
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {'Cancel'}
              </button>
              <button type="submit" className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs">
                {'Save Expense Head'}
              </button>
            </div>
          </form>
        </div>)}

      {/* View Expense Head Details Modal */}
      {viewingHead && (() => {
            const linkedAccount = getLinkedCOA(viewingHead);
            const budgetLimit = getHeadBudget(viewingHead);
            return (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600"/>
                  <h3 className="font-bold text-slate-900 text-base">
                    {'Expense Head Details'}
                  </h3>
                </div>
                <button type="button" onClick={() => setViewingHead(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                  ✕
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">{'Code'}</span>
                    <span className="font-bold text-slate-900 font-mono text-[12px]">{viewingHead.code}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">{'Status'}</span>
                    <span className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full border mt-0.5 ${viewingHead.isActive
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-slate-500 bg-slate-100 border-slate-200'}`}>
                      {viewingHead.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">{'Expense Head Name (English)'}</span>
                  <p className="font-bold text-slate-900 text-sm">{viewingHead.name}</p>
                </div>

                {viewingHead.nameBn && (<div className="space-y-1">
                    <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">{'Expense Head Name (Bengali)'}</span>
                    <p className="font-bold text-slate-800 text-sm">{viewingHead.nameBn}</p>
                  </div>)}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">{'Category Group'}</span>
                    <p className="font-semibold text-slate-800">{viewingHead.category}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">{'Monthly Budget Limit'}</span>
                    <p className="font-bold text-rose-600 font-mono text-sm">
                      {profile.currencySymbol}{budgetLimit.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">{'Linked COA Account'}</span>
                  {linkedAccount ? (<div className="p-2 border border-slate-100 bg-blue-50/20 rounded-lg text-blue-800 font-medium font-mono text-[11px]">
                      [{linkedAccount.code}] {linkedAccount.name}
                    </div>) : (<p className="text-slate-400 italic">{'No chart of account linked'}</p>)}
                </div>

                <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                  <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-wider">{'Description & Narration'}</span>
                  <p className="text-slate-700 font-medium leading-relaxed">{viewingHead.description || 'N/A'}</p>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setViewingHead(null)} className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs">
                  {'Close'}
                </button>
              </div>
            </div>
          </div>);
        })()}
    </div>);
};
