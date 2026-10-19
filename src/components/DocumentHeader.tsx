import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { BrandLogo } from './BrandLogo';
import { useApp } from '../context/AppContext';
export interface DocumentHeaderProps {
    documentTitle: string;
    documentSubtitle?: string;
    documentNo?: string;
    documentDate?: string;
    referenceNo?: string;
    compact?: boolean; // For 80mm POS slips
    className?: string;
    isPadMode?: boolean;
    padTopMarginMm?: number;
    invoiceId?: string;
    badgeStyle?: boolean; // For Image 2 style: pill badge directly under top-right logo
}
export const DocumentHeader: React.FC<DocumentHeaderProps> = ({ documentTitle, documentSubtitle, compact = false, className = '', isPadMode = false, padTopMarginMm = 44.45, invoiceId, documentNo, badgeStyle = false, }) => {
    const { profile } = useApp();
    const [posQrDataUrl, setPosQrDataUrl] = useState<string>('');
    // Generate QR code for compact POS thermal slips if needed
    useEffect(() => {
        if (compact) {
            const origin = typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null'
                ? window.location.origin
                : 'https://dotcolor.onrender.com';
            const targetInvoiceId = invoiceId || documentNo || '';
            const invoiceQrUrl = `${origin}/?invoiceId=${encodeURIComponent(targetInvoiceId)}`;
            QRCode.toDataURL(invoiceQrUrl, {
                width: 100,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#ffffff',
                },
            })
                .then((url) => setPosQrDataUrl(url))
                .catch((err) => console.error('Failed to generate POS QR Code:', err));
        }
    }, [compact, invoiceId, documentNo]);
    // Compact layout for 80mm POS thermal slips
    if (compact) {
        return (<div className={`pb-3 border-b border-dashed border-black text-black ${className}`}>
        {/* Top Header Row: Logo on Left, QR on Right */}
        <div className="flex items-center justify-between gap-2">
          {/* 1. Logo */}
          <div className="shrink-0">
            <BrandLogo size="sm" showTagline={false}/>
            <div className="text-[8px] font-black text-black uppercase tracking-wider mt-0.5">
              Printing & Packaging
            </div>
          </div>

          {/* 2. QR Code */}
          <div className="shrink-0 flex items-center bg-white p-0.5 rounded border border-black">
            {posQrDataUrl ? (<img src={posQrDataUrl} alt="Invoice QR" className="w-9 h-9 object-contain"/>) : (<div className="w-9 h-9 bg-white flex items-center justify-center text-[7px] text-black font-bold">
                QR
              </div>)}
          </div>
        </div>

        {/* Centered Document Title */}
        <div className="text-center mt-2 pt-1 border-t border-dotted border-black">
          <div className="font-black text-xs uppercase tracking-widest text-black">
            {documentTitle}
          </div>
          {documentSubtitle && (<div className="text-[9px] font-bold text-black">{documentSubtitle}</div>)}
        </div>
      </div>);
    }
    // Standard Full Layout (A4 Invoice, Challan, Work Order, Quotation, Reports)
    return (<div className={`w-full text-black ${className}`}>
      {/* Pad Header Spacer (Reserved blank space for pre-printed letterhead pad) */}
      <div className={`pad-header-spacer ${isPadMode ? 'block' : 'hidden'}`} style={{ height: `${padTopMarginMm}mm` }}>
        {isPadMode && (<div className="print:hidden h-full flex flex-col items-center justify-center border-2 border-dashed border-indigo-300 bg-indigo-50/50 rounded-xl p-2.5 text-center my-1">
            <span className="font-black text-xs text-indigo-900 tracking-wider uppercase">({padTopMarginMm}mm)
            </span>
            <span className="text-[10px] text-indigo-600 mt-0.5">Your pre-printed letterhead header will appear in this space during printing</span>
          </div>)}
      </div>

      {badgeStyle ? (
        /* Image 2 style: Top-Right Company Logo with BILL/Invoice pill badge directly below, matching width */
        <div className="flex items-center justify-end pb-0">
          <div className="inline-flex flex-col items-stretch w-[170px] sm:w-[180px]">
            {/* Company Logo: hidden in pad mode */}
            <div className={`pad-header-branding w-full flex items-center justify-center ${isPadMode ? 'hidden print:hidden' : ''}`}>
              <img src={profile?.logoUrl &&
                profile.logoUrl !== '/dotcolor-logo.svg' &&
                profile.logoUrl !== '/dotcolor-official-logo.png'
                ? profile.logoUrl
                : '/dotcolor-official-logo.png'} alt={profile?.name || 'Dot Color Communication'} className="w-full h-auto block select-none"/>
            </div>
            {/* Document Title Badge (e.g. BILL/Invoice or BILL/Quotation): Visible in BOTH normal and pad mode */}
            <div className={`w-full bg-[#18181B] text-white py-1.5 rounded-lg text-xs sm:text-[13px] font-black tracking-wider shadow-2xs text-center flex items-center justify-center select-none ${!isPadMode ? 'mt-2.5' : 'mt-0'}`}>
              {documentTitle}
            </div>
          </div>
        </div>) : (
        /* Standard Full Layout */
        <div className={`pad-header-branding flex items-center justify-end pb-2 ${isPadMode ? 'hidden print:hidden' : ''}`}>
          <div className="flex flex-col items-end text-right">
            <BrandLogo size="xl" className="items-end text-right" showTagline={profile.showTagline !== false} tagline={profile.tagline || 'YOUR VISION, OUR CREATION!'} taglineClassName="text-[11px] sm:text-[12px] uppercase font-black tracking-widest text-black mt-1 text-right"/>
            {profile.showCategory !== false && (<div className="text-xs sm:text-[13px] font-black text-black tracking-wide mt-1 text-right">
                ({profile.category || 'Printing, Packaging, Advertising & Brand Promotions'})
              </div>)}
          </div>
        </div>)}

      {/* Centered Document Title with clean black divider (omitted if badgeStyle is active) */}
      {!badgeStyle && (<>
          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-black"/>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-5 py-0.5 text-base sm:text-lg font-black uppercase tracking-widest text-black border-2 border-black rounded-lg shadow-2xs">
                {documentTitle}
              </span>
            </div>
          </div>
          {documentSubtitle && (<div className="text-center text-xs font-bold text-black -mt-1 mb-2">
              {documentSubtitle}
            </div>)}
        </>)}
    </div>);
};
