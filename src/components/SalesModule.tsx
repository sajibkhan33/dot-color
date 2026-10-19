import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { SalesInvoice, Quotation, Customer, ProductionStatus, PRESET_INVOICE_ITEM_TYPES } from '../types';
import { FileText, Printer, Receipt, Plus, Search, CheckCircle2, Clock, Truck, ArrowRight, DollarSign, AlertCircle, Eye, Filter, Layers, Phone, User, Calendar, FileSpreadsheet, SlidersHorizontal, RefreshCw, Edit2, Trash2, X, UserPlus, RotateCcw, AlertTriangle, Landmark, Smartphone, Banknote, CreditCard, History, ChevronRight, FolderKanban, Briefcase, } from 'lucide-react';
import { exportSalesToExcel } from '../utils/exportUtils';
import { ReportPrintModal } from './ReportPrintModal';
import { CreateSalesInvoiceModal } from './CreateSalesInvoiceModal';
import { getPaymentMethodLiveBalance, isInvoiceMatchingCustomer, getCustomerInvoiceSummary, getInvoicePayments } from '../utils/accountUtils';
interface SalesModuleProps {
    onOpenInvoiceModal: (invoiceId: string, mode?: 'invoice' | 'challan' | 'pos', options?: {
        autoPrint?: boolean;
        isPadMode?: boolean;
    }) => void;
    onOpenChallanModal: (invoiceId: string) => void;
}
export const SalesModule: React.FC<SalesModuleProps> = ({ onOpenInvoiceModal, onOpenChallanModal, }) => {
    const { invoices, quotations, customers, products, profile, language, paymentMethods = [], chartOfAccounts = [], transactions = [], accountBalances, updateProductionStatus, updateInvoice, deleteInvoice, collectInvoicePayment, convertQuotationToInvoice, addQuotation, updateQuotation, updateQuotationStatus, deleteQuotation, addCustomer, updateCustomer, deleteCustomer, projects = [], createProjectFromInvoice, } = useApp();
    const activePaymentMethods = useMemo(() => {
        const list = (paymentMethods || []).filter((p) => p.isEnabled);
        return list.length > 0 ? list : [{ id: 'pm-cash', name: 'Cash', nameBn: "Nagad", type: 'cash' as const, isEnabled: true }];
    }, [paymentMethods]);
    const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'quotations' | 'customers'>('invoices');
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
    const [invoiceToDelete, setInvoiceToDelete] = useState<SalesInvoice | null>(null);
    const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);
    const [showDirectInvoiceModal, setShowDirectInvoiceModal] = useState(false);
    const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
    const [addedQuoteItems, setAddedQuoteItems] = useState<any[]>([]);
    const [viewingPaymentDetailsInvoice, setViewingPaymentDetailsInvoice] = useState<SalesInvoice | null>(null);
    const [selectedCustomerHistory, setSelectedCustomerHistory] = useState<Customer | null>(null);
    // Invoice Editing States
    const [editingInvoice, setEditingInvoice] = useState<SalesInvoice | null>(null);
    const [editInvoiceItems, setEditInvoiceItems] = useState<any[]>([]);
    const [editInvoiceRefNo, setEditInvoiceRefNo] = useState('');
    const [editInvoiceWarehouse, setEditInvoiceWarehouse] = useState<'Factory' | 'Office'>('Factory');
    const [invItemName, setInvItemName] = useState('');
    const [invItemRegion, setInvItemRegion] = useState('');
    const [invItemType, setInvItemType] = useState('');
    const [editInvIsCustomType, setEditInvIsCustomType] = useState<boolean>(false);
    const [editInvCustomTypes, setEditInvCustomTypes] = useState<string[]>([]);
    const [editInvShowRegionColumn, setEditInvShowRegionColumn] = useState<boolean>(false);
    const [editInvShowTypeColumn, setEditInvShowTypeColumn] = useState<boolean>(false);
    const [invItemQty, setInvItemQty] = useState(1);
    const [invItemPrice, setInvItemPrice] = useState(1000);
    const [invSelectedProductId, setInvSelectedProductId] = useState('');
    const [invoiceDiscount, setInvoiceDiscount] = useState(0);
    const [invoiceDiscountType, setInvoiceDiscountType] = useState<'amount' | 'percent'>('amount');
    const [invoiceVatType, setInvoiceVatType] = useState<'amount' | 'percent'>('percent');
    const [invoiceVatAmountInput, setInvoiceVatAmountInput] = useState<number>(0);
    const [customerFormData, setCustomerFormData] = useState({
        name: '',
        company: '',
        phone: '',
        email: '',
        address: '',
        advanceBalance: 0,
    });

    // Project Creation Against Invoice States
    const [projectModalInvoice, setProjectModalInvoice] = useState<SalesInvoice | null>(null);
    const [projectFormData, setProjectFormData] = useState({
        name: '',
        nameBn: '',
        budget: 0,
        status: 'In Progress' as 'In Progress' | 'Completed' | 'Planning' | 'On Hold',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        chartOfAccountId: 'coa-4051',
        includeSalesItem: true,
        notes: '',
    });
    const [projectCreatedSuccess, setProjectCreatedSuccess] = useState<{ projectCode: string; projectName: string } | null>(null);

    const availableRevenueCOAs = useMemo(() => {
        const revs = (chartOfAccounts || []).filter(a => a.classification === 'Revenue' && a.isActive !== false);
        if (revs.length === 0) {
            return [
                { id: 'coa-4051', code: '4051', name: 'Project Sales Income', nameBn: 'প্রজেক্ট সেলস ইনকাম' },
                { id: 'coa-4010', code: '4010', name: 'Digital Printing & Flex Banner Sales', nameBn: 'ডিজিটাল প্রিন্টিং বিক্রয়' },
            ];
        }
        return [...revs].sort((a, b) => {
            if (a.code === '4051' || a.id === 'coa-4051') return -1;
            if (b.code === '4051' || b.id === 'coa-4051') return 1;
            return a.code.localeCompare(b.code);
        });
    }, [chartOfAccounts]);

    const handleCreateProjectAgainstInvoice = (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectModalInvoice || !projectFormData.name.trim()) return;

        const newProj = createProjectFromInvoice(projectModalInvoice.id, {
            name: projectFormData.name.trim(),
            nameBn: projectFormData.nameBn.trim() || undefined,
            budget: Number(projectFormData.budget) || 0,
            status: projectFormData.status,
            startDate: projectFormData.startDate,
            endDate: projectFormData.endDate || '',
            chartOfAccountId: projectFormData.chartOfAccountId,
            includeAsSalesItem: projectFormData.includeSalesItem,
            notes: projectFormData.notes,
        });

        if (newProj) {
            setProjectCreatedSuccess({ projectCode: newProj.code, projectName: newProj.name });
        }
        setProjectModalInvoice(null);
    };
    const handleUpdateEditInvoiceItemRow = (index: number, field: 'qty' | 'unitPrice', val: number) => {
        setEditInvoiceItems((prev) => prev.map((it, i) => {
            if (i !== index)
                return it;
            const newQty = field === 'qty' ? Math.max(1, val) : it.qty;
            const newPrice = field === 'unitPrice' ? Math.max(0, val) : it.unitPrice;
            const rowTotal = Math.round(newQty * newPrice);
            return {
                ...it,
                qty: newQty,
                unitPrice: newPrice,
                costPrice: Math.round(newPrice * 0.6),
                totalPrice: rowTotal,
            };
        }));
    };
    const handleUpdateQuoteItemRow = (index: number, field: 'qty' | 'unitPrice', val: number) => {
        setAddedQuoteItems((prev) => prev.map((it, i) => {
            if (i !== index)
                return it;
            const newQty = field === 'qty' ? Math.max(1, val) : it.qty;
            const newPrice = field === 'unitPrice' ? Math.max(0, val) : it.unitPrice;
            const rowTotal = Math.round(newQty * newPrice);
            return {
                ...it,
                qty: newQty,
                unitPrice: newPrice,
                costPrice: Math.round(newPrice * 0.6),
                totalPrice: rowTotal,
            };
        }));
    };
    const handleEditInvoiceSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingInvoice)
            return;
        let finalItems = [...editInvoiceItems];
        if (finalItems.length === 0 && invItemName.trim()) {
            const subItem = invItemQty * invItemPrice;
            finalItems.push({
                productId: invSelectedProductId || `custom-${Date.now()}`,
                name: invItemName.trim(),
                region: editInvShowRegionColumn && invItemRegion.trim() ? invItemRegion.trim() : undefined,
                type: editInvShowTypeColumn && invItemType.trim() ? invItemType.trim() : undefined,
                itemType: editInvShowTypeColumn && invItemType.trim() ? invItemType.trim() : undefined,
                unit: 'pcs',
                unitPrice: invItemPrice,
                costPrice: Math.round(invItemPrice * 0.6),
                qty: invItemQty,
                totalPrice: subItem,
            });
        }
        if (finalItems.length === 0) {
            alert('Please add at least one item!');
            return;
        }
        const sub = finalItems.reduce((acc, item) => acc + item.totalPrice, 0);
        const effectiveDiscount = invoiceDiscountType === 'percent'
            ? Math.round((sub * Math.min(100, Math.max(0, invoiceDiscount))) / 100)
            : Math.min(sub, Math.max(0, invoiceDiscount));
        const taxable = Math.max(0, sub - effectiveDiscount);
        const effectiveVat = invoiceVatType === 'percent'
            ? Math.round((taxable * Math.min(100, Math.max(0, invoiceVatAmountInput))) / 100)
            : Math.max(0, invoiceVatAmountInput);
        const computedVatRate = invoiceVatType === 'percent'
            ? invoiceVatAmountInput
            : (taxable > 0 ? Number(((effectiveVat / taxable) * 100).toFixed(2)) : 0);
        const grand = Math.max(0, taxable + effectiveVat);
        // Keep paid amount same, update due amount
        const due = Math.max(0, grand - editingInvoice.paidAmount);
        // Auto update payment status based on new due
        let newPaymentStatus = editingInvoice.paymentStatus;
        if (due <= 0) {
            newPaymentStatus = 'Paid';
        }
        else if (editingInvoice.paidAmount > 0 && due > 0) {
            newPaymentStatus = 'Partial';
        }
        else if (editingInvoice.paidAmount === 0) {
            newPaymentStatus = 'Due';
        }
        updateInvoice(editingInvoice.id, {
            referenceNo: editInvoiceRefNo.trim() || undefined,
            warehouseLocation: editInvoiceWarehouse,
            items: finalItems,
            subtotal: sub,
            discount: effectiveDiscount,
            discountType: invoiceDiscountType,
            discountValue: invoiceDiscount,
            vatType: invoiceVatType,
            vatValue: invoiceVatAmountInput,
            vatRate: computedVatRate,
            vatAmount: effectiveVat,
            grandTotal: grand,
            dueAmount: due,
            paymentStatus: newPaymentStatus,
            showRegionColumn: editInvShowRegionColumn,
            showTypeColumn: editInvShowTypeColumn,
        });
        setEditingInvoice(null);
        setEditInvoiceItems([]);
        setEditInvoiceRefNo('');
        setInvItemName('');
        setInvItemRegion('');
        setInvItemType('');
        setEditInvShowRegionColumn(false);
        setEditInvShowTypeColumn(false);
        setInvSelectedProductId('');
        setInvItemQty(1);
        setInvItemPrice(1000);
        setInvoiceDiscount(0);
        setInvoiceDiscountType('amount');
        setInvoiceVatType('percent');
        setInvoiceVatAmountInput(0);
    };
    const handleCustomerFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerFormData.name.trim() || !customerFormData.phone.trim())
            return;
        if (editingCustomer) {
            updateCustomer(editingCustomer.id, {
                name: customerFormData.name.trim(),
                company: customerFormData.company.trim() || undefined,
                phone: customerFormData.phone.trim(),
                email: customerFormData.email.trim() || undefined,
                address: customerFormData.address.trim() || undefined,
                advanceBalance: Number(customerFormData.advanceBalance) || 0,
            });
        }
        else {
            addCustomer({
                name: customerFormData.name.trim(),
                company: customerFormData.company.trim() || undefined,
                phone: customerFormData.phone.trim(),
                email: customerFormData.email.trim() || undefined,
                address: customerFormData.address.trim() || undefined,
                advanceBalance: Number(customerFormData.advanceBalance) || 0,
            });
        }
        setShowCustomerModal(false);
        setEditingCustomer(null);
    };
    const [filterPayment, setFilterPayment] = useState<string>('ALL');
    const [filterProduction, setFilterProduction] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [quoteCustomerSearch, setQuoteCustomerSearch] = useState('');
    const [isQuoteCustomerDropdownOpen, setIsQuoteCustomerDropdownOpen] = useState(false);
    // Date Range Filters for Invoices
    const [filterDatePreset, setFilterDatePreset] = useState<'ALL' | 'TODAY' | '7D' | 'THIS_MONTH' | 'LAST_30' | 'CUSTOM'>('ALL');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [showCustomDate, setShowCustomDate] = useState<boolean>(false);
    const [showReportModal, setShowReportModal] = useState<boolean>(false);
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
    // Collect Payment Modal
    const [paymentModalInvoice, setPaymentModalInvoice] = useState<SalesInvoice | null>(null);
    const [collectAmount, setCollectAmount] = useState<number>(0);
    const [collectMethod, setCollectMethod] = useState<string>('Cash');
    const [adjustAdvanceAmount, setAdjustAdvanceAmount] = useState<number>(0);
    // New Quotation Modal
    const [showNewQuoteModal, setShowNewQuoteModal] = useState(false);
    const [quoteType, setQuoteType] = useState<'Sales' | 'Custom'>('Sales');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [quoteCustomerName, setQuoteCustomerName] = useState('');
    const [quoteCustomerPhone, setQuoteCustomerPhone] = useState('');
    const [quoteCustomerCompany, setQuoteCustomerCompany] = useState('');
    const [quoteCustomerAddress, setQuoteCustomerAddress] = useState('');
    const [quoteReferenceNo, setQuoteReferenceNo] = useState('');
    const [quotePurchaseRequisition, setQuotePurchaseRequisition] = useState('');
    const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [quoteValidUntil, setQuoteValidUntil] = useState(() => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
    const [quoteItemName, setQuoteItemName] = useState('');
    const [quoteItemRegion, setQuoteItemRegion] = useState('');
    const [quoteItemType, setQuoteItemType] = useState('');
    const [quoteIsCustomType, setQuoteIsCustomType] = useState<boolean>(false);
    const [quoteCustomTypes, setQuoteCustomTypes] = useState<string[]>([]);
    const [quoteShowRegionColumn, setQuoteShowRegionColumn] = useState<boolean>(false);
    const [quoteShowTypeColumn, setQuoteShowTypeColumn] = useState<boolean>(false);
    const [quoteItemQty, setQuoteItemQty] = useState(1);
    const [quoteItemPrice, setQuoteItemPrice] = useState(1000);
    const [quoteDiscount, setQuoteDiscount] = useState(0);
    const [quoteDiscountType, setQuoteDiscountType] = useState<'amount' | 'percent'>('amount');
    const [quoteVatType, setQuoteVatType] = useState<'amount' | 'percent'>('percent');
    const [quoteVatAmountInput, setQuoteVatAmountInput] = useState<number>(0);
    const [quoteNotes, setQuoteNotes] = useState('');
    // Filtered invoices
    const filteredInvoices = invoices.filter((inv) => {
        const matchPay = filterPayment === 'ALL' ? true : inv.paymentStatus === filterPayment;
        const matchProd = filterProduction === 'ALL' ? true : inv.productionStatus === filterProduction;
        const matchDate = (!startDate || inv.date >= startDate) && (!endDate || inv.date <= endDate);
        const q = (searchQuery || '').toLowerCase().trim();
        const matchSearch = !q ||
            (inv.invoiceNo && inv.invoiceNo.toLowerCase().includes(q)) ||
            (inv.referenceNo && inv.referenceNo.toLowerCase().includes(q)) ||
            (inv.customerName && inv.customerName.toLowerCase().includes(q)) ||
            (inv.customerPhone && inv.customerPhone.includes(q)) ||
            (inv.items && inv.items.some((i) => i.name && i.name.toLowerCase().includes(q)));
        return matchPay && matchProd && matchDate && matchSearch;
    });
    const dateRangeLabel = startDate && endDate
        ? `${startDate} to ${endDate}`
        : startDate
            ? `From ${startDate}`
            : endDate
                ? `Up to ${endDate}`
                : 'All Invoices';
    const handleExcelExport = () => {
        exportSalesToExcel(filteredInvoices, profile, dateRangeLabel);
    };
    // Filtered clients for customer directory
    const filteredClients = useMemo(() => {
        if (!customerSearchQuery.trim())
            return customers;
        const q = customerSearchQuery.toLowerCase().trim();
        return customers.filter((c) => c.name.toLowerCase().includes(q) ||
            (c.phone && c.phone.includes(q)) ||
            (c.company && c.company.toLowerCase().includes(q)) ||
            (c.address && c.address.toLowerCase().includes(q)));
    }, [customers, customerSearchQuery]);
    // Filtered customers for quotation quick-select
    const filteredQuoteCustomers = useMemo(() => {
        if (!quoteCustomerSearch.trim())
            return customers;
        const q = quoteCustomerSearch.toLowerCase().trim();
        return customers.filter((c) => c.name.toLowerCase().includes(q) ||
            (c.phone && c.phone.includes(q)) ||
            (c.company && c.company.toLowerCase().includes(q)));
    }, [customers, quoteCustomerSearch]);
    // Financial stats (for filtered or overall)
    const totalSales = filteredInvoices.reduce((acc, i) => acc + (Number(i.grandTotal) || 0), 0);
    const totalCollected = filteredInvoices.reduce((acc, i) => acc + (Number(i.paidAmount) || 0), 0);
    const totalDue = filteredInvoices.reduce((acc, i) => acc + (Number(i.dueAmount) || 0), 0);
    const handleCollectSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!paymentModalInvoice)
            return;
        const totalSettling = (collectAmount || 0) + (adjustAdvanceAmount || 0);
        if (totalSettling <= 0)
            return;
        collectInvoicePayment(paymentModalInvoice.id, collectAmount || 0, collectMethod, adjustAdvanceAmount || 0);
        setPaymentModalInvoice(null);
        setCollectAmount(0);
        setAdjustAdvanceAmount(0);
    };
    const handleCreateQuote = (e: React.FormEvent) => {
        e.preventDefault();
        if (!quoteCustomerName)
            return;
        let finalItems = [...addedQuoteItems];
        if (finalItems.length === 0 && quoteItemName.trim()) {
            const subItem = quoteItemQty * quoteItemPrice;
            finalItems.push({
                productId: selectedProductId || `custom-${Date.now()}`,
                name: quoteItemName.trim(),
                category: 'BRANDED PROMOTIONAL GIFTS',
                region: quoteShowRegionColumn && quoteItemRegion.trim() ? quoteItemRegion.trim() : undefined,
                type: quoteShowTypeColumn && quoteItemType.trim() ? quoteItemType.trim() : undefined,
                itemType: quoteShowTypeColumn && quoteItemType.trim() ? quoteItemType.trim() : undefined,
                unit: 'pcs',
                unitPrice: quoteItemPrice,
                costPrice: Math.round(quoteItemPrice * 0.6),
                qty: quoteItemQty,
                totalPrice: subItem,
            });
        }
        if (finalItems.length === 0) {
            alert('Please add at least one item!');
            return;
        }
        const sub = finalItems.reduce((acc, item) => acc + item.totalPrice, 0);
        const effectiveQuoteDiscount = quoteDiscountType === 'percent'
            ? Math.round((sub * Math.min(100, Math.max(0, quoteDiscount))) / 100)
            : Math.min(sub, Math.max(0, quoteDiscount));
        const taxable = Math.max(0, sub - effectiveQuoteDiscount);
        const effectiveQuoteVat = quoteVatType === 'percent'
            ? Math.round((taxable * Math.min(100, Math.max(0, quoteVatAmountInput))) / 100)
            : Math.max(0, quoteVatAmountInput);
        const computedVatRate = quoteVatType === 'percent'
            ? quoteVatAmountInput
            : (taxable > 0 ? Number(((effectiveQuoteVat / taxable) * 100).toFixed(2)) : 0);
        const grand = taxable + effectiveQuoteVat;
        if (editingQuotation) {
            updateQuotation(editingQuotation.id, {
                date: quoteDate,
                validUntil: quoteValidUntil,
                customerName: quoteCustomerName,
                customerPhone: quoteCustomerPhone,
                customerCompany: quoteCustomerCompany,
                customerAddress: quoteCustomerAddress.trim() || undefined,
                referenceNo: quoteReferenceNo.trim() || undefined,
                purchaseRequisition: quotePurchaseRequisition.trim() || undefined,
                prNo: quotePurchaseRequisition.trim() || undefined,
                items: finalItems,
                subtotal: sub,
                discount: effectiveQuoteDiscount,
                discountType: quoteDiscountType,
                discountValue: quoteDiscount,
                vatType: quoteVatType,
                vatValue: quoteVatAmountInput,
                vatRate: computedVatRate,
                vatAmount: effectiveQuoteVat,
                grandTotal: grand,
                notes: quoteNotes,
                quoteType,
                showRegionColumn: quoteShowRegionColumn,
                showTypeColumn: quoteShowTypeColumn,
            });
            setEditingQuotation(null);
        }
        else {
            addQuotation({
                date: quoteDate,
                validUntil: quoteValidUntil,
                referenceNo: quoteReferenceNo.trim() || undefined,
                purchaseRequisition: quotePurchaseRequisition.trim() || undefined,
                prNo: quotePurchaseRequisition.trim() || undefined,
                customerName: quoteCustomerName,
                customerPhone: quoteCustomerPhone,
                customerCompany: quoteCustomerCompany,
                customerAddress: quoteCustomerAddress.trim() || undefined,
                items: finalItems,
                subtotal: sub,
                discount: effectiveQuoteDiscount,
                discountType: quoteDiscountType,
                discountValue: quoteDiscount,
                vatType: quoteVatType,
                vatValue: quoteVatAmountInput,
                vatRate: computedVatRate,
                vatAmount: effectiveQuoteVat,
                grandTotal: grand,
                status: 'Sent',
                notes: quoteNotes,
                quoteType,
                showRegionColumn: quoteShowRegionColumn,
                showTypeColumn: quoteShowTypeColumn,
            });
        }
        setShowNewQuoteModal(false);
        setAddedQuoteItems([]);
        setQuoteType('Sales');
        setSelectedProductId('');
        setQuoteCustomerName('');
        setQuoteCustomerPhone('');
        setQuoteCustomerCompany('');
        setQuoteCustomerAddress('');
        setQuoteReferenceNo('');
        setQuotePurchaseRequisition('');
        setQuoteDate(new Date().toISOString().slice(0, 10));
        setQuoteValidUntil(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
        setQuoteItemName('');
        setQuoteItemRegion('');
        setQuoteItemType('');
        setQuoteShowRegionColumn(false);
        setQuoteShowTypeColumn(false);
        setQuoteItemQty(1);
        setQuoteItemPrice(1000);
        setQuoteDiscount(0);
        setQuoteDiscountType('amount');
        setQuoteVatType('percent');
        setQuoteVatAmountInput(0);
        setQuoteNotes('');
    };
    const productionStatuses: ProductionStatus[] = [
        'Queued',
        'Designing',
        'In Print / Fabrication',
        'Finishing',
        'Ready',
        'Delivered',
    ];
    return (<div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 block mb-1">
            {'Total Gross Sales'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {profile.currencySymbol}
            {(Number(totalSales) || 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {invoices.length} {'invoices recorded'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-emerald-600 block mb-1">
            {'Total Cash & Bank Collected'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-700">
            {profile.currencySymbol}
            {(Number(totalCollected) || 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-emerald-600/80 mt-1 block font-medium">
            {'via Cash, Bank & Mobile Banking'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-rose-600 block mb-1">
            {'Accounts Receivable (Customer Due)'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-rose-600">
            {profile.currencySymbol}
            {(Number(totalDue) || 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-rose-500 mt-1 block font-medium">
            {invoices.filter((i) => (Number(i.dueAmount) || 0) > 0).length}{' '}
            {'invoices with due'}
          </span>
        </div>
      </div>

      {/* Sub tabs & Actions bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button type="button" onClick={() => setActiveSubTab('invoices')} className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'invoices' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
            {'Sales Invoices'}
          </button>
          <button type="button" onClick={() => setActiveSubTab('quotations')} className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'quotations' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
            {'Quotations / Estimates'}
          </button>
          <button type="button" onClick={() => setActiveSubTab('customers')} className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'customers' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
            {'Client Directory'}
          </button>
        </div>

        {activeSubTab === 'invoices' && (<div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button type="button" onClick={() => setShowDirectInvoiceModal(true)} className="w-full md:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all">
              <Plus className="w-4 h-4"/>
              <span>{'+ Create Sales Invoice'}</span>
            </button>
          </div>)}

        {activeSubTab === 'quotations' && (<button type="button" onClick={() => {
            setEditingQuotation(null);
            setQuoteCustomerName('');
            setQuoteCustomerPhone('');
            setQuoteCustomerCompany('');
            setQuoteCustomerAddress('');
            setQuoteReferenceNo('');
            setQuotePurchaseRequisition('');
            setQuoteDate(new Date().toISOString().slice(0, 10));
            setQuoteValidUntil(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
            setAddedQuoteItems([]);
            setShowNewQuoteModal(true);
        }} className="w-full md:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all">
            <Plus className="w-4 h-4"/>
            <span>{'+ Create New Quote'}</span>
          </button>)}
      </div>

      {/* SUB-TAB 1: INVOICES & ORDERS */}
      {activeSubTab === 'invoices' && (<div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Filters Bar */}
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={'Search invoice#, client or phone...'} className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"/>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              {/* Date Presets */}
              <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                {([
                { id: 'ALL', labelEn: 'All', labelBn: "" },
                { id: 'TODAY', labelEn: 'Today', labelBn: "" },
                { id: '7D', labelEn: '7 Days', labelBn: "" },
                { id: 'THIS_MONTH', labelEn: 'Month', labelBn: "" },
                { id: 'CUSTOM', labelEn: 'Custom', labelBn: "" },
            ] as const).map((p) => (<button key={p.id} type="button" onClick={() => handleDatePreset(p.id)} className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all ${filterDatePreset === p.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'}`}>
                    {p.labelEn}
                  </button>))}
              </div>

              <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold">
                <option value="ALL">{'All Payments'}</option>
                <option value="Paid">PaidPayment</option>
                <option value="Partial">Partial Payment</option>
                <option value="Due">DueDue</option>
              </select>

              <select value={filterProduction} onChange={(e) => setFilterProduction(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold">
                <option value="ALL">{'All Statuses'}</option>
                {productionStatuses.map((st) => (<option key={st} value={st}>
                    {st}
                  </option>))}
              </select>

              {/* Excel & PDF Export buttons */}
              <button type="button" onClick={handleExcelExport} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs flex items-center gap-1 transition-all" title={'Export Excel Report'}>
                <FileSpreadsheet className="w-3.5 h-3.5"/>
                <span>Excel</span>
              </button>

              <button type="button" onClick={() => setShowReportModal(true)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-2xs flex items-center gap-1 transition-all" title={'Print / Save PDF Report'}>
                <Printer className="w-3.5 h-3.5 text-amber-400"/>
                <span>PDF</span>
              </button>
            </div>
          </div>

          {/* Custom Date Range Filter Inputs */}
          {(showCustomDate || filterDatePreset === 'CUSTOM') && (<div className="bg-amber-50/60 border-b border-amber-200/70 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600"/>
                <span>{'Custom Date Filter:'}</span>
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

          {/* Invoices Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap">
                  <th className="py-2.5 px-3">INVOICE / DATE</th>
                  <th className="py-2.5 px-3">CUSTOMER & COMPANY</th>
                  <th className="py-2.5 px-3">ITEMS & DESCRIPTION</th>
                  <th className="py-2.5 px-3 text-right">TOTAL AMOUNT</th>
                  <th className="py-2.5 px-3 text-center">PAYMENT</th>
                  <th className="py-2.5 px-3 text-center">WORK STATUS</th>
                  <th className="py-2.5 px-3 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => {
                  const linkedProject = projects.find(p => p.invoiceId === inv.id || p.invoiceNo === inv.invoiceNo || (inv.projectId && p.id === inv.projectId));
                  const isLinkedToProject = Boolean(linkedProject || inv.projectId || inv.projectCode);
                  const pCode = linkedProject?.code || inv.projectCode;

                  return (
                    <tr
                      key={inv.id}
                      className={`transition-colors ${
                        isLinkedToProject
                          ? 'bg-amber-50/50 hover:bg-amber-100/60 border-l-4 border-l-amber-500'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900 text-xs sm:text-[13px] whitespace-nowrap">
                        <span>{inv.invoiceNo}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0"/>
                        <span>{inv.date}</span>
                        {inv.warehouseLocation && (
                          <span className="font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded text-[10px]">
                            {inv.warehouseLocation}
                          </span>
                        )}
                      </div>
                      {pCode && (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              try { sessionStorage.setItem('PROJECT_SEARCH_TERM', pCode); } catch {}
                              window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'projects' }));
                            }}
                            className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-100/90 hover:bg-amber-200 px-1.5 py-0.2 rounded text-[9.5px] border border-amber-300 cursor-pointer transition-colors shadow-2xs"
                            title={`Linked Project [${pCode}] - Click to view in Projects tab`}
                          >
                            <FolderKanban className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                            <span className="font-mono">{pCode}</span>
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-3 max-w-[170px]">
                      <div className="font-bold text-slate-900 truncate text-xs sm:text-[13px]" title={inv.customerName}>
                        {inv.customerName}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate mt-1">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0"/>
                        <span className="truncate">{inv.customerPhone}</span>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 max-w-[200px]">
                      <div className="font-medium text-slate-800 truncate text-xs sm:text-[12.5px]" title={`${(inv.items || []).map((i) => `${i?.name || 'Item'} (x${i?.qty || 1})`).join(', ')}${inv.jobSpecs ? ` • ${inv.jobSpecs}` : ''}`}>
                        <span>{(inv.items || []).map((i) => `${i?.name || 'Item'} (x${i?.qty || 1})`).join(', ')}</span>
                        {inv.jobSpecs && (<span className="text-[11px] text-amber-700 italic ml-1 font-normal">
                            • {inv.jobSpecs}
                          </span>)}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="font-black text-slate-900 text-xs sm:text-sm">
                        {profile.currencySymbol}
                        {(Number(inv.grandTotal) || 0).toLocaleString()}
                      </div>
                      {(Number(inv.dueAmount) || 0) > 0 && (<div className="text-[11px] font-bold text-rose-600 mt-0.5">
                          Due: {profile.currencySymbol}{(Number(inv.dueAmount) || 0).toLocaleString()}
                        </div>)}
                    </td>

                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {(() => {
                        const invPayments = getInvoicePayments(inv, transactions, paymentMethods);
                        return (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${inv.paymentStatus === 'Paid'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : inv.paymentStatus === 'Partial'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                {inv.paymentStatus}
                              </span>
                            </div>

                            {invPayments.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => setViewingPaymentDetailsInvoice(inv)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-extrabold cursor-pointer transition-colors shadow-2xs"
                                title={invPayments.map(p => `${p.channel}: ${profile.currencySymbol}${(Number(p.amount) || 0).toLocaleString()}`).join(' • ')}
                              >
                                <span>{invPayments.length} Channels</span>
                                <span className="text-[9px]">▾</span>
                              </button>
                            ) : invPayments.length === 1 ? (
                              <span className="text-[10px] text-slate-600 font-semibold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {invPayments[0].channel}
                              </span>
                            ) : inv.paymentMethod ? (
                              <span className="text-[10px] text-slate-500 font-medium">
                                {inv.paymentMethod}
                              </span>
                            ) : null}
                          </div>
                        );
                      })()}
                    </td>

                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <select value={inv.productionStatus} onChange={(e) => updateProductionStatus(inv.id, e.target.value)} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-semibold text-slate-700 h-6.5 w-[92px] cursor-pointer focus:outline-hidden">
                        {productionStatuses.map((st) => (<option key={st} value={st}>
                            {st}
                          </option>))}
                      </select>
                    </td>

                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                        {/* Compact Printer Dropdown */}
                        <div className="relative inline-flex items-center">
                          <button
                            type="button"
                            className="h-6.5 px-1.5 flex items-center gap-0.5 text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-md border border-amber-300 text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                            title="Print options (POS, A4, Pad, Preview)"
                          >
                            <Printer className="w-3 h-3 text-amber-700 shrink-0" />
                            <span className="text-[8px] text-amber-700">▾</span>
                          </button>
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              const val = e.target.value;
                              e.target.value = '';
                              if (val === 'pos') {
                                onOpenInvoiceModal(inv.id, 'pos', { autoPrint: true });
                              } else if (val === 'a4') {
                                onOpenInvoiceModal(inv.id, 'invoice', { autoPrint: true, isPadMode: false });
                              } else if (val === 'pad') {
                                onOpenInvoiceModal(inv.id, 'invoice', { autoPrint: true, isPadMode: true });
                              } else if (val === 'preview') {
                                onOpenInvoiceModal(inv.id, 'invoice', { autoPrint: false });
                              }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            title="Select print option"
                          >
                            <option value="" disabled>Print Options</option>
                            <option value="pos">🧾 80mm POS Slip</option>
                            <option value="a4">📄 A4 Invoice</option>
                            <option value="pad">📑 Letterhead Pad</option>
                            <option value="preview">👁️ Preview & Edit</option>
                          </select>
                        </div>

                        {/* View / Preview Invoice Modal */}
                        <button type="button" onClick={() => onOpenInvoiceModal(inv.id, 'invoice', { autoPrint: false })} className="w-6.5 h-6.5 p-1 flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-md border border-slate-200 transition-colors cursor-pointer" title="View Invoice">
                          <Eye className="w-3 h-3"/>
                        </button>

                        {/* Edit Invoice */}
                        <button type="button" onClick={() => {
                    setEditingInvoice(inv);
                    setEditInvoiceItems(inv.items || []);
                    setEditInvoiceRefNo(inv.referenceNo || '');
                    setEditInvoiceWarehouse(inv.warehouseLocation || 'Factory');
                    setInvoiceDiscountType(inv.discountType || 'amount');
                    setInvoiceDiscount(inv.discountValue !== undefined ? inv.discountValue : (inv.discount || 0));
                    setInvoiceVatType(inv.vatType || 'percent');
                    setInvoiceVatAmountInput(inv.vatValue !== undefined ? inv.vatValue : (inv.vatRate || 0));
                    setInvItemName('');
                    setInvItemQty(1);
                    setInvItemPrice(1000);
                    setInvSelectedProductId('');
                    setEditInvShowTypeColumn(inv.showTypeColumn ?? inv.items?.some(i => Boolean(i.type || i.itemType)) ?? false);
                    setEditInvShowRegionColumn(inv.showRegionColumn ?? inv.items?.some(i => Boolean(i.region)) ?? false);
                    setInvItemRegion('');
                    setInvItemType('');
                    const existingCustomTypes = (inv.items || [])
                        .map((i: any) => i.type || i.itemType)
                        .filter((t: any) => t && !PRESET_INVOICE_ITEM_TYPES.includes(t)) as string[];
                    setEditInvCustomTypes(Array.from(new Set(existingCustomTypes)));
                    setEditInvIsCustomType(false);
                }} className="w-6.5 h-6.5 p-1 flex items-center justify-center text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-md border border-slate-200 transition-colors cursor-pointer" title="Edit Invoice">
                          <Edit2 className="w-3 h-3"/>
                        </button>

                        {/* Delivery Challan */}
                        <button type="button" onClick={() => onOpenChallanModal(inv.id)} className="w-6.5 h-6.5 p-1 flex items-center justify-center text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-md border border-slate-200 transition-colors cursor-pointer" title="Generate Delivery Challan">
                          <Truck className="w-3 h-3"/>
                        </button>

                        {/* Create Project / View Linked Project (Unified COA) */}
                        {isLinkedToProject ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (pCode && pCode !== 'PRJ') {
                                try { sessionStorage.setItem('PROJECT_SEARCH_TERM', pCode); } catch {}
                              }
                              window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'projects' }));
                            }}
                            className="w-6.5 h-6.5 p-1 relative flex items-center justify-center text-amber-900 bg-amber-100 hover:bg-amber-200/90 rounded-md border border-amber-400 cursor-pointer transition-colors shadow-2xs"
                            title={`Linked to Project ${pCode} (Unified COA) - Click to view in Projects tab`}
                          >
                            <FolderKanban className="w-3 h-3 text-amber-700" />
                            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-600 rounded-full" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setProjectModalInvoice(inv);
                              const itemsCount = (inv.items || []).length;
                              const defaultProjectName = itemsCount > 1
                                ? `${inv.customerName} - Project (#${inv.invoiceNo})`
                                : (inv.items?.[0]?.name ? `${inv.customerName} - ${inv.items[0].name}` : `${inv.customerName} - Project`);
                              setProjectFormData({
                                name: defaultProjectName,
                                nameBn: '',
                                budget: Math.round((Number(inv.grandTotal) || 0) * 100) / 100,
                                status: 'In Progress',
                                startDate: inv.date || new Date().toISOString().split('T')[0],
                                endDate: '',
                                chartOfAccountId: inv.chartOfAccountId || 'coa-4051',
                                includeSalesItem: true,
                                notes: `Created against Invoice #${inv.invoiceNo}`,
                              });
                            }}
                            className="w-6.5 h-6.5 p-1 flex items-center justify-center text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-md border border-amber-300 transition-colors cursor-pointer shadow-2xs"
                            title="Create Project Against Invoice (Unified COA)"
                          >
                            <FolderKanban className="w-3 h-3" />
                          </button>
                        )}

                        {/* Delete Invoice */}
                        <button type="button" onClick={() => setInvoiceToDelete(inv)} className="w-6.5 h-6.5 p-1 flex items-center justify-center text-slate-700 hover:text-rose-600 hover:bg-rose-50 rounded-md border border-slate-200 transition-colors cursor-pointer" title="Delete Invoice">
                          <Trash2 className="w-3 h-3"/>
                        </button>

                        {/* Collect Payment */}
                        {inv.dueAmount > 0 && (<button type="button" onClick={() => {
                        setPaymentModalInvoice(inv);
                        setCollectAmount(inv.dueAmount);
                        setAdjustAdvanceAmount(0);
                    }} className="h-6.5 px-1.5 py-0.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-300 text-[10px] font-bold whitespace-nowrap cursor-pointer transition-colors" title="Collect Due Payment">
                            +Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

                {filteredInvoices.length === 0 && (<tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      {'No invoices found'}
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </div>)}

      {/* SUB-TAB 2: QUOTATIONS / ESTIMATES */}
      {activeSubTab === 'quotations' && (<div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {'Active Quotations & Estimates'}
              </h3>
              <p className="text-xs text-slate-500">
                {'Proposals sent to clients with one-click conversion to work order'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
                {quotations.length} {'Quotations'}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap">
                  <th className="py-2.5 px-3">QUOTE NO / VALIDITY</th>
                  <th className="py-2.5 px-3">CUSTOMER & COMPANY</th>
                  <th className="py-2.5 px-3">ITEMS & SPECS</th>
                  <th className="py-2.5 px-3 text-right">TOTAL QUOTE</th>
                  <th className="py-2.5 px-3 text-center">STATUS</th>
                  <th className="py-2.5 px-3 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotations.map((q) => (<tr key={q.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-nowrap text-xs sm:text-[13px]">
                        <span>{q.quoteNo}</span>
                        <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border ${q.quoteType === 'Custom'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                          {q.quoteType || 'Sales'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-1">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0"/>
                        <span>Valid until: {q.validUntil}</span>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 max-w-[170px]">
                      <div className="font-bold text-slate-900 truncate text-xs sm:text-[13px]" title={`${q.customerCompany ? `${q.customerCompany} - ` : ''}${q.customerName}`}>
                        {q.customerCompany ? `${q.customerCompany} - ` : ''}
                        {q.customerName}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate mt-1">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0"/>
                        <span className="truncate">{q.customerPhone}</span>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 max-w-[200px]">
                      <div className="font-medium text-slate-800 truncate text-xs sm:text-[12.5px]" title={`${q.items.map((i) => `${i.name} (x${i.qty} ${i.unit || ''})`).join(', ')}${q.notes ? ` • ${q.notes}` : ''}`}>
                        <span>{q.items.map((i) => `${i.name} (x${i.qty} ${i.unit || ''})`).join(', ')}</span>
                        {q.notes && (<span className="text-[11px] text-slate-500 italic ml-1 font-normal">
                            • {q.notes}
                          </span>)}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="font-black text-slate-900 text-xs sm:text-sm">
                        {profile.currencySymbol}
                        {(Number(q.grandTotal) || 0).toLocaleString()}
                      </div>
                      {q.discountValue || q.discount ? (<div className="text-[11px] text-slate-500 mt-0.5">
                          Disc: {profile.currencySymbol}{(Number(q.discountValue || q.discount) || 0).toLocaleString()}
                        </div>) : null}
                    </td>

                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <select value={q.status} onChange={(e) => updateQuotationStatus(q.id, e.target.value as any)} className={`text-[11px] font-bold px-2 py-0.5 rounded-md border cursor-pointer focus:outline-hidden transition-all h-6.5 ${q.status === 'Approved'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : q.status === 'Sent'
                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                        : q.status === 'Declined'
                            ? 'bg-rose-50 text-rose-700 border-rose-300'
                            : 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                        <option value="Sent">Pending / Sent</option>
                        <option value="Approved">Approved</option>
                        <option value="Declined">Declined</option>
                        <option value="Draft">Draft</option>
                      </select>
                      {q.status === 'Approved' && q.isConverted && (<div className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-600 mt-0.5">
                          <CheckCircle2 className="w-3 h-3"/>
                          <span>Converted</span>
                        </div>)}
                    </td>

                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                        {/* Compact Printer Dropdown */}
                        <div className="relative inline-flex items-center">
                          <button
                            type="button"
                            className="h-6.5 px-1.5 flex items-center gap-0.5 text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-md border border-amber-300 text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                            title="Quote print options (POS, A4, Pad, Preview)"
                          >
                            <Printer className="w-3 h-3 text-amber-700 shrink-0" />
                            <span className="text-[8px] text-amber-700">▾</span>
                          </button>
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              const val = e.target.value;
                              e.target.value = '';
                              if (val === 'pos') {
                                onOpenInvoiceModal(q.id, 'pos', { autoPrint: true });
                              } else if (val === 'a4') {
                                onOpenInvoiceModal(q.id, 'invoice', { autoPrint: true, isPadMode: false });
                              } else if (val === 'pad') {
                                onOpenInvoiceModal(q.id, 'invoice', { autoPrint: true, isPadMode: true });
                              } else if (val === 'preview') {
                                onOpenInvoiceModal(q.id, 'invoice', { autoPrint: false });
                              }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            title="Select quote print option"
                          >
                            <option value="" disabled>Print Options</option>
                            <option value="pos">🧾 80mm POS Slip</option>
                            <option value="a4">📄 A4 Quote</option>
                            <option value="pad">📑 Letterhead Pad</option>
                            <option value="preview">👁️ Quote Preview</option>
                          </select>
                        </div>

                        {/* View Preview */}
                        <button type="button" onClick={() => onOpenInvoiceModal(q.id, 'invoice', { autoPrint: false })} className="w-6.5 h-6.5 p-1 flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-md border border-slate-200 transition-colors cursor-pointer" title="View Quote Preview">
                          <Eye className="w-3 h-3"/>
                        </button>

                        {/* Edit Button if not converted to invoice */}
                        {!q.isConverted && (<button type="button" onClick={() => {
                        setEditingQuotation(q);
                        setQuoteCustomerName(q.customerName);
                        setQuoteCustomerPhone(q.customerPhone);
                        setQuoteCustomerCompany(q.customerCompany || '');
                        setQuoteCustomerAddress(q.customerAddress || '');
                        setQuoteReferenceNo(q.referenceNo || '');
                        setQuotePurchaseRequisition(q.purchaseRequisition || q.prNo || '');
                        setQuoteDate(q.date || new Date().toISOString().slice(0, 10));
                        setQuoteValidUntil(q.validUntil || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
                        setQuoteType(q.quoteType || 'Sales');
                        setQuoteItemName('');
                        setQuoteItemQty(1);
                        setQuoteItemPrice(1000);
                        setQuoteDiscount(q.discountValue !== undefined ? q.discountValue : (q.discount || 0));
                        setQuoteDiscountType(q.discountType || 'amount');
                        setQuoteVatType(q.vatType || 'percent');
                        setQuoteVatAmountInput(q.vatValue !== undefined ? q.vatValue : (q.vatRate || 0));
                        setQuoteNotes(q.notes || '');
                        setSelectedProductId('');
                        setAddedQuoteItems(q.items || []);
                        setQuoteShowRegionColumn(q.showRegionColumn ?? q.items?.some(i => Boolean(i.region)) ?? false);
                        setQuoteShowTypeColumn(q.showTypeColumn ?? q.items?.some(i => Boolean(i.type || i.itemType)) ?? false);
                        setQuoteItemRegion('');
                        setQuoteItemType('');
                        setShowNewQuoteModal(true);
                    }} className="w-6.5 h-6.5 p-1 flex items-center justify-center text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-md border border-slate-200 transition-colors cursor-pointer" title="Edit Quotation">
                            <Edit2 className="w-3 h-3"/>
                          </button>)}

                        {/* Convert to Invoice Button */}
                        {q.status === 'Approved' && !q.isConverted && (<button type="button" onClick={() => {
                        const inv = convertQuotationToInvoice(q.id);
                        if (inv) {
                            setActiveSubTab('invoices');
                            onOpenInvoiceModal(inv.id);
                        }
                    }} className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 h-6.5 rounded-md transition-colors cursor-pointer" title="Convert to Invoice">
                            <span>Convert</span>
                            <ArrowRight className="w-3 h-3"/>
                          </button>)}

                        {/* Delete Quotation Button */}
                        <button type="button" onClick={() => setQuotationToDelete(q)} className="w-6.5 h-6.5 p-1 flex items-center justify-center text-slate-700 hover:text-rose-600 hover:bg-rose-50 rounded-md border border-slate-200 transition-colors cursor-pointer" title="Delete Quotation">
                          <Trash2 className="w-3 h-3"/>
                        </button>
                      </div>
                    </td>
                  </tr>))}

                {quotations.length === 0 && (<tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      {'No quotations found'}
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </div>)}

      {/* SUB-TAB 3: CUSTOMER DIRECTORY */}
      {activeSubTab === 'customers' && (<div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm">
                {'Registered Clients'}
              </h3>
              <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                {filteredClients.length} {customerSearchQuery ? ` / ${customers.length}` : ''}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              {/* Search Customer Input */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                <input type="text" value={customerSearchQuery} onChange={(e) => setCustomerSearchQuery(e.target.value)} placeholder={'Search by name, phone, company...'} className="w-full pl-9 pr-8 py-1.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-amber-500 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500/20 transition-all"/>
                {customerSearchQuery && (<button type="button" onClick={() => setCustomerSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5">
                    <X className="w-3.5 h-3.5"/>
                  </button>)}
              </div>

              <button type="button" onClick={() => {
                const isPhone = /^[0-9+ -]+$/.test(customerSearchQuery.trim());
                setEditingCustomer(null);
                setCustomerFormData({
                    name: isPhone ? '' : customerSearchQuery.trim(),
                    company: '',
                    phone: isPhone ? customerSearchQuery.trim() : '',
                    email: '',
                    address: '',
                    advanceBalance: 0,
                });
                setShowCustomerModal(true);
            }} className="w-full sm:w-auto px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all flex-shrink-0">
                <Plus className="w-4 h-4"/>
                <span>{'Add New Client'}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Phone / Contact</th>
                  <th className="py-3 px-4">Address</th>
                  <th className="py-3 px-4 text-right">Advance Balance</th>
                  <th className="py-3 px-4 text-right">Total Sales</th>
                  <th className="py-3 px-4 text-right">Total Paid</th>
                  <th className="py-3 px-4 text-right">Current Due</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.length === 0 ? (<tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      <div className="max-w-xs mx-auto space-y-2">
                        <User className="w-8 h-8 mx-auto text-slate-300"/>
                        <p className="font-bold text-xs text-slate-700">
                          {`No clients found matching "${customerSearchQuery}"`}
                        </p>
                        <button type="button" onClick={() => {
                    const isPhone = /^[0-9+ -]+$/.test(customerSearchQuery.trim());
                    setEditingCustomer(null);
                    setCustomerFormData({
                        name: isPhone ? '' : customerSearchQuery.trim(),
                        company: '',
                        phone: isPhone ? customerSearchQuery.trim() : '',
                        email: '',
                        address: '',
                        advanceBalance: 0,
                    });
                    setShowCustomerModal(true);
                }} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 shadow-xs transition-colors">
                          <UserPlus className="w-3.5 h-3.5"/>
                          <span>
                            {`+ Add as New Client`}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>) : (filteredClients.map((c) => {
                    const { clientInvoices, totalPurchased, totalPaid, dueAmount } = getCustomerInvoiceSummary(c, invoices);
                    return (<tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{c.name}</div>
                        {c.company && (<div className="text-[11px] text-amber-700 font-semibold">{c.company}</div>)}
                        <span className="text-[10px] text-slate-400 font-medium">
                          {clientInvoices.length} {clientInvoices.length === 1 ? 'invoice' : 'invoices'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium font-mono">{c.phone || '—'}</td>
                      <td className="py-3 px-4 text-slate-500">{c.address || 'Chattogram'}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-black ${
                          c.advanceBalance && c.advanceBalance > 0
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs'
                            : 'text-slate-400 font-medium'
                        }`}>
                          {profile.currencySymbol}{(c.advanceBalance || 0).toLocaleString()}
                        </span>
                        {c.advanceBalance && c.advanceBalance > 0 && dueAmount > 0 && (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => {
                                const dueInv = clientInvoices.find(inv => inv.dueAmount > 0);
                                if (dueInv) {
                                  setPaymentModalInvoice(dueInv);
                                  const adv = Math.min(c.advanceBalance || 0, dueInv.dueAmount);
                                  setAdjustAdvanceAmount(adv);
                                  setCollectAmount(Math.max(0, dueInv.dueAmount - adv));
                                }
                              }}
                              className="text-[9.5px] font-black text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-0.5 whitespace-nowrap"
                              title="Adjust advance against customer due invoice"
                            >
                              <span>Adjust to Due</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {profile.currencySymbol}
                        {totalPurchased.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-700">
                        {profile.currencySymbol}
                        {totalPaid.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-black ${dueAmount > 0 ? 'text-rose-600 text-sm' : 'text-slate-400'}`}>
                          {profile.currencySymbol}
                          {dueAmount.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {c.advanceBalance && c.advanceBalance > 0 && dueAmount > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const dueInv = clientInvoices.find(inv => inv.dueAmount > 0);
                                if (dueInv) {
                                  setPaymentModalInvoice(dueInv);
                                  const adv = Math.min(c.advanceBalance || 0, dueInv.dueAmount);
                                  setAdjustAdvanceAmount(adv);
                                  setCollectAmount(Math.max(0, dueInv.dueAmount - adv));
                                }
                              }}
                              className="p-1.5 text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all inline-flex items-center justify-center cursor-pointer"
                              title="Adjust Advance Against Due"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button type="button" onClick={() => setSelectedCustomerHistory(c)} className="p-1.5 text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all inline-flex items-center justify-center cursor-pointer" title={'View Invoices & Payment Ledger'}>
                            <History className="w-3.5 h-3.5"/>
                          </button>
                          <button type="button" onClick={() => {
                    setEditingCustomer(c);
                    setCustomerFormData({
                        name: c.name,
                        company: c.company || '',
                        phone: c.phone,
                        email: c.email || '',
                        address: c.address || '',
                        advanceBalance: c.advanceBalance || 0,
                    });
                    setShowCustomerModal(true);
                }} className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all inline-flex items-center justify-center cursor-pointer" title={'Edit'}>
                            <Edit2 className="w-3.5 h-3.5"/>
                          </button>
                          <button type="button" onClick={() => setCustomerToDelete(c)} className="p-1.5 text-rose-600 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all inline-flex items-center justify-center cursor-pointer" title={'Delete'}>
                            <Trash2 className="w-3.5 h-3.5"/>
                          </button>
                        </div>
                      </td>
                    </tr>);
                  }))}
              </tbody>
            </table>
          </div>
        </div>)}

      {/* COLLECT DUE MODAL */}
      {/* COLLECT DUE MODAL */}
      {paymentModalInvoice && (() => {
        const modalPaymentHistory = getInvoicePayments(paymentModalInvoice, transactions, paymentMethods);
        const modalCustomer = customers.find(c => isInvoiceMatchingCustomer(paymentModalInvoice, c));
        const availableAdvance = Number(modalCustomer?.advanceBalance) || 0;
        const maxAdvanceCanUse = Math.min(availableAdvance, paymentModalInvoice.dueAmount);
        const remainingDueForChannel = Math.max(0, paymentModalInvoice.dueAmount - adjustAdvanceAmount);
        const totalSettling = (collectAmount || 0) + (adjustAdvanceAmount || 0);

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <form onSubmit={handleCollectSubmit} className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div>
                  <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-emerald-600" />
                    <span>Collect Due Payment</span>
                  </h3>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Invoice #{paymentModalInvoice.invoiceNo} • {paymentModalInvoice.date}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentModalInvoice(null);
                    setAdjustAdvanceAmount(0);
                    setCollectAmount(0);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto flex-1 pr-1 my-3 space-y-4 text-xs scrollbar-thin">
                {/* Customer & Invoice Financial Overview */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-extrabold text-slate-900 text-sm">
                        {paymentModalInvoice.customerName}
                      </div>
                      {paymentModalInvoice.customerPhone && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{paymentModalInvoice.customerPhone}</span>
                        </div>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                      paymentModalInvoice.paymentStatus === 'Paid'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {paymentModalInvoice.paymentStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/70 text-center">
                    <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Invoice</div>
                      <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5">
                        {profile.currencySymbol}{(Number(paymentModalInvoice.grandTotal) || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                      <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Total Paid</div>
                      <div className="text-xs sm:text-sm font-black text-emerald-700 mt-0.5">
                        {profile.currencySymbol}{(Number(paymentModalInvoice.paidAmount) || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-rose-200/70 bg-rose-50/30">
                      <div className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">Current Due</div>
                      <div className="text-xs sm:text-sm font-black text-rose-600 mt-0.5">
                        {profile.currencySymbol}{(Number(paymentModalInvoice.dueAmount) || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prior Payments Breakdown / Channels Used */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                      <History className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Payment History ({modalPaymentHistory.length} receipts)</span>
                    </div>
                    <span className="text-[10.5px] font-semibold text-slate-500">
                      Paid: {profile.currencySymbol}{(Number(paymentModalInvoice.paidAmount) || 0).toLocaleString()}
                    </span>
                  </div>

                  {modalPaymentHistory.length === 0 ? (
                    <div className="p-3 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                      No prior payments received for this invoice.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 scrollbar-thin">
                      {modalPaymentHistory.map((item, idx) => (
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
                            +{profile.currencySymbol}{(Number(item.amount) || 0).toLocaleString()}
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
                            setCollectAmount(Math.max(0, paymentModalInvoice.dueAmount - maxAdvanceCanUse));
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
                              setCollectAmount(paymentModalInvoice.dueAmount);
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
                          if ((collectAmount || 0) + val > paymentModalInvoice.dueAmount) {
                            setCollectAmount(Math.max(0, paymentModalInvoice.dueAmount - val));
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
                          setCollectAmount(Math.max(0, paymentModalInvoice.dueAmount - maxAdvanceCanUse));
                        } else {
                          setCollectAmount(remainingDueForChannel);
                        }
                      }}
                      className="text-[10.5px] font-extrabold text-amber-700 hover:text-amber-800 underline cursor-pointer"
                    >
                      {adjustAdvanceAmount > 0
                        ? `Collect Remaining (${profile.currencySymbol}${(Number(remainingDueForChannel) || 0).toLocaleString()})`
                        : `Collect Full Due (${profile.currencySymbol}${(Number(paymentModalInvoice.dueAmount) || 0).toLocaleString()})`}
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
                      value={collectAmount === 0 && adjustAdvanceAmount > 0 ? 0 : (collectAmount || '')}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setCollectAmount(Math.min(remainingDueForChannel, val));
                      }}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-black text-base text-emerald-700 bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700 block">
                        {'Deposit Into Payment Channel *'}
                      </label>
                      {(() => {
                        const selectedPm = activePaymentMethods.find(p => p.name === collectMethod || p.id === collectMethod) || activePaymentMethods[0];
                        if (!selectedPm) return null;
                        const bal = getPaymentMethodLiveBalance(selectedPm, chartOfAccounts, transactions, invoices, accountBalances);
                        return (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Live: {profile.currencySymbol}{bal.toLocaleString()}
                          </span>
                        );
                      })()}
                    </div>
                    <select
                      value={collectMethod}
                      onChange={(e) => setCollectMethod(e.target.value)}
                      disabled={collectAmount <= 0 && adjustAdvanceAmount > 0}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium text-xs bg-white cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {activePaymentMethods.map((pm) => {
                        const bal = getPaymentMethodLiveBalance(pm, chartOfAccounts, transactions, invoices, accountBalances);
                        return (
                          <option key={pm.id} value={pm.name}>
                            {pm.name} {pm.nameBn ? `(${pm.nameBn})` : ''} — [{profile.currencySymbol}{bal.toLocaleString()}]
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Settlement Summary Breakdown */}
                  <div className="bg-white p-2.5 rounded-lg border border-amber-200/60 text-xs space-y-1">
                    {adjustAdvanceAmount > 0 && (
                      <div className="flex justify-between text-indigo-700 font-bold">
                        <span>Advance Adjusted:</span>
                        <span>+{profile.currencySymbol}{adjustAdvanceAmount.toLocaleString()}</span>
                      </div>
                    )}
                    {collectAmount > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Channel Collection ({collectMethod}):</span>
                        <span>+{profile.currencySymbol}{collectAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-900 font-black pt-1 border-t border-slate-100">
                      <span>Total Payment Applied:</span>
                      <span className="text-emerald-700">+{profile.currencySymbol}{totalSettling.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 font-semibold text-[11px]">
                      <span>Remaining Due After Settlement:</span>
                      <span className={(Number(paymentModalInvoice.dueAmount) || 0) - totalSettling > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                        {profile.currencySymbol}{Math.max(0, (Number(paymentModalInvoice.dueAmount) || 0) - totalSettling).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentModalInvoice(null);
                    setAdjustAdvanceAmount(0);
                    setCollectAmount(0);
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  {'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={totalSettling <= 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer transition-colors"
                >
                  {adjustAdvanceAmount > 0 && collectAmount <= 0
                    ? `Confirm Advance Adjustment (${profile.currencySymbol}${adjustAdvanceAmount.toLocaleString()})`
                    : adjustAdvanceAmount > 0 && collectAmount > 0
                    ? `Confirm Collection & Adjustment`
                    : 'Confirm Collection'}
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* EDIT INVOICE MODAL */}
      {editingInvoice && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleEditInvoiceSubmit} className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] md:max-h-[85vh] flex flex-col p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-shrink-0">
              <h3 className="font-bold text-slate-900 text-base">
                {'Edit Invoice'}
              </h3>
              <button type="button" onClick={() => {
                setEditingInvoice(null);
                setEditInvoiceItems([]);
                setInvItemName('');
                setInvSelectedProductId('');
                setInvItemQty(1);
                setInvItemPrice(1000);
                setInvoiceDiscount(0);
            }} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs overflow-y-auto flex-1 pr-1.5 my-3 scrollbar-thin scrollbar-thumb-slate-200">
              {/* Reference & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Reference / PO No.'}
                  </label>
                  <input type="text" value={editInvoiceRefNo} onChange={(e) => setEditInvoiceRefNo(e.target.value)} placeholder="e.g. PO-889, REF-2024" className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-bold bg-white"/>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Branch / Location'}
                  </label>
                  <select value={editInvoiceWarehouse} onChange={(e) => setEditInvoiceWarehouse(e.target.value as any)} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-bold bg-white">
                    <option value="Office">Central Warehouse</option>
                  </select>
                </div>
              </div>

              {/* Optional Columns Banner */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 flex flex-wrap items-center gap-3">
                <span className="text-amber-900 font-extrabold text-xs tracking-wide uppercase">
                  OPTIONAL COLUMNS OPTION:
                </span>
                <label className="bg-white px-3 py-1.5 rounded-lg border border-amber-200/80 shadow-2xs flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 hover:border-amber-400 transition-colors select-none">
                  <input
                    type="checkbox"
                    checked={editInvShowTypeColumn}
                    onChange={(e) => setEditInvShowTypeColumn(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                  />
                  <span>Show Type Column</span>
                </label>
                <label className="bg-white px-3 py-1.5 rounded-lg border border-amber-200/80 shadow-2xs flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 hover:border-amber-400 transition-colors select-none">
                  <input
                    type="checkbox"
                    checked={editInvShowRegionColumn}
                    onChange={(e) => setEditInvShowRegionColumn(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                  />
                  <span>Show Region Column</span>
                </label>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-3">
                <div className="font-bold text-slate-800 border-b border-slate-200 pb-1 flex justify-between items-center">
                  <span>{'Add Item Row'}</span>
                  <span className="text-[10px] text-slate-400 font-medium">{'Click Add Row below to save to list'}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className={editInvShowRegionColumn && editInvShowTypeColumn ? "sm:col-span-4" : (editInvShowRegionColumn || editInvShowTypeColumn ? "sm:col-span-5" : "sm:col-span-6")}>
                    <label className="font-bold text-slate-600 block mb-1">
                      {'Service / Item Description *'}
                    </label>
                    <div className="flex gap-2">
                      <select value={invSelectedProductId} onChange={(e) => {
                const prodId = e.target.value;
                setInvSelectedProductId(prodId);
                const prod = products.find((p) => p.id === prodId);
                if (prod) {
                    setInvItemName(prod.name);
                    setInvItemPrice(prod.unitPrice);
                }
                else {
                    setInvItemName('');
                }
            }} className="w-1/2 px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-bold">
                        <option value="">{'-- Select Item --'}</option>
                        {(products || []).filter(p => !p.isRawMaterial).map((prod) => (<option key={prod.id} value={prod.id}>
                            {prod.name}
                          </option>))}
                      </select>
                      <input type="text" value={invItemName} onChange={(e) => setInvItemName(e.target.value)} placeholder={'Manual description...'} className="w-1/2 px-3 py-1.5 border border-slate-200 rounded-lg bg-white"/>
                    </div>
                  </div>

                  {editInvShowTypeColumn && (
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-600">
                          {'Type'}
                        </label>
                        {editInvIsCustomType && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditInvIsCustomType(false);
                              setInvItemType('');
                            }}
                            className="text-[10px] text-amber-600 hover:text-amber-700 font-bold underline cursor-pointer"
                          >
                            List
                          </button>
                        )}
                      </div>
                      {editInvIsCustomType ? (
                        <div className="relative">
                          <input
                            type="text"
                            value={invItemType}
                            onChange={(e) => setInvItemType(e.target.value)}
                            placeholder="Enter custom type..."
                            autoFocus
                            className="w-full px-3 py-1.5 pr-7 border border-amber-300 rounded-lg bg-white font-medium focus:ring-1 focus:ring-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEditInvIsCustomType(false);
                              setInvItemType('');
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold cursor-pointer text-xs"
                            title="Cancel custom"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <select
                          value={invItemType}
                          onChange={(e) => {
                            if (e.target.value === '__custom__') {
                              setEditInvIsCustomType(true);
                              setInvItemType('');
                            } else {
                              setInvItemType(e.target.value);
                            }
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-bold"
                        >
                          <option value="">{'-- Select Type --'}</option>
                          {PRESET_INVOICE_ITEM_TYPES.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                          {editInvCustomTypes.map((ct) => (
                            <option key={ct} value={ct}>
                              {ct}
                            </option>
                          ))}
                          <option value="__custom__">{'+ Custom Type...'}</option>
                        </select>
                      )}
                    </div>
                  )}

                  {editInvShowRegionColumn && (
                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-600 block mb-1">
                        {'Region'}
                      </label>
                      <input
                        type="text"
                        value={invItemRegion}
                        onChange={(e) => setInvItemRegion(e.target.value)}
                        placeholder="e.g. Dhaka, Chittagong"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-medium"
                      />
                    </div>
                  )}

                  <div className={editInvShowRegionColumn && editInvShowTypeColumn ? "sm:col-span-4 grid grid-cols-2 gap-2" : (editInvShowRegionColumn || editInvShowTypeColumn ? "sm:col-span-5 grid grid-cols-2 gap-2" : "sm:col-span-6 grid grid-cols-2 gap-2")}>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">
                        {'Quantity'}
                      </label>
                      <input type="number" step="any" min="1" value={invItemQty} onChange={(e) => setInvItemQty(Math.max(1, Number(e.target.value)))} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-bold bg-white"/>
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">
                        {"Unit RateTk"}
                      </label>
                      <input type="number" step="any" min="1" value={invItemPrice} onChange={(e) => setInvItemPrice(Math.max(1, Number(e.target.value)))} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-bold bg-white"/>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="button" onClick={() => {
                if (!invItemName.trim()) {
                    alert('Please enter or select item name!');
                    return;
                }
                const subTotal = invItemQty * invItemPrice;
                const newItem = {
                    productId: invSelectedProductId || `custom-${Date.now()}`,
                    name: invItemName.trim(),
                    region: editInvShowRegionColumn && invItemRegion.trim() ? invItemRegion.trim() : undefined,
                    type: editInvShowTypeColumn && invItemType.trim() ? invItemType.trim() : undefined,
                    itemType: editInvShowTypeColumn && invItemType.trim() ? invItemType.trim() : undefined,
                    unit: 'pcs',
                    unitPrice: invItemPrice,
                    costPrice: Math.round(invItemPrice * 0.6),
                    qty: invItemQty,
                    totalPrice: subTotal,
                };
                setEditInvoiceItems([...editInvoiceItems, newItem]);
                if (invItemType.trim() && !PRESET_INVOICE_ITEM_TYPES.includes(invItemType.trim() as any) && !editInvCustomTypes.includes(invItemType.trim())) {
                    setEditInvCustomTypes(prev => [...prev, invItemType.trim()]);
                }
                setInvItemName('');
                setInvItemRegion('');
                setInvItemType('');
                setEditInvIsCustomType(false);
                setInvSelectedProductId('');
                setInvItemQty(1);
                setInvItemPrice(1000);
            }} className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors cursor-pointer">
                    <Plus className="w-3.5 h-3.5"/>
                    <span>{'Add Row'}</span>
                  </button>
                </div>
              </div>

              {/* Added Items Table */}
              {editInvoiceItems.length > 0 && (<div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-700 border-b border-slate-200">
                    {'Added Items List'}
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px]">
                          <th className="p-2 text-center w-10">SL</th>
                          <th className="p-2">{'Description'}</th>
                          {editInvShowTypeColumn && <th className="p-2 text-center w-24">{'Type'}</th>}
                          {editInvShowRegionColumn && <th className="p-2 text-center w-24">{'Region'}</th>}
                          <th className="p-2 text-center w-28">{'Qty'}</th>
                          <th className="p-2 text-right w-32">{"RateTk"}</th>
                          <th className="p-2 text-right w-28">{"TotalTk"}</th>
                          <th className="p-2 text-center w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {editInvoiceItems.map((item, idx) => (<tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2 text-center text-slate-400">{idx + 1}</td>
                            <td className="p-2 font-semibold text-slate-800">{item.name}</td>
                            {editInvShowTypeColumn && (
                              <td className="p-2 text-center font-medium text-slate-700 text-xs">
                                {item.type || item.itemType || '-'}
                              </td>
                            )}
                            {editInvShowRegionColumn && (
                              <td className="p-2 text-center font-medium text-slate-700 text-xs">
                                {item.region || '-'}
                              </td>
                            )}
                            <td className="p-1.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <input type="number" step="any" min="1" value={item.qty} onChange={(e) => handleUpdateEditInvoiceItemRow(idx, 'qty', Math.max(1, Number(e.target.value)))} className="w-16 px-1.5 py-1 text-center font-bold text-slate-800 bg-white border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-slate-900"/>
                                <span className="text-[10px] text-slate-500 font-medium">{item.unit || 'pcs'}</span>
                              </div>
                            </td>
                            <td className="p-1.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-slate-400 font-semibold text-xs">Tk</span>
                                <input type="number" step="any" min="0" value={item.unitPrice} onChange={(e) => handleUpdateEditInvoiceItemRow(idx, 'unitPrice', Math.max(0, Number(e.target.value)))} className="w-20 px-1.5 py-1 text-right font-bold text-slate-800 bg-white border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-slate-900"/>
                              </div>
                            </td>
                            <td className="p-2 text-right font-bold text-slate-900">Tk{(Number(item.totalPrice) || 0).toLocaleString()}</td>
                            <td className="p-2 text-center">
                              <button type="button" onClick={() => {
                        setEditInvoiceItems(editInvoiceItems.filter((_, i) => i !== idx));
                    }} className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer">
                                <Trash2 className="w-3.5 h-3.5"/>
                              </button>
                            </td>
                          </tr>))}
                      </tbody>
                    </table>
                  </div>
                </div>)}

              {/* Discount & VAT / Tax with Toggle */}
              {(() => {
                const sub = editInvoiceItems.reduce((acc, item) => acc + item.totalPrice, 0);
                const effectiveDiscount = invoiceDiscountType === 'percent'
                    ? Math.round((sub * Math.min(100, Math.max(0, invoiceDiscount))) / 100)
                    : Math.min(sub, Math.max(0, invoiceDiscount));
                const taxable = Math.max(0, sub - effectiveDiscount);
                const effectiveVat = invoiceVatType === 'percent'
                    ? Math.round((taxable * Math.min(100, Math.max(0, invoiceVatAmountInput))) / 100)
                    : Math.max(0, invoiceVatAmountInput);
                const grand = Math.max(0, taxable + effectiveVat);
                return (<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Controls */}
                    <div className="space-y-2">
                      {/* Discount Control */}
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-700 text-xs">
                            {'Discount'}
                          </label>
                          <div className="flex items-center gap-1.5">
                            <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white">
                              <button type="button" onClick={() => setInvoiceDiscountType('amount')} className={`px-2 py-0.5 text-[10px] font-black ${invoiceDiscountType === 'amount'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:text-slate-800'}`}>Tk</button>
                              <button type="button" onClick={() => setInvoiceDiscountType('percent')} className={`px-2 py-0.5 text-[10px] font-black ${invoiceDiscountType === 'percent'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:text-slate-800'}`}>
                                %
                              </button>
                            </div>
                            <input type="number" step="any" min="0" value={invoiceDiscount} onChange={(e) => setInvoiceDiscount(Math.max(0, Number(e.target.value)))} className="w-24 text-right px-2 py-1 border border-slate-200 rounded-lg font-bold text-xs bg-white"/>
                          </div>
                        </div>
                      </div>

                      {/* VAT / Tax Control (Like Discount) */}
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-700 text-xs">
                            {'VAT / Tax'}
                          </label>
                          <div className="flex items-center gap-1.5">
                            <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white">
                              <button type="button" onClick={() => setInvoiceVatType('amount')} className={`px-2 py-0.5 text-[10px] font-black ${invoiceVatType === 'amount'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:text-slate-800'}`}>Tk</button>
                              <button type="button" onClick={() => setInvoiceVatType('percent')} className={`px-2 py-0.5 text-[10px] font-black ${invoiceVatType === 'percent'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:text-slate-800'}`}>
                                %
                              </button>
                            </div>
                            <input type="number" step="any" min="0" value={invoiceVatAmountInput} onChange={(e) => setInvoiceVatAmountInput(Math.max(0, Number(e.target.value)))} className="w-24 text-right px-2 py-1 border border-slate-200 rounded-lg font-bold text-xs bg-white"/>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Summary box */}
                    <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80 flex flex-col justify-center space-y-1">
                      <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                        <span>{'Subtotal:'}</span>
                        <span>{profile.currencySymbol}{sub.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                        <span>{'Discount:'}</span>
                        <span>-{profile.currencySymbol}{effectiveDiscount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                        <span>{'VAT / Tax:'}</span>
                        <span>+{profile.currencySymbol}{effectiveVat.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center font-black text-slate-900 pt-1 border-t border-amber-200/50">
                        <span>{'Grand Total:'}</span>
                        <span className="text-amber-600 text-sm">
                          {profile.currencySymbol}{grand.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>);
            })()}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-2 flex-shrink-0">
              <button type="button" onClick={() => {
                setEditingInvoice(null);
                setEditInvoiceItems([]);
                setInvItemName('');
                setInvSelectedProductId('');
                setInvItemQty(1);
                setInvItemPrice(1000);
                setInvoiceDiscount(0);
            }} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                {'Cancel'}
              </button>
              <button type="submit" className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer">
                {'Update Invoice'}
              </button>
            </div>
          </form>
        </div>)}

      {/* CREATE QUOTATION MODAL */}
      {showNewQuoteModal && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateQuote} className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] md:max-h-[85vh] flex flex-col p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-shrink-0">
              <h3 className="font-bold text-slate-900 text-base">
                {editingQuotation
                ? ('Edit Quotation')
                : ('Create New Quotation')}
              </h3>
              <button type="button" onClick={() => {
                setShowNewQuoteModal(false);
                setEditingQuotation(null);
                setAddedQuoteItems([]);
                setQuoteType('Sales');
                setSelectedProductId('');
                setQuoteCustomerName('');
                setQuoteCustomerPhone('');
                setQuoteCustomerCompany('');
                setQuoteCustomerAddress('');
                setQuoteReferenceNo('');
                setQuotePurchaseRequisition('');
                setQuoteDate(new Date().toISOString().slice(0, 10));
                setQuoteValidUntil(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
                setQuoteItemName('');
                setQuoteItemRegion('');
                setQuoteItemType('');
                setQuoteShowRegionColumn(false);
                setQuoteShowTypeColumn(false);
                setQuoteDiscount(0);
                setQuoteNotes('');
            }} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs overflow-y-auto flex-1 pr-1.5 my-3 scrollbar-thin scrollbar-thumb-slate-200">
              {/* Quick Customer Search & Select for Quotation */}
              <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/80 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-amber-600"/>
                    <span>
                      {'Quick Search Existing Customer (Name / Phone)'}
                    </span>
                  </label>
                  <span className="text-[10px] text-amber-800 bg-amber-100 font-bold px-1.5 py-0.5 rounded">
                    {'Auto-fill'}
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                  <input type="text" value={quoteCustomerSearch} onChange={(e) => {
                setQuoteCustomerSearch(e.target.value);
                setIsQuoteCustomerDropdownOpen(true);
            }} onFocus={() => setIsQuoteCustomerDropdownOpen(true)} placeholder={'Type existing customer name or phone to auto-fill...'} className="w-full pl-8 pr-7 py-1.5 bg-white border border-amber-300/90 focus:border-amber-500 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500/20"/>
                  {quoteCustomerSearch && (<button type="button" onClick={() => {
                    setQuoteCustomerSearch('');
                    setIsQuoteCustomerDropdownOpen(false);
                }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5">
                      <X className="w-3.5 h-3.5"/>
                    </button>)}

                  {/* Dropdown with matching customers */}
                  {isQuoteCustomerDropdownOpen && quoteCustomerSearch.trim() && (<>
                      <div className="fixed inset-0 z-20" onClick={() => setIsQuoteCustomerDropdownOpen(false)}/>
                      <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {filteredQuoteCustomers.length > 0 ? (filteredQuoteCustomers.map((c) => (<button key={c.id} type="button" onClick={() => {
                        setQuoteCustomerName(c.name);
                        setQuoteCustomerPhone(c.phone || '');
                        setQuoteCustomerCompany(c.company || '');
                        setQuoteCustomerAddress(c.address || '');
                        setQuoteCustomerSearch('');
                        setIsQuoteCustomerDropdownOpen(false);
                    }} className="w-full text-left p-2.5 hover:bg-amber-50/80 transition-colors flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs text-slate-900 font-bold truncate">
                                  {c.name} {c.company ? `(${c.company})` : ''}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{c.phone}</div>
                              </div>
                              <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-bold flex-shrink-0">
                                {'Select'}
                              </span>
                            </button>))) : (<div className="p-3 text-center text-xs text-slate-500">
                            {'No matching customer found. Type manually below.'}
                          </div>)}
                      </div>
                    </>)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Client Name *'}
                  </label>
                  <input type="text" required value={quoteCustomerName} onChange={(e) => setQuoteCustomerName(e.target.value)} placeholder="e.g. Sajib khan" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Phone'}
                  </label>
                  <input type="tel" value={quoteCustomerPhone} onChange={(e) => setQuoteCustomerPhone(e.target.value)} placeholder="01730-581687" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Company'}
                  </label>
                  <input type="text" value={quoteCustomerCompany} onChange={(e) => setQuoteCustomerCompany(e.target.value)} placeholder="e.g. Apex Apparel / Karnaphuli Group" className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium"/>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Delivery / Customer Address'}
                  </label>
                  <input type="text" value={quoteCustomerAddress} onChange={(e) => setQuoteCustomerAddress(e.target.value)} placeholder="e.g. Baizid Bostami I/A, Chattogram, Bangladesh" className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium"/>
                </div>
              </div>

              {/* Reference Number, PR, Dates Row (Matching Direct Sales Invoice layout) */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200/60">
                {/* 1. Purchase Requisition (PR) */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1 flex items-center justify-between">
                    <span>{'Reference / PR No.'}</span>
                  </label>
                  <input
                    type="text"
                    value={quotePurchaseRequisition}
                    onChange={(e) => setQuotePurchaseRequisition(e.target.value)}
                    placeholder={'e.g. PR-8901, REQ-102'}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs focus:ring-1 focus:ring-indigo-500/30"
                  />
                </div>

                {/* 2. Reference / PO No. */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1 flex items-center justify-between">
                    <span>{'Reference / PO No.'}</span>
                    <span className="text-[10px] text-amber-700 font-extrabold bg-amber-100/70 px-1.5 rounded">Ref</span>
                  </label>
                  <input
                    type="text"
                    value={quoteReferenceNo}
                    onChange={(e) => setQuoteReferenceNo(e.target.value)}
                    placeholder={'e.g. PO-8901, REF-102'}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs focus:ring-1 focus:ring-amber-500/30"
                  />
                </div>

                {/* 3. Quotation Date */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Quotation Date'}
                  </label>
                  <input
                    type="date"
                    value={quoteDate}
                    onChange={(e) => setQuoteDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-xs"
                  />
                </div>

                {/* 4. Valid Until */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1 flex items-center justify-between">
                    <span>{'Valid Until'}</span>
                    <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-1.5 rounded">Expiry</span>
                  </label>
                  <input
                    type="date"
                    value={quoteValidUntil}
                    onChange={(e) => setQuoteValidUntil(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-xs"
                  />
                </div>
              </div>

              {/* Quotation Type Selection */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Quotation Type *'}
                </label>
                <div className="flex gap-4 p-2 bg-slate-50 border border-slate-200/80 rounded-xl">
                  <label className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer font-bold transition-all text-slate-700">
                    <input type="radio" name="quoteType" value="Sales" checked={quoteType === 'Sales'} onChange={() => {
                setQuoteType('Sales');
                setSelectedProductId('');
                setQuoteItemName('');
            }} className="accent-amber-600 cursor-pointer"/>
                    <span>{'Sales & Service'}</span>
                  </label>
                  <label className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer font-bold transition-all text-slate-700">
                    <input type="radio" name="quoteType" value="Custom" checked={quoteType === 'Custom'} onChange={() => {
                setQuoteType('Custom');
                setSelectedProductId('');
                setQuoteItemName('');
            }} className="accent-amber-600 cursor-pointer"/>
                    <span>{'Custom Quotation'}</span>
                  </label>
                </div>
              </div>

              {/* Optional Columns Banner */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 flex flex-wrap items-center gap-3">
                <span className="text-amber-900 font-extrabold text-xs tracking-wide uppercase">
                  OPTIONAL COLUMNS OPTION:
                </span>
                <label className="bg-white px-3 py-1.5 rounded-lg border border-amber-200/80 shadow-2xs flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 hover:border-amber-400 transition-colors select-none">
                  <input
                    type="checkbox"
                    checked={quoteShowTypeColumn}
                    onChange={(e) => setQuoteShowTypeColumn(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                  />
                  <span>Show Type Column</span>
                </label>
                <label className="bg-white px-3 py-1.5 rounded-lg border border-amber-200/80 shadow-2xs flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 hover:border-amber-400 transition-colors select-none">
                  <input
                    type="checkbox"
                    checked={quoteShowRegionColumn}
                    onChange={(e) => setQuoteShowRegionColumn(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                  />
                  <span>Show Region Column</span>
                </label>
              </div>

              {/* Service / Item Description Field */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-3">
                <div className="font-bold text-slate-800 border-b border-slate-200 pb-1 flex justify-between items-center">
                  <span>{'Add Item Row'}</span>
                  <span className="text-[10px] text-slate-400 font-medium">{'Click Add Row below to save to list'}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className={quoteShowRegionColumn && quoteShowTypeColumn ? "sm:col-span-4" : (quoteShowRegionColumn || quoteShowTypeColumn ? "sm:col-span-5" : "sm:col-span-6")}>
                    <label className="font-bold text-slate-600 block mb-1">
                      {'Service / Item Description *'}
                    </label>
                    {quoteType === 'Custom' ? (<input type="text" value={quoteItemName} onChange={(e) => setQuoteItemName(e.target.value)} placeholder={'Enter any custom description...'} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-medium"/>) : (<select value={selectedProductId} onChange={(e) => {
                    const prodId = e.target.value;
                    setSelectedProductId(prodId);
                    const prod = products.find((p) => p.id === prodId);
                    if (prod) {
                        setQuoteItemName(prod.name);
                        setQuoteItemPrice(prod.unitPrice);
                    }
                    else {
                        setQuoteItemName('');
                    }
                }} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-bold">
                        <option value="">{'-- Select Item --'}</option>
                        {(products || []).filter(p => !p.isRawMaterial).map((prod) => (<option key={prod.id} value={prod.id}>
                            {prod.name}
                          </option>))}
                      </select>)}
                  </div>

                  {quoteShowTypeColumn && (
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-600">
                          {'Type'}
                        </label>
                        {quoteIsCustomType && (
                          <button
                            type="button"
                            onClick={() => {
                              setQuoteIsCustomType(false);
                              setQuoteItemType('');
                            }}
                            className="text-[10px] text-amber-600 hover:text-amber-700 font-bold underline cursor-pointer"
                          >
                            List
                          </button>
                        )}
                      </div>
                      {quoteIsCustomType ? (
                        <div className="relative">
                          <input
                            type="text"
                            value={quoteItemType}
                            onChange={(e) => setQuoteItemType(e.target.value)}
                            placeholder="Enter custom type..."
                            autoFocus
                            className="w-full px-3 py-1.5 pr-7 border border-amber-300 rounded-lg bg-white font-medium focus:ring-1 focus:ring-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setQuoteIsCustomType(false);
                              setQuoteItemType('');
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold cursor-pointer text-xs"
                            title="Cancel custom"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <select
                          value={quoteItemType}
                          onChange={(e) => {
                            if (e.target.value === '__custom__') {
                              setQuoteIsCustomType(true);
                              setQuoteItemType('');
                            } else {
                              setQuoteItemType(e.target.value);
                            }
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-bold"
                        >
                          <option value="">{'-- Select Type --'}</option>
                          {PRESET_INVOICE_ITEM_TYPES.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                          {quoteCustomTypes.map((ct) => (
                            <option key={ct} value={ct}>
                              {ct}
                            </option>
                          ))}
                          <option value="__custom__">{'+ Custom Type...'}</option>
                        </select>
                      )}
                    </div>
                  )}

                  {quoteShowRegionColumn && (
                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-600 block mb-1">
                        {'Region'}
                      </label>
                      <input
                        type="text"
                        value={quoteItemRegion}
                        onChange={(e) => setQuoteItemRegion(e.target.value)}
                        placeholder="e.g. Dhaka, Chittagong"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-medium"
                      />
                    </div>
                  )}

                  <div className={quoteShowRegionColumn && quoteShowTypeColumn ? "sm:col-span-4 grid grid-cols-2 gap-2" : (quoteShowRegionColumn || quoteShowTypeColumn ? "sm:col-span-5 grid grid-cols-2 gap-2" : "sm:col-span-6 grid grid-cols-2 gap-2")}>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">
                        {'Quantity'}
                      </label>
                      <input type="number" step="any" min="1" value={quoteItemQty} onChange={(e) => setQuoteItemQty(Math.max(1, Number(e.target.value)))} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-bold bg-white"/>
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">
                        {"Unit RateTk"}
                      </label>
                      <input type="number" step="any" min="1" value={quoteItemPrice} onChange={(e) => setQuoteItemPrice(Math.max(1, Number(e.target.value)))} className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-bold bg-white"/>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="button" onClick={() => {
                if (!quoteItemName.trim()) {
                    alert('Please enter or select item name!');
                    return;
                }
                const subTotal = quoteItemQty * quoteItemPrice;
                const newItem = {
                    productId: selectedProductId || `custom-${Date.now()}`,
                    name: quoteItemName.trim(),
                    category: 'BRANDED PROMOTIONAL GIFTS',
                    region: quoteShowRegionColumn && quoteItemRegion.trim() ? quoteItemRegion.trim() : undefined,
                    type: quoteShowTypeColumn && quoteItemType.trim() ? quoteItemType.trim() : undefined,
                    itemType: quoteShowTypeColumn && quoteItemType.trim() ? quoteItemType.trim() : undefined,
                    unit: 'pcs',
                    unitPrice: quoteItemPrice,
                    costPrice: Math.round(quoteItemPrice * 0.6),
                    qty: quoteItemQty,
                    totalPrice: subTotal,
                };
                setAddedQuoteItems([...addedQuoteItems, newItem]);
                if (quoteItemType.trim() && !PRESET_INVOICE_ITEM_TYPES.includes(quoteItemType.trim() as any) && !quoteCustomTypes.includes(quoteItemType.trim())) {
                    setQuoteCustomTypes(prev => [...prev, quoteItemType.trim()]);
                }
                setQuoteItemName('');
                setQuoteItemRegion('');
                setQuoteItemType('');
                setQuoteIsCustomType(false);
                setSelectedProductId('');
                setQuoteItemQty(1);
                setQuoteItemPrice(1000);
            }} className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors cursor-pointer">
                    <Plus className="w-3.5 h-3.5"/>
                    <span>{'Add Row'}</span>
                  </button>
                </div>
              </div>

              {/* Added Items Table */}
              {addedQuoteItems.length > 0 && (<div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-700 border-b border-slate-200">
                    {'Added Items List'}
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px]">
                          <th className="p-2 text-center w-10">SL</th>
                          <th className="p-2">{'Description'}</th>
                          {quoteShowTypeColumn && <th className="p-2 text-center w-24">{'Type'}</th>}
                          {quoteShowRegionColumn && <th className="p-2 text-center w-24">{'Region'}</th>}
                          <th className="p-2 text-center w-28">{'Qty'}</th>
                          <th className="p-2 text-right w-32">{"RateTk"}</th>
                          <th className="p-2 text-right w-28">{"TotalTk"}</th>
                          <th className="p-2 text-center w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {addedQuoteItems.map((item, idx) => (<tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2 text-center text-slate-400">{idx + 1}</td>
                            <td className="p-2 font-semibold text-slate-800">{item.name}</td>
                            {quoteShowTypeColumn && (
                              <td className="p-2 text-center font-medium text-slate-700 text-xs">
                                {item.type || item.itemType || '-'}
                              </td>
                            )}
                            {quoteShowRegionColumn && (
                              <td className="p-2 text-center font-medium text-slate-700 text-xs">
                                {item.region || '-'}
                              </td>
                            )}
                            <td className="p-1.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <input type="number" step="any" min="1" value={item.qty} onChange={(e) => handleUpdateQuoteItemRow(idx, 'qty', Math.max(1, Number(e.target.value)))} className="w-16 px-1.5 py-1 text-center font-bold text-slate-800 bg-white border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-slate-900"/>
                                <span className="text-[10px] text-slate-500 font-medium">{item.unit || 'pcs'}</span>
                              </div>
                            </td>
                            <td className="p-1.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-slate-400 font-semibold text-xs">Tk</span>
                                <input type="number" step="any" min="0" value={item.unitPrice} onChange={(e) => handleUpdateQuoteItemRow(idx, 'unitPrice', Math.max(0, Number(e.target.value)))} className="w-20 px-1.5 py-1 text-right font-bold text-slate-800 bg-white border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-slate-900"/>
                              </div>
                            </td>
                            <td className="p-2 text-right font-bold text-slate-900">Tk{(Number(item.totalPrice) || 0).toLocaleString()}</td>
                            <td className="p-2 text-center">
                              <button type="button" onClick={() => {
                        setAddedQuoteItems(addedQuoteItems.filter((_, i) => i !== idx));
                    }} className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer">
                                <Trash2 className="w-3.5 h-3.5"/>
                              </button>
                            </td>
                          </tr>))}
                      </tbody>
                    </table>
                  </div>
                </div>)}

              {/* Discount & VAT / Tax with Toggle */}
              {(() => {
                const sub = addedQuoteItems.reduce((acc, item) => acc + item.totalPrice, 0);
                const effectiveQuoteDiscount = quoteDiscountType === 'percent'
                    ? Math.round((sub * Math.min(100, Math.max(0, quoteDiscount))) / 100)
                    : Math.min(sub, Math.max(0, quoteDiscount));
                const taxable = Math.max(0, sub - effectiveQuoteDiscount);
                const effectiveQuoteVat = quoteVatType === 'percent'
                    ? Math.round((taxable * Math.min(100, Math.max(0, quoteVatAmountInput))) / 100)
                    : Math.max(0, quoteVatAmountInput);
                const grand = taxable + effectiveQuoteVat;
                return (<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Controls */}
                    <div className="space-y-2">
                      {/* Discount Control */}
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-700 text-xs">
                            {'Discount'}
                          </label>
                          <div className="flex items-center gap-1.5">
                            <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white">
                              <button type="button" onClick={() => setQuoteDiscountType('amount')} className={`px-2 py-0.5 text-[10px] font-black ${quoteDiscountType === 'amount'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:text-slate-800'}`}>Tk</button>
                              <button type="button" onClick={() => setQuoteDiscountType('percent')} className={`px-2 py-0.5 text-[10px] font-black ${quoteDiscountType === 'percent'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:text-slate-800'}`}>
                                %
                              </button>
                            </div>
                            <input type="number" step="any" min="0" value={quoteDiscount} onChange={(e) => setQuoteDiscount(Math.max(0, Number(e.target.value)))} className="w-24 text-right px-2 py-1 border border-slate-200 rounded-lg font-bold text-xs bg-white"/>
                          </div>
                        </div>
                      </div>

                      {/* VAT / Tax Control (Like Discount) */}
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-700 text-xs">
                            {'VAT / Tax'}
                          </label>
                          <div className="flex items-center gap-1.5">
                            <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white">
                              <button type="button" onClick={() => setQuoteVatType('amount')} className={`px-2 py-0.5 text-[10px] font-black ${quoteVatType === 'amount'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:text-slate-800'}`}>Tk</button>
                              <button type="button" onClick={() => setQuoteVatType('percent')} className={`px-2 py-0.5 text-[10px] font-black ${quoteVatType === 'percent'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:text-slate-800'}`}>
                                %
                              </button>
                            </div>
                            <input type="number" step="any" min="0" value={quoteVatAmountInput} onChange={(e) => setQuoteVatAmountInput(Math.max(0, Number(e.target.value)))} className="w-24 text-right px-2 py-1 border border-slate-200 rounded-lg font-bold text-xs bg-white"/>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Summary box */}
                    <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80 flex flex-col justify-center space-y-1">
                      <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                        <span>{'Subtotal:'}</span>
                        <span>{profile.currencySymbol}{sub.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                        <span>{'Discount:'}</span>
                        <span>-{profile.currencySymbol}{effectiveQuoteDiscount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                        <span>{'VAT / Tax:'}</span>
                        <span>+{profile.currencySymbol}{effectiveQuoteVat.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center font-black text-slate-900 pt-1 border-t border-amber-200/50">
                        <span>{'Grand Total:'}</span>
                        <span className="text-amber-600 text-sm">
                          {profile.currencySymbol}{grand.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>);
            })()}

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Terms & Remarks'}
                </label>
                <textarea rows={2} value={quoteNotes} onChange={(e) => setQuoteNotes(e.target.value)} placeholder="e.g. 50% advance on work order, 7 days delivery timeline" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"/>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-2 flex-shrink-0">
              <button type="button" onClick={() => {
                setShowNewQuoteModal(false);
                setEditingQuotation(null);
                setAddedQuoteItems([]);
                setQuoteType('Sales');
                setSelectedProductId('');
                setQuoteCustomerName('');
                setQuoteCustomerPhone('');
                setQuoteCustomerCompany('');
                setQuoteCustomerAddress('');
                setQuoteReferenceNo('');
                setQuotePurchaseRequisition('');
                setQuoteDate(new Date().toISOString().slice(0, 10));
                setQuoteValidUntil(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
                setQuoteItemName('');
                setQuoteItemRegion('');
                setQuoteItemType('');
                setQuoteShowRegionColumn(false);
                setQuoteShowTypeColumn(false);
                setQuoteDiscount(0);
                setQuoteDiscountType('amount');
                setQuoteVatType('percent');
                setQuoteVatAmountInput(0);
                setQuoteNotes('');
            }} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {'Cancel'}
              </button>
              <button type="submit" className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-2xs">
                {'Save Quotation'}
              </button>
            </div>
          </form>
        </div>)}

      {/* Sales Report Print & PDF Modal */}
      {showReportModal && (<ReportPrintModal type="sales" salesData={filteredInvoices} profile={profile} language={language} dateRangeText={dateRangeLabel} onClose={() => setShowReportModal(false)}/>)}

      {/* ADD/EDIT CUSTOMER MODAL */}
      {showCustomerModal && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCustomerFormSubmit} className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingCustomer
                ? ('Edit Customer Information')
                : ('Add New Customer')}
              </h3>
              <button type="button" onClick={() => {
                setShowCustomerModal(false);
                setEditingCustomer(null);
            }} className="text-slate-400 hover:text-slate-600 font-bold text-sm">
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Customer Name *'}
                  </label>
                  <input type="text" required value={customerFormData.name} onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })} placeholder={'e.g. Md. Sajib Khan'} className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Mobile Number *'}
                  </label>
                  <input type="text" required value={customerFormData.phone} onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })} placeholder={'e.g. 018XXXXXXXX'} className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Company/Business'}
                  </label>
                  <input type="text" value={customerFormData.company} onChange={(e) => setCustomerFormData({ ...customerFormData, company: e.target.value })} placeholder={'e.g. Sajib Printers'} className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Email Address'}
                  </label>
                  <input type="email" value={customerFormData.email} onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })} placeholder="name@company.com" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {"Advance BalanceTk"}
                  </label>
                  <input type="number" step="any" min="0" value={customerFormData.advanceBalance} onChange={(e) => setCustomerFormData({ ...customerFormData, advanceBalance: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"/>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Address'}
                  </label>
                  <input type="text" value={customerFormData.address} onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })} placeholder={'e.g. Anderkilla, Chittogram'} className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => {
                setShowCustomerModal(false);
                setEditingCustomer(null);
            }} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {'Cancel'}
              </button>
              <button type="submit" className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs">
                {'Save'}
              </button>
            </div>
          </form>
        </div>)}

      {/* CUSTOM CONFIRM DELETE MODALS */}
      {customerToDelete && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600">
              <Trash2 className="w-6 h-6"/>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {'Confirm Client Deletion'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {`Are you sure you want to delete client "${customerToDelete.name}"? This action cannot be undone.`}
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button type="button" onClick={() => setCustomerToDelete(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                {'Cancel'}
              </button>
              <button type="button" onClick={() => {
                deleteCustomer(customerToDelete.id);
                setCustomerToDelete(null);
            }} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer">
                {'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>)}

      {/* CREATE PROJECT AGAINST INVOICE MODAL (WITH UNIFIED COA) */}
      {projectModalInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateProjectAgainstInvoice}
            className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4 my-8"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    {'Create Project Against Invoice'}
                  </h3>
                  <div className="text-[11px] font-medium text-slate-500">
                    Project linked with Invoice <span className="font-bold text-amber-700 font-mono">#{projectModalInvoice.invoiceNo}</span> (Unified COA)
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProjectModalInvoice(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Invoice Summary Card */}
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-500 text-[11px]">Customer & Company:</span>
                  <div className="font-bold text-slate-900 text-xs sm:text-[13px]">{projectModalInvoice.customerName}</div>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-[11px]">Invoice Total:</span>
                  <div className="font-black text-slate-900 text-sm">
                    {profile.currencySymbol}{(Number(projectModalInvoice.grandTotal) || 0).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-amber-200/60">
                <span className="truncate max-w-[280px]" title={(projectModalInvoice.items || []).map(i => `${i?.name || 'Item'} (x${i?.qty || 1})`).join(', ')}>
                  <strong>Items:</strong> {(projectModalInvoice.items || []).length > 2
                    ? `${(projectModalInvoice.items || []).slice(0, 2).map(i => `${i?.name || 'Item'} (x${i?.qty || 1})`).join(', ')} +${(projectModalInvoice.items || []).length - 2} more`
                    : (projectModalInvoice.items || []).map(i => `${i?.name || 'Item'} (x${i?.qty || 1})`).join(', ') || 'None'}
                </span>
                <span className={(Number(projectModalInvoice.dueAmount) || 0) > 0 ? "text-rose-600 font-bold" : "text-emerald-700 font-bold"}>
                  {(Number(projectModalInvoice.dueAmount) || 0) > 0 ? `Due: ${profile.currencySymbol}${(Number(projectModalInvoice.dueAmount) || 0).toLocaleString()}` : 'Fully Paid'}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  value={projectFormData.name}
                  onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                  placeholder="e.g. BSRM Steel Ltd - Dealer New Signboard"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-amber-500 focus:outline-hidden font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Project Budget ({profile.currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={projectFormData.budget}
                    onChange={(e) => setProjectFormData({ ...projectFormData, budget: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-900 focus:border-amber-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Status
                  </label>
                  <select
                    value={projectFormData.status}
                    onChange={(e) => setProjectFormData({ ...projectFormData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-700 bg-white"
                  >
                    <option value="In Progress">In Progress</option>
                    <option value="Planning">Planning</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={projectFormData.startDate}
                    onChange={(e) => setProjectFormData({ ...projectFormData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={projectFormData.endDate}
                    onChange={(e) => setProjectFormData({ ...projectFormData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* UNIFIED CHART OF ACCOUNTS (COA) SELECTOR */}
              <div className="p-3.5 bg-gradient-to-br from-indigo-50/70 to-blue-50/50 rounded-xl border border-indigo-200 space-y-2">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-indigo-700 shrink-0" />
                  <label className="font-extrabold text-indigo-950 text-xs">
                    Unified Chart of Accounts Head (Unified COA) *
                  </label>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded">
                    Single Unified COA
                  </span>
                </div>
                <select
                  value={projectFormData.chartOfAccountId}
                  onChange={(e) => setProjectFormData({ ...projectFormData, chartOfAccountId: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl font-bold text-indigo-900 text-xs focus:outline-hidden cursor-pointer"
                >
                  {availableRevenueCOAs.map(coa => (
                    <option key={coa.id} value={coa.id}>
                      {coa.code} - {coa.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                  ✓ This project and sales invoice will share the <strong>same Chart of Accounts (COA)</strong> head. No duplicate entries will be recorded.
                </p>
              </div>

              {/* Sync sales item checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                <input
                  type="checkbox"
                  checked={projectFormData.includeSalesItem}
                  onChange={(e) => setProjectFormData({ ...projectFormData, includeSalesItem: e.target.checked })}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 block">
                    Add invoice amount ({profile.currencySymbol}{(Number(projectModalInvoice.grandTotal) || 0).toLocaleString()}) as project sales income
                  </span>
                  <span className="text-[11px] text-slate-500">
                    The sales and payment history of this invoice will be directly added to the project profitability statement.
                  </span>
                </div>
              </label>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Notes / Specification
                </label>
                <textarea
                  rows={2}
                  value={projectFormData.notes}
                  onChange={(e) => setProjectFormData({ ...projectFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                  placeholder="Optional internal remarks..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setProjectModalInvoice(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 transition-all"
              >
                <FolderKanban className="w-3.5 h-3.5" />
                <span>Create Project & Link COA</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PROJECT CREATED SUCCESS MODAL */}
      {projectCreatedSuccess && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Project Created Successfully!
              </h3>
              <p className="text-xs text-slate-600 mt-1 font-mono font-bold text-amber-700">
                {projectCreatedSuccess.projectCode}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {projectCreatedSuccess.projectName}
              </p>
              <div className="mt-2 p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-[11px] text-emerald-800 font-semibold">
                ✓ Chart of Accounts (COA) unified sync complete.
              </div>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProjectCreatedSuccess(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setProjectCreatedSuccess(null);
                  window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'projects' }));
                }}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1"
              >
                <span>Go to Projects</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {invoiceToDelete && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600">
              <Trash2 className="w-6 h-6"/>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {'Confirm Invoice Deletion'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {`Are you sure you want to delete invoice "${invoiceToDelete.invoiceNo}"? This action cannot be undone.`}
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button type="button" onClick={() => setInvoiceToDelete(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                {'Cancel'}
              </button>
              <button type="button" onClick={() => {
                deleteInvoice(invoiceToDelete.id);
                setInvoiceToDelete(null);
            }} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer">
                {'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>)}

      {quotationToDelete && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600">
              <Trash2 className="w-6 h-6"/>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {'Confirm Quotation Deletion'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {`Are you sure you want to delete quotation "${quotationToDelete.quoteNo}"? This action cannot be undone.`}
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button type="button" onClick={() => setQuotationToDelete(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                {'Cancel'}
              </button>
              <button type="button" onClick={() => {
                deleteQuotation(quotationToDelete.id);
                setQuotationToDelete(null);
            }} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer">
                {'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>)}



      {/* DIRECT SALES INVOICE CREATION MODAL */}
      <CreateSalesInvoiceModal isOpen={showDirectInvoiceModal} onClose={() => setShowDirectInvoiceModal(false)} onInvoiceCreated={(newInvoiceId) => {
            setShowDirectInvoiceModal(false);
            setActiveSubTab('invoices');
            onOpenInvoiceModal(newInvoiceId);
        }}/>

      {/* INVOICE MULTI-CHANNEL PAYMENT DETAILS MODAL */}
      {viewingPaymentDetailsInvoice && (() => {
        const invPayments = getInvoicePayments(viewingPaymentDetailsInvoice, transactions, paymentMethods);
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
                      #{viewingPaymentDetailsInvoice.invoiceNo} • {viewingPaymentDetailsInvoice.customerName}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingPaymentDetailsInvoice(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Financial summary banner */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Total Invoiced</div>
                  <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5">
                    {profile.currencySymbol}{(Number(viewingPaymentDetailsInvoice.grandTotal) || 0).toLocaleString()}
                  </div>
                </div>
                <div className="border-x border-slate-200">
                  <div className="text-[10px] text-emerald-600 font-bold uppercase">Total Paid</div>
                  <div className="text-xs sm:text-sm font-black text-emerald-700 mt-0.5">
                    {profile.currencySymbol}{(Number(viewingPaymentDetailsInvoice.paidAmount) || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-rose-600 font-bold uppercase">Due Remaining</div>
                  <div className="text-xs sm:text-sm font-black text-rose-600 mt-0.5">
                    {profile.currencySymbol}{(Number(viewingPaymentDetailsInvoice.dueAmount) || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Itemized payments list */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700">
                  Received Payments ({invPayments.length})
                </div>
                {invPayments.length === 0 ? (
                  <div className="p-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                    No payment transactions recorded for this invoice.
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {invPayments.map((p, idx) => (
                      <div key={p.id || idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/70 border border-slate-200 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <span className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700">
                            {p.channel.toLowerCase().includes('cash') ? (
                              <Banknote className="w-4 h-4 text-emerald-600" />
                            ) : p.channel.toLowerCase().includes('bkash') || p.channel.toLowerCase().includes('nagad') ? (
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
                          +{profile.currencySymbol}{(Number(p.amount) || 0).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setViewingPaymentDetailsInvoice(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                {viewingPaymentDetailsInvoice.dueAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = viewingPaymentDetailsInvoice;
                      setViewingPaymentDetailsInvoice(null);
                      setPaymentModalInvoice(target);
                      setCollectAmount(target.dueAmount);
                      setAdjustAdvanceAmount(0);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <span>+ Collect Remaining Due</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* CUSTOMER INVOICES & PAYMENT HISTORY MODAL */}
      {selectedCustomerHistory && (() => {
        const { clientInvoices, totalPurchased, totalPaid, dueAmount } = getCustomerInvoiceSummary(selectedCustomerHistory, invoices);
        const customerTxList = (transactions || []).filter(t => {
          if (t.type !== 'INCOME') return false;
          if (clientInvoices.some(inv => (inv.invoiceNo || '').toLowerCase().trim() === (t.refNo || '').toLowerCase().trim())) return true;
          const custName = (selectedCustomerHistory.name || '').toLowerCase().trim();
          const txCust = (t.customerOrSupplier || '').toLowerCase().trim();
          if (custName && (txCust === custName || txCust.includes(custName))) return true;
          return false;
        });

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base sm:text-lg flex items-center gap-2">
                      <span>{selectedCustomerHistory.name}</span>
                      {selectedCustomerHistory.company && (
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          {selectedCustomerHistory.company}
                        </span>
                      )}
                    </h3>
                    <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                      <span className="font-mono">{selectedCustomerHistory.phone || 'No phone'}</span>
                      {selectedCustomerHistory.address && <span>• {selectedCustomerHistory.address}</span>}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomerHistory(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Financial Metrics Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4 shrink-0 text-center">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Sales</div>
                  <div className="text-base sm:text-lg font-black text-slate-900 mt-1">
                    {profile.currencySymbol}{totalPurchased.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{clientInvoices.length} invoices</div>
                </div>
                <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                  <div className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Total Paid</div>
                  <div className="text-base sm:text-lg font-black text-emerald-700 mt-1">
                    {profile.currencySymbol}{totalPaid.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-emerald-600 mt-0.5">{customerTxList.length} payments</div>
                </div>
                <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-200">
                  <div className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">Advance Balance</div>
                  <div className="text-base sm:text-lg font-black text-indigo-700 mt-1">
                    {profile.currencySymbol}{(selectedCustomerHistory.advanceBalance || 0).toLocaleString()}
                  </div>
                  {selectedCustomerHistory.advanceBalance && selectedCustomerHistory.advanceBalance > 0 && dueAmount > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const dueInv = clientInvoices.find(inv => inv.dueAmount > 0);
                        if (dueInv) {
                          setSelectedCustomerHistory(null);
                          setPaymentModalInvoice(dueInv);
                          const adv = Math.min(selectedCustomerHistory.advanceBalance || 0, dueInv.dueAmount);
                          setAdjustAdvanceAmount(adv);
                          setCollectAmount(Math.max(0, dueInv.dueAmount - adv));
                        }
                      }}
                      className="mt-1 text-[9.5px] font-black text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 hover:border-indigo-300 px-2 py-0.5 rounded cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                    >
                      <span>Adjust to Due</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  ) : (
                    <div className="text-[10px] text-indigo-600 mt-0.5">Credit Held</div>
                  )}
                </div>
                <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200">
                  <div className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">Current Due</div>
                  <div className="text-base sm:text-lg font-black text-rose-600 mt-1">
                    {profile.currencySymbol}{dueAmount.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-rose-500 mt-0.5">{dueAmount > 0 ? 'Outstanding' : 'Cleared'}</div>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 pr-1 space-y-4 text-xs scrollbar-thin">
                {/* Invoices Section */}
                <div className="space-y-2">
                  <div className="font-extrabold text-slate-800 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Sales Invoices ({clientInvoices.length})</span>
                    </span>
                  </div>

                  {clientInvoices.length === 0 ? (
                    <div className="p-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                      No invoices recorded for this customer yet.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Invoice No</th>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3 text-right">Total</th>
                            <th className="py-2.5 px-3 text-right">Paid</th>
                            <th className="py-2.5 px-3 text-right">Due</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {clientInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-bold text-slate-900 font-mono">
                                #{inv.invoiceNo}
                              </td>
                              <td className="py-2 px-3 text-slate-500">{inv.date}</td>
                              <td className="py-2 px-3 text-right font-black text-slate-900">
                                {profile.currencySymbol}{(Number(inv.grandTotal) || 0).toLocaleString()}
                              </td>
                              <td className="py-2 px-3 text-right font-black text-emerald-700">
                                {profile.currencySymbol}{(Number(inv.paidAmount) || 0).toLocaleString()}
                              </td>
                              <td className="py-2 px-3 text-right font-black text-rose-600">
                                {(Number(inv.dueAmount) || 0) > 0 ? `${profile.currencySymbol}${(Number(inv.dueAmount) || 0).toLocaleString()}` : '—'}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  inv.paymentStatus === 'Paid'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : inv.paymentStatus === 'Partial'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}>
                                  {inv.paymentStatus}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onOpenInvoiceModal(inv.id, 'invoice')}
                                    className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                                    title="View / Print Invoice"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                  {inv.dueAmount > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedCustomerHistory(null);
                                        setPaymentModalInvoice(inv);
                                        setCollectAmount(inv.dueAmount);
                                        setAdjustAdvanceAmount(0);
                                      }}
                                      className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded cursor-pointer"
                                      title="Collect Due"
                                    >
                                      +Pay
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Payment Ledger Section */}
                <div className="space-y-2 pt-2">
                  <div className="font-extrabold text-slate-800 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Payment Receipts & Ledger ({customerTxList.length})</span>
                    </span>
                  </div>

                  {customerTxList.length === 0 ? (
                    <div className="p-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                      No payment receipts recorded for this customer yet.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Channel / Method</th>
                            <th className="py-2.5 px-3">Invoice Ref</th>
                            <th className="py-2.5 px-3">Description</th>
                            <th className="py-2.5 px-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {customerTxList.map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{tx.date}</td>
                              <td className="py-2 px-3 font-bold text-slate-800 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5">
                                  {tx.paymentAccount?.toLowerCase().includes('cash') ? (
                                    <Banknote className="w-3 h-3 text-emerald-600" />
                                  ) : tx.paymentAccount?.toLowerCase().includes('bkash') || tx.paymentAccount?.toLowerCase().includes('nagad') ? (
                                    <Smartphone className="w-3 h-3 text-pink-600" />
                                  ) : (
                                    <Landmark className="w-3 h-3 text-blue-600" />
                                  )}
                                  <span>{tx.paymentAccount || tx.accountHead || 'Cash'}</span>
                                </span>
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">{tx.refNo || '—'}</td>
                              <td className="py-2 px-3 text-slate-500 truncate max-w-[200px]" title={tx.description}>
                                {tx.description || tx.category}
                              </td>
                              <td className="py-2 px-3 text-right font-black text-emerald-700 whitespace-nowrap">
                                +{profile.currencySymbol}{tx.amount.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedCustomerHistory(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>);
};
