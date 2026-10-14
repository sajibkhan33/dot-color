import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BrandLogo } from './BrandLogo';
import { Building2, Factory, Globe2, Database, Phone, Mail, MapPin, AlertTriangle, Download, Upload, RotateCcw, CheckCircle2, X, CreditCard, TrendingUp, Settings, LogOut, Cloud, CloudOff, RefreshCw, Printer, User, KeyRound, Shield, Save, } from 'lucide-react';
import { PrinterBridgeModal } from './PrinterBridgeModal';
import { checkHardwareAgentStatus, HardwareAgentStatus } from '../utils/hardwarePrint';
interface HeaderProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}
export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
    const { profile, products, invoices, transactions, language, setLanguage, activeLocation, setActiveLocation, exportDatabase, importDatabase, resetToDefaultData, activeStaff, logout, cloudSyncStatus, isCloudConnected, lastSyncedAt, syncWithCloud, updateStaffMember, checkPermission, } = useApp();
    const canAccessSettings = (activeStaff?.role || '').toLowerCase().includes('admin') ||
        (activeStaff?.role || '').toLowerCase().includes('director') ||
        Boolean(checkPermission &&
            (checkPermission('settings.view') ||
                checkPermission('settings.manage_users') ||
                checkPermission('SETTINGS_MANAGE_USERS') ||
                checkPermission('settings.manage_payments') ||
                checkPermission('settings.manage_roles')));
    const [showBackupModal, setShowBackupModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showPrinterModal, setShowPrinterModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [profileFormData, setProfileFormData] = useState({
        name: '',
        nameBn: '',
        phone: '',
        email: '',
        password: '',
    });
    const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
    const [printerStatus, setPrinterStatus] = useState<HardwareAgentStatus>({ isOnline: false });
    const [importStatus, setImportStatus] = useState<string | null>(null);
    React.useEffect(() => {
        let isMounted = true;
        const fetchPrinterStatus = async () => {
            try {
                const s = await checkHardwareAgentStatus();
                if (isMounted)
                    setPrinterStatus(s);
            }
            catch {
                if (isMounted)
                    setPrinterStatus({ isOnline: false });
            }
        };
        fetchPrinterStatus();
        const interval = setInterval(fetchPrinterStatus, 6000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);
    // Compute stats
    const lowStockCount = products.filter((p) => p.stockFactory + p.stockOffice <= p.minStockAlert).length;
    const totalSalesAmount = invoices.reduce((acc, inv) => acc + inv.grandTotal, 0);
    const totalDueAmount = invoices.reduce((acc, inv) => acc + inv.dueAmount, 0);
    const handleExport = () => {
        const dataStr = exportDatabase();
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dot-color-erp-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            const ok = importDatabase(content);
            if (ok) {
                setImportStatus('success');
                syncWithCloud?.({ forcePush: true });
                setTimeout(() => {
                    setImportStatus(null);
                    setShowBackupModal(false);
                }, 1200);
            }
            else {
                setImportStatus('error');
            }
        };
        reader.readAsText(file);
    };
    return (<>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Left: Brand Identity */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <button type="button" onClick={() => setActiveTab('pos')} className="text-left focus:outline-hidden">
                <BrandLogo size="md" showTagline={false}/>
              </button>
            </div>

            {/* Middle: Single Central Warehouse Badge */}
            <div className="hidden md:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
              <Building2 className="w-4 h-4 text-emerald-600"/>
              <span>{'Central Warehouse & Head Office'}</span>
            </div>

            {/* Right: Actions, Badges & Toggles */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Alert Badge for Low Stock */}
              {lowStockCount > 0 && (<button type="button" onClick={() => setActiveTab('inventory')} className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg hover:bg-rose-100 transition-colors" title="Items running low on stock">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0"/>
                  <span className="hidden sm:inline">
                    {'Low Stock'}
                  </span>
                  <span className="bg-rose-600 text-white rounded-full px-1.5 py-0.2 text-[10px]">
                    {lowStockCount}
                  </span>
                </button>)}

              {/* Company Info Button */}
              <button type="button" onClick={() => setShowInfoModal(true)} className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors" title={'Company & Contact Info'}>
                <Phone className="w-4 h-4"/>
              </button>

              {/* Settings / Configuration Module */}
              {canAccessSettings && (<button type="button" id="btn-nav-settings" onClick={() => setActiveTab('settings')} className={`p-2 rounded-lg transition-colors cursor-pointer ${activeTab === 'settings'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`} title={'Settings & Admin'}>
                  <Settings className="w-4 h-4"/>
                </button>)}

              {/* Thermal Printer Hardware Bridge Status Button */}
              <button type="button" id="btn-printer-status" onClick={() => setShowPrinterModal(true)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${printerStatus.isOnline
            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400'
            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:border-rose-300'}`} title={printerStatus.isOnline
            ? `80mm POS Thermal Printer: Connected (${printerStatus.activePrinter || '80 Printer'}) - Click to view status, test print, or download agent`
            : 'POS Printer Agent Disconnected - Click to Download 1-Click Installer (.ZIP / .BAT) & Setup'}>
                <span className="relative flex h-2 w-2">
                  {printerStatus.isOnline && (<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>)}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${printerStatus.isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                </span>
                <Printer className={`w-3.5 h-3.5 ${printerStatus.isOnline ? 'text-emerald-600' : 'text-rose-600'}`}/>
                <span className="font-bold">
                  {printerStatus.isOnline
            ?
                'Printer OK'
            :
                'Printer Offline'}
                </span>
              </button>

              {/* Central Project Data Backup & Upload Button */}
              <button
                type="button"
                onClick={() => setShowBackupModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 shadow-xs transition-all border border-amber-400 shrink-0"
                title={language === 'bn' ? 'সম্পূর্ণ প্রোজেক্টের ডাটা ব্যাকআপ ও আপলোড' : 'Backup & Upload Entire Project Data'}
              >
                <Database className="w-4 h-4 text-slate-950" />
                <span className="font-extrabold hidden sm:inline">
                  {language === 'bn' ? 'ডাটা ব্যাকআপ ও আপলোড' : 'Backup & Upload'}
                </span>
              </button>

              {/* Language Switcher */}
              <button type="button" onClick={() => setLanguage('bn')} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 hover:border-slate-400 bg-white text-slate-800 transition-all shadow-2xs shrink-0">
                <Globe2 className="w-3.5 h-3.5 text-amber-600"/>
                <span>{'EN'}</span>
              </button>

              {/* User Session & Logout */}
              {activeStaff && (<div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <button type="button" onClick={() => {
                setProfileFormData({
                    name: activeStaff.name || '',
                    nameBn: activeStaff.nameBn || '',
                    phone: activeStaff.phone || '',
                    email: activeStaff.email || '',
                    password: activeStaff.password || '1234',
                });
                setProfileSaveSuccess(false);
                setShowProfileModal(true);
            }} className="flex items-center gap-2 p-1 -m-1 rounded-xl hover:bg-slate-100 transition-colors text-left cursor-pointer group" title={'View & Edit User Profile'}>
                    <div className="hidden sm:flex flex-col text-right">
                      <span className="text-xs font-bold text-slate-800 leading-tight group-hover:text-amber-700 transition-colors">
                        {activeStaff.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium leading-none mt-0.5">
                        {activeStaff.role}
                      </span>
                    </div>
                    <div className={`w-8 h-8 rounded-lg ${activeStaff.avatarColor || 'bg-purple-600'} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-xs ring-2 ring-transparent group-hover:ring-amber-500/40 transition-all`} title={activeStaff.role}>
                      {(activeStaff.name || 'U').charAt(0)}
                    </div>
                  </button>
                  <button type="button" onClick={logout} className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors shrink-0 cursor-pointer" title={'Log Out'}>
                    <LogOut className="w-4 h-4"/>
                  </button>
                </div>)}
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="bg-slate-50 border-t border-slate-200 overflow-x-auto scrollbar-none">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 flex gap-1 sm:gap-1.5 py-2">
            {[
            { id: 'pos', labelEn: 'POS Counter', labelBn: "" },
            { id: 'sales', labelEn: 'Sales & Orders', labelBn: "Order" },
            { id: 'inventory', labelEn: 'Inventory', labelBn: "" },
            { id: 'supply', labelEn: 'Supply & Purchase', labelBn: "" },
            { id: 'projects', labelEn: 'Projects', labelBn: "" },
            { id: 'accounting', labelEn: 'Accounting', labelBn: "" },
            { id: 'reports', labelEn: 'Reports', labelBn: "Report" },
            ...(canAccessSettings
                ? [{ id: 'settings', labelEn: 'Settings & Admin', labelBn: "" }]
                : []),
            { id: 'profile', labelEn: 'Company Profile', labelBn: "" },
        ].map((tab) => {
            const active = activeTab === tab.id;
            return (<button key={tab.id} onClick={() => {
                setActiveTab(tab.id);
                try {
                    const url = new URL(window.location.href);
                    url.searchParams.set('tab', tab.id);
                    window.history.replaceState({}, '', url.toString());
                } catch {}
            }} className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-[13px] font-semibold rounded-lg whitespace-nowrap transition-all ${active
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'}`}>
                  {tab.labelEn}
                </button>);
        })}
          </div>
        </div>
      </header>

      {/* Backup & Restore Modal */}
      {showBackupModal && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-600"/>
                <h3 className="font-bold text-slate-900 text-base">
                  {language === 'bn' ? 'সম্পূর্ণ প্রোজেক্ট ডাটা ব্যাকআপ ও আপলোড' : 'Project Data Backup & Restore'}
                </h3>
              </div>
              <button type="button" onClick={() => setShowBackupModal(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="py-4 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                {language === 'bn'
                  ? 'ইনভয়েস, পারচেজ, প্রজেক্ট, একাউন্টিং লেজার এবং ইনভেন্টরির সমস্ত ডাটা ক্লাউড ডাটাবেজে রিয়েল-টাইমে অটো-সেভ হয়। আপনি যেকোনো সময় সম্পূর্ণ ডাটার অফলাইন ব্যাকআপ ডাউনলোড করতে পারেন অথবা পূর্বের ব্যাকআপ ফাইল আপলোড করে রিস্টোর করতে পারেন।'
                  : 'All sales invoices, purchase records, projects, inventory stock and financial ledgers are automatically saved in the database in real-time. You can download an offline JSON backup or restore anytime.'}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={handleExport} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 transition-all group text-center cursor-pointer shadow-2xs">
                  <Download className="w-6 h-6 text-amber-600 group-hover:scale-110 transition-transform"/>
                  <span className="text-xs font-bold text-slate-900">
                    {language === 'bn' ? 'ব্যাকআপ ডাউনলোড' : 'Download Backup'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {language === 'bn' ? 'সম্পূর্ণ ডাটা (.json)' : '.json format'}
                  </span>
                </button>

                <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-amber-300 hover:border-amber-600 hover:bg-amber-50/50 transition-all cursor-pointer text-center shadow-2xs">
                  <Upload className="w-6 h-6 text-amber-600"/>
                  <span className="text-xs font-bold text-slate-900">
                    {language === 'bn' ? 'ফাইল আপলোড (রিস্টোর)' : 'Upload & Restore'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {language === 'bn' ? '.json ফাইল সিলেক্ট করুন' : 'select JSON file'}
                  </span>
                  <input type="file" accept=".json" onChange={handleFileUpload} className="hidden"/>
                </label>
              </div>

              {/* MongoDB Atlas Cloud Sync Status & Action */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg ${isCloudConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                      <Cloud className="w-4 h-4"/>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        {language === 'bn' ? 'MongoDB Atlas ক্লাউড ডাটাবেজ' : 'MongoDB Atlas Cloud Database'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {isCloudConnected
                          ? (language === 'bn' ? 'কানেক্টেড (ইনপুট করলেই অটো-সেভ হয়)' : `Connected (Real-time auto-save active)`)
                          : (language === 'bn' ? 'লোকাল মোডে চলছে' : 'Not Connected (Local Mode)')}
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={() => syncWithCloud()} disabled={cloudSyncStatus === 'syncing'} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors shadow-2xs shrink-0 cursor-pointer">
                    <RefreshCw className={`w-3.5 h-3.5 ${cloudSyncStatus === 'syncing' ? 'animate-spin' : ''}`}/>
                    <span>{cloudSyncStatus === 'syncing' ? (language === 'bn' ? 'সেভ হচ্ছে...' : 'Saving...') : (language === 'bn' ? 'এখনই সিঙ্ক' : 'Sync Now')}</span>
                  </button>
                </div>
              </div>

              {importStatus === 'success' && (<div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0"/>
                  {language === 'bn' ? 'ডাটা সফলভাবে রিস্টোর ও ডাটাবেজে সেভ হয়েছে!' : 'Data restored & saved successfully!'}
                </div>)}

              {importStatus === 'error' && (<div className="text-xs font-bold text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {language === 'bn' ? 'ভুল JSON ফাইল ফরম্যাট!' : 'Invalid JSON file format!'}
                </div>)}

              <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                <button type="button" onClick={() => {
                if (window.confirm(language === 'bn' ? 'আপনি কি নিশ্চিত যে ডেমো ডাটায় রিসেট করতে চান?' : 'Are you sure you want to reset to demo data?')) {
                    resetToDefaultData();
                    setShowBackupModal(false);
                }
            }} className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer">
                  <RotateCcw className="w-3.5 h-3.5"/>
                  {language === 'bn' ? 'ডিফল্ট ডাটায় রিসেট' : 'Reset to Default'}
                </button>

                <button type="button" onClick={() => setShowBackupModal(false)} className="text-xs font-semibold px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer">
                  {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>)}

      {/* Info & Contact Modal (from User photos) */}
      {showInfoModal && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <BrandLogo size="md" showTagline={true}/>
              <button type="button" onClick={() => setShowInfoModal(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs text-slate-700">
              <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80">
                <span className="font-bold text-amber-900 text-sm block">
                  {profile?.name || 'DotColorCommunication Sales, POS & ERP'}
                </span>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  {profile?.tagline || 'YOUR VISION, OUR CREATION!'} — {profile?.category || 'Premier digital printing, 3D signage, corporate promotional merchandise, and custom ERP solution provider.'}
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <Factory className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"/>
                  <div>
                    <strong className="text-slate-900 block font-semibold">
                      {'FACTORY:'}
                    </strong>
                    <span className="text-slate-600">{profile.factoryAddress}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Building2 className="w-4 h-4 text-slate-800 shrink-0 mt-0.5"/>
                  <div>
                    <strong className="text-slate-900 block font-semibold">
                      {'OFFICE:'}
                    </strong>
                    <span className="text-slate-600">{profile.officeAddress}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-emerald-600 shrink-0"/>
                  <div>
                    <strong className="text-slate-900 inline font-semibold">
                      {'Hotline:'}{' '}
                    </strong>
                    <a href={`tel:${profile.phone}`} className="text-amber-700 font-bold hover:underline">
                      {profile.phone}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-blue-600 shrink-0"/>
                  <div>
                    <strong className="text-slate-900 inline font-semibold">
                      {'Emails:'}{' '}
                    </strong>
                    <span className="text-slate-600">{profile.emails.join(' • ')}</span>
                  </div>
                </div>
              </div>

              {/* Dedicated BD HOSTT Technology Partner Advertising Card */}
              <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 rounded-2xl text-white shadow-xs border border-blue-900/50 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold tracking-widest uppercase bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2.5 py-0.5 rounded-full">
                    TECHNOLOGY &amp; IT PARTNER
                  </span>
                  <span className="text-[10px] font-semibold text-amber-400">
                    ★ Certified IT Solutions
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-black text-white">
                    BD HOSTT
                  </h4>
                  <a href="https://www.bdhost.com" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-400 hover:text-blue-300 underline">
                    www.bdhost.com ↗
                  </a>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Web Hosting, Domain Registration, High-Performance VPS, Enterprise POS &amp; ERP Solutions.
                </p>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
                  <span>Hotline: <strong className="text-white">01846100900</strong></span>
                  <a href="tel:01846100900" className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[10px] transition-colors">
                    Call BD HOSTT
                  </a>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button type="button" onClick={() => setShowInfoModal(false)} className="text-xs font-semibold px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">
                {'OK'}
              </button>
            </div>
          </div>
        </div>)}

      {/* Thermal Printer Hardware Bridge Modal */}
      <PrinterBridgeModal isOpen={showPrinterModal} onClose={() => {
            setShowPrinterModal(false);
            checkHardwareAgentStatus().then(setPrinterStatus).catch(() => { });
        }}/>

      {/* User Profile Edit Modal */}
      {showProfileModal && activeStaff && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl ${activeStaff.avatarColor || 'bg-purple-600'} flex items-center justify-center text-white text-base font-bold shadow-xs`}>
                  {(activeStaff.name || 'U').charAt(0)}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {'My Profile & User Settings'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {activeStaff.role} • {activeStaff.location}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setShowProfileModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <form onSubmit={(e) => {
                e.preventDefault();
                if (!profileFormData.name.trim())
                    return;
                updateStaffMember(activeStaff.id, {
                    name: profileFormData.name.trim(),
                    nameBn: profileFormData.nameBn.trim(),
                    phone: profileFormData.phone.trim(),
                    email: profileFormData.email.trim(),
                    password: profileFormData.password.trim() || '1234',
                });
                setProfileSaveSuccess(true);
                setTimeout(() => {
                    setProfileSaveSuccess(false);
                    setShowProfileModal(false);
                }, 900);
            }} className="py-4 space-y-4">
              {profileSaveSuccess && (<div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 rounded-2xl text-xs font-bold border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0"/>
                  <span>{'Profile updated successfully!'}</span>
                </div>)}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    {'Full Name (English) *'}
                  </label>
                  <input type="text" required value={profileFormData.name} onChange={(e) => setProfileFormData({ ...profileFormData, name: e.target.value })} placeholder="e.g. Javed Reza" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"/>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    {'Full Name (Bangla)'}
                  </label>
                  <input type="text" value={profileFormData.nameBn} onChange={(e) => setProfileFormData({ ...profileFormData, nameBn: e.target.value })} placeholder=":" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"/>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    {'Phone Number'}
                  </label>
                  <input type="text" value={profileFormData.phone} onChange={(e) => setProfileFormData({ ...profileFormData, phone: e.target.value })} placeholder="01730-XXXXXX" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"/>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    {'Email Address'}
                  </label>
                  <input type="email" value={profileFormData.email} onChange={(e) => setProfileFormData({ ...profileFormData, email: e.target.value })} placeholder="info.dotcolor@gmail.com" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"/>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  {'Login PIN / Password'}
                </label>
                <input type="text" value={profileFormData.password} onChange={(e) => setProfileFormData({ ...profileFormData, password: e.target.value })} placeholder=": 1234" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"/>
                <p className="text-[10px] text-slate-400 mt-1">
                  {'Used for PIN-based login verification.'}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                {canAccessSettings ? (<button type="button" onClick={() => {
                    setActiveTab('settings');
                    setShowProfileModal(false);
                }} className="text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-2 rounded-xl transition-colors cursor-pointer">
                    {'All Users Management ↗'}
                  </button>) : (<div />)}

                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setShowProfileModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
                    {'Cancel'}
                  </button>
                  <button type="submit" className="px-5 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-1.5">
                    <Save className="w-3.5 h-3.5"/>
                    <span>{'Save Changes'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>)}
    </>);
};
