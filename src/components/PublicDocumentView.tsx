import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import * as htmlToImage from 'html-to-image';
import {
  FileText,
  Printer,
  Download,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Phone,
  MapPin,
  FileCheck,
  ShieldCheck,
  Smartphone,
  Eye,
  Hash,
  Clock,
  Layers,
  ChevronRight,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { useApp } from '../context/AppContext';
import { SalesInvoice, Quotation, CompanyProfile } from '../types';

interface PublicDocumentViewProps {
  documentId: string;
  documentType?: 'invoice' | 'quotation';
}

interface NormalizedPublicDocument {
  id: string;
  isQuote: boolean;
  documentNo: string;
  referenceNo?: string;
  purchaseRequisition?: string;
  date: string;
  validUntil?: string;
  deliveryDate?: string;
  customerName: string;
  customerPhone?: string;
  customerCompany?: string;
  customerAddress?: string;
  items: Array<{
    name: string;
    category?: string;
    region?: string;
    type?: string;
    itemType?: string;
    unit?: string;
    qty: number;
    unitPrice: number;
    totalPrice: number;
    width?: number;
    height?: number;
    totalSqft?: number;
    notes?: string;
  }>;
  subtotal: number;
  discount: number;
  discountType: 'amount' | 'percent';
  vatRate: number;
  vatAmount: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: 'Paid' | 'Partial' | 'Due' | 'Approved' | 'Draft' | 'Sent' | 'Rejected';
  paymentMethod?: string;
  notes?: string;
  showRegionColumn?: boolean;
  showTypeColumn?: boolean;
}

export const PublicDocumentView: React.FC<PublicDocumentViewProps> = ({
  documentId,
  documentType,
}) => {
  const { invoices = [], quotations = [], profile: contextProfile } = useApp();
  const [doc, setDoc] = useState<NormalizedPublicDocument | null>(null);
  const [profile, setProfile] = useState<Partial<CompanyProfile>>(contextProfile || {});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [viewMode, setViewMode] = useState<'mobile' | 'a4'>('mobile');
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Resize listener
  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Default to A4 on wide desktop screens, mobile card on smaller screens
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setViewMode('a4');
    } else {
      setViewMode('mobile');
    }
  }, []);

  // Update profile from context if changed
  useEffect(() => {
    if (contextProfile && Object.keys(contextProfile).length > 0) {
      setProfile((prev) => ({ ...prev, ...contextProfile }));
    }
  }, [contextProfile]);

  // Load Document
  useEffect(() => {
    let isCancelled = false;
    const cleanId = (documentId || '').trim();
    const cleanLower = cleanId.toLowerCase();
    const cleanNoHash = cleanLower.replace(/^#/, '');

    const normalizeInvoice = (inv: SalesInvoice): NormalizedPublicDocument => {
      const sub = Number(inv.subtotal) || Number(inv.grandTotal) || 0;
      const grand = Number(inv.grandTotal) || 0;
      const paid = Number(inv.paidAmount) || 0;
      const due = Number(inv.dueAmount) !== undefined ? Number(inv.dueAmount) : Math.max(0, grand - paid);
      let status: 'Paid' | 'Partial' | 'Due' = 'Due';
      if (due <= 0 && grand > 0) status = 'Paid';
      else if (paid > 0 && due > 0) status = 'Partial';

      return {
        id: inv.id,
        isQuote: false,
        documentNo: inv.invoiceNo,
        referenceNo: inv.referenceNo,
        purchaseRequisition: inv.purchaseRequisition || inv.prNo,
        date: inv.date,
        deliveryDate: inv.deliveryDate,
        customerName: inv.customerName || 'Valued Customer',
        customerPhone: inv.customerPhone,
        customerCompany: inv.customerCompany,
        customerAddress: inv.customerAddress,
        items: Array.isArray(inv.items)
          ? inv.items.map((it) => ({
              name: it.name,
              category: it.category,
              region: it.region,
              type: it.type || it.itemType,
              unit: it.unit || 'pcs',
              qty: Number(it.qty) || 1,
              unitPrice: Number(it.unitPrice) || 0,
              totalPrice: Number(it.totalPrice) || (Number(it.qty) || 1) * (Number(it.unitPrice) || 0),
              width: it.width,
              height: it.height,
              totalSqft: it.totalSqft,
              notes: it.notes,
            }))
          : [],
        subtotal: sub,
        discount: Number(inv.discount) || 0,
        discountType: inv.discountType || 'amount',
        vatRate: Number(inv.vatRate) || 0,
        vatAmount: Number(inv.vatAmount) || 0,
        grandTotal: grand,
        paidAmount: paid,
        dueAmount: due,
        paymentStatus: status,
        paymentMethod: inv.paymentMethod || 'Cash',
        notes: inv.notes,
        showRegionColumn: inv.showRegionColumn,
        showTypeColumn: inv.showTypeColumn,
      };
    };

    const normalizeQuote = (q: Quotation): NormalizedPublicDocument => {
      const grand = Number(q.grandTotal) || 0;
      return {
        id: q.id,
        isQuote: true,
        documentNo: q.quoteNo,
        referenceNo: q.referenceNo,
        purchaseRequisition: q.purchaseRequisition || q.prNo,
        date: q.date,
        validUntil: q.validUntil,
        customerName: q.customerName || 'Valued Customer',
        customerPhone: q.customerPhone,
        customerCompany: q.customerCompany,
        customerAddress: q.customerAddress,
        items: Array.isArray(q.items)
          ? q.items.map((it: any) => ({
              name: it.name,
              category: it.category,
              region: it.region,
              type: it.type || it.itemType,
              unit: it.unit || 'pcs',
              qty: Number(it.qty) || 1,
              unitPrice: Number(it.unitPrice) || 0,
              totalPrice: Number(it.totalPrice) || (Number(it.qty) || 1) * (Number(it.unitPrice) || 0),
              width: it.width,
              height: it.height,
              totalSqft: it.totalSqft,
              notes: it.notes,
            }))
          : [],
        subtotal: grand,
        discount: 0,
        discountType: 'amount',
        vatRate: 0,
        vatAmount: 0,
        grandTotal: grand,
        paidAmount: 0,
        dueAmount: grand,
        paymentStatus: q.status || 'Approved',
        notes: q.notes,
        showRegionColumn: q.showRegionColumn,
        showTypeColumn: q.showTypeColumn,
      };
    };

    const findInMemory = (): NormalizedPublicDocument | null => {
      // 1. Try Invoices
      if (documentType !== 'quotation') {
        const foundInv = (invoices || []).find((inv) => {
          const invId = (inv.id || '').toLowerCase();
          const invNo = (inv.invoiceNo || '').toLowerCase();
          const invNoClean = invNo.replace(/^#/, '');
          return (
            invId === cleanLower ||
            invId === cleanNoHash ||
            invNo === cleanLower ||
            invNoClean === cleanNoHash ||
            invNo === cleanId
          );
        });
        if (foundInv) return normalizeInvoice(foundInv);
      }

      // 2. Try Quotations
      const foundQ = (quotations || []).find((q) => {
        const qId = (q.id || '').toLowerCase();
        const qNo = (q.quoteNo || '').toLowerCase();
        const qNoClean = qNo.replace(/^#/, '');
        return (
          qId === cleanLower ||
          qId === cleanNoHash ||
          qNo === cleanLower ||
          qNoClean === cleanNoHash ||
          qNo === cleanId
        );
      });
      if (foundQ) return normalizeQuote(foundQ);

      return null;
    };

    const fetchPublicData = async () => {
      // Check in-memory first
      const memDoc = findInMemory();
      if (memDoc) {
        if (!isCancelled) {
          setDoc(memDoc);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const res = await fetch(`/api/public/invoice/${encodeURIComponent(cleanNoHash)}`);
        if (!res.ok) {
          throw new Error('Document not found or verification expired.');
        }
        const json = await res.json();
        if (json.success && json.data && !isCancelled) {
          if (json.profile && Object.keys(json.profile).length > 0) {
            setProfile((prev) => ({ ...prev, ...json.profile }));
          }

          if (json.type === 'quotation') {
            setDoc(normalizeQuote(json.data));
          } else {
            setDoc(normalizeInvoice(json.data));
          }
        } else {
          throw new Error(json.message || 'Document record could not be retrieved.');
        }
      } catch (err: any) {
        if (!isCancelled) {
          // If network failed, re-check in-memory as final fallback
          const secondMem = findInMemory();
          if (secondMem) {
            setDoc(secondMem);
          } else {
            setLoadError(err.message || 'Unable to load document record.');
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchPublicData();

    return () => {
      isCancelled = true;
    };
  }, [documentId, documentType, invoices, quotations]);

  // Generate QR Code data URL
  useEffect(() => {
    if (typeof window !== 'undefined' && doc) {
      const currentUrl = window.location.href;
      QRCode.toDataURL(currentUrl, {
        width: 140,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeUrl(url))
        .catch(() => {});
    }
  }, [doc]);

  // Handle direct window print
  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 200);
  };

  // Handle high quality PDF Download
  const handleDownloadPDF = async () => {
    if (!doc) return;
    setIsDownloadingPdf(true);
    try {
      const element = document.getElementById('public-invoice-printable-area');
      if (!element) {
        alert('Printable element not found');
        return;
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const imgData = await htmlToImage.toPng(element, {
        quality: 0.98,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (element.offsetHeight * pdfWidth) / element.offsetWidth;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, 297));
      pdf.save(`${doc.isQuote ? 'Quotation' : 'Invoice'}_${doc.documentNo.replace(/^#/, '')}.pdf`);
    } catch (err) {
      console.error('PDF Download Error:', err);
      // Fallback to window.print
      window.print();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Mobile scaling calculation for A4 sheet preview
  const isMobile = viewportWidth < 820;
  const a4Scale = isMobile ? Math.max(0.35, Math.min(1, (viewportWidth - 28) / 794)) : 1;
  const scaledA4Width = Math.round(794 * a4Scale);
  const scaledA4Height = Math.round(1123 * a4Scale);

  // Status Badge Colors
  const getStatusBadge = () => {
    if (!doc) return null;
    if (doc.isQuote) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-800 border border-amber-300">
          <Clock className="w-3.5 h-3.5" />
          <span>{doc.paymentStatus || 'Valid Quotation'}</span>
        </span>
      );
    }

    if (doc.paymentStatus === 'Paid') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-xs">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>PAID IN FULL</span>
        </span>
      );
    }

    if (doc.paymentStatus === 'Partial') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-slate-950 shadow-xs">
          <Clock className="w-3.5 h-3.5" />
          <span>PARTIALLY PAID</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-600 text-white shadow-xs">
        <AlertCircle className="w-3.5 h-3.5" />
        <span>PAYMENT DUE</span>
      </span>
    );
  };

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="bg-slate-800/90 border border-slate-700 p-8 rounded-3xl shadow-2xl max-w-sm w-full flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/20 mb-4 animate-bounce">
            <ShieldCheck className="w-9 h-9 text-slate-950" />
          </div>
          <h2 className="text-lg font-black tracking-wide uppercase text-white mb-1">
            Dot Color Communication
          </h2>
          <p className="text-xs text-slate-400 mb-6 font-medium">
            Verifying Official Document Record...
          </p>
          <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div className="bg-amber-400 h-full w-2/3 animate-pulse rounded-full" />
          </div>
          <div className="text-[11px] text-slate-500 mt-4 font-mono">
            ID: {documentId}
          </div>
        </div>
      </div>
    );
  }

  // 2. Error / Not Found State
  if (loadError || !doc) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-200">
        <div className="bg-slate-900 border border-rose-900/50 p-6 sm:p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-4 text-rose-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            Document Record Not Found
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
            The document ID <span className="font-mono text-amber-400 font-bold">"{documentId}"</span> could not be verified in the live system. It may have been archived or entered incorrectly.
          </p>
          <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700 text-left text-xs space-y-2 mb-6">
            <div className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
              Need Verification Assistance?
            </div>
            <div className="text-white font-bold">
              {profile.name || 'Dot Color Communication'}
            </div>
            {profile.phone && (
              <div className="flex items-center gap-2 text-slate-300">
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <a href={`tel:${profile.phone}`} className="hover:underline">
                  Hotline: {profile.phone}
                </a>
              </div>
            )}
            {profile.email && (
              <div className="text-slate-300 text-[11px]">
                Email: {profile.email}
              </div>
            )}
          </div>
          <div className="text-[11px] text-slate-500">
            Powered by BD HOSTT ERP Cloud Sync
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col selection:bg-amber-200 selection:text-amber-900 antialiased">
      {/* Print Specific CSS */}
      <style>{`
        @media print {
          body {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .public-no-print {
            display: none !important;
          }
          .public-print-only {
            display: block !important;
          }
          #public-invoice-printable-area {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      {/* Top Standalone Verification Bar (No Login / Logout, Independent) */}
      <header className="public-no-print bg-slate-950 text-white sticky top-0 z-40 border-b border-slate-800 shadow-md">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
          {/* Brand & Verification Badge */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center font-black text-slate-950 shrink-0 text-sm">
              DC
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-black tracking-wide text-white truncate">
                <span>{profile.name || 'Dot Color Communication'}</span>
                <span className="inline-flex items-center gap-0.5 text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded-full font-bold">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  Verified
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate">
                {doc.isQuote ? 'Quotation' : 'Invoice'} #{doc.documentNo}
              </div>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* View Mode Toggle: Mobile Card vs Official A4 Sheet */}
            <div className="bg-slate-800 p-0.5 rounded-lg border border-slate-700 flex items-center text-xs">
              <button
                type="button"
                onClick={() => setViewMode('mobile')}
                className={`px-2 py-1 rounded-md font-bold flex items-center gap-1 transition-all ${
                  viewMode === 'mobile'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Mobile Responsive View"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mobile</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('a4')}
                className={`px-2 py-1 rounded-md font-bold flex items-center gap-1 transition-all ${
                  viewMode === 'a4'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Official A4 Document Sheet View"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">A4 Sheet</span>
              </button>
            </div>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1 border border-slate-700 cursor-pointer transition-colors"
              title="Print Document"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* Download PDF Button */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isDownloadingPdf}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow-sm cursor-pointer transition-colors"
              title="Download PDF"
            >
              {isDownloadingPdf ? (
                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Document Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-2 sm:p-6 flex flex-col items-center">
        {/* ========================================================= */}
        {/* VIEW MODE 1: NATIVE MOBILE RESPONSIVE CARD VIEW           */}
        {/* ========================================================= */}
        {viewMode === 'mobile' ? (
          <div
            id="public-invoice-printable-area"
            className="w-full bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden"
          >
            {/* Top Verified Ribbon Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4 sm:p-6 border-b border-amber-500/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold mb-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Official Authenticated System Document</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase flex items-center gap-2">
                    {doc.isQuote ? 'PRICE QUOTATION' : 'SALES INVOICE'}
                  </h1>
                  <div className="text-amber-400 font-mono font-bold text-sm mt-0.5">
                    #{doc.documentNo}
                  </div>
                </div>

                <div className="flex flex-wrap sm:flex-col sm:items-end gap-2 text-xs">
                  {getStatusBadge()}
                  <div className="text-slate-400 font-medium text-[11px] flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Date: {doc.date}</span>
                  </div>
                  {doc.referenceNo && (
                    <div className="text-slate-300 text-[11px] font-mono">
                      Ref: <span className="font-bold">{doc.referenceNo}</span>
                    </div>
                  )}
                  {doc.purchaseRequisition && (
                    <div className="text-amber-300 text-[11px] font-mono">
                      PR #: <span className="font-bold">{doc.purchaseRequisition}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Customer & Company Two-Column Card */}
            <div className="p-4 sm:p-6 bg-slate-50/70 border-b border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* BILL TO */}
              <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-amber-500" />
                  <span>{doc.isQuote ? 'QUOTATION TO' : 'BILL TO'}</span>
                </div>
                <div className="font-black text-slate-900 text-sm sm:text-base leading-snug">
                  {doc.customerName}
                </div>
                {doc.customerCompany && doc.customerCompany !== doc.customerName && (
                  <div className="text-xs font-semibold text-slate-700 mt-0.5">
                    {doc.customerCompany}
                  </div>
                )}
                {doc.customerAddress && (
                  <div className="text-xs text-slate-500 mt-1 flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{doc.customerAddress}</span>
                  </div>
                )}
                {doc.customerPhone && (
                  <div className="text-xs font-semibold text-slate-600 mt-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <a href={`tel:${doc.customerPhone}`} className="hover:text-blue-600 hover:underline">
                      {doc.customerPhone}
                    </a>
                  </div>
                )}
              </div>

              {/* ISSUED BY */}
              <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>ISSUED BY (OFFICIAL SUPPLIER)</span>
                </div>
                <div className="font-black text-slate-900 text-sm sm:text-base leading-snug">
                  {profile.name || 'Dot Color Communication'}
                </div>
                {profile.address && (
                  <div className="text-xs text-slate-500 mt-1 flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{profile.address}</span>
                  </div>
                )}
                {profile.phone && (
                  <div className="text-xs font-semibold text-slate-600 mt-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Hotline: {profile.phone}</span>
                  </div>
                )}
                {profile.email && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    Email: {profile.email}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Responsive Items List */}
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-500" />
                  <span>Order Items & Services ({doc.items.length})</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">
                  Currency: BDT (Tk)
                </span>
              </div>

              {/* Cards for Mobile Screens */}
              <div className="space-y-3">
                {doc.items.map((item, idx) => {
                  const hasDimensions = Boolean(item.width && item.height);
                  const singleSqft = hasDimensions
                    ? Number(((item.width || 0) * (item.height || 0)).toFixed(2))
                    : undefined;
                  const totalSqft = item.totalSqft || (singleSqft ? Number((singleSqft * (item.qty || 1)).toFixed(2)) : undefined);

                  return (
                    <div
                      key={idx}
                      className="bg-slate-50/90 hover:bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        {/* Item Name & Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="font-bold text-slate-900 text-xs sm:text-sm">
                              {item.name}
                            </div>
                          </div>

                          {/* Dimensions if customized product */}
                          {hasDimensions && (
                            <div className="mt-1.5 inline-flex flex-wrap items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-[11px] font-bold text-amber-900">
                              <span>📐 Dimensions:</span>
                              <span>{item.width}' × {item.height}' = {singleSqft} SqFt</span>
                              {item.qty > 1 && totalSqft && (
                                <span className="text-amber-800">
                                  (Total: {totalSqft} SqFt for {item.qty} {item.unit || 'pcs'})
                                </span>
                              )}
                            </div>
                          )}

                          {/* Badges: Type & Region */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.type && (
                              <span className="text-[10px] bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                                Type: {item.type}
                              </span>
                            )}
                            {item.region && (
                              <span className="text-[10px] bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                                Region: {item.region}
                              </span>
                            )}
                          </div>

                          {/* Item Note */}
                          {item.notes && (
                            <div className="text-[11px] text-slate-500 italic mt-1 bg-white p-1.5 rounded border border-slate-200">
                              Note: {item.notes}
                            </div>
                          )}
                        </div>

                        {/* Price & Total on Right */}
                        <div className="text-right shrink-0">
                          <div className="text-xs sm:text-sm font-black text-slate-950">
                            ৳{Number(item.totalPrice).toLocaleString()}
                          </div>
                          <div className="text-[10px] sm:text-[11px] text-slate-500 font-semibold mt-0.5">
                            {hasDimensions && totalSqft ? (
                              <span>{totalSqft} SqFt × ৳{Number(item.unitPrice).toLocaleString()}</span>
                            ) : (
                              <span>{item.qty} {item.unit || 'pcs'} × ৳{Number(item.unitPrice).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Financial Breakdown Card */}
            <div className="p-4 sm:p-6 bg-slate-50/80 border-t border-slate-200">
              <div className="max-w-xs ml-auto space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-bold text-slate-800">
                    ৳{Number(doc.subtotal).toLocaleString()}
                  </span>
                </div>

                {doc.discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Discount:</span>
                    <span className="font-bold">
                      -৳{Number(doc.discount).toLocaleString()}
                    </span>
                  </div>
                )}

                {doc.vatAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>VAT ({doc.vatRate}%):</span>
                    <span className="font-bold text-slate-800">
                      ৳{Number(doc.vatAmount).toLocaleString()}
                    </span>
                  </div>
                )}

                {/* Grand Total */}
                <div className="pt-2 border-t border-slate-300 flex justify-between items-center text-sm sm:text-base font-black text-slate-950">
                  <span>Grand Total:</span>
                  <span className="text-amber-600 font-black">
                    ৳{Number(doc.grandTotal).toLocaleString()}
                  </span>
                </div>

                {/* Paid & Due Breakdown (for Invoices) */}
                {!doc.isQuote && (
                  <>
                    <div className="flex justify-between text-emerald-700 font-semibold text-xs pt-1">
                      <span>Total Paid:</span>
                      <span>৳{Number(doc.paidAmount).toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between text-xs font-bold pt-1 border-t border-slate-200">
                      <span className={doc.dueAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                        Balance Due:
                      </span>
                      <span className={doc.dueAmount > 0 ? 'text-rose-600 font-black' : 'text-emerald-600 font-black'}>
                        ৳{Number(doc.dueAmount).toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Notes & Terms if any */}
            {doc.notes && (
              <div className="p-4 sm:p-6 border-t border-slate-200 bg-white">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                  Special Notes & Terms
                </div>
                <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                  {doc.notes}
                </div>
              </div>
            )}

            {/* Verification Footer with Dynamic QR Code */}
            <div className="p-4 sm:p-6 bg-slate-900 text-white border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {qrCodeUrl ? (
                  <div className="bg-white p-1 rounded-lg shrink-0">
                    <img src={qrCodeUrl} alt="Verify QR Code" className="w-16 h-16 object-contain" />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-950">
                    QR CODE
                  </div>
                )}
                <div>
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Real-Time Digital Verification</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    Scan this QR code with any smartphone to instantly confirm official status & authentic pricing on Dot Color ERP servers.
                  </div>
                </div>
              </div>

              <div className="text-center sm:text-right text-[10px] text-slate-400 shrink-0">
                <div className="text-white font-bold">{profile.name || 'Dot Color Communication'}</div>
                <div>Printing, Packaging & Digital Media Solution</div>
                <div className="text-amber-400/80 font-mono mt-0.5">Powered by BD HOSTT</div>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* VIEW MODE 2: PIXEL-PERFECT A4 PRINT SHEET VIEW            */
          /* ========================================================= */
          <div className="w-full flex flex-col items-center">
            {/* Mobile View Switcher Banner */}
            <div className="public-no-print w-full max-w-[794px] mb-3 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-900 flex items-center justify-between gap-2">
              <span className="font-semibold text-[11px] sm:text-xs">
                📄 You are viewing the exact printable A4 paper sheet.
              </span>
              <button
                type="button"
                onClick={() => setViewMode('mobile')}
                className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 shrink-0 cursor-pointer"
              >
                Switch to Mobile View
              </button>
            </div>

            {/* A4 Sheet Wrapper with Bulletproof Centered Scaling */}
            <div
              style={
                isMobile
                  ? {
                      width: `${scaledA4Width}px`,
                      height: `${scaledA4Height}px`,
                      position: 'relative',
                      overflow: 'hidden',
                      margin: '0 auto',
                      flexShrink: 0,
                    }
                  : {
                      width: '794px',
                      margin: '0 auto',
                    }
              }
              className="print:w-full print:h-auto print:overflow-visible print:static"
            >
              <div
                id="public-invoice-printable-area"
                style={
                  isMobile
                    ? {
                        width: '794px',
                        minWidth: '794px',
                        maxWidth: '794px',
                        height: '1123px',
                        minHeight: '1123px',
                        transform: `scale(${a4Scale})`,
                        transformOrigin: 'top left',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                      }
                    : {
                        width: '794px',
                        minWidth: '794px',
                        maxWidth: '794px',
                        minHeight: '1123px',
                      }
                }
                className="a4-page-sheet relative bg-white p-8 rounded-none shadow-2xl print:shadow-none border border-slate-300 print:border-none flex flex-col justify-between text-black text-xs shrink-0 box-border print:static print:transform-none"
              >
                {/* A4 Top Header */}
                <div className="space-y-4">
                  {/* Top Bar: Logo & Document Title Badge */}
                  <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-4">
                    <div>
                      <BrandLogo size="lg" showTagline={true} />
                      <div className="text-[10px] text-slate-700 mt-1 max-w-xs leading-tight">
                        {profile.address || 'House-31, Road-02, Block-A, Aftabnagar, Badda, Dhaka-1212'}
                      </div>
                      {profile.phone && (
                        <div className="text-[10px] font-bold text-slate-900 mt-0.5">
                          Hotline: {profile.phone}
                        </div>
                      )}
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <div className="bg-black text-white px-5 py-1.5 rounded-md font-black tracking-widest text-base uppercase">
                        {doc.isQuote ? 'PRICE/Quotation' : 'BILL/Invoice'}
                      </div>
                      <div className="mt-2 text-right">
                        <div className="text-xs font-bold text-black">
                          {doc.isQuote ? 'Quotation #' : 'Invoice #'}: <span className="font-mono font-black">{doc.documentNo}</span>
                        </div>
                        <div className="text-xs text-black font-semibold mt-0.5">
                          Date: {doc.date}
                        </div>
                        {doc.referenceNo && (
                          <div className="text-[11px] text-black">
                            Ref: {doc.referenceNo}
                          </div>
                        )}
                        {doc.purchaseRequisition && (
                          <div className="text-[11px] font-bold text-black">
                            PR #: {doc.purchaseRequisition}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* BILL TO & Document Meta Box with QR */}
                  <div className="border border-black rounded-lg p-3 flex justify-between items-center text-xs">
                    <div className="space-y-1 max-w-sm">
                      <div className="font-black text-black uppercase tracking-wider text-[11px]">
                        {doc.isQuote ? 'Quotation TO:' : 'BILL TO:'}
                      </div>
                      <div className="font-black text-black text-sm">
                        {doc.customerName}
                      </div>
                      {doc.customerCompany && (
                        <div className="font-semibold text-black text-[11px]">
                          {doc.customerCompany}
                        </div>
                      )}
                      {doc.customerAddress && (
                        <div className="text-black text-[10px] leading-tight">
                          Address: {doc.customerAddress}
                        </div>
                      )}
                      {doc.customerPhone && (
                        <div className="text-black text-[10px] font-bold">
                          Phone: {doc.customerPhone}
                        </div>
                      )}
                    </div>

                    {/* QR Code on Right */}
                    <div className="flex flex-col items-center">
                      {qrCodeUrl ? (
                        <img src={qrCodeUrl} alt="Document QR" className="w-20 h-20 object-contain border border-black p-0.5 bg-white" />
                      ) : (
                        <div className="w-20 h-20 border border-black flex items-center justify-center text-[9px] font-bold">
                          QR CODE
                        </div>
                      )}
                      <span className="text-[8px] font-bold uppercase mt-0.5 tracking-tight">Scan to Verify</span>
                    </div>
                  </div>

                  {/* A4 Items Table */}
                  <table className="w-full text-left border-collapse border border-black text-xs">
                    <thead>
                      <tr className="bg-black text-white text-[11px] font-black uppercase">
                        <th className="p-2 border border-black text-center w-10">SL</th>
                        <th className="p-2 border border-black">SERVICE / ITEM DESCRIPTION</th>
                        <th className="p-2 border border-black text-center w-16">UNIT</th>
                        <th className="p-2 border border-black text-center w-20">QTY/SQFT</th>
                        <th className="p-2 border border-black text-right w-24">RATE (Tk)</th>
                        <th className="p-2 border border-black text-right w-28">TOTAL (Tk)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doc.items.map((item, idx) => {
                        const hasDimensions = Boolean(item.width && item.height);
                        const singleSqft = hasDimensions
                          ? Number(((item.width || 0) * (item.height || 0)).toFixed(2))
                          : undefined;
                        const totalSqft = item.totalSqft || (singleSqft ? Number((singleSqft * (item.qty || 1)).toFixed(2)) : undefined);

                        return (
                          <tr key={idx} className="border-b border-black">
                            <td className="p-2 border-r border-black text-center font-bold">{idx + 1}</td>
                            <td className="p-2 border-r border-black">
                              <div className="font-black text-black">{item.name}</div>
                              {hasDimensions && (
                                <div className="text-[10px] text-black font-semibold mt-0.5">
                                  📐 Dimensions: {item.width}' × {item.height}' = {singleSqft} SqFt{item.qty > 1 ? ` × ${item.qty} = ${totalSqft} SqFt` : ''}
                                </div>
                              )}
                              {item.notes && (
                                <div className="text-[10px] text-black italic mt-0.5">* {item.notes}</div>
                              )}
                            </td>
                            <td className="p-2 border-r border-black text-center font-medium">
                              {item.unit || 'pcs'}
                            </td>
                            <td className="p-2 border-r border-black text-center font-bold">
                              {hasDimensions && totalSqft ? totalSqft : item.qty}
                            </td>
                            <td className="p-2 border-r border-black text-right font-medium">
                              {Number(item.unitPrice).toLocaleString()}
                            </td>
                            <td className="p-2 text-right font-black">
                              {Number(item.totalPrice).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Summary Box */}
                  <div className="flex justify-end pt-2">
                    <div className="w-64 space-y-1.5 text-xs">
                      <div className="flex justify-between font-bold border-b border-black/20 pb-1">
                        <span>Subtotal:</span>
                        <span>৳{Number(doc.subtotal).toLocaleString()}</span>
                      </div>
                      {doc.discount > 0 && (
                        <div className="flex justify-between font-bold text-rose-700">
                          <span>Discount:</span>
                          <span>-৳{Number(doc.discount).toLocaleString()}</span>
                        </div>
                      )}
                      {doc.vatAmount > 0 && (
                        <div className="flex justify-between font-bold">
                          <span>VAT ({doc.vatRate}%):</span>
                          <span>৳{Number(doc.vatAmount).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-black text-sm border-t-2 border-black pt-1">
                        <span>Grand Total:</span>
                        <span>৳{Number(doc.grandTotal).toLocaleString()}</span>
                      </div>
                      {!doc.isQuote && (
                        <>
                          <div className="flex justify-between font-bold text-black pt-1">
                            <span>Total Paid:</span>
                            <span>৳{Number(doc.paidAmount).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between font-black text-xs border-t border-black pt-1">
                            <span>Balance Due:</span>
                            <span>৳{Number(doc.dueAmount).toLocaleString()}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* A4 Bottom Signatures & Footer */}
                <div className="pt-12">
                  <div className="flex justify-between items-end text-center text-xs font-bold pt-10">
                    <div className="border-t border-black w-44 pt-1">
                      Customer's Signature
                    </div>
                    <div className="border-t border-black w-44 pt-1">
                      Authorized Signature
                    </div>
                  </div>

                  <div className="mt-6 pt-3 border-t border-black/30 text-[9px] text-center text-black flex justify-between items-center">
                    <span>This is a computer generated document verified by Dot Color ERP.</span>
                    <span>Powered by BD HOSTT</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Discreet Footer (No login redirect, keeps view independent) */}
      <footer className="public-no-print bg-white border-t border-slate-200 py-3 text-xs text-slate-500 mt-auto">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
          <div>
            © {new Date().getFullYear()} {profile.name || 'Dot Color Communication'} • Official Verification Portal
          </div>
          <div className="flex items-center gap-3">
            <span>Powered by <strong className="text-blue-600">BD HOSTT</strong></span>
            {/* Subtle login link in case an authorized employee wants to access ERP */}
            <a
              href="/"
              className="text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors"
              title="Staff Login"
            >
              <Lock className="w-3 h-3" />
              <span>Staff Login</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
