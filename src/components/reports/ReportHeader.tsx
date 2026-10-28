import React from 'react';
import { CompanyProfile, Language } from '../../types';
import { BrandLogo } from '../BrandLogo';
import { DocumentHeader } from '../DocumentHeader';
import { Printer, FileSpreadsheet, Calendar, MapPin, Phone, Mail, ShieldCheck } from 'lucide-react';
interface ReportHeaderProps {
    titleEn: string;
    titleBn: string;
    categoryEn: string;
    categoryBn: string;
    profile: CompanyProfile;
    language: Language;
    dateRangeText: string;
    locationFilter: string;
    onPrint?: () => void;
    onExportExcel?: () => void;
}
export const ReportHeader: React.FC<ReportHeaderProps> = ({ titleEn, titleBn, categoryEn, categoryBn, profile, language, dateRangeText, locationFilter, onPrint, onExportExcel, }) => {
    const isBn = language === 'bn';
    const companyAddress = profile.officeAddress || profile.factoryAddress || 'South Noya Para, Banglabazar, Cox\'s Bazar, Chattogram, Bangladesh.';
    const companyPhone = profile.phone || '01846100900, 01756007600';
    const companyEmail = profile.emails?.[0] || 'info@dotcom.com.bd';
    return (<div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
      {/* Screen action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 print:hidden">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/60">
            {categoryEn}
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1.5 flex items-center gap-2">
            <span>{titleEn}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
            <span className="flex items-center gap-1 font-medium text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400"/>
              {dateRangeText}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400"/>
              {locationFilter === 'ALL'
            ?
                'All Locations (Office & Factory)'
            : locationFilter}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onExportExcel && (
            <button type="button" onClick={onExportExcel} className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all shadow-2xs cursor-pointer" title="Export this report to Microsoft Excel (.xlsx)">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600"/>
              <span>{'Export Excel'}</span>
            </button>
          )}
          {onPrint && (
            <button type="button" onClick={onPrint} className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-2xs cursor-pointer" title="Print or Save as PDF">
              <Printer className="w-4 h-4"/>
              <span>{'Print / PDF'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Official Print Letterhead Header (visible on print & preview) */}
      <div className="pt-2">
        <DocumentHeader documentTitle={titleEn} documentSubtitle={`Period: ${dateRangeText} • Location: ${locationFilter || 'All Branches'} • Generated: ${new Date().toLocaleDateString()}`}/>
      </div>
    </div>);
};
