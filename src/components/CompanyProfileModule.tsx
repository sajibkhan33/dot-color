import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CompanyServiceCapability, CompanyPremise } from '../types';
import { INITIAL_COMPANY_PROFILE } from '../data/initialData';
import { BrandLogo } from './BrandLogo';
import { DocumentHeader } from './DocumentHeader';
import { Building2, Factory, Phone, Mail, MapPin, Globe2, CheckCircle2, Edit2, Save, Palette, Printer, Sparkles, Gift, Boxes, Calendar, Layers, Award, Plus, Trash2, X, RotateCcw, ArrowUp, ArrowDown, Shield, CreditCard, FileText, SlidersHorizontal, Upload, Image as ImageIcon, QrCode, Lock, } from 'lucide-react';
const ICON_MAP: Record<string, React.FC<{
    className?: string;
}>> = {
    Printer,
    Layers,
    Gift,
    Boxes,
    Palette,
    Sparkles,
    Calendar,
    Building2,
    Factory,
    Award,
    Globe2,
    Shield,
    FileText,
};
const COLOR_MAP: Record<string, {
    badge: string;
    text: string;
    bg: string;
    border: string;
}> = {
    amber: { badge: 'bg-amber-100/70 text-amber-800 border-amber-200', text: 'text-amber-600', bg: 'bg-amber-50/70', border: 'hover:border-amber-400' },
    blue: { badge: 'bg-blue-100/70 text-blue-800 border-blue-200', text: 'text-blue-600', bg: 'bg-blue-50/70', border: 'hover:border-blue-400' },
    emerald: { badge: 'bg-emerald-100/70 text-emerald-800 border-emerald-200', text: 'text-emerald-600', bg: 'bg-emerald-50/70', border: 'hover:border-emerald-400' },
    purple: { badge: 'bg-purple-100/70 text-purple-800 border-purple-200', text: 'text-purple-600', bg: 'bg-purple-50/70', border: 'hover:border-purple-400' },
    rose: { badge: 'bg-rose-100/70 text-rose-800 border-rose-200', text: 'text-rose-600', bg: 'bg-rose-50/70', border: 'hover:border-rose-400' },
    indigo: { badge: 'bg-indigo-100/70 text-indigo-800 border-indigo-200', text: 'text-indigo-600', bg: 'bg-indigo-50/70', border: 'hover:border-indigo-400' },
    cyan: { badge: 'bg-cyan-100/70 text-cyan-800 border-cyan-200', text: 'text-cyan-600', bg: 'bg-cyan-50/70', border: 'hover:border-cyan-400' },
    teal: { badge: 'bg-teal-100/70 text-teal-800 border-teal-200', text: 'text-teal-600', bg: 'bg-teal-50/70', border: 'hover:border-teal-400' },
};
export const CompanyProfileModule: React.FC = () => {
    const { profile, updateProfile, language, activeStaff, checkPermission } = useApp();
    const isSuperAdmin = (activeStaff?.role || '').toLowerCase() === 'super admin' ||
        (activeStaff?.role || '').toLowerCase() === 'superadmin' ||
        activeStaff?.customRoleId === 'role-superadmin' ||
        (activeStaff?.name || '').toLowerCase().includes('super admin');
    const canEditCompany = isSuperAdmin || Boolean(checkPermission && checkPermission('settings.view'));
    const canManagePayments = isSuperAdmin ||
        Boolean(checkPermission &&
            (checkPermission('settings.manage_payments') ||
                checkPermission('settings.view')));
    const [isFullEditorOpen, setIsFullEditorOpen] = useState(false);
    const [activeEditorTab, setActiveEditorTab] = useState<'general' | 'premises' | 'services' | 'banking'>('general');
    const [saveNotification, setSaveNotification] = useState<string | null>(null);
    // Quick Single-Field Edit Modal State
    const [quickEditModal, setQuickEditModal] = useState<{
        open: boolean;
        titleEn: string;
        titleBn: string;
        fieldKey: 'phone' | 'email' | 'vatTaxNumber' | 'incomeTaxRate' | 'experience' | 'factory' | 'office' | 'brand' | 'headerCard' | 'logo' | 'companyName';
        val1: string;
        val2?: string;
        val3?: string;
        val4?: string;
        val5?: string;
    }>({
        open: false,
        titleEn: '',
        titleBn: '',
        fieldKey: 'phone',
        val1: '',
    });
    const handleSaveQuickEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (quickEditModal.fieldKey === 'phone') {
            updateProfile({ phone: quickEditModal.val1 });
        }
        else if (quickEditModal.fieldKey === 'email') {
            updateProfile({ emails: [quickEditModal.val1] });
        }
        else if (quickEditModal.fieldKey === 'vatTaxNumber') {
            updateProfile({ vatTaxNumber: quickEditModal.val1 });
        }
        else if (quickEditModal.fieldKey === 'incomeTaxRate') {
            const parsedRate = Math.max(0, Math.min(100, Number(quickEditModal.val1) || 0));
            updateProfile({ incomeTaxRate: parsedRate });
        }
        else if (quickEditModal.fieldKey === 'experience') {
            updateProfile({
                experienceYears: Number(quickEditModal.val1) || 6,
                category: quickEditModal.val2 || profile.category,
            });
        }
        else if (quickEditModal.fieldKey === 'headerCard') {
            const emailsArray = (quickEditModal.val3 || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            updateProfile({
                factoryAddress: quickEditModal.val1,
                phone: quickEditModal.val2,
                emails: emailsArray.length > 0 ? emailsArray : profile.emails,
                facebook: quickEditModal.val4,
                qrCodeValue: quickEditModal.val5,
            });
        }
        else if (quickEditModal.fieldKey === 'logo') {
            updateProfile({ logoUrl: quickEditModal.val1 });
        }
        else if (quickEditModal.fieldKey === 'companyName') {
            const newName = quickEditModal.val1.trim();
            const newNameBn = quickEditModal.val2 !== undefined ? quickEditModal.val2.trim() : (profile.nameBn || '');
            const shouldSyncFooter = !profile.footerBrandText ||
                profile.footerBrandText === INITIAL_COMPANY_PROFILE.footerBrandText ||
                profile.footerBrandText === profile.name;
            updateProfile({
                name: newName,
                nameBn: newNameBn,
                ...(shouldSyncFooter ? { footerBrandText: newName } : {}),
            });
            setFormData((prev) => ({
                ...prev,
                name: newName,
                nameBn: newNameBn,
                ...(shouldSyncFooter ? { footerBrandText: newName } : {}),
            }));
        }
        setQuickEditModal((prev) => ({ ...prev, open: false }));
        setSaveNotification('Information updated successfully!');
        setTimeout(() => setSaveNotification(null), 3000);
    };
    // Dedicated Footer & Copyright Settings Modal State & Handlers
    const [footerModalOpen, setFooterModalOpen] = useState(false);
    const [footerFormData, setFooterFormData] = useState({
        footerBrandText: profile.footerBrandText || profile.name || 'DotColorCommunication Sales, POS & ERP',
        footerCopyrightText: profile.footerCopyrightText || `© ${new Date().getFullYear()}`,
        footerPoweredByText: profile.footerPoweredByText || 'BD HOSTT',
        footerPoweredByUrl: profile.footerPoweredByUrl || 'https://www.bdhost.com',
        footerHotline: profile.footerHotline || '01846100900',
        footerShowPoweredBy: profile.footerShowPoweredBy ?? true,
    });
    const handleOpenFooterSettings = () => {
        setFooterFormData({
            footerBrandText: profile.footerBrandText || profile.name || 'DotColorCommunication Sales, POS & ERP',
            footerCopyrightText: profile.footerCopyrightText || `© ${new Date().getFullYear()}`,
            footerPoweredByText: profile.footerPoweredByText || 'BD HOSTT',
            footerPoweredByUrl: profile.footerPoweredByUrl || 'https://www.bdhost.com',
            footerHotline: profile.footerHotline || '01846100900',
            footerShowPoweredBy: profile.footerShowPoweredBy ?? true,
        });
        setFooterModalOpen(true);
    };
    const handleSaveFooterSettings = (e: React.FormEvent) => {
        e.preventDefault();
        updateProfile({
            footerBrandText: footerFormData.footerBrandText.trim(),
            footerCopyrightText: footerFormData.footerCopyrightText.trim(),
            footerPoweredByText: footerFormData.footerPoweredByText.trim(),
            footerPoweredByUrl: footerFormData.footerPoweredByUrl.trim(),
            footerHotline: footerFormData.footerHotline.trim(),
            footerShowPoweredBy: footerFormData.footerShowPoweredBy,
        });
        setFooterModalOpen(false);
        setSaveNotification('Footer settings saved successfully!');
        setTimeout(() => setSaveNotification(null), 3000);
    };
    useEffect(() => {
        const handleCustomOpen = () => {
            handleOpenFooterSettings();
        };
        window.addEventListener('open-footer-settings', handleCustomOpen);
        return () => window.removeEventListener('open-footer-settings', handleCustomOpen);
    }, [profile]);
    // Single Service Add/Edit Modal
    const [serviceModalOpen, setServiceModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<CompanyServiceCapability | null>(null);
    const [serviceFormData, setServiceFormData] = useState<Omit<CompanyServiceCapability, 'id'>>({
        titleEn: '',
        titleBn: '',
        descEn: '',
        descBn: '',
        iconName: 'Printer',
        color: 'amber',
    });
    // Master Form State for Full Page Editor
    const [formData, setFormData] = useState({
        // General
        name: profile.name || '',
        nameBn: profile.nameBn || '',
        tagline: profile.tagline || '',
        taglineBn: profile.taglineBn || '',
        category: profile.category || '',
        showTagline: profile.showTagline !== false,
        showCategory: profile.showCategory !== false,
        experienceYears: profile.experienceYears || 6,
        phone: profile.phone || '',
        emails: (profile.emails || []).join(', '),
        website: profile.website || '',
        facebook: profile.facebook || '',
        vatTaxNumber: profile.vatTaxNumber || '',
        incomeTaxRate: profile.incomeTaxRate !== undefined ? profile.incomeTaxRate : 0,
        tradeLicense: profile.tradeLicense || '',
        currency: profile.currency || 'BDT',
        currencySymbol: profile.currencySymbol || "Tk",
        logoUrl: profile.logoUrl &&
            (profile.logoUrl.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALL') ||
                profile.logoUrl.includes('ALLCAYAAACHp'))
            ? '/dotcolor-logo.svg'
            : profile.logoUrl || '',
        qrCodeValue: profile.qrCodeValue || '',
        // Factory Premise
        factoryUnitBadge: profile.factoryUnitBadge || 'DIGITAL PRINTING & FABRICATION UNIT',
        factoryName: profile.factoryName || 'DotColor Production & Printing Plant',
        factoryNameBn: profile.factoryNameBn || "Dot Color   Print",
        factoryAddress: profile.factoryAddress || '',
        factoryDescription: profile.factoryDescription ||
            'Equipped with high-resolution large-format solvent, eco-solvent, UV flatbed printers, laser cutting & CNC machines.',
        factoryPhone: profile.factoryPhone || profile.phone || '',
        // Office Premise
        officeUnitBadge: profile.officeUnitBadge || 'CORPORATE HEAD OFFICE & SUPPORT CENTER',
        officeName: profile.officeName || 'DotColor Corporate Office',
        officeNameBn: profile.officeNameBn || "Dot Color",
        officeAddress: profile.officeAddress || '',
        officeDescription: profile.officeDescription ||
            'Client consultation lounge, creative graphic design studio, accounts & billing desk, and client support desk.',
        officePhone: profile.officePhone || profile.phone || '',
        // Services section
        servicesSectionTitle: profile.servicesSectionTitle || 'Our Specialized Service Capabilities',
        servicesSectionTitleBn: profile.servicesSectionTitleBn || "Dot Color",
        servicesSectionSubtitle: profile.servicesSectionSubtitle ||
            'End-to-end design, printing, corporate gifting, signage and event coordination.',
        servicesSectionSubtitleBn: profile.servicesSectionSubtitleBn || "+",
        servicesCapabilities: profile.servicesCapabilities || INITIAL_COMPANY_PROFILE.servicesCapabilities || [],
        // Banking
        bankName: profile.bankName || '',
        bankAccount: profile.bankAccount || '',
        bankBranch: profile.bankBranch || '',
        routingNumber: profile.routingNumber || '',
        bkashNagadNumber: profile.bkashNagadNumber || profile.phone || '',
        bankingNotes: profile.bankingNotes ||
            'Clients can transfer invoices via BRAC Bank, bKash Merchant, or Cash counters.',
    });
    const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            if (result) {
                setFormData((prev) => ({ ...prev, logoUrl: result }));
                updateProfile({ logoUrl: result });
                setSaveNotification('Company logo uploaded successfully!');
                setTimeout(() => setSaveNotification(null), 3000);
            }
        };
        reader.readAsDataURL(file);
    };
    const handleRemoveLogo = () => {
        setFormData((prev) => ({ ...prev, logoUrl: '' }));
        updateProfile({ logoUrl: '' });
        setSaveNotification('Reset to default logo!');
        setTimeout(() => setSaveNotification(null), 3000);
    };
    const syncFormWithProfile = () => {
        setFormData({
            name: profile.name || '',
            nameBn: profile.nameBn || '',
            tagline: profile.tagline || '',
            taglineBn: profile.taglineBn || '',
            category: profile.category || '',
            showTagline: profile.showTagline !== false,
            showCategory: profile.showCategory !== false,
            experienceYears: profile.experienceYears || 6,
            phone: profile.phone || '',
            emails: (profile.emails || []).join(', '),
            website: profile.website || '',
            facebook: profile.facebook || '',
            vatTaxNumber: profile.vatTaxNumber || '',
            incomeTaxRate: profile.incomeTaxRate !== undefined ? profile.incomeTaxRate : 0,
            tradeLicense: profile.tradeLicense || '',
            currency: profile.currency || 'BDT',
            currencySymbol: profile.currencySymbol || "Tk",
            logoUrl: profile.logoUrl &&
                (profile.logoUrl.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALL') ||
                    profile.logoUrl.includes('ALLCAYAAACHp'))
                ? '/dotcolor-logo.svg'
                : profile.logoUrl || '',
            qrCodeValue: profile.qrCodeValue || '',
            factoryUnitBadge: profile.factoryUnitBadge || 'DIGITAL PRINTING & FABRICATION UNIT',
            factoryName: profile.factoryName || 'DotColor Production & Printing Plant',
            factoryNameBn: profile.factoryNameBn || "Dot Color   Print",
            factoryAddress: profile.factoryAddress || '',
            factoryDescription: profile.factoryDescription ||
                'Equipped with high-resolution large-format solvent, eco-solvent, UV flatbed printers, laser cutting & CNC machines.',
            factoryPhone: profile.factoryPhone || profile.phone || '',
            officeUnitBadge: profile.officeUnitBadge || 'CORPORATE HEAD OFFICE & SUPPORT CENTER',
            officeName: profile.officeName || 'DotColor Corporate Office',
            officeNameBn: profile.officeNameBn || "Dot Color",
            officeAddress: profile.officeAddress || '',
            officeDescription: profile.officeDescription ||
                'Client consultation lounge, creative graphic design studio, accounts & billing desk, and client support desk.',
            officePhone: profile.officePhone || profile.phone || '',
            servicesSectionTitle: profile.servicesSectionTitle || 'Our Specialized Service Capabilities',
            servicesSectionTitleBn: profile.servicesSectionTitleBn || "Dot Color",
            servicesSectionSubtitle: profile.servicesSectionSubtitle ||
                'End-to-end design, printing, corporate gifting, signage and event coordination.',
            servicesSectionSubtitleBn: profile.servicesSectionSubtitleBn || "+",
            servicesCapabilities: profile.servicesCapabilities || INITIAL_COMPANY_PROFILE.servicesCapabilities || [],
            bankName: profile.bankName || '',
            bankAccount: profile.bankAccount || '',
            bankBranch: profile.bankBranch || '',
            routingNumber: profile.routingNumber || '',
            bkashNagadNumber: profile.bkashNagadNumber || profile.phone || '',
            bankingNotes: profile.bankingNotes ||
                'Clients can transfer invoices via BRAC Bank, bKash Merchant, or Cash counters.',
        });
    };
    const handleOpenFullEditor = (tab: 'general' | 'premises' | 'services' | 'banking' = 'general') => {
        syncFormWithProfile();
        setActiveEditorTab(tab);
        setIsFullEditorOpen(true);
    };
    const handleSaveFullProfile = (e?: React.FormEvent) => {
        if (e)
            e.preventDefault();
        const emailsArray = formData.emails
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        const shouldSyncFooter = !profile.footerBrandText ||
            profile.footerBrandText === INITIAL_COMPANY_PROFILE.footerBrandText ||
            profile.footerBrandText === profile.name;
        updateProfile({
            name: formData.name.trim(),
            nameBn: formData.nameBn.trim(),
            ...(shouldSyncFooter ? { footerBrandText: formData.name.trim() } : {}),
            tagline: formData.tagline,
            taglineBn: formData.taglineBn,
            category: formData.category,
            showTagline: formData.showTagline,
            showCategory: formData.showCategory,
            experienceYears: Number(formData.experienceYears) || 6,
            phone: formData.phone,
            emails: emailsArray.length > 0 ? emailsArray : ['info@dotcolorcommunication.com'],
            website: formData.website,
            facebook: formData.facebook,
            vatTaxNumber: formData.vatTaxNumber,
            incomeTaxRate: Math.max(0, Math.min(100, Number(formData.incomeTaxRate) || 0)),
            tradeLicense: formData.tradeLicense,
            currency: formData.currency,
            currencySymbol: formData.currencySymbol,
            logoUrl: formData.logoUrl,
            qrCodeValue: formData.qrCodeValue,
            factoryUnitBadge: formData.factoryUnitBadge,
            factoryName: formData.factoryName,
            factoryNameBn: formData.factoryNameBn,
            factoryAddress: formData.factoryAddress,
            factoryDescription: formData.factoryDescription,
            factoryPhone: formData.factoryPhone,
            officeUnitBadge: formData.officeUnitBadge,
            officeName: formData.officeName,
            officeNameBn: formData.officeNameBn,
            officeAddress: formData.officeAddress,
            officeDescription: formData.officeDescription,
            officePhone: formData.officePhone,
            servicesSectionTitle: formData.servicesSectionTitle,
            servicesSectionTitleBn: formData.servicesSectionTitleBn,
            servicesSectionSubtitle: formData.servicesSectionSubtitle,
            servicesSectionSubtitleBn: formData.servicesSectionSubtitleBn,
            servicesCapabilities: formData.servicesCapabilities,
            bankName: formData.bankName,
            bankAccount: formData.bankAccount,
            bankBranch: formData.bankBranch,
            routingNumber: formData.routingNumber,
            bkashNagadNumber: formData.bkashNagadNumber,
            bankingNotes: formData.bankingNotes,
        });
        setIsFullEditorOpen(false);
        setSaveNotification('Company profile updated successfully!');
        setTimeout(() => setSaveNotification(null), 4000);
    };
    // Restore defaults
    const handleRestoreDefaults = () => {
        if (window.confirm('Are you sure you want to reset company profile to original defaults?')) {
            updateProfile({ ...INITIAL_COMPANY_PROFILE });
            syncFormWithProfile();
            setSaveNotification('Original defaults restored.');
            setTimeout(() => setSaveNotification(null), 4000);
        }
    };
    // Quick Service Modal Handlers
    const handleOpenAddService = () => {
        setEditingService(null);
        setServiceFormData({
            titleEn: '',
            titleBn: '',
            descEn: '',
            descBn: '',
            iconName: 'Printer',
            color: 'amber',
        });
        setServiceModalOpen(true);
    };
    const handleOpenEditService = (srv: CompanyServiceCapability) => {
        setEditingService(srv);
        setServiceFormData({
            titleEn: srv.titleEn,
            titleBn: srv.titleBn,
            descEn: srv.descEn,
            descBn: srv.descBn,
            iconName: srv.iconName || 'Printer',
            color: srv.color || 'amber',
        });
        setServiceModalOpen(true);
    };
    const handleSaveServiceModal = (e: React.FormEvent) => {
        e.preventDefault();
        const currentList = profile.servicesCapabilities || INITIAL_COMPANY_PROFILE.servicesCapabilities || [];
        if (editingService) {
            const updated = currentList.map((s) => s.id === editingService.id
                ? {
                    ...s,
                    ...serviceFormData,
                }
                : s);
            updateProfile({ servicesCapabilities: updated });
        }
        else {
            const newService: CompanyServiceCapability = {
                id: `srv-${Date.now()}`,
                ...serviceFormData,
            };
            updateProfile({ servicesCapabilities: [...currentList, newService] });
        }
        setServiceModalOpen(false);
        setEditingService(null);
        setSaveNotification('Service saved successfully!');
        setTimeout(() => setSaveNotification(null), 3000);
    };
    const handleDeleteService = (id: string) => {
        if (window.confirm('Are you sure you want to delete this service?')) {
            const currentList = profile.servicesCapabilities || INITIAL_COMPANY_PROFILE.servicesCapabilities || [];
            const updated = currentList.filter((s) => s.id !== id);
            updateProfile({ servicesCapabilities: updated });
            setFormData((prev) => ({
                ...prev,
                servicesCapabilities: updated,
            }));
        }
    };
    const handleMoveService = (index: number, direction: 'up' | 'down') => {
        const list = [...(formData.servicesCapabilities || [])];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= list.length)
            return;
        const temp = list[index];
        list[index] = list[targetIndex];
        list[targetIndex] = temp;
        setFormData((prev) => ({ ...prev, servicesCapabilities: list }));
        updateProfile({ servicesCapabilities: list });
    };
    const currentServices = profile.servicesCapabilities || INITIAL_COMPANY_PROFILE.servicesCapabilities || [];
    return (<div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
      {/* Toast Notification */}
      {saveNotification && (<div className="fixed top-20 right-6 z-50 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4"/>
          <span>{saveNotification}</span>
        </div>)}

      {/* Brand Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <BrandLogo size="lg" showTagline={true}/>
          <button type="button" onClick={() => handleOpenFullEditor('general')} className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs" title={'Edit Logo & Brand Info'}>
            <Edit2 className="w-3.5 h-3.5 text-amber-600"/>
            <span>{'Edit Logo & Tagline'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleRestoreDefaults} className="px-3.5 py-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white rounded-xl text-xs font-semibold text-slate-600 flex items-center gap-1.5 transition-colors cursor-pointer" title={'Reset to Default Profile'}>
            <RotateCcw className="w-3.5 h-3.5 text-slate-400"/>
            <span>{'Defaults'}</span>
          </button>

          <button type="button" onClick={() => handleOpenFullEditor('general')} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer">
            <Edit2 className="w-3.5 h-3.5"/>
            <span>
              {'Edit Entire Company Profile'}
            </span>
          </button>
        </div>
      </div>

      {/* Quick Meta Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Quick Edit Company Name Card */}
        <div onClick={() => {
            if (!canEditCompany)
                return;
            setQuickEditModal({
                open: true,
                titleEn: 'Edit Company & Project Name',
                titleBn: "",
                fieldKey: 'companyName',
                val1: profile.name || 'DotColorCommunication Sales, POS & ERP',
                val2: profile.nameBn || '',
            });
        }} className={`bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs relative col-span-2 sm:col-span-4 bg-gradient-to-r from-amber-50/50 via-white to-white transition-all ${canEditCompany ? 'hover:border-amber-400 hover:shadow-md cursor-pointer group' : ''}`} title={canEditCompany
            ? ('Click to edit Company Name')
            : ('Admin only')}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
              {'Official Company & Project Name'}
            </span>
            {canEditCompany ? (<span className="px-2 py-0.5 text-xs text-amber-800 bg-amber-100 group-hover:bg-amber-200 rounded-md transition-colors flex items-center gap-1 font-bold">
                <Edit2 className="w-3 h-3 text-amber-600"/>
                <span>{'Edit Company Name'}</span>
              </span>) : (<span className="px-2 py-0.5 text-[10px] text-slate-500 bg-slate-100 rounded-md font-medium">
                {'Admin Protected'}
              </span>)}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mt-1.5">
            <h3 className={`font-black text-slate-900 text-base sm:text-lg transition-colors ${canEditCompany ? 'group-hover:text-amber-800' : ''}`}>
              {profile.name || 'DotColorCommunication Sales, POS & ERP'}
            </h3>
            {profile.nameBn && (<span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                {profile.nameBn}
              </span>)}
          </div>
        </div>

        {/* Quick Edit Footer & Copyright Settings Card */}
        <div onClick={() => {
            if (!canEditCompany)
                return;
            handleOpenFooterSettings();
        }} className={`bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs relative col-span-2 sm:col-span-4 bg-gradient-to-r from-blue-50/40 via-white to-white transition-all ${canEditCompany ? 'hover:border-blue-400 hover:shadow-md cursor-pointer group' : ''}`} title={canEditCompany
            ? ('Click to configure Footer & Credits')
            : ('Admin only')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600"/>
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
                {'Footer Branding, Copyright & Credits'}
              </span>
            </div>
            {canEditCompany ? (<span className="px-2 py-0.5 text-xs text-blue-800 bg-blue-100 group-hover:bg-blue-200 rounded-md transition-colors flex items-center gap-1 font-bold">
                <Edit2 className="w-3 h-3 text-blue-600"/>
                <span>{'Edit Footer'}</span>
              </span>) : (<span className="px-2 py-0.5 text-[10px] text-slate-500 bg-slate-100 rounded-md font-medium">
                {'Admin Protected'}
              </span>)}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="font-bold text-slate-900">
                {profile.footerBrandText || profile.name || 'DotColorCommunication Sales, POS & ERP'}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">{profile.footerCopyrightText || `© ${new Date().getFullYear()}`}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 text-[11px]">
              <span>Powered by <strong className="text-blue-700">{profile.footerPoweredByText || 'BD HOSTT'}</strong></span>
              {profile.footerHotline && (<>
                  <span className="text-slate-300">•</span>
                  <span>Hotline: {profile.footerHotline}</span>
                </>)}
              {profile.footerPoweredByUrl && (<>
                  <span className="text-slate-300">•</span>
                  <span className="text-blue-600 font-mono">{profile.footerPoweredByUrl.replace(/^https?:\/\//, '')}</span>
                </>)}
            </div>
          </div>
        </div>

        <div onClick={() => setQuickEditModal({
            open: true,
            titleEn: 'Edit Hotline Phone Number',
            titleBn: "",
            fieldKey: 'phone',
            val1: profile.phone || '',
        })} className="bg-white rounded-xl border border-slate-200 hover:border-amber-400 p-3.5 shadow-2xs hover:shadow-md transition-all cursor-pointer group relative" title={'Click to edit Hotline Phone'}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {'Hotline Phone'}
            </span>
            <span className="p-1 text-slate-500 bg-slate-100 group-hover:text-amber-700 group-hover:bg-amber-100 rounded-md transition-colors">
              <Edit2 className="w-3 h-3 text-amber-600"/>
            </span>
          </div>
          <p className="font-bold text-slate-900 text-sm mt-0.5 font-mono group-hover:text-amber-800 transition-colors">
            {profile.phone}
          </p>
        </div>

        <div onClick={() => setQuickEditModal({
            open: true,
            titleEn: 'Edit Official Email Address',
            titleBn: "",
            fieldKey: 'email',
            val1: profile.emails?.[0] || 'info@dotcolorcommunication.com',
        })} className="bg-white rounded-xl border border-slate-200 hover:border-amber-400 p-3.5 shadow-2xs hover:shadow-md transition-all cursor-pointer group relative" title={'Click to edit Official Email'}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {'Official Email'}
            </span>
            <span className="p-1 text-slate-500 bg-slate-100 group-hover:text-amber-700 group-hover:bg-amber-100 rounded-md transition-colors">
              <Edit2 className="w-3 h-3 text-amber-600"/>
            </span>
          </div>
          <p className="font-bold text-slate-900 text-xs mt-1 truncate group-hover:text-amber-800 transition-colors">
            {profile.emails?.[0] || 'info@dotcolorcommunication.com'}
          </p>
        </div>

        <div onClick={() => setQuickEditModal({
            open: true,
            titleEn: 'Edit BIN / VAT Number',
            titleBn: "BIN",
            fieldKey: 'vatTaxNumber',
            val1: profile.vatTaxNumber || 'BIN: 004829104-0503',
        })} className="bg-white rounded-xl border border-slate-200 hover:border-amber-400 p-3.5 shadow-2xs hover:shadow-md transition-all cursor-pointer group relative" title={'Click to edit BIN / VAT No'}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {'BIN / VAT No'}
            </span>
            <span className="p-1 text-slate-500 bg-slate-100 group-hover:text-amber-700 group-hover:bg-amber-100 rounded-md transition-colors">
              <Edit2 className="w-3 h-3 text-amber-600"/>
            </span>
          </div>
          <p className="font-bold text-slate-900 text-xs mt-1 font-mono group-hover:text-amber-800 transition-colors">
            {profile.vatTaxNumber || 'BIN: 004829104-0503'}
          </p>
        </div>

        <div onClick={() => setQuickEditModal({
            open: true,
            titleEn: 'Edit Corporate Income Tax Rate',
            titleBn: 'Corporate Tax Rate',
            fieldKey: 'incomeTaxRate',
            val1: String(profile.incomeTaxRate !== undefined ? profile.incomeTaxRate : 0),
        })} className="bg-white rounded-xl border border-slate-200 hover:border-amber-400 p-3.5 shadow-2xs hover:shadow-md transition-all cursor-pointer group relative" title={'Click to edit Corporate Tax Rate'}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {'Corporate Tax %'}
            </span>
            <span className="p-1 text-slate-500 bg-slate-100 group-hover:text-amber-700 group-hover:bg-amber-100 rounded-md transition-colors">
              <Edit2 className="w-3 h-3 text-amber-600"/>
            </span>
          </div>
          <p className="font-bold text-slate-900 text-xs mt-1 font-mono group-hover:text-amber-800 transition-colors">
            {profile.incomeTaxRate !== undefined ? profile.incomeTaxRate : 0}% {'(IFRS P&L)'}
          </p>
        </div>

        <div onClick={() => setQuickEditModal({
            open: true,
            titleEn: 'Edit Industry & Experience',
            titleBn: "",
            fieldKey: 'experience',
            val1: String(profile.experienceYears || 6),
            val2: profile.category || 'Printing & Promo',
        })} className="bg-white rounded-xl border border-slate-200 hover:border-amber-400 p-3.5 shadow-2xs hover:shadow-md transition-all cursor-pointer group relative" title={'Click to edit Industry & Exp'}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {'Industry & Exp.'}
            </span>
            <span className="p-1 text-slate-500 bg-slate-100 group-hover:text-amber-700 group-hover:bg-amber-100 rounded-md transition-colors">
              <Edit2 className="w-3 h-3 text-amber-600"/>
            </span>
          </div>
          <p className="font-bold text-amber-700 text-xs mt-1 group-hover:text-amber-800 transition-colors">
            {profile.experienceYears}+ {'Years'} • {profile.category || ('Printing & Promo')}
          </p>
        </div>
      </div>

      {/* Official Report & Document Letterhead Header Preview Box (Exact match for marked red box) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3 relative group hover:border-amber-400 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-md border border-amber-200">
                {'Official Report & Invoice Contact Box'}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {'Card printed on Reports & Invoices'}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              {'Report Header Contact Box & QR Code'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setQuickEditModal({
            open: true,
            titleEn: 'Edit Report Header Box & Contact Info',
            titleBn: "Report",
            fieldKey: 'headerCard',
            val1: profile.factoryAddress || 'Nazir Ahmed Chowdhury Road Raja Pukur By lane, G A Bhaban Mat, Chattogram, Bangladesh.',
            val2: profile.phone || '01730581687',
            val3: (profile.emails || ['info.dotcolor@gmail.com']).join(', '),
            val4: profile.facebook || 'dotcolorcommunication.official',
            val5: profile.qrCodeValue || '',
        })} className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs">
              <Edit2 className="w-3.5 h-3.5 text-amber-600"/>
              <span>{'Edit Header Info & QR'}</span>
            </button>
          </div>
        </div>

        {/* Live DocumentHeader Preview */}
        <div onClick={() => setQuickEditModal({
            open: true,
            titleEn: 'Edit Report Header Box & Contact Info',
            titleBn: "Report",
            fieldKey: 'headerCard',
            val1: profile.factoryAddress || 'Nazir Ahmed Chowdhury Road Raja Pukur By lane, G A Bhaban Mat, Chattogram, Bangladesh.',
            val2: profile.phone || '01730581687',
            val3: (profile.emails || ['info.dotcolor@gmail.com']).join(', '),
            val4: profile.facebook || 'dotcolorcommunication.official',
            val5: profile.qrCodeValue || '',
        })} className="p-3 bg-slate-50/60 rounded-xl border border-dashed border-slate-200 hover:border-amber-400 cursor-pointer transition-all hover:bg-amber-50/20 group/header" title={'Click to edit any info in this report header box'}>
          <DocumentHeader documentTitle="ITEM-WISE SALES REPORT" documentSubtitle={`Period: Sep 01 - Sep 23, 2026 • Location: ALL • Generated: ${new Date().toLocaleDateString()}`}/>
        </div>
      </div>

      {/* Physical Premises Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {'Physical Premises & Production Units'}
            </h3>
            <p className="text-xs text-slate-500">
              {'Factory machinery, corporate consultation office, and workshop locations.'}
            </p>
          </div>
          <button type="button" onClick={() => handleOpenFullEditor('premises')} className="px-3 py-1.5 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer">
            <Edit2 className="w-3.5 h-3.5 text-amber-600"/>
            <span>{'Edit Premises'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* FACTORY */}
          <div onClick={() => handleOpenFullEditor('premises')} className="bg-white rounded-2xl border border-slate-200 hover:border-amber-400 p-5 shadow-2xs space-y-3 transition-all cursor-pointer relative group hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                  <Factory className="w-5 h-5"/>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider bg-amber-100/70 px-2 py-0.5 rounded">
                    {profile.factoryUnitBadge || 'DIGITAL PRINTING & FABRICATION UNIT'}
                  </span>
                  <h4 className="text-base font-bold text-slate-900 mt-1 group-hover:text-amber-800 transition-colors">
                    {profile.factoryName || 'DotColor Production & Printing Plant'}
                  </h4>
                </div>
              </div>
              <button type="button" onClick={(e) => {
            e.stopPropagation();
            handleOpenFullEditor('premises');
        }} className="px-2.5 py-1 text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg flex items-center gap-1 text-xs font-bold transition-all shadow-2xs shrink-0" title={'Edit Factory'}>
                <Edit2 className="w-3.5 h-3.5 text-amber-600"/>
                <span>{'Edit'}</span>
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <p className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"/>
                <span className="leading-relaxed">{profile.factoryAddress}</span>
              </p>
              {profile.factoryDescription && (<p className="text-[11px] text-slate-500 pl-6 leading-relaxed">
                  {profile.factoryDescription}
                </p>)}
              {profile.factoryPhone && (<p className="flex items-center gap-2 pl-6 text-slate-500 font-mono text-[11px]">
                  <Phone className="w-3.5 h-3.5 text-slate-400"/>
                  <span>{profile.factoryPhone}</span>
                </p>)}
            </div>
          </div>

          {/* OFFICE */}
          <div onClick={() => handleOpenFullEditor('premises')} className="bg-white rounded-2xl border border-slate-200 hover:border-amber-400 p-5 shadow-2xs space-y-3 transition-all cursor-pointer relative group hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5"/>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider bg-slate-200/70 px-2 py-0.5 rounded">
                    {profile.officeUnitBadge || 'CORPORATE HEAD OFFICE & SUPPORT CENTER'}
                  </span>
                  <h4 className="text-base font-bold text-slate-900 mt-1 group-hover:text-amber-800 transition-colors">
                    {profile.officeName || 'DotColor Corporate Office'}
                  </h4>
                </div>
              </div>
              <button type="button" onClick={(e) => {
            e.stopPropagation();
            handleOpenFullEditor('premises');
        }} className="px-2.5 py-1 text-slate-800 bg-slate-100 border border-slate-200 hover:bg-slate-200/80 rounded-lg flex items-center gap-1 text-xs font-bold transition-all shadow-2xs shrink-0" title={'Edit Office'}>
                <Edit2 className="w-3.5 h-3.5 text-slate-600"/>
                <span>{'Edit'}</span>
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <p className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-700 shrink-0 mt-0.5"/>
                <span className="leading-relaxed">{profile.officeAddress}</span>
              </p>
              {profile.officeDescription && (<p className="text-[11px] text-slate-500 pl-6 leading-relaxed">
                  {profile.officeDescription}
                </p>)}
              {profile.officePhone && (<p className="flex items-center gap-2 pl-6 text-slate-500 font-mono text-[11px]">
                  <Phone className="w-3.5 h-3.5 text-slate-400"/>
                  <span>{profile.officePhone}</span>
                </p>)}
            </div>
          </div>
        </div>
      </div>

      {/* Services Portfolio Grid (Specialized Service Capabilities) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {profile.servicesSectionTitle || 'Our Specialized Service Capabilities'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {profile.servicesSectionSubtitle || 'End-to-end design, printing, corporate gifting, signage and event coordination.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={handleOpenAddService} className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer">
              <Plus className="w-3.5 h-3.5 text-amber-600"/>
              <span>{'Add New Service'}</span>
            </button>
            <button type="button" onClick={() => handleOpenFullEditor('services')} className="px-3 py-1.5 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500"/>
              <span>{'Manage List'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {currentServices.map((srv) => {
            const Icon = (srv.iconName && ICON_MAP[srv.iconName]) || Printer;
            const colorConfig = (srv.color && COLOR_MAP[srv.color]) || COLOR_MAP.amber;
            return (<div key={srv.id} onClick={() => handleOpenEditService(srv)} className={`bg-slate-50/70 hover:bg-white rounded-xl border border-slate-200/80 p-4 transition-all ${colorConfig.border} hover:shadow-md space-y-2 relative group flex flex-col justify-between cursor-pointer`}>
                <div>
                  <div className="flex items-center justify-between">
                    <div className={`w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center ${colorConfig.text} shadow-2xs`}>
                      <Icon className="w-4 h-4"/>
                    </div>

                    <div className="flex items-center gap-1 bg-white/90 border border-slate-200/80 rounded-md px-1 py-0.5 shadow-2xs">
                      <button type="button" onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEditService(srv);
                }} className="p-1 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded" title={'Edit'}>
                        <Edit2 className="w-3.5 h-3.5"/>
                      </button>
                      <button type="button" onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteService(srv.id);
                }} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded" title={'Delete'}>
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                  </div>

                  <h4 className="font-bold text-sm text-slate-900 mt-2">
                    {srv.titleEn}
                  </h4>
                  {srv.titleBn && language !== 'bn' && (<p className="text-[11px] text-slate-400">{srv.titleBn}</p>)}
                  <p className="text-xs text-slate-600 leading-relaxed mt-1">
                    {srv.descEn}
                  </p>
                </div>
              </div>);
        })}

          {/* Quick Add Placeholder Card */}
          <button type="button" onClick={handleOpenAddService} className="border-2 border-dashed border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer group min-h-[140px]">
            <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-amber-100 text-slate-400 group-hover:text-amber-700 flex items-center justify-center transition-colors">
              <Plus className="w-4 h-4"/>
            </div>
            <span className="text-xs font-bold text-slate-600 group-hover:text-amber-800 mt-2">
              {'+ Add New Capability'}
            </span>
          </button>
        </div>
      </div>

      {/* Bank & Payment Credentials for Clients */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative group">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
              Official Banking Credentials
            </span>
            {canManagePayments ? (<div className="flex items-center gap-2">
                <button type="button" onClick={() => {
                window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'settings' }));
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('open-payment-settings'));
                }, 60);
            }} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer font-bold border border-emerald-500/30" title="Manage Payment Gateway & Methods in Settings">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400"/>
                  <span>{'Payment Gateway Settings ➔'}</span>
                </button>
                <button type="button" onClick={() => handleOpenFullEditor('banking')} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer">
                  <Edit2 className="w-3 h-3 text-amber-400"/>
                  <span>{'Edit'}</span>
                </button>
              </div>) : (<span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                🔒 Protected
              </span>)}
          </div>
          <h4 className="text-base font-bold text-white mt-2">
            Payment & Accounts Information
          </h4>
          <p className="text-xs text-slate-300 max-w-xl">
            {profile.bankingNotes || 'Clients can transfer invoices via City Bank PLC, bKash Merchant, or Cash counters.'}
          </p>
        </div>

        {canManagePayments ? (<div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 text-xs space-y-1.5 w-full md:w-auto min-w-[300px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Bank:</span>
              <span className="font-bold text-white">{profile.bankName || 'Not Set'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Account No:</span>
              <span className="font-mono font-bold text-amber-400">{profile.bankAccount || '---'}</span>
            </div>
            {profile.bankAccountTitle && (<div className="flex justify-between">
                <span className="text-slate-400">Account Title:</span>
                <span className="font-semibold text-slate-300">{profile.bankAccountTitle}</span>
              </div>)}
            <div className="flex justify-between">
              <span className="text-slate-400">Branch:</span>
              <span className="font-semibold text-slate-200">{profile.bankBranch || '---'}</span>
            </div>
            {profile.routingNumber && (<div className="flex justify-between">
                <span className="text-slate-400">Routing / SWIFT:</span>
                <span className="font-mono text-slate-300">{profile.routingNumber}</span>
              </div>)}
            <div className="flex justify-between pt-1 border-t border-slate-700">
              <span className="text-slate-400">bKash / Nagad:</span>
              <span className="font-bold text-pink-400">{profile.bkashNagadNumber || profile.phone}</span>
            </div>
          </div>) : (<div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 text-xs space-y-1.5 w-full md:w-auto min-w-[300px] text-center py-4">
            <Lock className="w-5 h-5 text-amber-400 mx-auto mb-1"/>
            <span className="font-bold text-slate-200 block">
              {'Restricted Banking Information'}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {'Accessible only by Super Admin & authorized staff.'}
            </span>
          </div>)}
      </div>

      {/* ============================================================ */}
      {/* MASTER FULL PROFILE EDITOR MODAL (EDIT ALL SECTIONS)           */}
      {/* ============================================================ */}
      {isFullEditorOpen && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Edit2 className="w-4 h-4"/>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {'Dynamic Company Profile Editor'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {'Customize branding, premises, service list, and banking details dynamically.'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setIsFullEditorOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5"/>
              </button>
            </div>

            {/* Editor Tabs Navigation */}
            <div className="flex border-b border-slate-200 px-6 bg-slate-50 overflow-x-auto">
              <button type="button" onClick={() => setActiveEditorTab('general')} className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${activeEditorTab === 'general'
                ? 'border-amber-600 text-amber-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                <BrandLogo size="sm" showTagline={false}/>
                <span>{'1. General & Brand'}</span>
              </button>

              <button type="button" onClick={() => setActiveEditorTab('premises')} className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${activeEditorTab === 'premises'
                ? 'border-amber-600 text-amber-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                <Factory className="w-4 h-4 text-amber-600"/>
                <span>{'2. Factory & Offices'}</span>
              </button>

              <button type="button" onClick={() => setActiveEditorTab('services')} className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${activeEditorTab === 'services'
                ? 'border-amber-600 text-amber-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                <Sparkles className="w-4 h-4 text-indigo-600"/>
                <span>{'3. Services & Catalog'}</span>
              </button>

              {canManagePayments && (<button type="button" onClick={() => setActiveEditorTab('banking')} className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${activeEditorTab === 'banking'
                    ? 'border-amber-600 text-amber-700 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                  <CreditCard className="w-4 h-4 text-emerald-600"/>
                  <span>{'4. Banking & Accounts'}</span>
                </button>)}
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveFullProfile} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* TAB 1: GENERAL & BRAND */}
              {activeEditorTab === 'general' && (<div className="space-y-5">
                  {/* BRAND LOGO UPLOAD BOX */}
                  <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-amber-700"/>
                        <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                          {'Company Brand Logo Upload'}
                        </h4>
                      </div>
                      {formData.logoUrl && (<button type="button" onClick={handleRemoveLogo} className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 cursor-pointer">
                          <Trash2 className="w-3 h-3"/>
                          <span>{'Remove Custom Logo'}</span>
                        </button>)}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                      {/* Logo Preview Box */}
                      <div className="sm:col-span-1 bg-white p-3 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center shadow-2xs min-h-[100px]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                          {'Active Logo Preview'}
                        </span>
                        <BrandLogo logoUrl={formData.logoUrl} size="lg" showTagline={true} tagline={formData.tagline}/>
                      </div>

                      {/* Upload Controls */}
                      <div className="sm:col-span-2 space-y-2.5">
                        <div>
                          <label className="font-bold text-slate-700 block text-xs mb-1">
                            {'Upload Image File (PNG, JPG, SVG, WebP)'}
                          </label>
                          <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-2xs">
                            <Upload className="w-4 h-4"/>
                            <span>{'Choose Logo Image File'}</span>
                            <input type="file" accept="image/*" onChange={handleLogoFileUpload} className="hidden"/>
                          </label>
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-slate-500 block mb-1">
                            {'Or paste direct Logo Image URL:'}
                          </label>
                          <input type="text" placeholder="https://example.com/logo.png" value={formData.logoUrl} onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })} className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-hidden"/>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button type="button" onClick={() => {
                    setFormData((prev) => ({ ...prev, logoUrl: '/dotcolor-official-logo.png' }));
                    updateProfile({ logoUrl: '/dotcolor-official-logo.png' });
                    setSaveNotification('Official Dot Color Communication logo set!');
                    setTimeout(() => setSaveNotification(null), 3000);
                }} className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs" title="DOT COLOR Communication">
                            <span>🎨 {'Use Official Dot Color Logo'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Company Name (English)</label>
                      <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-hidden"/>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Company NameBengali</label>
                      <input type="text" value={formData.nameBn} onChange={(e) => setFormData({ ...formData, nameBn: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-hidden"/>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700 block">Tagline / Slogan (English)</label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 bg-amber-50/80 border border-amber-200 px-2.5 py-0.5 rounded-lg hover:bg-amber-100/80 transition-colors">
                          <input type="checkbox" checked={formData.showTagline !== false} onChange={(e) => setFormData({ ...formData, showTagline: e.target.checked })} className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"/>
                          <span>{'Show on Invoice'}</span>
                        </label>
                      </div>
                      <input type="text" value={formData.tagline} onChange={(e) => setFormData({ ...formData, tagline: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">TaglineBengali</label>
                      <input type="text" value={formData.taglineBn} onChange={(e) => setFormData({ ...formData, taglineBn: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700 block">Industry / Category (Subtitle)</label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 bg-amber-50/80 border border-amber-200 px-2.5 py-0.5 rounded-lg hover:bg-amber-100/80 transition-colors">
                          <input type="checkbox" checked={formData.showCategory !== false} onChange={(e) => setFormData({ ...formData, showCategory: e.target.checked })} className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"/>
                          <span>{'Show on Invoice'}</span>
                        </label>
                      </div>
                      <input type="text" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Experience (Years)</label>
                      <input type="number" step="any" value={formData.experienceYears} onChange={(e) => setFormData({ ...formData, experienceYears: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Hotline Phone</label>
                      <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"/>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Official Emails (comma separated)</label>
                      <input type="text" value={formData.emails} onChange={(e) => setFormData({ ...formData, emails: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Website URL</label>
                      <input type="text" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Facebook Page / Handle</label>
                      <input type="text" value={formData.facebook} onChange={(e) => setFormData({ ...formData, facebook: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">VAT / Tax / BIN Number</label>
                      <input type="text" value={formData.vatTaxNumber} onChange={(e) => setFormData({ ...formData, vatTaxNumber: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"/>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Trade License Number</label>
                      <input type="text" value={formData.tradeLicense} onChange={(e) => setFormData({ ...formData, tradeLicense: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"/>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Corporate Tax Rate (%) - IFRS P&L</label>
                      <input type="number" min="0" max="100" step="0.5" value={formData.incomeTaxRate ?? 0} onChange={(e) => setFormData({ ...formData, incomeTaxRate: Number(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"/>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Currency Code</label>
                      <input type="text" value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Currency Symbol</label>
                      <input type="text" value={formData.currencySymbol} onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"/>
                    </div>
                  </div>
                </div>)}

              {/* TAB 2: PREMISES & LOCATIONS */}
              {activeEditorTab === 'premises' && (<div className="space-y-6">
                  {/* Factory Unit Settings */}
                  <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-200 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-amber-200">
                      <Factory className="w-4 h-4 text-amber-700"/>
                      <h4 className="font-bold text-amber-900 text-sm">
                        {'Factory & Signage Workshop'}
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Unit Tag / Badge</label>
                        <input type="text" value={formData.factoryUnitBadge} onChange={(e) => setFormData({ ...formData, factoryUnitBadge: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"/>
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Factory Name (English)</label>
                        <input type="text" value={formData.factoryName} onChange={(e) => setFormData({ ...formData, factoryName: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"/>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 block mb-1">Factory Address</label>
                        <textarea rows={2} value={formData.factoryAddress} onChange={(e) => setFormData({ ...formData, factoryAddress: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"/>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 block mb-1">
                          Machinery, Equipment & Facilities Description
                        </label>
                        <textarea rows={2} value={formData.factoryDescription} onChange={(e) => setFormData({ ...formData, factoryDescription: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs" placeholder="Large-format solvent printers, CNC routers, acrylic welding..."/>
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Factory Direct Phone</label>
                        <input type="text" value={formData.factoryPhone} onChange={(e) => setFormData({ ...formData, factoryPhone: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono"/>
                      </div>
                    </div>
                  </div>

                  {/* Corporate Office Settings */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                      <Building2 className="w-4 h-4 text-slate-700"/>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {'Corporate Head Office & Studio'}
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Unit Tag / Badge</label>
                        <input type="text" value={formData.officeUnitBadge} onChange={(e) => setFormData({ ...formData, officeUnitBadge: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"/>
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Office Name (English)</label>
                        <input type="text" value={formData.officeName} onChange={(e) => setFormData({ ...formData, officeName: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"/>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 block mb-1">Office Address</label>
                        <textarea rows={2} value={formData.officeAddress} onChange={(e) => setFormData({ ...formData, officeAddress: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"/>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 block mb-1">
                          Studios & Facilities Description
                        </label>
                        <textarea rows={2} value={formData.officeDescription} onChange={(e) => setFormData({ ...formData, officeDescription: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs" placeholder="Client consultation studio, corporate gift sample gallery..."/>
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Office Direct Phone</label>
                        <input type="text" value={formData.officePhone} onChange={(e) => setFormData({ ...formData, officePhone: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono"/>
                      </div>
                    </div>
                  </div>
                </div>)}

              {/* TAB 3: SERVICES & CAPABILITIES */}
              {activeEditorTab === 'services' && (<div className="space-y-5">
                  {/* Section Title Configuration */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      {'Section Heading & Subtitle'}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Section Title (English)</label>
                        <input type="text" value={formData.servicesSectionTitle} onChange={(e) => setFormData({ ...formData, servicesSectionTitle: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"/>
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Section Title (Bengali)</label>
                        <input type="text" value={formData.servicesSectionTitleBn} onChange={(e) => setFormData({ ...formData, servicesSectionTitleBn: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"/>
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Subtitle (English)</label>
                        <input type="text" value={formData.servicesSectionSubtitle} onChange={(e) => setFormData({ ...formData, servicesSectionSubtitle: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"/>
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Subtitle (Bengali)</label>
                        <input type="text" value={formData.servicesSectionSubtitleBn} onChange={(e) => setFormData({ ...formData, servicesSectionSubtitleBn: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"/>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Services List with reordering & inline controls */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-800 text-xs">
                        {`Configured Services (${formData.servicesCapabilities.length})`}
                      </h4>
                      <button type="button" onClick={handleOpenAddService} className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 flex items-center gap-1 cursor-pointer">
                        <Plus className="w-3.5 h-3.5"/>
                        <span>{'Add Service'}</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {formData.servicesCapabilities.map((srv, idx) => {
                    const Icon = (srv.iconName && ICON_MAP[srv.iconName]) || Printer;
                    return (<div key={srv.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-mono text-[10px] text-slate-400 font-bold w-4">
                                {idx + 1}.
                              </span>
                              <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                                <Icon className="w-3.5 h-3.5"/>
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 truncate">
                                  {srv.titleEn} {srv.titleBn ? `(${srv.titleBn})` : ''}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate max-w-md">
                                  {srv.descEn}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button type="button" disabled={idx === 0} onClick={() => handleMoveService(idx, 'up')} className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none rounded hover:bg-slate-100" title="Move Up">
                                <ArrowUp className="w-3.5 h-3.5"/>
                              </button>
                              <button type="button" disabled={idx === formData.servicesCapabilities.length - 1} onClick={() => handleMoveService(idx, 'down')} className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none rounded hover:bg-slate-100" title="Move Down">
                                <ArrowDown className="w-3.5 h-3.5"/>
                              </button>
                              <button type="button" onClick={() => handleOpenEditService(srv)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                                <Edit2 className="w-3.5 h-3.5"/>
                              </button>
                              <button type="button" onClick={() => handleDeleteService(srv.id)} className="p-1 text-rose-600 hover:bg-rose-50 rounded" title="Delete">
                                <Trash2 className="w-3.5 h-3.5"/>
                              </button>
                            </div>
                          </div>);
                })}
                    </div>
                  </div>
                </div>)}

              {/* TAB 4: BANKING & PAYMENTS */}
              {activeEditorTab === 'banking' && canManagePayments && (<div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Bank Name</label>
                      <input type="text" value={formData.bankName} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Bank Account Number</label>
                      <input type="text" value={formData.bankAccount} onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"/>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Bank Branch</label>
                      <input type="text" value={formData.bankBranch} onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Routing Number / SWIFT</label>
                      <input type="text" value={formData.routingNumber} onChange={(e) => setFormData({ ...formData, routingNumber: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"/>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        bKash / Nagad / Rocket Merchant Number
                      </label>
                      <input type="text" value={formData.bkashNagadNumber} onChange={(e) => setFormData({ ...formData, bkashNagadNumber: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"/>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-700 block mb-1">
                        Banking Notes & Client Instructions
                      </label>
                      <textarea rows={2} value={formData.bankingNotes} onChange={(e) => setFormData({ ...formData, bankingNotes: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"/>
                    </div>
                  </div>
                </div>)}

              {/* Bottom Sticky Action Bar */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setIsFullEditorOpen(false)} className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 transition-colors">
                  {'Cancel'}
                </button>

                <div className="flex items-center gap-2">
                  <button type="submit" className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer">
                    <Save className="w-4 h-4"/>
                    <span>{'Save All Changes'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>)}

      {/* ============================================================ */}
      {/* QUICK ADD / EDIT SINGLE SERVICE MODAL                        */}
      {/* ============================================================ */}
      {serviceModalOpen && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveServiceModal} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600"/>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingService
                ?
                    'Edit Service Capability'
                :
                    'Add New Service Capability'}
                </h3>
              </div>
              <button type="button" onClick={() => setServiceModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Service Title (English) <span className="text-rose-500">*</span>
                  </label>
                  <input type="text" required value={serviceFormData.titleEn} onChange={(e) => setServiceFormData({ ...serviceFormData, titleEn: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl" placeholder="e.g. 3D Acrylic Lettering"/>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Bengali</label>
                  <input type="text" value={serviceFormData.titleBn} onChange={(e) => setServiceFormData({ ...serviceFormData, titleBn: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl" placeholder=":"/>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Description / Specification (English) <span className="text-rose-500">*</span>
                </label>
                <textarea rows={2} required value={serviceFormData.descEn} onChange={(e) => setServiceFormData({ ...serviceFormData, descEn: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl" placeholder="Materials, machinery used, output formats..."/>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Bengali Description</label>
                <textarea rows={2} value={serviceFormData.descBn} onChange={(e) => setServiceFormData({ ...serviceFormData, descBn: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl" placeholder=",    Description..."/>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Icon Style</label>
                  <select value={serviceFormData.iconName} onChange={(e) => setServiceFormData({ ...serviceFormData, iconName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white">
                    {Object.keys(ICON_MAP).map((iconKey) => (<option key={iconKey} value={iconKey}>
                        {iconKey}
                      </option>))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Accent Theme</label>
                  <select value={serviceFormData.color} onChange={(e) => setServiceFormData({ ...serviceFormData, color: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white capitalize">
                    {Object.keys(COLOR_MAP).map((col) => (<option key={col} value={col}>
                        {col}
                      </option>))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setServiceModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {'Cancel'}
              </button>
              <button type="submit" className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5"/>
                <span>{'Save Service'}</span>
              </button>
            </div>
          </form>
        </div>)}

      {/* ============================================================ */}
      {/* QUICK SINGLE-FIELD EDIT MODAL                                */}
      {/* ============================================================ */}
      {quickEditModal.open && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveQuickEdit} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Edit2 className="w-4 h-4"/>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {quickEditModal.titleEn}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {'Update information and save changes'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setQuickEditModal((prev) => ({ ...prev, open: false }))} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {quickEditModal.fieldKey === 'companyName' && (<>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {'Company / Business Name (English)'}
                    </label>
                    <input type="text" required value={quickEditModal.val1} onChange={(e) => setQuickEditModal({ ...quickEditModal, val1: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-900 text-sm focus:ring-2 focus:ring-amber-400 focus:outline-hidden" placeholder="DotColorCommunication Sales, POS & ERP"/>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {'Company Name (Bengali)'}
                    </label>
                    <input type="text" value={quickEditModal.val2 || ''} onChange={(e) => setQuickEditModal({ ...quickEditModal, val2: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 focus:outline-hidden" placeholder="Dot Color"/>
                  </div>
                </>)}

              {quickEditModal.fieldKey === 'phone' && (<div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Hotline Phone Number'}
                  </label>
                  <input type="text" required value={quickEditModal.val1} onChange={(e) => setQuickEditModal({ ...quickEditModal, val1: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-amber-400 focus:outline-hidden" placeholder="+88 01730-581687"/>
                </div>)}

              {quickEditModal.fieldKey === 'email' && (<div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Official Email Address'}
                  </label>
                  <input type="email" required value={quickEditModal.val1} onChange={(e) => setQuickEditModal({ ...quickEditModal, val1: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 focus:outline-hidden" placeholder="info@dotcolorcommunication.com"/>
                </div>)}

              {quickEditModal.fieldKey === 'vatTaxNumber' && (<div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'BIN / VAT Tax Number'}
                  </label>
                  <input type="text" required value={quickEditModal.val1} onChange={(e) => setQuickEditModal({ ...quickEditModal, val1: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-amber-400 focus:outline-hidden" placeholder="BIN: 004829104-0503"/>
                </div>)}

              {quickEditModal.fieldKey === 'incomeTaxRate' && (<div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Corporate Income Tax Provision Rate (%)'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      required
                      value={quickEditModal.val1}
                      onChange={(e) => setQuickEditModal({ ...quickEditModal, val1: e.target.value })}
                      className="w-full px-3.5 py-2.5 pr-8 border border-slate-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
                      placeholder="0"
                    />
                    <span className="absolute right-3.5 top-2.5 font-bold text-slate-400 text-sm">%</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Used in IFRS Statement of Profit or Loss to calculate Income Tax Expense / Provision.
                  </p>
                </div>)}

              {quickEditModal.fieldKey === 'experience' && (<>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {'Experience (Years)'}
                    </label>
                    <input type="number" step="any" required min="0" value={quickEditModal.val1} onChange={(e) => setQuickEditModal({ ...quickEditModal, val1: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 focus:outline-hidden"/>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {'Industry Category'}
                    </label>
                    <input type="text" required value={quickEditModal.val2 || ''} onChange={(e) => setQuickEditModal({ ...quickEditModal, val2: e.target.value })} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 focus:outline-hidden" placeholder="Printing & Promo"/>
                  </div>
                </>)}

              {quickEditModal.fieldKey === 'headerCard' && (<div className="space-y-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {'Company Address'}
                    </label>
                    <textarea rows={2} required value={quickEditModal.val1} onChange={(e) => setQuickEditModal({ ...quickEditModal, val1: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-400 focus:outline-hidden" placeholder="36/37 Nazir Ahmed Chowdhury Road, Raja Pukur By lane, G A Bhaban Mat, Chattogram, Bangladesh"/>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        {'Hotline Phone'}
                      </label>
                      <input type="text" required value={quickEditModal.val2 || ''} onChange={(e) => setQuickEditModal({ ...quickEditModal, val2: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-amber-400 focus:outline-hidden" placeholder="+88 01730-581687"/>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        {'Emails (comma separated)'}
                      </label>
                      <input type="text" required value={quickEditModal.val3 || ''} onChange={(e) => setQuickEditModal({ ...quickEditModal, val3: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-400 focus:outline-hidden" placeholder="info@dotcolorcommunication.com, support@dotcolorcommunication.com"/>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {'Facebook Page / Handle'}
                    </label>
                    <input type="text" value={quickEditModal.val4 || ''} onChange={(e) => setQuickEditModal({ ...quickEditModal, val4: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-400 focus:outline-hidden" placeholder="facebook.com/Dot-Color-Communication"/>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {'Custom QR Code Link or Content'}
                    </label>
                    <input type="text" value={quickEditModal.val5 || ''} onChange={(e) => setQuickEditModal({ ...quickEditModal, val5: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-400 focus:outline-hidden" placeholder={'Leave empty for auto vCard QR code'}/>
                  </div>
                </div>)}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
              <button type="button" onClick={() => {
                setQuickEditModal((prev) => ({ ...prev, open: false }));
                handleOpenFullEditor('general');
            }} className="text-xs text-amber-700 font-bold hover:underline cursor-pointer">
                {'Open Full Editor →'}
              </button>

              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setQuickEditModal((prev) => ({ ...prev, open: false }))} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                  {'Cancel'}
                </button>
                <button type="submit" className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer">
                  <Save className="w-3.5 h-3.5"/>
                  <span>{'Save'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>)}

      {/* Dedicated Footer & Copyright Settings Modal */}
      {footerModalOpen && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-5 h-5"/>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {'Footer & Copyright Configuration'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {'Customize footer branding, copyright year, and developer credits'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setFooterModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <form onSubmit={handleSaveFooterSettings} className="space-y-4 text-xs">
              {/* Live Preview Box */}
              <div>
                <label className="font-bold text-slate-700 block mb-1 text-[11px] uppercase tracking-wider text-slate-500">
                  {'Live Preview (How footer will look)'}
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-2xs font-sans">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                    <span>{footerFormData.footerBrandText || 'Company Name'}</span>
                    <span className="text-slate-400 font-normal">•</span>
                    <span className="font-normal text-slate-500">{footerFormData.footerCopyrightText || '© 2026'}</span>
                  </div>
                  {footerFormData.footerShowPoweredBy && (<div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <span>Powered by <strong className="text-blue-600">{footerFormData.footerPoweredByText || 'BD HOSTT'}</strong></span>
                      {footerFormData.footerHotline && (<>
                          <span className="text-slate-300">•</span>
                          <span>Hotline: {footerFormData.footerHotline}</span>
                        </>)}
                      {footerFormData.footerPoweredByUrl && (<>
                          <span className="text-slate-300">•</span>
                          <span className="text-blue-600 font-mono text-[10px]">{footerFormData.footerPoweredByUrl.replace(/^https?:\/\//, '')}</span>
                        </>)}
                    </div>)}
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Footer Brand / System Title'}
                  </label>
                  <input type="text" required value={footerFormData.footerBrandText} onChange={(e) => setFooterFormData({ ...footerFormData, footerBrandText: e.target.value })} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-400 focus:outline-hidden" placeholder="DotColorCommunication Sales, POS & ERP"/>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Copyright Text & Year'}
                  </label>
                  <input type="text" required value={footerFormData.footerCopyrightText} onChange={(e) => setFooterFormData({ ...footerFormData, footerCopyrightText: e.target.value })} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-400 focus:outline-hidden" placeholder="© 2026"/>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Powered By Firm Name'}
                  </label>
                  <input type="text" required value={footerFormData.footerPoweredByText} onChange={(e) => setFooterFormData({ ...footerFormData, footerPoweredByText: e.target.value })} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold text-blue-700 focus:ring-2 focus:ring-blue-400 focus:outline-hidden" placeholder="BD HOSTT"/>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Firm Website URL'}
                  </label>
                  <input type="text" required value={footerFormData.footerPoweredByUrl} onChange={(e) => setFooterFormData({ ...footerFormData, footerPoweredByUrl: e.target.value })} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-400 focus:outline-hidden" placeholder="https://www.bdhost.com"/>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Support Hotline Phone'}
                  </label>
                  <input type="text" required value={footerFormData.footerHotline} onChange={(e) => setFooterFormData({ ...footerFormData, footerHotline: e.target.value })} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-400 focus:outline-hidden" placeholder="01846100900"/>
                </div>

                <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                  <input type="checkbox" id="chkShowPoweredBy" checked={footerFormData.footerShowPoweredBy} onChange={(e) => setFooterFormData({ ...footerFormData, footerShowPoweredBy: e.target.checked })} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"/>
                  <label htmlFor="chkShowPoweredBy" className="font-bold text-slate-700 cursor-pointer text-xs">
                    {'Display Powered by and developer credits in footer'}
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
                <button type="button" onClick={() => {
                setFooterFormData({
                    footerBrandText: 'DotColorCommunication Sales, POS & ERP',
                    footerCopyrightText: `© ${new Date().getFullYear()}`,
                    footerPoweredByText: 'BD HOSTT',
                    footerPoweredByUrl: 'https://www.bdhost.com',
                    footerHotline: '01846100900',
                    footerShowPoweredBy: true,
                });
            }} className="px-3.5 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer transition-colors">
                  {'Reset to Default'}
                </button>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setFooterModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                    {'Cancel'}
                  </button>
                  <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer">
                    <Save className="w-3.5 h-3.5"/>
                    <span>{'Save Footer Settings'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>)}
    </div>);
};
