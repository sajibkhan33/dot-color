import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { InvoiceItem, PaymentMethod, ProductionStatus, UnitType, PRESET_INVOICE_ITEM_TYPES } from '../types';
import { X, FileText, Plus, Trash2, Calendar, User, Phone, Building, CheckCircle2, Percent, Hash, Truck, DollarSign, Search, UserPlus, } from 'lucide-react';
interface CreateSalesInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onInvoiceCreated: (invoiceId: string) => void;
}
export const CreateSalesInvoiceModal: React.FC<CreateSalesInvoiceModalProps> = ({ isOpen, onClose, onInvoiceCreated, }) => {
    const { customers, products, profile, language, paymentMethods = [], addInvoice, addCustomer, } = useApp();
    const activePaymentMethods = useMemo(() => {
        const list = (paymentMethods || []).filter((p) => p.isEnabled);
        return list.length > 0 ? list : [{ id: 'pm-cash', name: 'Cash', nameBn: "Cash", type: 'cash' as const, isEnabled: true }];
    }, [paymentMethods]);
    // Customer Mode: 'existing' or 'new'
    const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [existingCustAddress, setExistingCustAddress] = useState<string>('');
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
    // New Customer Fields
    const [newCustName, setNewCustName] = useState('');
    const [newCustPhone, setNewCustPhone] = useState('');
    const [newCustCompany, setNewCustCompany] = useState('');
    const [newCustAddress, setNewCustAddress] = useState('');
    // Filtered existing customers for invoice creation
    const filteredExistingCustomers = useMemo(() => {
        if (!customerSearchQuery.trim())
            return customers;
        const q = customerSearchQuery.toLowerCase().trim();
        return customers.filter((c) => c.name.toLowerCase().includes(q) ||
            (c.phone && c.phone.includes(q)) ||
            (c.company && c.company.toLowerCase().includes(q)) ||
            (c.address && c.address.toLowerCase().includes(q)));
    }, [customers, customerSearchQuery]);
    // Invoice Meta
    const [invoiceType, setInvoiceType] = useState<'Sales' | 'Custom'>('Sales');
    const [purchaseRequisition, setPurchaseRequisition] = useState('');
    const [referenceNo, setReferenceNo] = useState('');
    const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [deliveryDate, setDeliveryDate] = useState<string>('');
    const [warehouseLocation, setWarehouseLocation] = useState<'Factory' | 'Office'>('Factory');
    // Items in Invoice
    const [items, setItems] = useState<InvoiceItem[]>([]);
    // Optional Columns Configuration
    const [showRegionColumn, setShowRegionColumn] = useState<boolean>(false);
    const [showTypeColumn, setShowTypeColumn] = useState<boolean>(false);
    // Item Entry Row
    const [selectedProductId, setSelectedProductId] = useState('');
    const [itemName, setItemName] = useState('');
    const [itemRegion, setItemRegion] = useState('');
    const [itemTypeStr, setItemTypeStr] = useState('');
    const [isCustomType, setIsCustomType] = useState<boolean>(false);
    const [invoiceCustomTypes, setInvoiceCustomTypes] = useState<string[]>([]);
    const [itemCategory, setItemCategory] = useState('BRANDED PROMOTIONAL GIFTS');
    const [itemUnit, setItemUnit] = useState<UnitType>('pcs');
    const [itemQty, setItemQty] = useState(1);
    const [itemPrice, setItemPrice] = useState(1000);
    const [itemWidth, setItemWidth] = useState<number | ''>('');
    const [itemHeight, setItemHeight] = useState<number | ''>('');
    const [itemNotes, setItemNotes] = useState('');
    // Discount (Tk or %)
    const [discountAmount, setDiscountAmount] = useState<number>(0);
    const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
    // VAT / Tax (same toggle style as Discount)
    const [vatAmountInput, setVatAmountInput] = useState<number>(0);
    const [vatType, setVatType] = useState<'amount' | 'percent'>('percent');
    // Payment & Settlement
    const [paidAmount, setPaidAmount] = useState<number | ''>('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
    const [productionStatus, setProductionStatus] = useState<ProductionStatus>('Queued');
    const [notes, setNotes] = useState('');
    const [jobSpecs, setJobSpecs] = useState('');
    // Calculations
    const subtotal = useMemo(() => {
        return items.reduce((acc, item) => acc + item.totalPrice, 0);
    }, [items]);
    const effectiveDiscount = useMemo(() => {
        if (discountType === 'percent') {
            const pct = Math.max(0, Math.min(100, Number(discountAmount) || 0));
            return Math.round((subtotal * pct) / 100);
        }
        return Math.min(subtotal, Math.max(0, Number(discountAmount) || 0));
    }, [subtotal, discountAmount, discountType]);
    const taxableAmount = Math.max(0, subtotal - effectiveDiscount);
    const effectiveVat = useMemo(() => {
        if (vatType === 'percent') {
            const pct = Math.max(0, Math.min(100, Number(vatAmountInput) || 0));
            return Math.round((taxableAmount * pct) / 100);
        }
        return Math.max(0, Number(vatAmountInput) || 0);
    }, [taxableAmount, vatAmountInput, vatType]);
    const computedVatRate = useMemo(() => {
        if (vatType === 'percent')
            return Number(vatAmountInput) || 0;
        return taxableAmount > 0 ? Number(((effectiveVat / taxableAmount) * 100).toFixed(2)) : 0;
    }, [vatType, vatAmountInput, effectiveVat, taxableAmount]);
    const grandTotal = taxableAmount + effectiveVat;
    const effectivePaid = paidAmount === '' ? grandTotal : Math.min(grandTotal, Math.max(0, Number(paidAmount)));
    const dueAmount = Math.max(0, grandTotal - effectivePaid);
    const paymentStatus = effectivePaid >= grandTotal && grandTotal > 0
        ? 'Paid'
        : effectivePaid > 0
            ? 'Partial'
            : 'Due';
    if (!isOpen)
        return null;
    // Add Item to List
    const handleAddItemRow = () => {
        if (!itemName.trim()) {
            alert('Please enter or select item description!');
            return;
        }
        const w = Number(itemWidth) || 0;
        const h = Number(itemHeight) || 0;
        const sqft = w > 0 && h > 0 ? Number((w * h).toFixed(2)) : undefined;
        const rowTotal = sqft ? Math.round(sqft * itemQty * itemPrice) : Math.round(itemQty * itemPrice);
        const newItem: InvoiceItem = {
            productId: selectedProductId || `custom-${Date.now()}`,
            name: itemName.trim(),
            category: itemCategory,
            region: showRegionColumn && itemRegion.trim() ? itemRegion.trim() : undefined,
            type: showTypeColumn && itemTypeStr.trim() ? itemTypeStr.trim() : undefined,
            itemType: showTypeColumn && itemTypeStr.trim() ? itemTypeStr.trim() : undefined,
            unit: itemUnit,
            unitPrice: itemPrice,
            costPrice: Math.round(itemPrice * 0.6),
            qty: itemQty,
            width: w > 0 ? w : undefined,
            height: h > 0 ? h : undefined,
            totalSqft: sqft,
            totalPrice: rowTotal,
            notes: itemNotes.trim() || undefined,
        };
        setItems([...items, newItem]);
        if (itemTypeStr.trim() && !PRESET_INVOICE_ITEM_TYPES.includes(itemTypeStr.trim() as any) && !invoiceCustomTypes.includes(itemTypeStr.trim())) {
            setInvoiceCustomTypes((prev) => [...prev, itemTypeStr.trim()]);
        }
        // Reset Item Entry Row
        setSelectedProductId('');
        setItemName('');
        setItemRegion('');
        setItemTypeStr('');
        setIsCustomType(false);
        setItemQty(1);
        setItemPrice(1000);
        setItemWidth('');
        setItemHeight('');
        setItemNotes('');
    };
    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };
    const handleUpdateItemRow = (index: number, field: 'qty' | 'unitPrice', val: number) => {
        setItems((prev) => prev.map((it, i) => {
            if (i !== index)
                return it;
            const newQty = field === 'qty' ? Math.max(1, val) : it.qty;
            const newPrice = field === 'unitPrice' ? Math.max(0, val) : it.unitPrice;
            const sqft = it.totalSqft;
            const rowTotal = sqft ? Math.round(sqft * newQty * newPrice) : Math.round(newQty * newPrice);
            return {
                ...it,
                qty: newQty,
                unitPrice: newPrice,
                costPrice: Math.round(newPrice * 0.6),
                totalPrice: rowTotal,
            };
        }));
    };
    // Submit Invoice
    const handleSubmitInvoice = (e: React.FormEvent) => {
        e.preventDefault();
        // Determine Customer
        let finalCustId = '';
        let finalCustName = '';
        let finalCustPhone = '';
        let finalCustAddress = '';
        if (customerMode === 'existing') {
            const existing = customers.find((c) => c.id === selectedCustomerId);
            if (!existing) {
                alert('Please select a customer!');
                return;
            }
            finalCustId = existing.id;
            finalCustName = existing.company ? `${existing.company} (${existing.name})` : existing.name;
            finalCustPhone = existing.phone;
            finalCustAddress = existingCustAddress.trim() || existing.address || '';
        }
        else {
            if (!newCustName.trim()) {
                alert('Please enter customer name!');
                return;
            }
            const createdCustomer = addCustomer({
                name: newCustName.trim(),
                phone: newCustPhone.trim() || '01819-000000',
                company: newCustCompany.trim() || undefined,
                address: newCustAddress.trim() || undefined,
            });
            finalCustId = createdCustomer.id;
            finalCustName = createdCustomer.company ? `${createdCustomer.company} (${createdCustomer.name})` : createdCustomer.name;
            finalCustPhone = createdCustomer.phone;
            finalCustAddress = createdCustomer.address || '';
        }
        // Auto-add current row if user typed without clicking Add
        let finalItems = [...items];
        if (finalItems.length === 0 && itemName.trim()) {
            const w = Number(itemWidth) || 0;
            const h = Number(itemHeight) || 0;
            const sqft = w > 0 && h > 0 ? Number((w * h).toFixed(2)) : undefined;
            const rowTotal = sqft ? Math.round(sqft * itemQty * itemPrice) : Math.round(itemQty * itemPrice);
            finalItems.push({
                productId: selectedProductId || `custom-${Date.now()}`,
                name: itemName.trim(),
                category: itemCategory,
                region: showRegionColumn && itemRegion.trim() ? itemRegion.trim() : undefined,
                type: showTypeColumn && itemTypeStr.trim() ? itemTypeStr.trim() : undefined,
                itemType: showTypeColumn && itemTypeStr.trim() ? itemTypeStr.trim() : undefined,
                unit: itemUnit,
                unitPrice: itemPrice,
                costPrice: Math.round(itemPrice * 0.6),
                qty: itemQty,
                width: w > 0 ? w : undefined,
                height: h > 0 ? h : undefined,
                totalSqft: sqft,
                totalPrice: rowTotal,
                notes: itemNotes.trim() || undefined,
            });
        }
        if (finalItems.length === 0) {
            alert('Please add at least one item!');
            return;
        }
        const selectedCust = customerMode === 'existing' ? customers.find((c) => c.id === selectedCustomerId) : null;
        const advanceToUse = selectedCust ? Math.min(Number(selectedCust.advanceBalance) || 0, effectivePaid) : 0;
        const channelPaid = Math.max(0, effectivePaid - advanceToUse);

        const created = addInvoice({
            date: invoiceDate,
            referenceNo: referenceNo.trim() || undefined,
            purchaseRequisition: purchaseRequisition.trim() || undefined,
            prNo: purchaseRequisition.trim() || undefined,
            deliveryDate: deliveryDate || undefined,
            customerId: finalCustId,
            customerName: finalCustName,
            customerPhone: finalCustPhone,
            customerAddress: finalCustAddress,
            items: finalItems,
            subtotal,
            discount: effectiveDiscount,
            discountType,
            discountValue: Number(discountAmount) || 0,
            vatType,
            vatValue: Number(vatAmountInput) || 0,
            vatRate: Number(computedVatRate) || 0,
            vatAmount: effectiveVat,
            grandTotal,
            paidAmount: effectivePaid,
            dueAmount,
            paymentMethod,
            paymentStatus,
            productionStatus,
            warehouseLocation,
            notes: notes.trim() || undefined,
            jobSpecs: jobSpecs.trim() || undefined,
            showRegionColumn,
            showTypeColumn,
            splitPayments: {
                cash: paymentMethod.toLowerCase().includes('cash') ? channelPaid : 0,
                card: paymentMethod.toLowerCase().includes('card') || paymentMethod.toLowerCase().includes('bank') ? channelPaid : 0,
                bkash: paymentMethod.toLowerCase().includes('bkash') ? channelPaid : 0,
                nagad: paymentMethod.toLowerCase().includes('nagad') ? channelPaid : 0,
                ...(advanceToUse > 0 ? { 'Customer Advance': advanceToUse } : {}),
                due: dueAmount,
            },
        });
        onClose();
        onInvoiceCreated(created.id);
    };
    return (<div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <FileText className="w-4 h-4"/>
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base tracking-wide flex items-center gap-2">
                <span>{'Direct Sales Invoice Creation'}</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  {'No Quote Needed'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {'Issue direct billing invoice with reference number, discount, and VAT'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmitInvoice} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs scrollbar-thin scrollbar-thumb-slate-200">
          {/* Section 1: Customer Selection & Reference Number */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-700"/>
                <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                  {'1. Customer & Reference Details'}
                </span>
              </div>
              {/* Customer Mode Tabs */}
              <div className="flex bg-white p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
                <button type="button" onClick={() => setCustomerMode('existing')} className={`px-3 py-1 rounded-md transition-all cursor-pointer ${customerMode === 'existing'
            ? 'bg-slate-900 text-white shadow-2xs'
            : 'text-slate-600 hover:text-slate-900'}`}>
                  {'Existing Customer'}
                </button>
                <button type="button" onClick={() => setCustomerMode('new')} className={`px-3 py-1 rounded-md transition-all cursor-pointer ${customerMode === 'new'
            ? 'bg-slate-900 text-white shadow-2xs'
            : 'text-slate-600 hover:text-slate-900'}`}>
                  {'+ New Customer'}
                </button>
              </div>
            </div>

            {/* Customer Inputs */}
            {customerMode === 'existing' ? (<div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Search Input Field */}
                  <div className="relative">
                    <label className="font-bold text-slate-700 block mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Search className="w-3.5 h-3.5 text-slate-400"/>
                        {'Search Customer (Name / Phone)'}
                      </span>
                      {customerSearchQuery && (<span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                          {filteredExistingCustomers.length} {'found'}
                        </span>)}
                    </label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                      <input type="text" value={customerSearchQuery} onChange={(e) => {
                setCustomerSearchQuery(e.target.value);
                setIsCustomerSearchOpen(true);
            }} onFocus={() => setIsCustomerSearchOpen(true)} placeholder={'Search customer by name or phone...'} className="w-full pl-8 pr-7 py-2 bg-white border border-slate-200 focus:border-amber-500 rounded-xl font-medium text-xs focus:ring-2 focus:ring-amber-500/20"/>
                      {customerSearchQuery && (<button type="button" onClick={() => {
                    setCustomerSearchQuery('');
                    setIsCustomerSearchOpen(false);
                }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5">
                          <X className="w-3.5 h-3.5"/>
                        </button>)}

                      {/* Dropdown with matching customers */}
                      {isCustomerSearchOpen && customerSearchQuery.trim() && (<>
                          <div className="fixed inset-0 z-20" onClick={() => setIsCustomerSearchOpen(false)}/>
                          <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white rounded-xl shadow-xl border border-slate-200 max-h-52 overflow-y-auto divide-y divide-slate-100">
                            {filteredExistingCustomers.length > 0 ? (filteredExistingCustomers.map((c) => (<button key={c.id} type="button" onClick={() => {
                        setSelectedCustomerId(c.id);
                        setCustomerSearchQuery('');
                        setIsCustomerSearchOpen(false);
                    }} className={`w-full text-left p-2.5 hover:bg-amber-50/80 transition-colors flex items-center justify-between gap-2 ${c.id === selectedCustomerId ? 'bg-amber-50 font-bold border-l-2 border-amber-500' : ''}`}>
                                  <div className="min-w-0">
                                    <div className="text-xs text-slate-900 font-bold truncate">
                                      {c.name} {c.company ? `(${c.company})` : ''}
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">{c.phone}</div>
                                  </div>
                                  {c.dueAmount > 0 && (<span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded flex-shrink-0">
                                      {'Due'}: Tk{c.dueAmount.toLocaleString()}
                                    </span>)}
                                </button>))) : (<div className="p-3 text-center space-y-2">
                                <p className="text-xs text-slate-500">
                                  {`No customer found matching "${customerSearchQuery}"`}
                                </p>
                                <button type="button" onClick={() => {
                        const isPhone = /^[0-9+ -]+$/.test(customerSearchQuery.trim());
                        setCustomerMode('new');
                        if (isPhone) {
                            setNewCustPhone(customerSearchQuery.trim());
                            setNewCustName('');
                        }
                        else {
                            setNewCustName(customerSearchQuery.trim());
                            setNewCustPhone('');
                        }
                        setCustomerSearchQuery('');
                        setIsCustomerSearchOpen(false);
                    }} className="w-full py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors">
                                  <UserPlus className="w-3.5 h-3.5"/>
                                  <span>
                                    {`+ Add as New Customer`}
                                  </span>
                                </button>
                              </div>)}
                          </div>
                        </>)}
                    </div>
                  </div>

                  {/* Customer Select Dropdown */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {'Select Customer *'}
                    </label>
                    <select required value={selectedCustomerId} onChange={(e) => {
                      const cid = e.target.value;
                      setSelectedCustomerId(cid);
                      const sel = customers.find((c) => c.id === cid);
                      setExistingCustAddress(sel?.address || '');
                    }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs focus:ring-1 focus:ring-amber-500/30">
                      <option value="">{'-- Choose Customer --'}</option>
                      {filteredExistingCustomers.map((c) => (<option key={c.id} value={c.id}>
                          {c.name} {c.company ? `(${c.company})` : ''} - {c.phone} {c.dueAmount > 0 ? `[Due: Tk ${c.dueAmount}]` : ''}
                        </option>))}
                    </select>
                  </div>
                </div>

                {/* Selected Customer Info Badge */}
                {selectedCustomerId && (<div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200 flex items-center justify-between text-[11px]">
                    {(() => {
                    const sel = customers.find((c) => c.id === selectedCustomerId);
                    if (!sel)
                        return null;
                    return (<>
                          <div>
                            <span className="font-black text-slate-900">{sel.name}</span>
                            {sel.company && <span className="text-amber-800 font-semibold ml-1.5">({sel.company})</span>}
                            <span className="text-slate-500 block font-mono mt-0.5">{sel.phone}</span>
                            <div className="mt-2">
                              <label className="font-bold text-slate-700 block mb-0.5">
                                {'Delivery / Billing Address (Editable):'}
                              </label>
                              <input type="text" value={existingCustAddress} onChange={(e) => setExistingCustAddress(e.target.value)} placeholder="e.g. Baizid Bostami I/A, Chattogram, Bangladesh" className="w-full px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-amber-500"/>
                            </div>
                          </div>
                          {sel.dueAmount > 0 && (<span className="font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              {'Past Due'}: Tk{sel.dueAmount.toLocaleString()}
                            </span>)}
                        </>);
                })()}
                  </div>)}
              </div>) : (<div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Client Name *'}
                  </label>
                  <input type="text" required value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="e.g. Sajib Khan" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium"/>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Phone'}
                  </label>
                  <input type="tel" value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} placeholder="01730-581687" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium"/>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Company'}
                  </label>
                  <input type="text" value={newCustCompany} onChange={(e) => setNewCustCompany(e.target.value)} placeholder="e.g. Apex Enterprise" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium"/>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Address'}
                  </label>
                  <input type="text" value={newCustAddress} onChange={(e) => setNewCustAddress(e.target.value)} placeholder="e.g. GEC Circle, Chattogram" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium"/>
                </div>
              </div>)}

            {/* Reference Number, PR, Dates & Location Row */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200/60">
              {/* 1. Purchase Requisition (PR) */}
              <div>
                <label className="font-bold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>{'Reference / PR No.'}</span>
                  {/* <span className="text-[10px] text-indigo-700 font-extrabold bg-indigo-100/70 px-1.5 rounded">PR</span> */}
                </label>
                <input
                  type="text"
                  value={purchaseRequisition}
                  onChange={(e) => setPurchaseRequisition(e.target.value)}
                  placeholder={'e.g. PR-8901, REQ-102'}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs focus:ring-1 focus:ring-indigo-500/30"
                />
              </div>

              {/* 2. Reference / PO No. */}
              <div>
                <label className="font-bold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>{'Reference / PO No.'}</span>
                  {/* <span className="text-[10px] text-amber-700 font-extrabold bg-amber-100/70 px-1.5 rounded">Ref</span> */}
                </label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder={'e.g. PO-8901, REF-102'}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs focus:ring-1 focus:ring-amber-500/30"
                />
              </div>

              {/* 3. Invoice Date */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Invoice Date'}
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-xs"
                />
              </div>

              {/* 4. Branch Location */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Branch Location'}
                </label>
                <select
                  value={warehouseLocation}
                  onChange={(e) => setWarehouseLocation(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-xs"
                >
                  <option value="Office">
                    {'Central Warehouse & Outlet'}
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Sales Invoice Type Selection */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <label className="font-extrabold text-slate-700 block mb-1.5 uppercase tracking-wider text-[11px]">
              {'Sales Invoice Type *'}
            </label>
            <div className="flex gap-4 p-1.5 bg-white border border-slate-200/80 rounded-xl">
              <label className="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer font-bold transition-all text-slate-700 text-xs">
                <input type="radio" name="invoiceType" value="Sales" checked={invoiceType === 'Sales'} onChange={() => {
            setInvoiceType('Sales');
            setSelectedProductId('');
            setItemName('');
            setItemPrice(1000);
        }} className="accent-slate-900 cursor-pointer"/>
                <span>{'Sales & Service'}</span>
              </label>
              <label className="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer font-bold transition-all text-slate-700 text-xs">
                <input type="radio" name="invoiceType" value="Custom" checked={invoiceType === 'Custom'} onChange={() => {
            setInvoiceType('Custom');
            setSelectedProductId('');
            setItemName('');
            setItemPrice(1000);
        }} className="accent-slate-900 cursor-pointer"/>
                <span>{'Custom Sales Invoice'}</span>
              </label>
            </div>
          </div>

          {/* Section 2: Items Entry Row & Table */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                {'2. Add Items & Services'}
              </span>
              <span className="text-[11px] text-slate-500 font-bold">
                {`Total Items: ${items.length}`}
              </span>
            </div>

            {/* Optional Columns Banner */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 flex flex-wrap items-center gap-3">
              <span className="text-amber-900 font-extrabold text-xs tracking-wide uppercase">
                OPTIONAL COLUMNS OPTION:
              </span>
              <label className="bg-white px-3 py-1.5 rounded-lg border border-amber-200/80 shadow-2xs flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 hover:border-amber-400 transition-colors select-none">
                <input
                  type="checkbox"
                  checked={showTypeColumn}
                  onChange={(e) => setShowTypeColumn(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                />
                <span>Show Type Column</span>
              </label>
              <label className="bg-white px-3 py-1.5 rounded-lg border border-amber-200/80 shadow-2xs flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 hover:border-amber-400 transition-colors select-none">
                <input
                  type="checkbox"
                  checked={showRegionColumn}
                  onChange={(e) => setShowRegionColumn(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                />
                <span>Show Region Column</span>
              </label>
            </div>

            {/* Entry Row Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className={showRegionColumn && showTypeColumn ? "sm:col-span-3" : (showRegionColumn || showTypeColumn ? "sm:col-span-3" : "sm:col-span-3")}>
                <label className="font-bold text-slate-600 block mb-1 text-[11px] truncate">
                  {'Service / Item Name *'}
                </label>
                {invoiceType === 'Custom' ? (<input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder={'e.g. Digital Sign Banner, Acrylic Sign...'} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs focus:ring-1 focus:ring-slate-900/20 focus:border-slate-950"/>) : (<select value={selectedProductId} onChange={(e) => {
                const pid = e.target.value;
                setSelectedProductId(pid);
                const prod = products.find((p) => p.id === pid);
                if (prod) {
                    setItemName(prod.name);
                    setItemPrice(prod.unitPrice);
                    setItemCategory(prod.category);
                    setItemUnit(prod.unit);
                }
                else {
                    setItemName('');
                }
            }} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs focus:ring-1 focus:ring-slate-900/20 focus:border-slate-950">
                    <option value="">{'-- Choose Item --'}</option>
                    {products.filter((p) => !p.isRawMaterial).map((p) => (<option key={p.id} value={p.id}>
                        {p.name}(Tk{p.unitPrice}/{p.unit})
                      </option>))}
                  </select>)}
              </div>

              {showTypeColumn && (
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-600 text-[11px] truncate">
                      {'Type'}
                    </label>
                    {isCustomType && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomType(false);
                          setItemTypeStr('');
                        }}
                        className="text-[10px] text-amber-600 hover:text-amber-700 font-bold underline cursor-pointer"
                        title="Back to list"
                      >
                        List
                      </button>
                    )}
                  </div>
                  {isCustomType ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={itemTypeStr}
                        onChange={(e) => setItemTypeStr(e.target.value)}
                        placeholder="Enter custom type..."
                        autoFocus
                        className="w-full px-2 py-1.5 pr-6 bg-white border border-amber-300 rounded-lg font-bold text-xs focus:ring-1 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomType(false);
                          setItemTypeStr('');
                        }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                        title="Cancel custom"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <select
                      value={itemTypeStr}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsCustomType(true);
                          setItemTypeStr('');
                        } else {
                          setItemTypeStr(e.target.value);
                        }
                      }}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs focus:ring-1 focus:ring-slate-900"
                    >
                      <option value="">{'-- Select Type --'}</option>
                      {PRESET_INVOICE_ITEM_TYPES.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                      {invoiceCustomTypes.map((ct) => (
                        <option key={ct} value={ct}>
                          {ct}
                        </option>
                      ))}
                      <option value="__custom__">{'+ Custom Type...'}</option>
                    </select>
                  )}
                </div>
              )}

              {showRegionColumn && (
                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-600 block mb-1 text-[11px] truncate">
                    {'Region'}
                  </label>
                  <input
                    type="text"
                    value={itemRegion}
                    onChange={(e) => setItemRegion(e.target.value)}
                    placeholder="e.g. Dhaka, Chittagong"
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              )}

              <div className="sm:col-span-1">
                <label className="font-bold text-slate-600 block mb-1 text-[11px] truncate">
                  {'Unit'}
                </label>
                <select value={itemUnit} onChange={(e) => setItemUnit(e.target.value as any)} className="w-full px-1.5 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-xs">
                  <option value="pcs">pcs</option>
                  <option value="sqft">sqft</option>
                  <option value="set">set</option>
                  <option value="roll">roll</option>
                  <option value="packet">packet</option>
                </select>
              </div>

              {/* Dimensions if Sqft */}
              <div className="sm:col-span-1">
                <label className="font-bold text-slate-600 block mb-1 text-[11px] truncate" title="Width">
                  {'Width (W)'}
                </label>
                <input type="number" step="any" min="0" value={itemWidth} onChange={(e) => setItemWidth(e.target.value ? Number(e.target.value) : '')} placeholder="0" className="w-full px-1.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs text-center"/>
              </div>

              <div className="sm:col-span-1">
                <label className="font-bold text-slate-600 block mb-1 text-[11px] truncate" title="Height">
                  {'Height (H)'}
                </label>
                <input type="number" step="any" min="0" value={itemHeight} onChange={(e) => setItemHeight(e.target.value ? Number(e.target.value) : '')} placeholder="0" className="w-full px-1.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs text-center"/>
              </div>

              <div className="sm:col-span-1">
                <label className="font-bold text-slate-600 block mb-1 text-[11px] truncate">
                  {'Qty'}
                </label>
                <input type="number" step="any" min="1" value={itemQty} onChange={(e) => setItemQty(Math.max(1, Number(e.target.value)))} className="w-full px-1.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs text-center"/>
              </div>

              <div className={showRegionColumn && showTypeColumn ? "sm:col-span-1" : "sm:col-span-2"}>
                <label className="font-bold text-slate-600 block mb-1 text-[11px] truncate">
                  {"Unit RateTk"}
                </label>
                <input type="number" step="any" min="0" value={itemPrice} onChange={(e) => setItemPrice(Math.max(0, Number(e.target.value)))} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs text-right"/>
              </div>

              <div className={showRegionColumn && showTypeColumn ? "sm:col-span-1 flex items-end" : (showRegionColumn || showTypeColumn ? "sm:col-span-2 flex items-end" : "sm:col-span-3 flex items-end")}>
                <button type="button" onClick={handleAddItemRow} className="w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer">
                  <Plus className="w-3.5 h-3.5"/>
                  <span>{'+ Add Item'}</span>
                </button>
              </div>
            </div>

            {/* Added Items Table */}
            {items.length > 0 && (<div className="border border-slate-200 rounded-xl overflow-hidden mt-3">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-bold text-[11px] border-b border-slate-200">
                      <th className="p-2.5 text-center w-10">SL</th>
                      <th className="p-2.5">{'Description'}</th>
                      {showTypeColumn && <th className="p-2.5 text-center w-24">{'Type'}</th>}
                      {showRegionColumn && <th className="p-2.5 text-center w-24">{'Region'}</th>}
                      <th className="p-2.5 text-center w-20">{'Unit'}</th>
                      <th className="p-2.5 text-center w-28">{'Qty'}</th>
                      <th className="p-2.5 text-right w-32">{"RateTk"}</th>
                      <th className="p-2.5 text-right w-28">{'Total'}</th>
                      <th className="p-2.5 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {items.map((item, idx) => (<tr key={idx} className="hover:bg-slate-50/70">
                        <td className="p-2.5 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900">{item.name}</div>
                          {item.totalSqft && (<div className="text-[10px] text-amber-700 font-semibold mt-0.5">📐 :{item.width}' × {item.height}' = {item.totalSqft} SqFt
                            </div>)}
                          {item.notes && (<div className="text-[10px] text-slate-500 italic">{item.notes}</div>)}
                        </td>
                        {showTypeColumn && (
                          <td className="p-2.5 text-center font-medium text-slate-700 text-xs">
                            {item.type || item.itemType || '-'}
                          </td>
                        )}
                        {showRegionColumn && (
                          <td className="p-2.5 text-center font-medium text-slate-700 text-xs">
                            {item.region || '-'}
                          </td>
                        )}
                        <td className="p-2.5 text-center font-medium text-slate-600">{item.unit}</td>
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <input type="number" step="any" min="1" value={item.qty} onChange={(e) => handleUpdateItemRow(idx, 'qty', Math.max(1, Number(e.target.value)))} className="w-16 px-1.5 py-1 text-center font-bold text-slate-800 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-slate-400 rounded-md text-xs focus:ring-1 focus:ring-slate-900 transition-colors"/>
                            <span className="text-[10px] text-slate-500 font-medium">{item.unit}</span>
                          </div>
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-slate-400 font-semibold text-xs">Tk</span>
                            <input type="number" step="any" min="0" value={item.unitPrice} onChange={(e) => handleUpdateItemRow(idx, 'unitPrice', Math.max(0, Number(e.target.value)))} className="w-20 px-1.5 py-1 text-right font-bold text-slate-800 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-slate-400 rounded-md text-xs focus:ring-1 focus:ring-slate-900 transition-colors"/>
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-black text-slate-900">Tk{item.totalPrice.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-center">
                          <button type="button" onClick={() => handleRemoveItem(idx)} className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer" title="Remove row">
                            <Trash2 className="w-3.5 h-3.5"/>
                          </button>
                        </td>
                      </tr>))}
                  </tbody>
                </table>
              </div>)}
          </div>

          {/* Section 3: Financial Calculations (Discount, VAT, Totals) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            {/* Left Col: Discount & VAT Inputs */}
            <div className="sm:col-span-6 space-y-3">
              <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wider block border-b border-slate-200 pb-1.5">
                {'3. Discount & Tax Adjustments'}
              </span>

              {/* Discount Input with Toggle */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <span>{'Discount'}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex border border-slate-200 rounded-lg overflow-hidden shrink-0 bg-slate-50">
                      <button type="button" onClick={() => setDiscountType('amount')} className={`px-2.5 py-1 text-[11px] font-black transition-colors cursor-pointer ${discountType === 'amount'
            ? 'bg-slate-900 text-white'
            : 'text-slate-500 hover:text-slate-800'}`}>Tk</button>
                      <button type="button" onClick={() => setDiscountType('percent')} className={`px-2.5 py-1 text-[11px] font-black transition-colors cursor-pointer ${discountType === 'percent'
            ? 'bg-slate-900 text-white'
            : 'text-slate-500 hover:text-slate-800'}`}>
                        %
                      </button>
                    </div>
                    <input type="number" step="any" min="0" max={discountType === 'percent' ? 100 : subtotal} value={discountAmount || ''} onChange={(e) => setDiscountAmount(Number(e.target.value))} placeholder="0" className="w-24 text-right px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg font-black text-xs focus:ring-1 focus:ring-amber-500/30"/>
                  </div>
                </div>
                {effectiveDiscount > 0 && (<div className="flex justify-between text-[11px] text-rose-600 font-bold">
                    <span>{'Discount Amount:'}</span>
                    <span>-{profile.currencySymbol}{effectiveDiscount.toLocaleString()}</span>
                  </div>)}
              </div>

              {/* VAT / Tax Input with Toggle (Discount-er moto) */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <span>{'VAT / Tax'}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex border border-slate-200 rounded-lg overflow-hidden shrink-0 bg-slate-50">
                      <button type="button" onClick={() => setVatType('amount')} className={`px-2.5 py-1 text-[11px] font-black transition-colors cursor-pointer ${vatType === 'amount'
            ? 'bg-slate-900 text-white'
            : 'text-slate-500 hover:text-slate-800'}`}>Tk</button>
                      <button type="button" onClick={() => setVatType('percent')} className={`px-2.5 py-1 text-[11px] font-black transition-colors cursor-pointer ${vatType === 'percent'
            ? 'bg-slate-900 text-white'
            : 'text-slate-500 hover:text-slate-800'}`}>
                        %
                      </button>
                    </div>
                    <input type="number" step="any" min="0" max={vatType === 'percent' ? 100 : undefined} value={vatAmountInput || ''} onChange={(e) => setVatAmountInput(Number(e.target.value))} placeholder="0" className="w-24 text-right px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg font-black text-xs focus:ring-1 focus:ring-amber-500/30"/>
                  </div>
                </div>

                {effectiveVat > 0 && (<div className="flex justify-between text-[11px] text-amber-800 font-bold">
                    <span>
                      {'VAT Amount'} {vatType === 'percent' ? `(${vatAmountInput}%)` : ''}:
                    </span>
                    <span>+{profile.currencySymbol}{effectiveVat.toLocaleString()}</span>
                  </div>)}
              </div>
            </div>

            {/* Right Col: Totals Display */}
            <div className="sm:col-span-6 bg-amber-50/70 p-4 rounded-xl border border-amber-200 flex flex-col justify-between space-y-2">
              <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wider block border-b border-amber-200 pb-1.5">
                {'Financial Summary'}
              </span>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600 font-semibold">
                  <span>{'Subtotal:'}</span>
                  <span className="font-bold text-slate-900">{profile.currencySymbol}{subtotal.toLocaleString()}</span>
                </div>

                {effectiveDiscount > 0 && (<div className="flex justify-between text-rose-600 font-semibold">
                    <span>{'Discount:'}</span>
                    <span className="font-bold">-{profile.currencySymbol}{effectiveDiscount.toLocaleString()}</span>
                  </div>)}

                {effectiveVat > 0 && (<div className="flex justify-between text-slate-700 font-semibold">
                    <span>{'VAT:'}</span>
                    <span className="font-bold">+{profile.currencySymbol}{effectiveVat.toLocaleString()}</span>
                  </div>)}

                <div className="pt-2 border-t border-amber-200/80 flex justify-between items-baseline">
                  <span className="text-sm font-black text-slate-900">{'Grand Total:'}</span>
                  <span className="text-lg font-black text-amber-700">
                    {profile.currencySymbol}{grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Payment Row inside Summary */}
              <div className="pt-3 border-t border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="font-extrabold text-slate-800 text-xs">
                    {'Amount Paid:'}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input type="number" step="any" min="0" max={grandTotal} value={paidAmount} onChange={(e) => setPaidAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder={grandTotal.toString()} className="w-28 text-right px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-black text-xs focus:ring-1 focus:ring-amber-500/30"/>
                  </div>
                </div>

                {/* Quick Paid Presets */}
                <div className="flex justify-end gap-1.5 flex-wrap">
                  {customerMode === 'existing' && (() => {
                    const cust = customers.find((c) => c.id === selectedCustomerId);
                    const adv = Number(cust?.advanceBalance) || 0;
                    if (adv <= 0) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => setPaidAmount(Math.min(adv, grandTotal))}
                        className="px-2 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded text-[10px] font-extrabold cursor-pointer flex items-center gap-1 shadow-2xs"
                        title={`Customer has ${profile.currencySymbol}${adv.toLocaleString()} advance balance`}
                      >
                        <span>Adjust Advance ({profile.currencySymbol}{Math.min(adv, grandTotal).toLocaleString()})</span>
                      </button>
                    );
                  })()}
                  <button type="button" onClick={() => setPaidAmount(grandTotal)} className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-[10px] font-extrabold cursor-pointer">
                    {'Full Paid'}
                  </button>
                  <button type="button" onClick={() => setPaidAmount(Math.round(grandTotal / 2))} className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-[10px] font-extrabold cursor-pointer">
                    {'50% Advance'}
                  </button>
                  <button type="button" onClick={() => setPaidAmount(0)} className="px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded text-[10px] font-extrabold cursor-pointer">
                    {'Full Due'}
                  </button>
                </div>

                <div className="flex justify-between items-center text-xs font-bold pt-1">
                  <span className="text-slate-600">{'Due Balance:'}</span>
                  <span className={`font-black ${dueAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {profile.currencySymbol}{dueAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Payment Method, Production Status & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                {'Payment Method'}
              </label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs">
                {activePaymentMethods.map((pm) => (<option key={pm.id} value={pm.name}>
                    {pm.name}
                    {pm.accountNumber ? ` (${pm.accountNumber})` : ''}
                    {''}
                  </option>))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                {'Initial Job Status'}
              </label>
              <select value={productionStatus} onChange={(e) => setProductionStatus(e.target.value as any)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs">
                <option value="Queued">Queued</option>
                <option value="In Print / Fabrication">In PrintFabricationPrint</option>
                <option value="Ready">Ready</option>
                <option value="Delivered">Delivered</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                {'Job Instructions'}
              </label>
              <input type="text" value={jobSpecs} onChange={(e) => setJobSpecs(e.target.value)} placeholder="e.g. Eyelet 4 corners, Matt lamination" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"/>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-semibold hidden sm:block">
            {'Invoice can be printed immediately after saving'}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer">
              {'Cancel'}
            </button>
            <button type="button" onClick={handleSubmitInvoice} className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-extrabold text-xs shadow-md flex items-center gap-1.5 cursor-pointer transition-all">
              <CheckCircle2 className="w-4 h-4"/>
              <span>{'Confirm & Create Invoice'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>);
};
