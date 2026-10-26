import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import * as htmlToImage from 'html-to-image';
import {
  FileText,
  Printer,
  Download,
  Search,
  Maximize2,
  ZoomIn,
  CheckCircle2,
  AlertCircle,
  Building2,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { DocumentHeader } from './DocumentHeader';
import { useApp } from '../context/AppContext';
import { SalesInvoice, Quotation, CompanyProfile } from '../types';

interface PublicDocumentViewProps {
  documentId: string;
  documentType?: 'invoice' | 'quotation';
}

interface NormalizedDoc {
  id: string;
  isQuote: boolean;
  invoiceNo: string;
  date: string;
  referenceNo?: string;
  purchaseRequisition?: string;
  deliveryDate?: string;
  customerName: string;
  customerCompany?: string;
  customerAddress?: string;
  customerPhone?: string;
  items: Array<{
    name: string;
    type?: string;
    itemType?: string;
    region?: string;
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
  vatRate: number;
  vatAmount: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  splitPayments?: Record<string, number>;
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
  const [doc, setDoc] = useState<NormalizedDoc | null>(null);
  const [profile, setProfile] = useState<Partial<CompanyProfile>>(contextProfile || {});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Mark 2 Toolbar State
  const [showType, setShowType] = useState<boolean>(false);
  const [showRegion, setShowRegion] = useState<boolean>(false);
  const [isFit, setIsFit] = useState<boolean>(true);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Responsive Viewport Width
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [sheetHeight, setSheetHeight] = useState<number>(1123);

  // Resize listener
  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update profile from context
  useEffect(() => {
    if (contextProfile && Object.keys(contextProfile).length > 0) {
      setProfile((prev) => ({ ...prev, ...contextProfile }));
    }
  }, [contextProfile]);

  // Load and Normalize Document
  useEffect(() => {
    let isCancelled = false;
    const cleanId = (documentId || '').trim();
    const cleanLower = cleanId.toLowerCase();
    const cleanNoHash = cleanLower.replace(/^#/, '');

    const normalizeInvoice = (inv: SalesInvoice): NormalizedDoc => {
      const sub = Number(inv.subtotal) || Number(inv.grandTotal) || 0;
      const grand = Number(inv.grandTotal) || 0;
      const paid = Number(inv.paidAmount) || 0;
      const due =
        Number(inv.dueAmount) !== undefined
          ? Number(inv.dueAmount)
          : Math.max(0, grand - paid);

      return {
        id: inv.id,
        isQuote: false,
        invoiceNo: inv.invoiceNo,
        date: inv.date,
        referenceNo: inv.referenceNo,
        purchaseRequisition: inv.purchaseRequisition || inv.prNo,
        deliveryDate: inv.deliveryDate,
        customerName: inv.customerName || 'Valued Customer',
        customerCompany: inv.customerCompany,
        customerAddress: inv.customerAddress || 'Chattogram, Bangladesh',
        customerPhone: inv.customerPhone,
        items: Array.isArray(inv.items)
          ? inv.items.map((it) => ({
              name: it.name,
              type: it.type || it.itemType,
              itemType: it.itemType || it.type,
              region: it.region,
              unit: it.unit || 'pcs',
              qty: Number(it.qty) || 1,
              unitPrice: Number(it.unitPrice) || 0,
              totalPrice:
                Number(it.totalPrice) ||
                (Number(it.qty) || 1) * (Number(it.unitPrice) || 0),
              width: it.width,
              height: it.height,
              totalSqft: it.totalSqft,
              notes: it.notes,
            }))
          : [],
        subtotal: sub,
        discount: Number(inv.discount) || 0,
        vatRate: Number(inv.vatRate) || 0,
        vatAmount: Number(inv.vatAmount) || 0,
        grandTotal: grand,
        paidAmount: paid,
        dueAmount: due,
        splitPayments: inv.splitPayments,
        paymentMethod: inv.paymentMethod || 'Cash',
        notes: inv.notes,
        showRegionColumn: inv.showRegionColumn,
        showTypeColumn: inv.showTypeColumn,
      };
    };

    const normalizeQuote = (q: Quotation): NormalizedDoc => {
      const grand = Number(q.grandTotal) || 0;
      return {
        id: q.id,
        isQuote: true,
        invoiceNo: q.quoteNo,
        date: q.date,
        referenceNo: q.referenceNo,
        purchaseRequisition: q.purchaseRequisition || q.prNo,
        deliveryDate: q.validUntil,
        customerName: q.customerName || 'Valued Customer',
        customerCompany: q.customerCompany,
        customerAddress: q.customerAddress || 'Chattogram, Bangladesh',
        customerPhone: q.customerPhone,
        items: Array.isArray(q.items)
          ? q.items.map((it: any) => ({
              name: it.name,
              type: it.type || it.itemType,
              itemType: it.itemType || it.type,
              region: it.region,
              unit: it.unit || 'pcs',
              qty: Number(it.qty) || 1,
              unitPrice: Number(it.unitPrice) || 0,
              totalPrice:
                Number(it.totalPrice) ||
                (Number(it.qty) || 1) * (Number(it.unitPrice) || 0),
              width: it.width,
              height: it.height,
              totalSqft: it.totalSqft,
              notes: it.notes,
            }))
          : [],
        subtotal: grand,
        discount: 0,
        vatRate: 0,
        vatAmount: 0,
        grandTotal: grand,
        paidAmount: 0,
        dueAmount: grand,
        notes: q.notes,
        showRegionColumn: q.showRegionColumn,
        showTypeColumn: q.showTypeColumn,
      };
    };

    const findInMemory = (): NormalizedDoc | null => {
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
      const memDoc = findInMemory();
      if (memDoc) {
        if (!isCancelled) {
          setDoc(memDoc);
          if (memDoc.showTypeColumn) setShowType(true);
          if (memDoc.showRegionColumn) setShowRegion(true);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const res = await fetch(`/api/public/invoice/${encodeURIComponent(cleanNoHash)}`);
        if (!res.ok) {
          throw new Error('Invoice / Document record not found or link expired.');
        }
        const json = await res.json();
        if (json.success && json.data && !isCancelled) {
          if (json.profile && Object.keys(json.profile).length > 0) {
            setProfile((prev) => ({ ...prev, ...json.profile }));
          }

          let normalized: NormalizedDoc;
          if (json.type === 'quotation') {
            normalized = normalizeQuote(json.data);
          } else {
            normalized = normalizeInvoice(json.data);
          }

          setDoc(normalized);
          if (normalized.showTypeColumn) setShowType(true);
          if (normalized.showRegionColumn) setShowRegion(true);
        } else {
          throw new Error(json.message || 'Unable to retrieve document record.');
        }
      } catch (err: any) {
        if (!isCancelled) {
          const secondMem = findInMemory();
          if (secondMem) {
            setDoc(secondMem);
          } else {
            setLoadError(err.message || 'Failed to load invoice record.');
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

  // Generate Scannable QR Code
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
        .then((url) => setQrCodeDataUrl(url))
        .catch(() => {});
    }
  }, [doc]);

  // Measure sheet height
  useEffect(() => {
    if (sheetRef.current) {
      setSheetHeight(sheetRef.current.offsetHeight || 1123);
    }
  }, [doc, showType, showRegion, viewportWidth]);

  // Responsive Scaling
  const isMobile = viewportWidth < 820;
  // Fit to screen width smoothly with small margin
  const scale = isMobile && isFit ? Math.max(0.3, Math.min(1, (viewportWidth - 24) / 794)) : 1;
  const scaledWidth = Math.round(794 * scale);
  const scaledHeight = Math.round(sheetHeight * scale);
  const hasExtraCols = showType || showRegion;

  // Print Handlers
  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 200);
  };

  const handleDownloadPDF = async () => {
    if (!doc) return;
    setIsDownloadingPdf(true);
    try {
      const sheet = document.getElementById('a4-document-sheet');
      if (!sheet) {
        window.print();
        return;
      }

      const prevTransform = sheet.style.transform;
      const prevPosition = sheet.style.position;
      const prevTop = sheet.style.top;
      const prevLeft = sheet.style.left;

      // Temporarily reset transform for crystal-clear 1:1 render
      sheet.style.transform = 'none';
      sheet.style.position = 'static';

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const imgData = await htmlToImage.toPng(sheet, {
        quality: 1,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        width: 794,
        height: sheet.offsetHeight || 1123,
      });

      // Restore transform
      sheet.style.transform = prevTransform;
      sheet.style.position = prevPosition;
      sheet.style.top = prevTop;
      sheet.style.left = prevLeft;

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = ((sheet.offsetHeight || 1123) * pdfWidth) / 794;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, 297));
      pdf.save(
        `${doc.isQuote ? 'Quotation' : 'Invoice'}_${doc.invoiceNo.replace(/^#/, '')}.pdf`
      );
    } catch (err) {
      console.error('PDF error, falling back to print:', err);
      window.print();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-slate-300 p-8 rounded-2xl shadow-xl max-w-sm w-full flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-black text-white flex items-center justify-center mb-3 animate-pulse">
            <FileText className="w-6 h-6" />
          </div>
          <div className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Dot Color Communication
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1 mb-4">
            Loading Official Invoice...
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-full w-3/4 animate-pulse rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Error State
  if (loadError || !doc) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-slate-300 p-6 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-1">
            Invoice Record Not Found
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Could not locate record for <span className="font-mono font-bold text-slate-800">"{documentId}"</span>.
          </p>
          <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 text-left space-y-1">
            <div className="font-bold text-slate-800">{profile.name || 'Dot Color Communication'}</div>
            {profile.phone && <div>Hotline: {profile.phone}</div>}
            {profile.email && <div>Email: {profile.email}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col antialiased selection:bg-amber-100 selection:text-amber-900">
      {/* Print CSS Rules */}
      <style>{`
        @media print {
          body, html {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .public-no-print {
            display: none !important;
          }
          #public-invoice-scroll-area {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            overflow: visible !important;
          }
          #a4-document-sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 24px !important;
            width: 100% !important;
            max-width: 100% !important;
            transform: none !important;
            position: static !important;
          }
        }
      `}</style>

      {/* ============================================================== */}
      {/* TOP CONTROL BAR (Matches Image 2 exactly)                     */}
      {/* Document Icon | SALES INVOICE #... | 🔍 Zoom | COLS | Print | PDF */}
      {/* ============================================================== */}
      <div className="public-no-print bg-white border-b border-slate-200 p-2.5 sm:p-4 shadow-xs sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left Title Box: Black File Icon + Title + Invoice Number */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-black rounded-xl text-white shadow-2xs shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black text-slate-900 tracking-wider uppercase">
                {doc.isQuote ? 'PRICE QUOTATION' : 'SALES INVOICE'}
              </div>
              <div className="text-[11px] font-mono font-bold text-slate-600">
                #{doc.invoiceNo}
              </div>
            </div>
          </div>

          {/* Right Toolbar: Zoom + COLS + Print + Download */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Zoom / Fit Button */}
            {isMobile && (
              <button
                type="button"
                onClick={() => setIsFit((prev) => !prev)}
                className="p-2 sm:px-2.5 sm:py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                title={isFit ? 'View 100% Original Size' : 'Fit to Mobile Screen'}
              >
                <Search className="w-4 h-4 text-slate-700" />
                <span className="hidden sm:inline font-mono">{isFit ? '100%' : 'Fit'}</span>
              </button>
            )}

            {/* Column Toggles Pill: COLS: [ ] Type [ ] Region */}
            <div className="bg-amber-50 border border-amber-200/90 text-amber-900 px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-semibold shadow-2xs">
              <span className="font-black text-amber-950">COLS:</span>
              <label className="flex items-center gap-1 cursor-pointer select-none text-slate-800 hover:text-black">
                <input
                  type="checkbox"
                  checked={showType}
                  onChange={(e) => setShowType(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer"
                />
                <span>Type</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer select-none text-slate-800 hover:text-black">
                <input
                  type="checkbox"
                  checked={showRegion}
                  onChange={(e) => setShowRegion(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer"
                />
                <span>Region</span>
              </label>
            </div>

            {/* Print Document Button */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
              title="Print Document"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>{isPrinting ? 'Printing...' : 'Print'}</span>
            </button>

            {/* Direct PDF Download Button */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isDownloadingPdf}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
              title="Download PDF"
            >
              {isDownloadingPdf ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isDownloadingPdf ? 'PDF...' : 'Download'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* OFFICIAL A4 DOCUMENT SHEET (Matches Image 2 exactly)           */}
      {/* ============================================================== */}
      <main
        id="public-invoice-scroll-area"
        className={`flex-1 py-4 sm:py-6 px-1 sm:px-4 bg-slate-200/50 flex justify-center ${
          isMobile && !isFit ? 'overflow-x-auto' : 'overflow-x-hidden'
        }`}
      >
        <div
          style={
            isMobile && isFit
              ? {
                  width: `${scaledWidth}px`,
                  height: `${scaledHeight}px`,
                  position: 'relative',
                  overflow: 'hidden',
                  margin: '0 auto',
                  flexShrink: 0,
                }
              : {
                  width: '794px',
                  margin: '0 auto',
                  flexShrink: 0,
                }
          }
          className="print:w-full print:h-auto print:overflow-visible print:static"
        >
          {/* Actual 794px White A4 Page Sheet */}
          <div
            ref={sheetRef}
            id="a4-document-sheet"
            style={
              isMobile && isFit
                ? {
                    width: '794px',
                    minWidth: '794px',
                    maxWidth: '794px',
                    height: `${sheetHeight}px`,
                    transform: `scale(${scale})`,
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
            className="a4-page-sheet relative bg-white p-8 rounded-none shadow-xl print:shadow-none border border-slate-300 print:border-none flex flex-col justify-between text-black text-xs shrink-0 box-border print:static print:transform-none select-text"
          >
            {/* Top Document Header Content */}
            <div className="space-y-4">
              {/* Header: Logo on Right, Document Title Pill Badge */}
              <DocumentHeader
                badgeStyle={true}
                documentTitle={doc.isQuote ? 'PRICE/Quotation' : 'BILL/Invoice'}
                documentNo={doc.invoiceNo}
                documentDate={doc.date}
                referenceNo={doc.referenceNo}
                invoiceId={doc.id}
                isPadMode={false}
              />

              {/* Bill To & Document Details Box (Image 2 style) */}
              <div className="bg-white p-4 rounded-xl border-2 border-black shadow-2xs grid grid-cols-2 gap-4 text-xs">
                {/* Left Column: BILL TO */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase text-black tracking-wider block mb-1">
                    {doc.isQuote ? 'Quotation TO:' : 'BILL TO:'}
                  </span>
                  <div className="space-y-1 text-black">
                    <div className="flex items-baseline">
                      <span className="w-28 shrink-0 text-black font-bold">Customer Name :</span>
                      <span className="font-black text-black text-sm">{doc.customerName}</span>
                    </div>
                    {doc.customerCompany && (
                      <div className="flex items-baseline">
                        <span className="w-28 shrink-0 text-black font-bold">Company / Org :</span>
                        <span className="font-bold text-black">{doc.customerCompany}</span>
                      </div>
                    )}
                    <div className="flex items-baseline">
                      <span className="w-28 shrink-0 text-black font-bold">Address :</span>
                      <span className="text-black font-medium">{doc.customerAddress}</span>
                    </div>
                    {doc.customerPhone && (
                      <div className="flex items-baseline">
                        <span className="w-28 shrink-0 text-black font-bold">Phone :</span>
                        <span className="text-black font-medium">{doc.customerPhone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: DOCUMENT DETAILS with QR Code */}
                <div className="space-y-1.5 border-l-2 border-black pl-4 flex flex-col justify-between">
                  <span className="text-[11px] font-black uppercase text-black tracking-wider block mb-1">
                    DOCUMENT DETAILS:
                  </span>
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1 text-black flex-1">
                      <div className="flex items-baseline">
                        <span className="w-24 sm:w-28 shrink-0 text-black font-bold">
                          {doc.isQuote ? 'Quotation Date :' : 'Invoice Date :'}
                        </span>
                        <span className="font-black text-black">{doc.date}</span>
                      </div>
                      <div className="flex items-baseline">
                        <span className="w-24 sm:w-28 shrink-0 text-black font-bold">
                          {doc.isQuote ? 'Quotation # :' : 'Invoice # :'}
                        </span>
                        <span className="font-black text-black font-mono">#{doc.invoiceNo}</span>
                      </div>
                      {doc.referenceNo &&
                        !['nill', 'nil', 'none', 'null', '-'].includes(
                          doc.referenceNo.trim().toLowerCase()
                        ) && (
                          <div className="flex items-baseline">
                            <span className="w-24 sm:w-28 shrink-0 text-black font-bold">Ref/PO # :</span>
                            <span className="font-black text-black font-mono">{doc.referenceNo}</span>
                          </div>
                        )}
                      {doc.purchaseRequisition &&
                        !['nill', 'nil', 'none', 'null', '-'].includes(
                          doc.purchaseRequisition.trim().toLowerCase()
                        ) && (
                          <div className="flex items-baseline">
                            <span className="w-24 sm:w-28 shrink-0 text-black font-bold">PR # :</span>
                            <span className="font-black text-black font-mono">
                              {doc.purchaseRequisition}
                            </span>
                          </div>
                        )}
                      {doc.deliveryDate && (
                        <div className="flex items-baseline">
                          <span className="w-24 sm:w-28 shrink-0 text-black font-bold">
                            {doc.isQuote ? 'Valid Until :' : 'Delivery Target :'}
                          </span>
                          <span className="font-black text-black">{doc.deliveryDate}</span>
                        </div>
                      )}
                    </div>

                    {/* Scannable Invoice QR Code on Right */}
                    <div className="shrink-0 p-1 bg-white rounded-lg border-2 border-black flex items-center justify-center shadow-2xs">
                      {qrCodeDataUrl ? (
                        <img
                          src={qrCodeDataUrl}
                          alt={`QR #${doc.invoiceNo}`}
                          className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
                        />
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 flex items-center justify-center text-[9px] text-black font-bold">
                          QR
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table Container (Black header, crisp borders) */}
              <div className="rounded-xl border-2 border-black overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black text-white text-[11px] font-black uppercase tracking-wider border-b-2 border-black">
                      <th className={`py-2 text-center border-r border-black font-black text-white ${hasExtraCols ? 'w-10 px-1' : 'w-12 px-3'}`}>
                        SL
                      </th>
                      <th className="py-2 px-3 text-left border-r border-black font-black text-white">
                        SERVICE / ITEM DESCRIPTION
                      </th>
                      {showType && (
                        <th className="py-2 px-2 text-center border-r border-black font-black text-white w-20 text-[10.5px]">
                          TYPE
                        </th>
                      )}
                      {showRegion && (
                        <th className="py-2 px-2 text-center border-r border-black font-black text-white w-20 text-[10.5px]">
                          REGION
                        </th>
                      )}
                      <th className={`py-2 text-center border-r border-black font-black text-white ${hasExtraCols ? 'w-12 px-1 text-[10.5px]' : 'w-16 px-3'}`}>
                        UNIT
                      </th>
                      <th className={`py-2 text-center border-r border-black font-black text-white ${hasExtraCols ? 'w-16 px-1 text-[10.5px]' : 'w-24 px-3'}`}>
                        QTY / SQFT
                      </th>
                      <th className={`py-2 text-right border-r border-black font-black text-white ${hasExtraCols ? 'w-16 px-2 text-[10.5px]' : 'w-24 px-3'}`}>
                        RATETk
                      </th>
                      <th className={`py-2 text-right font-black text-white ${hasExtraCols ? 'w-20 px-2 text-[10.5px]' : 'w-28 px-3'}`}>
                        TOTALTk
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-xs bg-white text-black">
                    {doc.items.map((item, idx) => {
                      const hasDimensions = Boolean(item.width && item.height);
                      const singleSqft = hasDimensions
                        ? Number(((item.width || 0) * (item.height || 0)).toFixed(2))
                        : undefined;
                      const qty = Number(item.qty) || 1;
                      const totSqft =
                        item.totalSqft && item.totalSqft !== singleSqft
                          ? item.totalSqft
                          : singleSqft
                          ? Number((singleSqft * qty).toFixed(2))
                          : undefined;

                      return (
                        <tr
                          key={idx}
                          className={`border-b border-black last:border-b-0 hover:bg-slate-50/60 ${
                            idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                          }`}
                        >
                          <td className={`py-2 font-bold text-black border-r border-black text-center ${hasExtraCols ? 'px-1' : 'px-3'}`}>
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 border-r border-black">
                            <div className="font-black text-black text-xs leading-snug">{item.name}</div>
                            {hasDimensions && (
                              <div className="text-[11px] text-black font-bold mt-0.5">
                                Dimensions: {item.width}' × {item.height}' = {singleSqft} SqFt
                                {qty > 1 ? ` × ${qty} = ${totSqft} SqFt` : ''}
                              </div>
                            )}
                            {item.notes && (
                              <div className="text-[10px] text-black italic font-medium mt-0.5">
                                {item.notes}
                              </div>
                            )}
                          </td>
                          {showType && (
                            <td className="py-2 px-2 text-center font-bold text-black border-r border-black text-[11px] leading-tight">
                              {item.type || item.itemType || '-'}
                            </td>
                          )}
                          {showRegion && (
                            <td className="py-2 px-2 text-center font-bold text-black border-r border-black text-[11px] leading-tight">
                              {item.region || '-'}
                            </td>
                          )}
                          <td className={`py-2 text-center font-bold text-black border-r border-black ${hasExtraCols ? 'px-1 text-[11px]' : 'px-3'}`}>
                            {item.unit || 'pcs'}
                          </td>
                          <td className={`py-2 text-center font-black text-black border-r border-black ${hasExtraCols ? 'px-1' : 'px-3'}`}>
                            {totSqft ? totSqft : qty}
                          </td>
                          <td className={`py-2 text-right font-black text-black border-r border-black ${hasExtraCols ? 'px-2' : 'px-3'}`}>
                            {Number(item.unitPrice).toLocaleString()}
                          </td>
                          <td className={`py-2 text-right font-black text-black ${hasExtraCols ? 'px-2' : 'px-3'}`}>
                            {Number(item.totalPrice).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals & Financials Box (Right-aligned, matching Image 2) */}
              <div className="grid grid-cols-12 gap-6 pt-2">
                {/* Left side notes */}
                <div className="col-span-7 space-y-2">
                  {doc.notes && (
                    <div className="bg-white p-3 rounded-xl border-2 border-black text-xs shadow-2xs">
                      <strong className="text-black font-black block mb-1 uppercase tracking-wider text-[11px]">
                        Terms & Conditions / Remarks:
                      </strong>
                      <div className="text-black font-medium whitespace-pre-line leading-relaxed text-xs">
                        {doc.notes}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right side totals breakdown */}
                <div className="col-span-5 space-y-1 text-xs text-black">
                  <div className="flex justify-between text-black font-bold pb-1">
                    <span>Subtotal:</span>
                    <span className="font-bold text-black">
                      ৳{Number(doc.subtotal).toLocaleString()}
                    </span>
                  </div>

                  {doc.discount > 0 && (
                    <div className="flex justify-between text-black font-bold pb-1">
                      <span>Discount:</span>
                      <span className="font-bold text-black">
                        -৳{Number(doc.discount).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {doc.vatAmount > 0 && (
                    <div className="flex justify-between text-black font-bold pb-1">
                      <span>VAT ({doc.vatRate}%):</span>
                      <span className="font-bold text-black">
                        +৳{Number(doc.vatAmount).toLocaleString()}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm font-black py-1.5 border-t border-black text-black">
                    <span>Grand Total:</span>
                    <span className="text-black font-black text-base">
                      ৳{Number(doc.grandTotal).toLocaleString()}
                    </span>
                  </div>

                  {!doc.isQuote && (
                    <>
                      {/* Split payments breakdown if available */}
                      {doc.splitPayments && Object.keys(doc.splitPayments).length > 0 ? (
                        <div className="space-y-1 text-[11px] pt-1 border-t-2 border-double border-black text-black">
                          {Object.entries(doc.splitPayments)
                            .filter(
                              ([channel, amt]) =>
                                channel.toLowerCase() !== 'due' && (Number(amt) || 0) > 0
                            )
                            .map(([channel, amt]) => {
                              const cl = channel.toLowerCase().replace(/[\s_-]/g, '');
                              const label =
                                cl === 'cash' || cl === 'cashinhand'
                                  ? 'Paid Cash:'
                                  : cl === 'card' || cl === 'bank' || cl.includes('bank')
                                  ? 'Paid Card / Bank:'
                                  : cl === 'bkash'
                                  ? 'Paid bKash:'
                                  : cl === 'nagad'
                                  ? 'Paid Nagad:'
                                  : `Paid (${channel}):`;
                              return (
                                <div key={channel} className="flex justify-between text-black">
                                  <span>{label}</span>
                                  <span className="font-bold text-black">
                                    ৳{(Number(amt) || 0).toLocaleString()}
                                  </span>
                                </div>
                              );
                            })}
                          <div className="flex justify-between text-xs py-1 border-t border-black text-black">
                            <span className="font-bold text-black">Total Paid:</span>
                            <span className="font-bold text-black">
                              ৳{Number(doc.paidAmount).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between text-xs py-1 border-t-2 border-double border-black text-black">
                          <span className="font-bold text-black">
                            Total Paid ({doc.paymentMethod || 'Cash'}):
                          </span>
                          <span className="font-bold text-black">
                            ৳{Number(doc.paidAmount).toLocaleString()}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between text-xs font-black text-black pt-1 border-t border-black">
                        <span>Balance Due:</span>
                        <span className="font-black text-black">
                          ৳{Number(doc.dueAmount).toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Signatures & Footer (Image 2 style) */}
            <div className="pt-10">
              <div className="flex justify-between items-end text-center text-xs text-black">
                <div>
                  <div className="w-44 border-t border-black mx-auto mb-1" />
                  <span className="font-bold text-black">Customer's Signature</span>
                </div>
                <div>
                  <div className="w-48 border-t border-black mx-auto mb-1" />
                  <span className="font-bold text-black">
                    For {profile.name || 'Dot Color Communication'}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-2 text-center text-[10px] text-slate-500">
                This is system generated document no signature required
              </div>

              {/* Company Address & Phone Footer */}
              <div className="text-center text-[10px] text-slate-700 font-medium leading-relaxed pt-1 border-t border-slate-300 mt-2">
                <div>
                  {profile.officeAddress ||
                    profile.address ||
                    'Nazir Ahmed Chowdhury Road, Raja Pukur Lane, G A Bhaban Mat, Andarkilla, Chattogram'}
                </div>
                <div>
                  Call-{profile.phone || '01730581687'}, E-mail :{' '}
                  {profile.email || 'info@bdhostt.com'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
