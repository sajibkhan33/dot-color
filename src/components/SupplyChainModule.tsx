import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { PurchaseOrder, Supplier, PaymentMethod, PurchaseItem } from '../types';
import { getPaymentMethodLiveBalance, calculateSingleAccountBalance, matchChannelToAccount, getPurchaseOrderPayments } from '../utils/accountUtils';
import { Truck, Plus, Search, CheckCircle2, Clock, Building2, DollarSign, AlertCircle, FileCheck, UserCheck, Package, Calendar, Phone, Factory, ArrowRight, Edit2, Trash2, CreditCard, Wallet, Landmark, Smartphone, Receipt, ExternalLink, MapPin, Mail, User, PackageCheck, Banknote, History, } from 'lucide-react';
export const SupplyChainModule: React.FC = () => {
    const { purchaseOrders = [], suppliers = [], products = [], profile, language, accountBalances, paymentMethods = [], chartOfAccounts = [], transactions = [], invoices = [], journalEntries = [], addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, receivePurchaseOrder, payPurchaseOrder, paySupplier, paySupplierDue, addSupplier, updateSupplier, deleteSupplier, checkPermission, activeStaff } = useApp();

    const isSuperAdmin = (activeStaff?.role || '').toLowerCase() === 'super admin' ||
        (activeStaff?.role || '').toLowerCase() === 'superadmin' ||
        activeStaff?.customRoleId === 'role-superadmin' ||
        (activeStaff?.name || '').toLowerCase().includes('super admin');
    const canCreatePO = isSuperAdmin || Boolean(checkPermission && checkPermission('supply.create_po'));
    const canReceiveStock = isSuperAdmin || Boolean(checkPermission && checkPermission('supply.receive_stock'));
    const canManageSuppliers = isSuperAdmin || Boolean(checkPermission && checkPermission('supply.manage_suppliers'));
    const canPaySupplier = isSuperAdmin || Boolean(checkPermission && checkPermission('supply.pay_supplier'));

    const activePaymentMethods = useMemo(() => {
        const list = (paymentMethods || []).filter((p) => p.isEnabled);
        return list.length > 0 ? list : [{ id: 'pm-cash', name: 'Cash', nameBn: 'নগদ', type: 'cash' as const, isEnabled: true }];
    }, [paymentMethods]);
    const [activeSubTab, setActiveSubTab] = useState<'orders' | 'suppliers'>('orders');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    // Modals
    const [showNewPOModal, setShowNewPOModal] = useState(false);
    const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
    const [poFormError, setPoFormError] = useState<string | null>(null);
    const [poSuccessToast, setPoSuccessToast] = useState<string | null>(null);
    const [poToReceive, setPoToReceive] = useState<PurchaseOrder | null>(null);
    const [receiveItemsState, setReceiveItemsState] = useState<{
        productId: string;
        name: string;
        unit: string;
        orderedQty: number;
        receivedQty: number;
    }[]>([]);
    const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);
    const [showSupplierModal, setShowSupplierModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
    const [paySupplierModal, setPaySupplierModal] = useState<Supplier | null>(null);
    const [supplierPayAmount, setSupplierPayAmount] = useState<number>(0);
    const [supplierPayAccount, setSupplierPayAccount] = useState<string>(() => activePaymentMethods[0]?.name || 'Cash');
    const [paySupplierTargetPoId, setPaySupplierTargetPoId] = useState<string>('all');
    const [selectedVendorProfile, setSelectedVendorProfile] = useState<Supplier | null>(null);
    const [viewingPaymentDetailsPO, setViewingPaymentDetailsPO] = useState<PurchaseOrder | null>(null);
    // Specific PO Payment Modal
    const [poToPay, setPoToPay] = useState<PurchaseOrder | null>(null);
    const [poPayAmount, setPoPayAmount] = useState<number>(0);
    const [poPayAccount, setPoPayAccount] = useState<string>(() => activePaymentMethods[0]?.name || 'Cash');
    const [poPayMethod, setPoPayMethod] = useState<PaymentMethod>(() => activePaymentMethods[0]?.name || 'Cash');
    // New PO form state
    const [poType, setPoType] = useState<'Sales' | 'Custom'>('Sales');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>((suppliers && suppliers[0]?.id) || '');
    const [destination, setDestination] = useState<'Factory' | 'Office'>('Factory');
    const [poItems, setPoItems] = useState<{
        productId: string;
        name: string;
        unit: string;
        qty: number;
        unitCost: number;
    }[]>(() => {
        const rawProd = (products || []).find((p) => p.isRawMaterial) || (products || [])[0];
        return [
            {
                productId: rawProd?.id || '',
                name: rawProd?.name || '',
                unit: rawProd?.unit || 'roll',
                qty: 10,
                unitCost: rawProd?.costPrice || 500,
            },
        ];
    });
    const [poPaidAmount, setPoPaidAmount] = useState<number>(0);
    const [poPaymentMethod, setPoPaymentMethod] = useState<PaymentMethod>(() => activePaymentMethods[0]?.name || 'Cash');
    const [poNotes, setPoNotes] = useState('');
    // New Supplier form state
    const [newSupName, setNewSupName] = useState('');
    const [newSupContact, setNewSupContact] = useState('');
    const [newSupPhone, setNewSupPhone] = useState('');
    const [newSupAddress, setNewSupAddress] = useState('');
    const [newSupCat, setNewSupCat] = useState('');
    const [newSupBankAccountNumber, setNewSupBankAccountNumber] = useState('');
    const [newSupBankName, setNewSupBankName] = useState('');
    const [newSupBankAccounts, setNewSupBankAccounts] = useState<Array<{
        bankName: string;
        accountNumber: string;
        accountName?: string;
        branchName?: string;
    }>>([]);
    const [tempBankName, setTempBankName] = useState('');
    const [tempAccountNo, setTempAccountNo] = useState('');
    const [tempAccountName, setTempAccountName] = useState('');
    const [tempBranchName, setTempBranchName] = useState('');
    // PO calculations
    const poSubtotal = poItems.reduce((acc, i) => acc + i.qty * i.unitCost, 0);
    // Filtered orders
    const filteredPOs = purchaseOrders.filter((po) => {
        const matchStatus = filterStatus === 'ALL' ? true : po.status === filterStatus;
        const q = (searchQuery || '').toLowerCase().trim();
        if (!q)
            return matchStatus;
        const poNum = (po.poNumber || po.poNo || '').toLowerCase();
        const suppName = (po.supplierName || '').toLowerCase();
        const matchSearch = poNum.includes(q) ||
            suppName.includes(q) ||
            (po.items && po.items.some((i) => (i.name || '').toLowerCase().includes(q)));
        return matchStatus && matchSearch;
    });
    const getSupplierPOs = (supplier: Supplier) => {
        const sId = supplier.id;
        const sName = (supplier.name || '').toLowerCase().trim();
        const sCompany = (supplier.company || '').toLowerCase().trim();
        const sPhone = (supplier.phone || '').replace(/\D/g, '');
        return purchaseOrders.filter((p) => {
            const pSuppId = p.supplierId || '';
            const pSuppName = (p.supplierName || '').toLowerCase().trim();
            const pSuppPhone = (p.supplierPhone || '').replace(/\D/g, '');
            return ((sId && pSuppId === sId) ||
                (sName && pSuppName === sName) ||
                (sName && (pSuppName.includes(sName) || sName.includes(pSuppName))) ||
                (sCompany && pSuppName === sCompany) ||
                (sCompany && (pSuppName.includes(sCompany) || sCompany.includes(pSuppName))) ||
                (sPhone && pSuppPhone && sPhone === pSuppPhone));
        });
    };
    const getSupplierFinancials = (supplier: Supplier) => {
        const pos = getSupplierPOs(supplier);
        // Received POs: only received goods create confirmed bills and active payable dues
        const receivedPOs = pos.filter((p) => p.status === 'Received');
        const pendingPOs = pos.filter((p) => p.status !== 'Received');
        const recTotal = receivedPOs.reduce((acc, p) => acc + (p.grandTotal ?? p.totalAmount ?? 0), 0);
        const recPaid = receivedPOs.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
        const recDue = receivedPOs.reduce((acc, p) => acc +
            (p.dueAmount !== undefined
                ? p.dueAmount
                : Math.max(0, (p.grandTotal ?? p.totalAmount ?? 0) - (p.paidAmount || 0))), 0);
        const pendingTotal = pendingPOs.reduce((acc, p) => acc + (p.grandTotal ?? p.totalAmount ?? 0), 0);
        const hasAnyPOs = pos.length > 0;
        const totalBills = hasAnyPOs ? recTotal : 0;
        const balanceDue = hasAnyPOs ? recDue : ((purchaseOrders || []).length > 0 ? 0 : Number(supplier.balancePayable ?? supplier.dueAmount ?? 0));
        const totalPaid = hasAnyPOs ? pos.reduce((acc, p) => acc + (p.paidAmount || 0), 0) : 0;
        return { pos, receivedPOs, pendingPOs, totalBills, totalPaid, balanceDue, pendingTotal };
    };
    const totalProcurement = purchaseOrders.reduce((acc, po) => acc + (po.grandTotal ?? po.totalAmount ?? 0), 0);
    const totalPayableToSuppliers = (purchaseOrders && purchaseOrders.length > 0)
        ? purchaseOrders
            .filter((p) => p.status === 'Received')
            .reduce((acc, p) => acc + (p.dueAmount !== undefined ? Number(p.dueAmount) : Math.max(0, (Number(p.grandTotal ?? p.totalAmount ?? 0)) - (Number(p.paidAmount || 0)))), 0)
        : (suppliers || []).reduce((acc, s) => acc + Number(s.balancePayable ?? s.dueAmount ?? 0), 0);
    const totalPaidToSuppliers = (purchaseOrders || []).reduce((acc, po) => acc + (po.paidAmount || 0), 0);
    const bankBalance = accountBalances?.bank ?? 0;
    const cashBalance = accountBalances?.cash ?? 0;
    const mobileBalance = accountBalances?.mobile ?? 0;
    const getAccountLiveBalance = (accountOrMethodName: string): number => {
        if (!accountOrMethodName) return 0;
        const lower = accountOrMethodName.toLowerCase().trim();
        // 1. Match payment method from activePaymentMethods
        const matchedPm = activePaymentMethods.find(
            (p) => p.name.toLowerCase().trim() === lower || p.id.toLowerCase().trim() === lower
        );
        if (matchedPm) {
            return getPaymentMethodLiveBalance(matchedPm, chartOfAccounts, transactions, invoices, accountBalances, [], journalEntries);
        }
        // 2. Match directly with Chart of Accounts
        const coaAcc = matchChannelToAccount(accountOrMethodName, chartOfAccounts, activePaymentMethods);
        if (coaAcc) {
            return calculateSingleAccountBalance(coaAcc, transactions, invoices, [], journalEntries);
        }
        // 3. Fallbacks based on keyword
        if (lower.includes('bank') || lower.includes('city') || lower.includes('southeast') || lower.includes('brac')) {
            return accountBalances?.bank ?? 0;
        }
        if (lower.includes('bkash') || lower.includes('nagad') || lower.includes('mobile')) {
            return accountBalances?.mobile ?? 0;
        }
        return accountBalances?.cash ?? 0;
    };
    const handleAddPoItemRow = () => {
        if (poType === 'Custom') {
            setPoItems([
                ...poItems,
                {
                    productId: `custom-${Date.now()}-${poItems.length}`,
                    name: '',
                    unit: 'pcs',
                    qty: 5,
                    unitCost: 100,
                },
            ]);
        }
        else {
            const defaultProd = (products || []).find((p) => p.isRawMaterial) || (products || [])[0];
            if (defaultProd) {
                setPoItems([
                    ...poItems,
                    {
                        productId: defaultProd.id,
                        name: defaultProd.name,
                        unit: defaultProd.unit,
                        qty: 5,
                        unitCost: defaultProd.costPrice,
                    },
                ]);
            }
        }
    };
    const handleUpdatePoItemRow = (index: number, field: string, value: any) => {
        const updated = [...poItems];
        if (field === 'productId') {
            const prod = (products || []).find((p) => p.id === value);
            if (prod) {
                updated[index] = {
                    ...updated[index],
                    productId: prod.id,
                    name: prod.name,
                    unit: prod.unit,
                    unitCost: prod.costPrice,
                };
            }
        }
        else {
            (updated[index] as any)[field] = value;
        }
        setPoItems(updated);
    };
    const handleRemovePoItemRow = (index: number) => {
        if (poItems.length <= 1)
            return;
        setPoItems(poItems.filter((_, i) => i !== index));
    };
    const openCreatePOModal = (presetSupplierId?: string) => {
        setEditingPO(null);
        setPoFormError(null);
        setPoType('Sales');
        const targetSupId = presetSupplierId ||
            (suppliers.some((s) => s.id === selectedSupplierId) ? selectedSupplierId : '') ||
            (suppliers && suppliers.length > 0 ? suppliers[0].id : '');
        setSelectedSupplierId(targetSupId);
        setDestination('Factory');
        setPoPaidAmount(0);
        setPoNotes('');
        const defaultProd = (products || []).find((p) => p.isRawMaterial) || (products || [])[0];
        setPoItems([
            {
                productId: defaultProd?.id || 'raw-1',
                name: defaultProd?.name || 'Raw Material Item',
                unit: defaultProd?.unit || 'roll',
                qty: 10,
                unitCost: defaultProd?.costPrice || 500,
            },
        ]);
        setShowNewPOModal(true);
    };
    const handleCreatePO = (e: React.FormEvent) => {
        e.preventDefault();
        setPoFormError(null);
        const sup = (suppliers || []).find((s) => s.id === selectedSupplierId);
        if (!sup) {
            setPoFormError('⚠️ Please select a vendor / supplier.');
            return;
        }
        const validItems: PurchaseItem[] = [];
        for (const item of poItems) {
            const matchedProd = (products || []).find((p) => p.id === item.productId);
            const name = (item.name || '').trim() || matchedProd?.name || 'Raw Material Item';
            const unit = (item.unit || matchedProd?.unit || 'roll') as any;
            const qty = Math.max(0, Number(item.qty) || 0);
            const unitCost = Math.max(0, Number(item.unitCost) || 0);
            if (qty > 0) {
                validItems.push({
                    productId: item.productId || matchedProd?.id || `custom-${Date.now()}`,
                    name,
                    unit,
                    qty,
                    unitCost,
                    totalCost: qty * unitCost,
                });
            }
        }
        if (validItems.length === 0) {
            setPoFormError('⚠️ Please provide valid quantity and cost for at least one item.');
            return;
        }
        const sub = validItems.reduce((acc, item) => acc + item.totalCost, 0);
        const paid = Math.min(sub, Math.max(0, Number(poPaidAmount) || 0));
        const due = Math.max(0, sub - paid);
        const payStatus = due <= 0 ? 'Paid' : paid <= 0 ? 'Due' : 'Partial';
        if (editingPO) {
            updatePurchaseOrder(editingPO.id, {
                supplierId: sup.id,
                supplierName: sup.name,
                supplierPhone: sup.phone,
                items: validItems,
                subtotal: sub,
                totalAmount: sub,
                grandTotal: sub,
                paidAmount: paid,
                dueAmount: due,
                paymentStatus: payStatus,
                paymentMethod: poPaymentMethod,
                destination: destination,
                destinationLocation: destination,
                notes: poNotes || undefined,
            });
            setPoSuccessToast(`✅ Purchase Order (${editingPO.poNo || 'PO'}) updated successfully!`);
        }
        else {
            const created = addPurchaseOrder({
                date: new Date().toISOString().slice(0, 10),
                supplierId: sup.id,
                supplierName: sup.name,
                supplierPhone: sup.phone,
                destination: destination,
                destinationLocation: destination,
                items: validItems,
                subtotal: sub,
                totalAmount: sub,
                grandTotal: sub,
                paidAmount: paid,
                dueAmount: due,
                paymentStatus: payStatus,
                paymentMethod: poPaymentMethod,
                status: 'Ordered',
                notes: poNotes || undefined,
            });
            setPoSuccessToast(`✅ New Purchase Order (${created?.poNo || 'PO'}) created successfully!`);
        }
        setShowNewPOModal(false);
        setEditingPO(null);
        setPoNotes('');
        setActiveSubTab('orders');
        setTimeout(() => {
            setPoSuccessToast(null);
        }, 5000);
    };
    const handleCreateSupplier = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSupName || !newSupPhone)
            return;
        let accountsToSave = [...newSupBankAccounts];
        if (tempBankName.trim() && tempAccountNo.trim()) {
            accountsToSave.push({
                bankName: tempBankName.trim(),
                accountNumber: tempAccountNo.trim(),
                accountName: tempAccountName.trim() || undefined,
                branchName: tempBranchName.trim() || undefined,
            });
        }
        const firstAcc = accountsToSave[0];
        const legacyBankNo = firstAcc ? firstAcc.accountNumber : '';
        const legacyBankName = firstAcc ? firstAcc.bankName : '';
        if (editingSupplier) {
            updateSupplier(editingSupplier.id, {
                name: newSupName,
                company: newSupName,
                contactPerson: newSupContact,
                phone: newSupPhone,
                address: newSupAddress,
                category: newSupCat || 'Raw Materials Supplier',
                bankAccountNumber: legacyBankNo,
                bankName: legacyBankName,
                bankAccounts: accountsToSave,
            });
            setPoSuccessToast(`Vendor "${newSupName}" updated successfully!`);
        }
        else {
            const created = addSupplier({
                name: newSupName,
                company: newSupName,
                contactPerson: newSupContact,
                phone: newSupPhone,
                address: newSupAddress,
                category: newSupCat || 'Raw Materials Supplier',
                balancePayable: 0,
                bankAccountNumber: legacyBankNo,
                bankName: legacyBankName,
                bankAccounts: accountsToSave,
            });
            if (created && created.id) {
                setSelectedSupplierId(created.id);
                setPoFormError(null);
            }
            setPoSuccessToast(`Vendor "${newSupName}" enlisted successfully!`);
        }
        setShowSupplierModal(false);
        setEditingSupplier(null);
        setNewSupName('');
        setNewSupContact('');
        setNewSupPhone('');
        setNewSupAddress('');
        setNewSupCat('');
        setNewSupBankAccountNumber('');
        setNewSupBankName('');
        setNewSupBankAccounts([]);
        setTempBankName('');
        setTempAccountNo('');
        setTempAccountName('');
        setTempBranchName('');
    };
    const handlePaySupplierSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!paySupplierModal || supplierPayAmount <= 0)
            return;
        const currentBal = getAccountLiveBalance(supplierPayAccount);
        if (supplierPayAmount > currentBal) {
            alert(`Insufficient funds in ${supplierPayAccount}! Available balance is ${profile.currencySymbol}${currentBal.toLocaleString()}. You cannot pay more than the available account balance.`);
            return;
        }
        const payFn = paySupplier || paySupplierDue;
        if (typeof payFn === 'function') {
            payFn(paySupplierModal.id, supplierPayAmount, supplierPayAccount, paySupplierTargetPoId === 'all' ? undefined : paySupplierTargetPoId);
        }
        setPaySupplierModal(null);
        setSupplierPayAmount(0);
        setPaySupplierTargetPoId('all');
    };
    const handlePayPOSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!poToPay || poPayAmount <= 0)
            return;
        const currentBal = getAccountLiveBalance(poPayAccount);
        if (poPayAmount > currentBal) {
            alert(`Insufficient funds in ${poPayAccount}! Available balance is ${profile.currencySymbol}${currentBal.toLocaleString()}. You cannot pay more than the available account balance.`);
            return;
        }
        payPurchaseOrder(poToPay.id, poPayAmount, poPayAccount, poPayMethod);
        setPoToPay(null);
        setPoPayAmount(0);
    };
    return (<div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5">
      {/* SUCCESS TOAST NOTIFICATION */}
      {poSuccessToast && (<div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-900 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0"/>
            <span className="font-bold text-sm">{poSuccessToast}</span>
          </div>
          <button type="button" onClick={() => setPoSuccessToast(null)} className="text-emerald-700 hover:text-emerald-950 font-bold text-base px-2 py-0.5 rounded-lg hover:bg-emerald-100 transition-colors">
            ✕
          </button>
        </div>)}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 block mb-1">
            {'Total Supply Procurement'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {profile.currencySymbol}
            {totalProcurement.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {purchaseOrders.length} {'purchase orders'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-amber-700 block mb-1">
            {'Accounts Payable (Supplier Due)'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-amber-700">
            {profile.currencySymbol}
            {totalPayableToSuppliers.toLocaleString()}
          </div>
          <span className="text-[11px] text-amber-600/80 mt-1 block font-medium">
            {suppliers.length} {'enlisted vendors'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-emerald-700 block mb-1">
            {'Accounts Paid (Supplier Paid)'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-700">
            {profile.currencySymbol}
            {totalPaidToSuppliers.toLocaleString()}
          </div>
          <span className="text-[11px] text-emerald-600/80 mt-1 block font-medium">
            {purchaseOrders.filter((p) => (p.paidAmount || 0) > 0).length}{' '}
            {'orders paid / partial'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-blue-600 block mb-1">
            {'Awaiting Delivery'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-blue-700">
            {purchaseOrders.filter((p) => p.status === 'Ordered').length}{' '}
            {'Orders'}
          </div>
          <span className="text-[11px] text-blue-600/80 mt-1 block font-medium">
            {'Waiting for warehouse receiving'}
          </span>
        </div>
      </div>

      {/* Action Header & Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button type="button" onClick={() => setActiveSubTab('orders')} className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'orders' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
            {'Purchase Orders'}
          </button>
          <button type="button" onClick={() => setActiveSubTab('suppliers')} className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'suppliers' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
            {'Vendor Directory'}
          </button>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {activeSubTab === 'suppliers' && canManageSuppliers && (<button type="button" onClick={() => {
                setEditingSupplier(null);
                setNewSupName('');
                setNewSupContact('');
                setNewSupPhone('');
                setNewSupAddress('');
                setNewSupCat('');
                setNewSupBankAccountNumber('');
                setNewSupBankName('');
                setNewSupBankAccounts([]);
                setTempBankName('');
                setTempAccountNo('');
                setTempAccountName('');
                setTempBranchName('');
                setShowSupplierModal(true);
            }} className="w-full md:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs">
              <Plus className="w-4 h-4 text-amber-400"/>
              <span>{'Add Vendor'}</span>
            </button>)}

          {activeSubTab === 'orders' && canCreatePO && (<button type="button" onClick={() => openCreatePOModal()} className="w-full md:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer">
              <Truck className="w-4 h-4"/>
              <span>{'+ Create Purchase Order'}</span>
            </button>)}
        </div>
      </div>

      {/* SUB-TAB 1: PURCHASE ORDERS */}
      {activeSubTab === 'orders' && (<div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={'Search PO# or supplier...'} className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"/>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold">
                <option value="ALL">{'All Status'}</option>
                <option value="Ordered">OrderedIn Progress Challan</option>
                <option value="Received">ReceivedStock Received</option>
                <option value="Draft">DraftDraft</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <th className="py-3 px-4">PO   Date</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Purchased Materials</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Payment</th>
                  <th className="py-3 px-4 text-center">Challan Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPOs.map((po) => (<tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-900">{po.poNumber || po.poNo}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{po.date}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{po.supplierName}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Factory className="w-3 h-3 text-amber-600"/>
                        <span>
                          {'To:'}{' '}
                          {po.destinationLocation || po.destination}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="space-y-1">
                        {po.items.map((i, idx) => {
                    const hasPartial = i.receivedQty !== undefined && i.receivedQty !== i.qty;
                    return (<div key={idx} className="text-xs">
                              <span className="font-semibold text-slate-800">{i.name}</span>{' '}
                              {hasPartial ? (<span className="inline-block font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] ml-1">
                                  {`PO: ${i.qty} | Recv: ${i.receivedQty} ${i.unit}`}
                                </span>) : (<span className="text-slate-500 font-normal">
                                  ({i.qty} {i.unit})
                                </span>)}
                            </div>);
                })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="font-black text-slate-900 text-sm">
                        {profile.currencySymbol}
                        {(po.grandTotal ?? po.totalAmount ?? 0).toLocaleString()}
                      </div>
                      {po.status === 'Received' && po.dueAmount > 0 ? (<div className="text-[11px] font-bold text-amber-700">
                          {'Due: '}
                          {profile.currencySymbol}
                          {po.dueAmount.toLocaleString()}
                        </div>) : po.status !== 'Received' ? (<div className="text-[10px] font-medium text-slate-400 mt-0.5">
                          {'Awaiting Receipt'}
                        </div>) : null}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {po.status !== 'Received' ? (<div className="flex flex-col items-center gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                              <Clock className="w-3 h-3 text-slate-500"/>
                              <span>{'Pending (Not Received)'}</span>
                            </span>
                            <span className="text-[9px] text-slate-400 font-medium">
                              {'Due upon receiving'}
                            </span>
                          </div>) : (() => {
                            const poPayments = getPurchaseOrderPayments(po, transactions, journalEntries, paymentMethods);
                            return (
                              <>
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${(po.paymentStatus === 'Paid' || po.dueAmount <= 0)
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : (po.paymentStatus === 'Partial' || po.paidAmount > 0)
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                  {(po.paymentStatus === 'Paid' || po.dueAmount <= 0)
                                    ? 'Paid'
                                    : (po.paymentStatus === 'Partial' || po.paidAmount > 0)
                                        ? 'Partial'
                                        : 'Due'}
                                </span>

                                {poPayments.length > 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => setViewingPaymentDetailsPO(po)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-extrabold cursor-pointer transition-colors shadow-2xs"
                                    title={poPayments.map(p => `${p.channel}: ${profile.currencySymbol}${(Number(p.amount) || 0).toLocaleString()}`).join(' • ')}
                                  >
                                    <span>{poPayments.length} Channels</span>
                                    <span className="text-[9px]">▾</span>
                                  </button>
                                ) : poPayments.length === 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => setViewingPaymentDetailsPO(po)}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] text-slate-700 font-semibold cursor-pointer transition-colors"
                                    title={`Click to view payment breakdown (${poPayments[0].channel})`}
                                  >
                                    <span>{poPayments[0].channel}</span>
                                    <span className="text-[9px] text-slate-400">▾</span>
                                  </button>
                                ) : po.paymentMethod ? (
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    {po.paymentMethod}
                                  </span>
                                ) : null}

                                {po.dueAmount > 0 && canPaySupplier && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPoToPay(po);
                                      setPoPayAmount(po.dueAmount);
                                      const defMethod = activePaymentMethods[0]?.name || 'Cash';
                                      setPoPayAccount(defMethod);
                                      setPoPayMethod(defMethod);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded text-[10px] font-bold cursor-pointer transition-colors shadow-2xs mt-0.5"
                                    title={`Pay bill for ${po.poNo}`}
                                  >
                                    <CreditCard className="w-3 h-3 text-slate-950"/>
                                    <span>{'Pay Bill'}</span>
                                  </button>
                                )}
                              </>
                            );
                          })()}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${po.status === 'Received'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-blue-100 text-blue-800'}`}>
                        {po.status === 'Received'
                    ?
                        po.items.some(i => i.receivedQty !== undefined && i.receivedQty !== i.qty)
                            ? 'Received (Partial)'
                            : 'Received'
                    :
                        'Ordered'}
                      </span>
                    </td>

                     <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {po.status === 'Ordered' ? (canReceiveStock ? (<button type="button" onClick={() => {
                        setPoToReceive(po);
                        setReceiveItemsState(po.items.map(i => ({
                            productId: i.productId,
                            name: i.name,
                            unit: i.unit,
                            orderedQty: i.qty,
                            receivedQty: i.qty
                        })));
                    }} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer">
                            <CheckCircle2 className="w-3.5 h-3.5"/>
                            <span>{'Receive'}</span>
                          </button>) : (<span className="text-slate-400 text-[10px] font-semibold">{'Ordered'}</span>)) : (<span className="text-slate-400 text-[10px] flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600"/>
                            {'Done'}
                          </span>)}

                        {/* Direct Pay button if PO has due */}
                        {po.dueAmount > 0 && canPaySupplier && (<button type="button" onClick={() => {
                        setPoToPay(po);
                        setPoPayAmount(po.dueAmount);
                        const defMethod = activePaymentMethods[0]?.name || 'Cash';
                        setPoPayAccount(defMethod);
                        setPoPayMethod(defMethod);
                    }} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors" title={`Pay bill for ${po.poNo}`}>
                            <CreditCard className="w-3.5 h-3.5"/>
                            <span>{'Pay'}</span>
                          </button>)}

                        {po.status !== 'Received' && canCreatePO && (<button type="button" onClick={() => {
                        setEditingPO(po);
                        setPoFormError(null);
                        setSelectedSupplierId(po.supplierId);
                        setDestination(po.destinationLocation || 'Factory');
                        setPoPaidAmount(po.paidAmount);
                        setPoNotes(po.notes || '');
                        // Check if there are custom items (items with non-standard products)
                        const hasCustomItems = po.items.some((item) => !products.some((p) => p.id === item.productId));
                        setPoType(hasCustomItems ? 'Custom' : 'Sales');
                        setPoItems(po.items.map((item) => ({
                            productId: item.productId,
                            name: item.name,
                            unit: item.unit,
                            qty: item.qty,
                            unitCost: item.unitCost,
                        })));
                        setShowNewPOModal(true);
                    }} className="p-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all inline-flex items-center justify-center cursor-pointer" title={'Edit'}>
                            <Edit2 className="w-3.5 h-3.5"/>
                          </button>)}

                        {po.status !== 'Received' && canCreatePO && (<button type="button" onClick={() => setPoToDelete(po)} className="p-1 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all inline-flex items-center justify-center cursor-pointer" title={'Delete'}>
                            <Trash2 className="w-3.5 h-3.5"/>
                          </button>)}
                      </div>
                    </td>
                  </tr>))}

                {filteredPOs.length === 0 && (<tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      {'No purchase orders found'}
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </div>)}

      {/* SUB-TAB 2: SUPPLIERS */}
      {activeSubTab === 'suppliers' && (<div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">
              {'Registered Material Suppliers'}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <th className="py-3 px-4">{'Vendor & Name'}</th>
                  <th className="py-3 px-4">{'Category'}</th>
                  <th className="py-3 px-4">{'Phone'}</th>
                  <th className="py-3 px-4">{'Address'}</th>
                  <th className="py-3 px-4 text-right">{'Total Bills'}</th>
                  <th className="py-3 px-4 text-right">{'Paid'}</th>
                  <th className="py-3 px-4 text-right">{'Balance (Due)'}</th>
                  <th className="py-3 px-4 text-center">{'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => {
                const { pos, receivedPOs, pendingPOs, totalBills, totalPaid, balanceDue, pendingTotal } = getSupplierFinancials(s);
                return (<tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <button type="button" onClick={() => setSelectedVendorProfile(s)} className="text-left group cursor-pointer" title={'View Vendor Profile & Bills'}>
                          <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                            <span>{s.name}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-blue-500 transition-colors"/>
                          </div>
                          {s.company && s.company !== s.name && (<div className="text-[11px] text-slate-500">{s.company}</div>)}
                          {s.contactPerson && (<div className="text-[10px] text-slate-400">:{s.contactPerson}</div>)}
                          {s.bankAccounts && s.bankAccounts.length > 0 ? (<div className="flex flex-col gap-0.5 mt-1 max-w-[200px]">
                              {s.bankAccounts.map((acc, index) => (<div key={index} className="text-[10px] text-amber-700 font-semibold inline-flex items-center gap-1 bg-amber-50 rounded px-1.5 py-0.5 border border-amber-200/50 w-fit">
                                  <Landmark className="w-2.5 h-2.5 shrink-0 text-amber-600"/>
                                  <span className="truncate">{acc.bankName}: {acc.accountNumber}</span>
                                </div>))}
                            </div>) : s.bankAccountNumber ? (<div className="text-[10px] text-amber-700 font-semibold mt-1 inline-flex items-center gap-1 bg-amber-50 rounded px-1.5 py-0.5 border border-amber-200/50 w-fit">
                              <Landmark className="w-2.5 h-2.5 shrink-0 text-amber-600"/>
                              <span>{s.bankName || 'Bank'}: {s.bankAccountNumber}</span>
                            </div>) : null}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {s.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{s.phone}</td>
                      <td className="py-3 px-4 text-slate-500">{s.address}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="font-bold text-slate-900 text-xs">
                          {profile.currencySymbol}{totalBills.toLocaleString()}
                        </div>
                        <span className="text-[10px] text-slate-400 block">
                          {receivedPOs.length} {'received bills'}
                        </span>
                        {pendingPOs.length > 0 && (<span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200" title={'Awaiting delivery receipt'}>
                            {pendingPOs.length} {'pending'}
                          </span>)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="font-bold text-emerald-600 text-xs">
                          {profile.currencySymbol}{totalPaid.toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-black text-xs ${balanceDue > 0 ? 'text-amber-700 font-extrabold' : 'text-slate-400'}`}>
                          {profile.currencySymbol}
                          {balanceDue.toLocaleString()}
                        </span>
                        {pendingPOs.length > 0 && (<span className="text-[9px] text-slate-400 block font-medium mt-0.5" title={'Due upon receiving goods'}>
                            {'Pending: '}
                            {profile.currencySymbol}{pendingTotal.toLocaleString()}
                          </span>)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* Vendor Profile / View Bills */}
                          <button type="button" onClick={() => setSelectedVendorProfile(s)} className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer" title={'View Vendor Bills & Profile'}>
                            <Receipt className="w-3.5 h-3.5"/>
                            <span>{'Bills'}</span>
                          </button>

                          {/* Quick Pay button if balanceDue > 0 */}
                          {balanceDue > 0 && canPaySupplier && (<button type="button" onClick={() => {
                            setPaySupplierModal(s);
                            setSupplierPayAmount(balanceDue);
                            const defMethod = activePaymentMethods[0]?.name || 'Cash';
                            setSupplierPayAccount(defMethod);
                            setPaySupplierTargetPoId('all');
                        }} className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-2xs whitespace-nowrap inline-flex items-center gap-1 cursor-pointer" title={'Pay Due'}>
                              <CreditCard className="w-3.5 h-3.5"/>
                              <span>{'Pay'}</span>
                            </button>)}

                          {canManageSuppliers && (<button type="button" onClick={() => {
                        setEditingSupplier(s);
                        setNewSupName(s.name);
                        setNewSupContact(s.contactPerson || '');
                        setNewSupPhone(s.phone);
                        setNewSupAddress(s.address || '');
                        setNewSupCat(s.category || '');
                        setNewSupBankAccountNumber(s.bankAccountNumber || '');
                        setNewSupBankName(s.bankName || '');
                        if (s.bankAccounts && s.bankAccounts.length > 0) {
                            setNewSupBankAccounts(s.bankAccounts);
                        }
                        else if (s.bankAccountNumber) {
                            setNewSupBankAccounts([{
                                    bankName: s.bankName || 'Bank',
                                    accountNumber: s.bankAccountNumber,
                                }]);
                        }
                        else {
                            setNewSupBankAccounts([]);
                        }
                        setTempBankName('');
                        setTempAccountNo('');
                        setTempAccountName('');
                        setTempBranchName('');
                        setShowSupplierModal(true);
                    }} className="p-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all inline-flex items-center justify-center cursor-pointer" title={'Edit'}>
                            <Edit2 className="w-3.5 h-3.5"/>
                          </button>)}

                          {canManageSuppliers && (<button type="button" onClick={() => setSupplierToDelete(s)} className="p-1 text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-lg transition-all inline-flex items-center justify-center cursor-pointer" title={'Delete'}>
                            <Trash2 className="w-3.5 h-3.5"/>
                          </button>)}
                        </div>
                      </td>
                    </tr>);
            })}
              </tbody>
            </table>
          </div>
        </div>)}

      {/* CREATE PURCHASE ORDER MODAL */}
      {showNewPOModal && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreatePO} className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-600"/>
                <span>
                  {editingPO
                ? ('Edit Purchase Order (PO)')
                : ('Create Purchase Order (PO)')}
                </span>
              </h3>
              <button type="button" onClick={() => {
                setShowNewPOModal(false);
                setEditingPO(null);
                setPoFormError(null);
            }} className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg hover:bg-slate-100">
                ✕
              </button>
            </div>

            {/* In-Modal Validation Error Banner */}
            {poFormError && (<div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0"/>
                  <span className="font-bold">{poFormError}</span>
                </div>
                {suppliers.length > 0 && !selectedSupplierId && (<button type="button" onClick={() => {
                        setSelectedSupplierId(suppliers[0].id);
                        setPoFormError(null);
                    }} className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold shrink-0 cursor-pointer shadow-2xs">
                    {`Select '${suppliers[0].name}'`}
                  </button>)}
              </div>)}

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 block">
                      {'Select Vendor *'}
                    </label>
                    <button type="button" onClick={() => {
                setEditingSupplier(null);
                setNewSupName('');
                setNewSupContact('');
                setNewSupPhone('');
                setNewSupAddress('');
                setNewSupCat('');
                setNewSupBankAccountNumber('');
                setNewSupBankName('');
                setNewSupBankAccounts([]);
                setTempBankName('');
                setTempAccountNo('');
                setTempAccountName('');
                setTempBranchName('');
                setShowSupplierModal(true);
            }} className="text-amber-600 font-bold hover:underline text-[11px] cursor-pointer">
                      {'+ Add New Vendor'}
                    </button>
                  </div>
                  <select value={selectedSupplierId} onChange={(e) => {
                setSelectedSupplierId(e.target.value);
                if (poFormError)
                    setPoFormError(null);
            }} className={`w-full px-3 py-2 border rounded-xl font-medium bg-white transition-all ${!selectedSupplierId && poFormError
                ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50/30'
                : 'border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-200'}`}>
                    <option value="">{'-- Select --'}</option>
                    {suppliers.map((s) => (<option key={s.id} value={s.id}>
                        {s.name} ({s.category})
                      </option>))}
                  </select>
                  {!selectedSupplierId && (<p className="text-[10px] text-rose-600 mt-1 font-semibold">
                      * {'Vendor selection is mandatory'}
                    </p>)}
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Receiving Warehouse'}
                  </label>
                  <select value={destination} onChange={(e) => setDestination(e.target.value as any)} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium">
                    <option value="Office">
                      {'Central Warehouse'}
                    </option>
                  </select>
                </div>
              </div>

              {/* Purchase Order Type Selection */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <label className="font-extrabold text-slate-700 block mb-1.5 uppercase tracking-wider text-[10px]">
                  {'Purchase Order Type *'}
                </label>
                <div className="flex gap-3 p-1 bg-white border border-slate-200/80 rounded-xl">
                  <label className="flex-1 flex items-center justify-center gap-2 py-1 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer font-bold transition-all text-slate-700 text-xs">
                    <input type="radio" name="poType" value="Sales" checked={poType === 'Sales'} onChange={() => {
                setPoType('Sales');
                const rawProd = (products || []).find((p) => p.isRawMaterial) || (products || [])[0];
                setPoItems([
                    {
                        productId: rawProd?.id || '',
                        name: rawProd?.name || '',
                        unit: rawProd?.unit || 'roll',
                        qty: 10,
                        unitCost: rawProd?.costPrice || 500,
                    },
                ]);
            }} className="accent-slate-900 cursor-pointer"/>
                    <span>{'Sales & Service Items'}</span>
                  </label>
                  <label className="flex-1 flex items-center justify-center gap-2 py-1 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer font-bold transition-all text-slate-700 text-xs">
                    <input type="radio" name="poType" value="Custom" checked={poType === 'Custom'} onChange={() => {
                setPoType('Custom');
                setPoItems([
                    {
                        productId: `custom-${Date.now()}`,
                        name: '',
                        unit: 'pcs',
                        qty: 10,
                        unitCost: 100,
                    },
                ]);
            }} className="accent-slate-900 cursor-pointer"/>
                    <span>{'Custom Purchase Order'}</span>
                  </label>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">
                    {'Purchased Items'}
                  </label>
                  <button type="button" onClick={handleAddPoItemRow} className="text-xs text-amber-600 hover:text-amber-800 font-bold flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5"/>
                    {'+ Add Row'}
                  </button>
                </div>

                {poItems.map((item, idx) => (<div key={idx} className="grid grid-cols-12 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 items-center">
                    <div className="col-span-5">
                      {poType === 'Custom' ? (<input type="text" value={item.name} onChange={(e) => handleUpdatePoItemRow(idx, 'name', e.target.value)} placeholder={'Enter item name...'} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-slate-950/20"/>) : (<select value={item.productId} onChange={(e) => handleUpdatePoItemRow(idx, 'productId', e.target.value)} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs">
                          {products.map((p) => (<option key={p.id} value={p.id}>
                              {p.name} ({p.unit})
                            </option>))}
                        </select>)}
                    </div>

                    <div className="col-span-3">
                      <div className="flex items-center gap-1">
                        <input type="number" step="any" min="1" value={item.qty} onChange={(e) => handleUpdatePoItemRow(idx, 'qty', Math.max(1, Number(e.target.value)))} placeholder="Qty" className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center"/>
                        {poType === 'Custom' ? (<select value={item.unit} onChange={(e) => handleUpdatePoItemRow(idx, 'unit', e.target.value)} className="bg-white border border-slate-200 rounded-lg text-[10px] p-1 font-semibold min-w-[50px]">
                            <option value="pcs">pcs</option>
                            <option value="roll">roll</option>
                            <option value="sqft">sqft</option>
                            <option value="set">set</option>
                            <option value="kg">kg</option>
                            <option value="liter">ltr</option>
                          </select>) : (<span className="text-[10px] text-slate-500">{item.unit}</span>)}
                      </div>
                    </div>

                    <div className="col-span-3">
                      <input type="number" step="any" min="0" value={item.unitCost} onChange={(e) => handleUpdatePoItemRow(idx, 'unitCost', Number(e.target.value))} placeholder="Cost" className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right"/>
                    </div>

                    <div className="col-span-1 text-right">
                      {poItems.length > 1 && (<button type="button" onClick={() => handleRemovePoItemRow(idx)} className="text-slate-400 hover:text-rose-600 font-bold p-1">
                          ✕
                        </button>)}
                    </div>
                  </div>))}
              </div>

              {/* Summary & Payment */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-baseline font-bold text-slate-900">
                  <span>{'Subtotal Cost:'}</span>
                  <span className="text-base text-amber-700 font-black">
                    {profile.currencySymbol}
                    {poSubtotal.toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {'Advance / Paid Amount'}
                    </label>
                    <input type="number" step="any" min="0" max={poSubtotal} value={poPaidAmount} onChange={(e) => setPoPaidAmount(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-emerald-700"/>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {'Payment Mode'}
                    </label>
                    <select value={poPaymentMethod} onChange={(e) => setPoPaymentMethod(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold">
                      {activePaymentMethods.map((pm) => {
                        const bal = getPaymentMethodLiveBalance(pm, chartOfAccounts, transactions, invoices, accountBalances, [], journalEntries);
                        return (
                          <option key={pm.id} value={pm.name}>
                            {pm.type === 'bank' ? '🏦' : pm.type === 'mfs' ? '📱' : '💵'} {pm.name} {pm.accountNumber ? `(${pm.accountNumber})` : ''} — [{profile.currencySymbol}{bal.toLocaleString()}]
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="text-right text-xs font-bold text-amber-800">
                  {'Remaining Payable: '}
                  {profile.currencySymbol}
                  {Math.max(0, poSubtotal - poPaidAmount).toLocaleString()}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Notes / Remarks'}
                </label>
                <input type="text" value={poNotes} onChange={(e) => setPoNotes(e.target.value)} placeholder="e.g. Urgent solvent ink delivery for Nazir Ahmed Chowdhury Rd factory" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => {
                setShowNewPOModal(false);
                setEditingPO(null);
                setPoFormError(null);
            }} className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
                {'Cancel'}
              </button>
              <button type="submit" className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400"/>
                <span>
                  {editingPO
                ? ('Update Purchase Order')
                : ('Confirm Purchase Order')}
                </span>
              </button>
            </div>
          </form>
        </div>)}

      {/* CREATE SUPPLIER MODAL */}
      {showSupplierModal && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateSupplier} className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingSupplier
                ? ('Edit Vendor / Supplier')
                : ('Enlist New Vendor / Supplier')}
              </h3>
              <button type="button" onClick={() => {
                setShowSupplierModal(false);
                setEditingSupplier(null);
            }} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Company Name *'}
                  </label>
                  <input type="text" required value={newSupName} onChange={(e) => setNewSupName(e.target.value)} placeholder="e.g. Signtech Media & Supplies" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Contact Person'}
                  </label>
                  <input type="text" value={newSupContact} onChange={(e) => setNewSupContact(e.target.value)} placeholder="e.g. Sajib Khan" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Phone *'}
                  </label>
                  <input type="tel" required value={newSupPhone} onChange={(e) => setNewSupPhone(e.target.value)} placeholder="01819-xxxxxx" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Address'}
                  </label>
                  <input type="text" value={newSupAddress} onChange={(e) => setNewSupAddress(e.target.value)} placeholder="e.g. Anderkilla, Chattogram / Dhaka" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Category / Materials'}
                </label>
                <input type="text" value={newSupCat} onChange={(e) => setNewSupCat(e.target.value)} placeholder="e.g. PVC Flex Rolls, Vinyl & Solvent Inks" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
              </div>

              <div className="border-t border-slate-100 pt-3 mt-1 space-y-3">
                <h4 className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5 text-amber-600">
                  <Landmark className="w-3.5 h-3.5"/>
                  <span>{'Bank Accounts (Add Multiple)'}</span>
                </h4>

                {/* List of Added Bank Accounts */}
                {newSupBankAccounts.length > 0 && (<div className="space-y-1.5 bg-slate-50 p-2 rounded-xl border border-slate-100 max-h-36 overflow-y-auto">
                    {newSupBankAccounts.map((acc, index) => (<div key={index} className="flex items-center justify-between gap-2 p-1.5 bg-white rounded-lg border border-slate-200 text-[10px]">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">
                            {acc.bankName} - <span className="font-mono">{acc.accountNumber}</span>
                          </div>
                          {(acc.accountName || acc.branchName) && (<div className="text-slate-500 truncate text-[9px] mt-0.5">
                              {acc.accountName && `${'Name: '}${acc.accountName}`}
                              {acc.branchName && ` • ${'Branch: '}${acc.branchName}`}
                            </div>)}
                        </div>
                        <button type="button" onClick={() => {
                        setNewSupBankAccounts(prev => prev.filter((_, idx) => idx !== index));
                    }} className="p-1 text-rose-600 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors" title={'Remove'}>
                          ✕
                        </button>
                      </div>))}
                  </div>)}

                {/* Form to add a new Bank Account */}
                <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-slate-600 block text-[10px] mb-0.5">
                        {'Bank Name'}
                      </label>
                      <input type="text" value={tempBankName} onChange={(e) => setTempBankName(e.target.value)} placeholder="e.g. BRAC Bank" className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px]"/>
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block text-[10px] mb-0.5">
                        {'Account Number'}
                      </label>
                      <input type="text" value={tempAccountNo} onChange={(e) => setTempAccountNo(e.target.value)} placeholder="e.g. 150120xxxx" className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-mono"/>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-slate-600 block text-[10px] mb-0.5">
                        {'Account Name (Opt)'}
                      </label>
                      <input type="text" value={tempAccountName} onChange={(e) => setTempAccountName(e.target.value)} placeholder="e.g. Acme Corp" className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px]"/>
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block text-[10px] mb-0.5">
                        {'Branch Name (Opt)'}
                      </label>
                      <input type="text" value={tempBranchName} onChange={(e) => setTempBranchName(e.target.value)} placeholder="e.g. Agrabad" className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px]"/>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button type="button" onClick={() => {
                if (!tempBankName.trim() || !tempAccountNo.trim())
                    return;
                setNewSupBankAccounts(prev => [
                    ...prev,
                    {
                        bankName: tempBankName.trim(),
                        accountNumber: tempAccountNo.trim(),
                        accountName: tempAccountName.trim() || undefined,
                        branchName: tempBranchName.trim() || undefined,
                    }
                ]);
                setTempBankName('');
                setTempAccountNo('');
                setTempAccountName('');
                setTempBranchName('');
            }} className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold shadow-2xs transition-colors cursor-pointer">
                      {'+ Add to List'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => {
                setShowSupplierModal(false);
                setEditingSupplier(null);
            }} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {'Cancel'}
              </button>
              <button type="submit" className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs">
                {editingSupplier
                ? ('Update Supplier')
                : ('Save Vendor')}
              </button>
            </div>
          </form>
        </div>)}

      {/* VENDOR PROFILE & INDIVIDUAL BILLS MODAL */}
      {selectedVendorProfile && (() => {
            const liveVendor = suppliers.find((s) => s.id === selectedVendorProfile.id) || selectedVendorProfile;
            const { pos: vendorPOs, receivedPOs, pendingPOs, totalBills, totalPaid, balanceDue, pendingTotal } = getSupplierFinancials(liveVendor);
            return (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full my-8 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <Building2 className="w-5 h-5"/>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        {liveVendor.name}
                      </h3>
                      {liveVendor.company && liveVendor.company !== liveVendor.name && (<span className="text-xs text-slate-500 font-medium">({liveVendor.company})</span>)}
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800">
                        {liveVendor.category || 'Supplier'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1.5 flex-wrap">
                      {liveVendor.phone && (<span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400"/>
                          {liveVendor.phone}
                        </span>)}
                      {liveVendor.contactPerson && (<span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400"/>
                          {liveVendor.contactPerson}
                        </span>)}
                      {liveVendor.address && (<span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400"/>
                          {liveVendor.address}
                        </span>)}
                    </div>
                    {liveVendor.bankAccounts && liveVendor.bankAccounts.length > 0 ? (<div className="flex flex-wrap gap-2 mt-2">
                        {liveVendor.bankAccounts.map((acc, index) => (<span key={index} className="inline-flex flex-col px-2.5 py-1.5 bg-amber-50/70 text-amber-950 border border-amber-200/70 rounded-xl text-xs shadow-3xs">
                            <span className="flex items-center gap-1.5 font-semibold">
                              <Landmark className="w-3.5 h-3.5 text-amber-600 shrink-0"/>
                              <span>{acc.bankName}: <strong className="font-bold font-mono text-[12px]">{acc.accountNumber}</strong></span>
                            </span>
                            {(acc.accountName || acc.branchName) && (<span className="text-[10px] text-amber-800/80 mt-0.5 ml-5">
                                {acc.accountName && `${'Name: '}${acc.accountName}`}
                                {acc.branchName && ` (${'Branch: '}${acc.branchName})`}
                              </span>)}
                          </span>))}
                      </div>) : liveVendor.bankAccountNumber ? (<div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs font-semibold">
                          <Landmark className="w-3.5 h-3.5 text-amber-600 shrink-0"/>
                          <span>
                            {'Bank Account: '}
                            <strong className="font-bold font-mono">{liveVendor.bankAccountNumber}</strong>
                            {liveVendor.bankName && ` (${liveVendor.bankName})`}
                          </span>
                        </span>
                      </div>) : null}
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedVendorProfile(null)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer">
                  ✕
                </button>
              </div>

              {/* Financial Metric Cards Ribbon (ex: Total Bills: 20000/- Paid: 5000/- Balance (Due): 15000/=) */}
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-white">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>{'Total Bills'}</span>
                      <Receipt className="w-4 h-4 text-slate-400"/>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-slate-900">
                      {profile.currencySymbol}{totalBills.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      {receivedPOs.length} {'received bills'}
                      {pendingPOs.length > 0 && (<span className="text-amber-600 font-medium"> • ({pendingPOs.length} {'pending'})</span>)}
                    </span>
                  </div>

                  <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                    <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>{'Total Paid'}</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600"/>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-emerald-700">
                      {profile.currencySymbol}{totalPaid.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-emerald-600 mt-0.5 block font-medium">
                      {'Paid to vendor'}
                    </span>
                  </div>

                  <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl">
                    <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>{'Balance (Due)'}</span>
                      <AlertCircle className="w-4 h-4 text-amber-600"/>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-amber-700">
                      {profile.currencySymbol}{balanceDue.toLocaleString()}
                    </div>
                    {pendingTotal > 0 && (<span className="text-[10px] text-slate-500 mt-0.5 block">
                        {'Pending orders: '}
                        {profile.currencySymbol}{pendingTotal.toLocaleString()}
                      </span>)}
                    {balanceDue > 0 ? (canPaySupplier ? (<button type="button" onClick={() => {
                        setPaySupplierModal(liveVendor);
                        setSupplierPayAmount(balanceDue);
                        const defMethod = activePaymentMethods[0]?.name || 'Cash';
                        setSupplierPayAccount(defMethod);
                        setPaySupplierTargetPoId('all');
                    }} className="mt-2 w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                        <CreditCard className="w-3.5 h-3.5"/>
                        <span>{'Pay All Dues'}</span>
                      </button>) : null) : (<span className="text-[10px] text-emerald-600 mt-0.5 block font-semibold">
                        ✓ {'All dues cleared'}
                      </span>)}
                  </div>
                </div>
              </div>

              {/* Individual Bills / PO List */}
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {'Individual Purchase Bills'}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {'Bills are due upon receiving and can be paid individually.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200">
                      {receivedPOs.length} {'Received'}
                    </span>
                    {pendingPOs.length > 0 && (<span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200">
                        {pendingPOs.length} {'Pending'}
                      </span>)}
                  </div>
                </div>

                {vendorPOs.length === 0 ? (<div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2"/>
                    <p className="text-xs font-medium text-slate-500">
                      {'No purchase orders found for this vendor.'}
                    </p>
                    {canCreatePO && (<button type="button" onClick={() => {
                        setSelectedVendorProfile(null);
                        openCreatePOModal(liveVendor.id);
                    }} className="mt-3 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
                      <Plus className="w-3.5 h-3.5"/>
                      <span>{'Create New Purchase Bill'}</span>
                    </button>)}
                  </div>) : (<div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                          <th className="py-2.5 px-3">{'PO No & Date'}</th>
                          <th className="py-2.5 px-3">{'Items & Destination'}</th>
                          <th className="py-2.5 px-3 text-right">{'Total Bill'}</th>
                          <th className="py-2.5 px-3 text-right">{'Paid'}</th>
                          <th className="py-2.5 px-3 text-right">{'Due'}</th>
                          <th className="py-2.5 px-3 text-center">{'Status'}</th>
                          <th className="py-2.5 px-3 text-center">{'Action'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {vendorPOs.map((po) => {
                        const isReceived = po.status === 'Received';
                        const poTotal = po.grandTotal ?? po.totalAmount ?? 0;
                        const poPaid = po.paidAmount || 0;
                        const poDue = isReceived
                            ? (po.dueAmount !== undefined ? po.dueAmount : Math.max(0, poTotal - poPaid))
                            : 0;
                        return (<tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-900">{po.poNo}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                  <Calendar className="w-3 h-3"/>
                                  {po.date}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="text-slate-800 font-medium line-clamp-1">
                                  {po.items.map((it) => `${it.name} (${it.qty} ${it.unit})`).join(', ')}
                                </div>
                                <span className="inline-block mt-0.5 text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  {po.destinationLocation || po.destination || 'Factory'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-slate-900">
                                {profile.currencySymbol}{poTotal.toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-emerald-600">
                                {profile.currencySymbol}{poPaid.toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {isReceived ? (<span className={`font-black ${poDue > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                                    {profile.currencySymbol}{poDue.toLocaleString()}
                                  </span>) : (<span className="text-slate-400 text-[11px] font-medium">
                                    {'— (Pending)'}
                                  </span>)}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {!isReceived ? (<span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center justify-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-500"/>
                                    <span>{'Pending (Unreceived)'}</span>
                                  </span>) : poDue <= 0 ? (<span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    {'Paid'}
                                  </span>) : poPaid > 0 ? (<span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    {'Partial'}
                                  </span>) : (<span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    {'Due'}
                                  </span>)}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {!isReceived ? (canReceiveStock ? (<button type="button" onClick={() => {
                                    setSelectedVendorProfile(null);
                                    setPoToReceive(po);
                                    setReceiveItemsState(po.items.map((it) => ({
                                        productId: it.productId,
                                        name: it.name,
                                        unit: it.unit,
                                        orderedQty: it.qty,
                                        receivedQty: it.qty,
                                    })));
                                }} className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap" title={'Receive items into stock'}>
                                    <PackageCheck className="w-3.5 h-3.5"/>
                                    <span>{'Receive'}</span>
                                  </button>) : (<span className="text-slate-400 text-[10px] font-semibold">{'Ordered'}</span>)) : poDue > 0 ? (canPaySupplier ? (<button type="button" onClick={() => {
                                    setPoToPay(po);
                                    setPoPayAmount(poDue);
                                    const defMethod = activePaymentMethods[0]?.name || 'Cash';
                                    setPoPayAccount(defMethod);
                                    setPoPayMethod(defMethod);
                                }} className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-2xs inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap">
                                    <CreditCard className="w-3.5 h-3.5"/>
                                    <span>{'Pay Bill'}</span>
                                  </button>) : (<span className="text-rose-600 text-[10px] font-bold">Due</span>)) : (<span className="text-[11px] text-emerald-600 font-bold flex items-center justify-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5"/>
                                    {'Done'}
                                  </span>)}
                              </td>
                            </tr>);
                    })}
                      </tbody>
                    </table>
                  </div>)}
              </div>

              {/* Modal Footer */}
              <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                <button type="button" onClick={() => setSelectedVendorProfile(null)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer">
                  {'Close'}
                </button>
              </div>
            </div>
          </div>);
        })()}

      {/* PAY SUPPLIER MODAL */}
      {paySupplierModal && (() => {
            const { pos: linkedSupplierPOs, totalBills, totalPaid, balanceDue } = getSupplierFinancials(paySupplierModal);
            const duePOs = linkedSupplierPOs.filter((p) => {
                const pDue = p.dueAmount !== undefined ? p.dueAmount : Math.max(0, (p.grandTotal ?? p.totalAmount ?? 0) - (p.paidAmount || 0));
                return pDue > 0;
            });
            const effectiveDue = balanceDue > 0 ? balanceDue : Number(paySupplierModal.balancePayable ?? paySupplierModal.dueAmount ?? 0);
            const selectedBal = getAccountLiveBalance(supplierPayAccount);
            return (<div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <form onSubmit={handlePaySupplierSubmit} className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                    <CreditCard className="w-4 h-4"/>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {'Pay Vendor Bill'}
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      {paySupplierModal.name} {paySupplierModal.company ? `(${paySupplierModal.company})` : ''}
                    </span>
                  </div>
                </div>
                <button type="button" onClick={() => setPaySupplierModal(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                  ✕
                </button>
              </div>

              <div className="text-xs space-y-3">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">{'Category:'}</span>
                    <span className="font-bold text-slate-700">{paySupplierModal.category || 'General'}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500">
                      {'Total Bills:'}
                    </span>
                    <span className="font-bold text-slate-800">
                      {profile.currencySymbol}{totalBills.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">
                      {'Paid:'}
                    </span>
                    <span className="font-bold text-emerald-600">
                      {profile.currencySymbol}{totalPaid.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                    <span className="text-slate-600 font-semibold">
                      {'Total Outstanding Due:'}
                    </span>
                    <span className="font-black text-amber-700 text-sm">
                      {profile.currencySymbol}
                      {effectiveDue.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Linked PO selector if vendor has pending POs */}
                {duePOs.length > 0 && (<div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {'Assign to Purchase Order'}
                    </label>
                    <select value={paySupplierTargetPoId} onChange={(e) => {
                        const val = e.target.value;
                        setPaySupplierTargetPoId(val);
                        if (val !== 'all') {
                            const targetPo = purchaseOrders.find((p) => p.id === val);
                            if (targetPo) {
                                const tDue = targetPo.dueAmount !== undefined ? targetPo.dueAmount : Math.max(0, (targetPo.grandTotal ?? targetPo.totalAmount ?? 0) - (targetPo.paidAmount || 0));
                                setSupplierPayAmount(tDue);
                            }
                        }
                    }} className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden bg-slate-50">
                      <option value="all">
                        {'All Due POs (FIFO)'}
                      </option>
                      {duePOs.map((p) => {
                        const pDue = p.dueAmount !== undefined ? p.dueAmount : Math.max(0, (p.grandTotal ?? p.totalAmount ?? 0) - (p.paidAmount || 0));
                        return (<option key={p.id} value={p.id}>
                            {p.poNo} — {'Due: '}Tk{pDue.toLocaleString()} ({p.items.map((it) => it.name).join(', ')})
                          </option>);
                    })}
                    </select>
                  </div>)}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">
                      {"Payment AmountTk  *"}
                    </label>
                    <button type="button" onClick={() => setSupplierPayAmount(effectiveDue)} className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer">
                      {'Full Due'}
                    </button>
                  </div>
                  <input type="number" step="any" min="1" max={effectiveDue} required value={supplierPayAmount} onChange={(e) => setSupplierPayAmount(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-black text-base text-amber-700 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"/>
                </div>

                {/* Account Balances Quick Selector */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Payment Account & Balance'}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-2">
                    {activePaymentMethods.map((pm) => {
                      const isSelected = supplierPayAccount.toLowerCase().trim() === pm.name.toLowerCase().trim();
                      const liveBal = getPaymentMethodLiveBalance(pm, chartOfAccounts, transactions, invoices, accountBalances, [], journalEntries);
                      const isBank = pm.type === 'bank';
                      const isMfs = pm.type === 'mfs';
                      const isCash = pm.type === 'cash';

                      return (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setSupplierPayAccount(pm.name)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300 shadow-xs'
                              : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-[11px] font-bold truncate">
                            {isBank ? <Landmark className="w-3.5 h-3.5 text-blue-600 shrink-0" /> :
                             isMfs ? <Smartphone className="w-3.5 h-3.5 text-purple-600 shrink-0" /> :
                             <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                            <span className="truncate text-slate-900">{pm.name}</span>
                          </div>
                          <div className="font-black text-xs text-slate-900 mt-1">
                            {profile.currencySymbol}{liveBal.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                            {pm.accountNumber || (isBank ? (pm.bankName || 'Bank') : isCash ? 'Cash' : 'MFS')}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <select
                    value={supplierPayAccount}
                    onChange={(e) => setSupplierPayAccount(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden bg-white"
                  >
                    <optgroup label="Active Payment Methods">
                      {activePaymentMethods.map((pm) => {
                        const bal = getPaymentMethodLiveBalance(pm, chartOfAccounts, transactions, invoices, accountBalances, [], journalEntries);
                        return (
                          <option key={pm.id} value={pm.name}>
                            {pm.type === 'bank' ? '🏦' : pm.type === 'mfs' ? '📱' : '💵'} {pm.name} {pm.accountNumber ? `(${pm.accountNumber})` : ''} — [{profile.currencySymbol}{bal.toLocaleString()}]
                          </option>
                        );
                      })}
                    </optgroup>
                    {chartOfAccounts.filter((a) => a.classification === 'Asset').length > 0 && (
                      <optgroup label="Chart of Accounts (Assets)">
                        {chartOfAccounts.filter((a) => a.classification === 'Asset').map((acc) => {
                          const bal = calculateSingleAccountBalance(acc, transactions, invoices);
                          return (
                            <option key={acc.id} value={acc.name}>
                              #{acc.code} {acc.name} — [{profile.currencySymbol}{bal.toLocaleString()}]
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* Account Balance Feedback Banner */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-slate-500 block text-[10px]">
                      {'Available Fund in Selected Account:'}
                    </span>
                    <span className="font-bold text-slate-900 text-xs">
                      {profile.currencySymbol}{selectedBal.toLocaleString()}
                    </span>
                  </div>
                  {supplierPayAmount > selectedBal ? (<span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                      {`⚠️ Insufficient Fund (Shortfall: ${profile.currencySymbol}${(supplierPayAmount - selectedBal).toLocaleString()})`}
                    </span>) : (<span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                      {'✓ Sufficient Fund'}
                    </span>)}
                </div>

                {supplierPayAmount > selectedBal && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      {`Payment amount exceeds available balance in ${supplierPayAccount} (${profile.currencySymbol}${selectedBal.toLocaleString()}). Cannot proceed with negative cash balance.`}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setPaySupplierModal(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                  {'Cancel'}
                </button>
                <button type="submit" disabled={supplierPayAmount <= 0 || supplierPayAmount > selectedBal} className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all ${
                  supplierPayAmount > selectedBal
                    ? 'bg-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-slate-900 hover:bg-slate-800 cursor-pointer'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400"/>
                  <span>{supplierPayAmount > selectedBal ? 'Insufficient Account Balance' : 'Confirm Payment'}</span>
                </button>
              </div>
            </form>
          </div>);
        })()}

      {/* PAY PO BILL MODAL */}
      {poToPay && (() => {
            const selectedPoBal = getAccountLiveBalance(poPayAccount);
            return (<div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <form onSubmit={handlePayPOSubmit} className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                    <CreditCard className="w-4 h-4"/>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {'Pay Purchase Order Bill'}
                    </h3>
                    <span className="text-[11px] font-mono text-blue-600 font-bold">
                      {poToPay.poNo}
                    </span>
                  </div>
                </div>
                <button type="button" onClick={() => setPoToPay(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                  ✕
                </button>
              </div>

              <div className="text-xs space-y-3">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">
                      {'Supplier / Vendor:'}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {poToPay.supplierName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500">
                      {'Total Grand Bill:'}
                    </span>
                    <span className="font-black text-slate-900">
                      {profile.currencySymbol}
                      {(poToPay.grandTotal ?? poToPay.totalAmount ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">
                      {'Already Paid:'}
                    </span>
                    <span className="font-bold text-emerald-700">
                      {profile.currencySymbol}
                      {(poToPay.paidAmount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                    <span className="font-bold text-rose-700">
                      {'Current Due:'}
                    </span>
                    <span className="font-black text-rose-700 text-sm">
                      {profile.currencySymbol}
                      {poToPay.dueAmount.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Prior Payments Breakdown / Channels Used */}
                {(() => {
                  const modalPoPayments = getPurchaseOrderPayments(poToPay, transactions, journalEntries, paymentMethods);
                  if (modalPoPayments.length === 0) return null;
                  return (
                    <div className="space-y-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Previous Payments ({modalPoPayments.length})</span>
                        </span>
                        <span className="text-emerald-700 font-extrabold text-[10.5px]">
                          Paid: {profile.currencySymbol}{(poToPay.paidAmount || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-1 scrollbar-thin">
                        {modalPoPayments.map((p, idx) => (
                          <div key={p.id || idx} className="flex items-center justify-between text-[10.5px] bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                              {p.channel.toLowerCase().includes('cash') ? (
                                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                              ) : p.channel.toLowerCase().includes('bkash') || p.channel.toLowerCase().includes('nagad') || p.channel.toLowerCase().includes('rocket') ? (
                                <Smartphone className="w-3.5 h-3.5 text-pink-600" />
                              ) : (
                                <Landmark className="w-3.5 h-3.5 text-blue-600" />
                              )}
                              <span>{p.channel}</span>
                              <span className="text-slate-400 text-[9.5px]">({p.date})</span>
                            </span>
                            <span className="font-black text-emerald-700">
                              {profile.currencySymbol}{(Number(p.amount) || 0).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">
                      {"Payment AmountTk  *"}
                    </label>
                    <button type="button" onClick={() => setPoPayAmount(poToPay.dueAmount)} className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer">
                      {'Pay Full Due'}
                    </button>
                  </div>
                  <input type="number" step="any" min="1" max={poToPay.dueAmount} required value={poPayAmount} onChange={(e) => setPoPayAmount(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-black text-base text-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"/>
                </div>

                {/* Account Balances Quick Selector */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Payment Account & Balance'}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-2">
                    {activePaymentMethods.map((pm) => {
                      const isSelected = poPayAccount.toLowerCase().trim() === pm.name.toLowerCase().trim() ||
                                         poPayMethod.toLowerCase().trim() === pm.name.toLowerCase().trim();
                      const liveBal = getPaymentMethodLiveBalance(pm, chartOfAccounts, transactions, invoices, accountBalances, [], journalEntries);
                      const isBank = pm.type === 'bank';
                      const isMfs = pm.type === 'mfs';
                      const isCash = pm.type === 'cash';

                      return (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => {
                            setPoPayAccount(pm.name);
                            setPoPayMethod(pm.name);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300 shadow-xs'
                              : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-[11px] font-bold truncate">
                            {isBank ? <Landmark className="w-3.5 h-3.5 text-blue-600 shrink-0" /> :
                             isMfs ? <Smartphone className="w-3.5 h-3.5 text-purple-600 shrink-0" /> :
                             <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                            <span className="truncate text-slate-900">{pm.name}</span>
                          </div>
                          <div className="font-black text-xs text-slate-900 mt-1">
                            {profile.currencySymbol}{liveBal.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                            {pm.accountNumber || (isBank ? (pm.bankName || 'Bank') : isCash ? 'Cash' : 'MFS')}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {'Payment Method'}
                    </label>
                    <select
                      value={poPayMethod}
                      onChange={(e) => {
                        const m = e.target.value;
                        setPoPayMethod(m);
                        setPoPayAccount(m);
                      }}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden bg-white"
                    >
                      {activePaymentMethods.map((pm) => {
                        const bal = getPaymentMethodLiveBalance(pm, chartOfAccounts, transactions, invoices, accountBalances, [], journalEntries);
                        return (
                          <option key={pm.id} value={pm.name}>
                            {pm.type === 'bank' ? '🏦' : pm.type === 'mfs' ? '📱' : '💵'} {pm.name} {pm.accountNumber ? `(${pm.accountNumber})` : ''} — [{profile.currencySymbol}{bal.toLocaleString()}]
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {'Account'}
                    </label>
                    <select
                      value={poPayAccount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPoPayAccount(val);
                        const matched = activePaymentMethods.find((p) => p.name.toLowerCase().trim() === val.toLowerCase().trim() || p.id === val);
                        if (matched) {
                          setPoPayMethod(matched.name);
                        }
                      }}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden bg-white"
                    >
                      <optgroup label="Active Payment Methods">
                        {activePaymentMethods.map((pm) => {
                          const bal = getPaymentMethodLiveBalance(pm, chartOfAccounts, transactions, invoices, accountBalances, [], journalEntries);
                          return (
                            <option key={pm.id} value={pm.name}>
                              {pm.type === 'bank' ? '🏦' : pm.type === 'mfs' ? '📱' : '💵'} {pm.name} — [{profile.currencySymbol}{bal.toLocaleString()}]
                            </option>
                          );
                        })}
                      </optgroup>
                      {chartOfAccounts.filter((a) => a.classification === 'Asset').length > 0 && (
                        <optgroup label="Chart of Accounts (Assets)">
                          {chartOfAccounts.filter((a) => a.classification === 'Asset').map((acc) => {
                            const bal = calculateSingleAccountBalance(acc, transactions, invoices, [], journalEntries);
                            return (
                              <option key={acc.id} value={acc.name}>
                                #{acc.code} {acc.name} — [{profile.currencySymbol}{bal.toLocaleString()}]
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                    </select>
                  </div>
                </div>

                {/* Account Balance Feedback Banner */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-slate-500 block text-[10px]">
                      {'Available Fund in Selected Account:'}
                    </span>
                    <span className="font-bold text-slate-900 text-xs">
                      {profile.currencySymbol}{selectedPoBal.toLocaleString()}
                    </span>
                  </div>
                  {poPayAmount > selectedPoBal ? (<span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                      {`⚠️ Insufficient Fund (Shortfall: ${profile.currencySymbol}${(poPayAmount - selectedPoBal).toLocaleString()})`}
                    </span>) : (<span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                      {'✓ Sufficient Fund'}
                    </span>)}
                </div>

                {poPayAmount > selectedPoBal && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      {`Payment exceeds available balance in ${poPayAccount} (${profile.currencySymbol}${selectedPoBal.toLocaleString()}). Cannot proceed with negative balance.`}
                    </span>
                  </div>
                )}

                {/* Real-time feedback badge */}
                <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/80 text-[11px] text-slate-700 space-y-1">
                  <div className="flex justify-between">
                    <span>{'Remaining Due After Pay:'}</span>
                    <span className="font-bold text-slate-900">
                      {profile.currencySymbol}
                      {Math.max(0, poToPay.dueAmount - poPayAmount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{'New Payment Status:'}</span>
                    <span className={`font-black px-2 py-0.5 rounded text-[10px] ${poPayAmount >= poToPay.dueAmount
                    ? 'bg-emerald-100 text-emerald-800'
                    : poPayAmount > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'}`}>
                      {poPayAmount >= poToPay.dueAmount
                    ? "PaidPayment" : poPayAmount > 0
                    ? "Partial" : "Due"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setPoToPay(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                  {'Cancel'}
                </button>
                <button type="submit" disabled={poPayAmount <= 0 || poPayAmount > selectedPoBal} className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 ${
                  poPayAmount > selectedPoBal
                    ? 'bg-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5"/>
                  <span>{poPayAmount > selectedPoBal ? 'Insufficient Account Balance' : 'Confirm Bill Payment'}</span>
                </button>
              </div>
            </form>
          </div>);
        })()}

      {/* PURCHASE ORDER PAYMENT CHANNELS BREAKDOWN MODAL */}
      {viewingPaymentDetailsPO && (() => {
        const poPayments = getPurchaseOrderPayments(viewingPaymentDetailsPO, transactions, journalEntries, paymentMethods);
        const poGrand = Number(viewingPaymentDetailsPO.grandTotal ?? viewingPaymentDetailsPO.totalAmount ?? 0);
        const poPaid = Number(viewingPaymentDetailsPO.paidAmount || 0);
        const poDue = Number(viewingPaymentDetailsPO.dueAmount ?? Math.max(0, poGrand - poPaid));

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm sm:text-base">
                      Payment Channels Breakdown
                    </h3>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      #{viewingPaymentDetailsPO.poNo || viewingPaymentDetailsPO.poNumber} • {viewingPaymentDetailsPO.supplierName}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingPaymentDetailsPO(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Financial summary banner */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Total Bill</div>
                  <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5">
                    {profile.currencySymbol}{poGrand.toLocaleString()}
                  </div>
                </div>
                <div className="border-x border-slate-200">
                  <div className="text-[10px] text-emerald-600 font-bold uppercase">Total Paid</div>
                  <div className="text-xs sm:text-sm font-black text-emerald-700 mt-0.5">
                    {profile.currencySymbol}{poPaid.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-rose-600 font-bold uppercase">Due Remaining</div>
                  <div className="text-xs sm:text-sm font-black text-rose-600 mt-0.5">
                    {profile.currencySymbol}{poDue.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Itemized payments list */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Disbursed Payments ({poPayments.length})</span>
                  <span className="text-[10.5px] font-semibold text-slate-500">
                    Paid: {profile.currencySymbol}{poPaid.toLocaleString()}
                  </span>
                </div>
                {poPayments.length === 0 ? (
                  <div className="p-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                    No payment transactions recorded for this purchase order.
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {poPayments.map((p, idx) => (
                      <div key={p.id || idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/70 border border-slate-200 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <span className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700">
                            {p.channel.toLowerCase().includes('cash') ? (
                              <Banknote className="w-4 h-4 text-emerald-600" />
                            ) : p.channel.toLowerCase().includes('bkash') || p.channel.toLowerCase().includes('nagad') || p.channel.toLowerCase().includes('rocket') ? (
                              <Smartphone className="w-4 h-4 text-pink-600" />
                            ) : (
                              <Landmark className="w-4 h-4 text-blue-600" />
                            )}
                          </span>
                          <div>
                            <div className="font-black text-slate-800 text-xs">
                              {p.channel}
                            </div>
                            <div className="text-[10.5px] text-slate-400">
                              {p.date} {p.description ? `• ${p.description}` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="font-black text-emerald-700 text-sm whitespace-nowrap">
                          {profile.currencySymbol}{(Number(p.amount) || 0).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setViewingPaymentDetailsPO(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                {poDue > 0 && canPaySupplier && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetPo = viewingPaymentDetailsPO;
                      setViewingPaymentDetailsPO(null);
                      setPoToPay(targetPo);
                      setPoPayAmount(targetPo.dueAmount);
                      const defMethod = activePaymentMethods[0]?.name || 'Cash';
                      setPoPayAccount(defMethod);
                      setPoPayMethod(defMethod);
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pay Due Balance</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* CUSTOM CONFIRM PO RECEIVE MODAL */}
      {poToReceive && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 mb-2">
                <CheckCircle2 className="w-6 h-6"/>
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                {'Confirm Receipt'}
              </h3>
              <p className="text-slate-500 text-xs mt-1">
                {`Are you sure you have received the items into ${poToReceive.destinationLocation}? This will automatically add items to stock and update the bill.`}
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl space-y-2 border border-slate-100">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-500 border-b border-slate-200 pb-2">
                <div className="col-span-6">{'Item'}</div>
                <div className="col-span-3 text-center">{'Ordered'}</div>
                <div className="col-span-3 text-center">{'Received'}</div>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {receiveItemsState.map((item, idx) => (<div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs">
                    <div className="col-span-6 font-medium text-slate-700 truncate" title={item.name}>
                      {item.name}
                    </div>
                    <div className="col-span-3 text-center text-slate-500 font-medium">
                      {item.orderedQty} {item.unit}
                    </div>
                    <div className="col-span-3">
                      <input type="number" step="any" min="0" value={item.receivedQty} onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setReceiveItemsState(prev => prev.map((p, i) => i === idx ? { ...p, receivedQty: val } : p));
                }} className="w-full px-2 py-1 text-center border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"/>
                    </div>
                  </div>))}
              </div>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button type="button" onClick={() => setPoToReceive(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                {'Cancel'}
              </button>
              <button type="button" onClick={() => {
                receivePurchaseOrder(poToReceive.id, receiveItemsState);
                setPoToReceive(null);
            }} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer">
                {'Confirm Receive'}
              </button>
            </div>
          </div>
        </div>)}

      {/* CUSTOM CONFIRM PO DELETE MODAL */}
      {poToDelete && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="w-6 h-6"/>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {'Confirm Deletion'}
              </h3>
              <p className="text-slate-500 text-xs mt-1">
                {`Are you sure you want to delete this purchase order? This action cannot be undone.`}
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button type="button" onClick={() => setPoToDelete(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {'Cancel'}
              </button>
              <button type="button" onClick={() => {
                deletePurchaseOrder(poToDelete.id);
                setPoToDelete(null);
            }} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-2xs">
                {'Delete'}
              </button>
            </div>
          </div>
        </div>)}

      {supplierToDelete && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600">
              <Trash2 className="w-6 h-6"/>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {'Confirm Vendor Deletion'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {`Are you sure you want to delete vendor "${supplierToDelete.name}"? This action cannot be undone.`}
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button type="button" onClick={() => setSupplierToDelete(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                {'Cancel'}
              </button>
              <button type="button" onClick={() => {
                deleteSupplier(supplierToDelete.id);
                setSupplierToDelete(null);
            }} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer">
                {'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>)}
    </div>);
};
