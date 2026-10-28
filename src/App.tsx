import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { POSModule } from './components/POSModule';
import { SalesModule } from './components/SalesModule';
import { InventoryModule } from './components/InventoryModule';
import { SupplyChainModule } from './components/SupplyChainModule';
import { ProjectManagementModule } from './components/ProjectManagementModule';
import { AccountingModule } from './components/AccountingModule';
import { ReportModule } from './components/ReportModule';
import { CompanyProfileModule } from './components/CompanyProfileModule';
import { SettingsModule } from './components/SettingsModule';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { Login } from './components/Login';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SlidersHorizontal } from 'lucide-react';
const VALID_TABS = ['pos', 'sales', 'inventory', 'supply', 'projects', 'accounting', 'reports', 'settings', 'profile'];
const TAB_STORAGE_KEY = 'DOT_COLOR_ERP_ACTIVE_TAB';
const getInitialTab = (): string => {
    try {
        // 1. Check URL query param: ?tab=supply
        const searchTab = new URLSearchParams(window.location.search).get('tab');
        if (searchTab && VALID_TABS.includes(searchTab)) {
            return searchTab;
        }
        // 2. Check URL hash: #supply
        const hashTab = window.location.hash.replace(/^#\/?/, '').trim();
        if (hashTab && VALID_TABS.includes(hashTab)) {
            return hashTab;
        }
        // 3. Check LocalStorage
        const storedTab = localStorage.getItem(TAB_STORAGE_KEY);
        if (storedTab && VALID_TABS.includes(storedTab)) {
            return storedTab;
        }
    }
    catch { }
    return 'pos';
};
/**
 * Extracts public document query parameters from the URL (?invoiceId=..., ?quoteId=..., ?quotationId=..., ?inv=..., ?doc=...)
 * We preserve the URL in the address bar so user refreshes or shares will keep viewing the document,
 * without falling back to ERP Login or revealing internal ERP pages.
 */
interface PublicDocParam {
    id: string;
    type: 'invoice' | 'quotation';
}

const getPublicDocumentParam = (): PublicDocParam | null => {
    try {
        if (typeof window === 'undefined')
            return null;
        const url = new URL(window.location.href);
        const quoteId = url.searchParams.get('quoteId') || url.searchParams.get('quotationId');
        if (quoteId && quoteId.trim()) {
            return { id: quoteId.trim(), type: 'quotation' };
        }
        const invId = url.searchParams.get('invoiceId') || url.searchParams.get('invoiceNo') || url.searchParams.get('inv');
        if (invId && invId.trim()) {
            const trimmed = invId.trim();
            const isQuote = trimmed.toLowerCase().startsWith('qt-') || trimmed.toLowerCase().startsWith('q-');
            return { id: trimmed, type: isQuote ? 'quotation' : 'invoice' };
        }
        const docId = url.searchParams.get('doc') || url.searchParams.get('id');
        const view = url.searchParams.get('view');
        if (docId && docId.trim() && (view === 'public' || docId.startsWith('INV-') || docId.startsWith('QT-') || docId.toLowerCase().startsWith('inv-') || docId.toLowerCase().startsWith('qt-'))) {
            const trimmed = docId.trim();
            const isQuote = trimmed.toLowerCase().startsWith('qt-') || trimmed.toLowerCase().startsWith('q-');
            return { id: trimmed, type: isQuote ? 'quotation' : 'invoice' };
        }
    }
    catch { }
    return null;
};
const MainLayout: React.FC = () => {
    const [activeTab, setActiveTab] = useState<string>(getInitialTab);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
    const [modalMode, setModalMode] = useState<'invoice' | 'challan' | 'pos'>('invoice');
    const [directPrintOptions, setDirectPrintOptions] = useState<{
        autoPrint: boolean;
        isPadMode: boolean;
    }>({
        autoPrint: false,
        isPadMode: false,
    });
    const { profile, activeStaff, language, checkPermission } = useApp();
    const isSuperAdmin = (activeStaff?.role || '').toLowerCase() === 'super admin' ||
        (activeStaff?.role || '').toLowerCase() === 'superadmin' ||
        activeStaff?.customRoleId === 'role-superadmin' ||
        (activeStaff?.name || '').toLowerCase().includes('super admin');

    const canAccessSettings = isSuperAdmin || Boolean(
        checkPermission &&
            (checkPermission('settings.view') ||
                checkPermission('settings.manage_users') ||
                checkPermission('settings.manage_roles') ||
                checkPermission('settings.clean_data') ||
                checkPermission('settings.backup_restore') ||
                checkPermission('settings.manage_payments'))
    );

    const canAccessPOS = isSuperAdmin || Boolean(checkPermission && checkPermission('pos.view'));
    const canAccessSales = isSuperAdmin || Boolean(checkPermission && checkPermission('sales.view'));
    const canAccessInventory = isSuperAdmin || Boolean(checkPermission && checkPermission('inventory.view'));
    const canAccessSupply = isSuperAdmin || Boolean(checkPermission && checkPermission('supply.view'));
    const canAccessProjects = isSuperAdmin || Boolean(checkPermission && (checkPermission('projects.view') || checkPermission('projects.manage')));
    const canAccessAccounting = isSuperAdmin || Boolean(checkPermission && checkPermission('accounting.view'));
    const canAccessReports = isSuperAdmin || Boolean(checkPermission && (checkPermission('reports.view') || checkPermission('accounting.export_reports')));

    // Determine first permitted tab for redirection if current tab is not allowed
    const isTabPermitted = (tab: string): boolean => {
        if (isSuperAdmin) return true;
        if (tab === 'pos') return canAccessPOS;
        if (tab === 'sales') return canAccessSales;
        if (tab === 'inventory') return canAccessInventory;
        if (tab === 'supply') return canAccessSupply;
        if (tab === 'projects') return canAccessProjects;
        if (tab === 'accounting') return canAccessAccounting;
        if (tab === 'reports') return canAccessReports;
        if (tab === 'settings') return canAccessSettings;
        if (tab === 'profile') return true;
        return true;
    };

    const getFirstPermittedTab = (): string => {
        if (canAccessPOS) return 'pos';
        if (canAccessSales) return 'sales';
        if (canAccessInventory) return 'inventory';
        if (canAccessSupply) return 'supply';
        if (canAccessAccounting) return 'accounting';
        if (canAccessProjects) return 'projects';
        if (canAccessReports) return 'reports';
        if (canAccessSettings) return 'settings';
        return 'profile';
    };

    // Guard: If user lands on an unauthorized tab, redirect them to first permitted tab
    useEffect(() => {
        if (!isTabPermitted(activeTab)) {
            const nextTab = getFirstPermittedTab();
            setActiveTab(nextTab);
        }
    }, [activeTab, canAccessPOS, canAccessSales, canAccessInventory, canAccessSupply, canAccessProjects, canAccessAccounting, canAccessReports, canAccessSettings]);
    // Sync document title with company profile name
    useEffect(() => {
        if (profile?.name) {
            document.title = profile.name;
        }
    }, [profile?.name]);
    // Auto-clean any lingering invoiceId / QR scan query params from the browser address bar
    useEffect(() => {
        try {
            const url = new URL(window.location.href);
            ['invoiceId', 'invoiceNo', 'inv', 'quoteId', 'quotationId', 'doc'].forEach((p) => url.searchParams.delete(p));
            window.history.replaceState(window.history.state || {}, '', url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') + url.hash);
        } catch {}
    }, []);
    // Sync activeTab with URL & localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem(TAB_STORAGE_KEY, activeTab);
            const url = new URL(window.location.href);
            // Strip any lingering invoice query params during tab transitions
            url.searchParams.delete('invoiceId');
            url.searchParams.delete('invoiceNo');
            url.searchParams.delete('inv');
            if (url.searchParams.get('tab') !== activeTab) {
                url.searchParams.set('tab', activeTab);
            }
            window.history.replaceState({ tab: activeTab }, '', url.toString());
        }
        catch { }
    }, [activeTab]);
    // Handle browser Back / Forward navigation
    useEffect(() => {
        const handlePopState = () => {
            try {
                const searchTab = new URLSearchParams(window.location.search).get('tab');
                if (searchTab && VALID_TABS.includes(searchTab)) {
                    setActiveTab(searchTab);
                    return;
                }
                const hashTab = window.location.hash.replace(/^#\/?/, '').trim();
                if (hashTab && VALID_TABS.includes(hashTab)) {
                    setActiveTab(hashTab);
                }
            }
            catch { }
        };
        const handleSwitchTab = (e: any) => {
            if (e.detail && VALID_TABS.includes(e.detail)) {
                setActiveTab(e.detail);
                try {
                    const url = new URL(window.location.href);
                    url.searchParams.set('tab', e.detail);
                    window.history.replaceState({}, '', url.toString());
                } catch {}
            }
        };
        window.addEventListener('popstate', handlePopState);
        window.addEventListener('hashchange', handlePopState);
        window.addEventListener('switch-tab', handleSwitchTab);
        return () => {
            window.removeEventListener('popstate', handlePopState);
            window.removeEventListener('hashchange', handlePopState);
            window.removeEventListener('switch-tab', handleSwitchTab);
        };
    }, []);
    const handleOpenInvoice = (id: string, mode: 'invoice' | 'challan' | 'pos' = 'invoice', options?: {
        autoPrint?: boolean;
        isPadMode?: boolean;
    }) => {
        setSelectedInvoiceId(id);
        setModalMode(mode);
        setDirectPrintOptions({
            autoPrint: Boolean(options?.autoPrint),
            isPadMode: Boolean(options?.isPadMode),
        });
    };
    const handleOpenChallan = (id: string) => {
        setSelectedInvoiceId(id);
        setModalMode('challan');
        setDirectPrintOptions({ autoPrint: false, isPadMode: false });
    };
    return (<div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans antialiased selection:bg-amber-100 selection:text-amber-900">
      {/* Top Header & Navigation */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab}/>

      {/* Main View Area */}
      <main className="flex-1 pb-12">
        {activeTab === 'pos' && canAccessPOS && (<POSModule onOpenInvoiceModal={handleOpenInvoice}/>)}
        {activeTab === 'sales' && canAccessSales && (<SalesModule onOpenInvoiceModal={handleOpenInvoice} onOpenChallanModal={handleOpenChallan}/>)}
        {activeTab === 'inventory' && canAccessInventory && <InventoryModule />}
        {activeTab === 'supply' && canAccessSupply && <SupplyChainModule />}
        {activeTab === 'projects' && canAccessProjects && <ProjectManagementModule onOpenInvoiceModal={handleOpenInvoice} />}
        {activeTab === 'accounting' && canAccessAccounting && <AccountingModule />}
        {activeTab === 'reports' && canAccessReports && <ReportModule />}
        {activeTab === 'settings' && canAccessSettings && <SettingsModule onNavigateTab={setActiveTab} />}
        {activeTab === 'profile' && <CompanyProfileModule />}
      </main>

      {/* Invoice & Challan Modal */}
      {selectedInvoiceId && (<InvoicePrintModal key={`${selectedInvoiceId}-${directPrintOptions.autoPrint ? 'auto' : 'view'}-${directPrintOptions.isPadMode ? 'pad' : 'normal'}`} invoiceId={selectedInvoiceId} mode={modalMode} autoPrint={directPrintOptions.autoPrint} initialPadMode={directPrintOptions.isPadMode} onClose={() => {
                try {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('invoiceId');
                    url.searchParams.delete('invoiceNo');
                    url.searchParams.delete('inv');
                    window.history.replaceState({}, '', url.toString());
                }
                catch { }
                setSelectedInvoiceId(null);
                setDirectPrintOptions({ autoPrint: false, isPadMode: false });
            }}/>)}

      {/* Professional 1-Line Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto print:hidden py-3 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">
              {profile.footerBrandText && profile.footerBrandText !== 'DotColorCommunication Sales, POS & ERP'
            ? profile.footerBrandText
            : profile.name || 'Dot Color'}
            </span>
            <span className="text-slate-400">•</span>
            <span>{profile.footerCopyrightText || `© ${new Date().getFullYear()}`}</span>

            {/* Admin-only discreet footer edit button */}
            {activeStaff?.role === 'admin' && (<button type="button" onClick={() => {
                setActiveTab('profile');
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('open-footer-settings'));
                }, 60);
            }} className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-700 hover:bg-blue-50 px-2 py-0.5 rounded-md transition-colors cursor-pointer border border-transparent hover:border-blue-200" title={'Edit Footer & Credits (Admin)'}>
                <SlidersHorizontal className="w-3 h-3 text-blue-600"/>
                <span className="font-semibold text-[10px]">{'Edit Footer'}</span>
              </button>)}
          </div>

          {(profile.footerShowPoweredBy ?? true) && (<div className="flex items-center gap-2 text-xs">
              <span>
                Powered by{' '}
                <a href={profile.footerPoweredByUrl || 'https://www.bdhost.com'} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:text-blue-700 hover:underline">
                  {profile.footerPoweredByText || 'BD HOSTT'}
                </a>
              </span>
              {profile.footerHotline && (<>
                  <span className="text-slate-300">•</span>
                  <a href={`tel:${profile.footerHotline.replace(/\s+/g, '')}`} className="text-slate-500 hover:text-slate-700">
                    Hotline: {profile.footerHotline}
                  </a>
                </>)}
              {profile.footerPoweredByUrl && (<>
                  <span className="text-slate-300">•</span>
                  <a href={profile.footerPoweredByUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {profile.footerPoweredByUrl.replace(/^https?:\/\//, '')}
                  </a>
                </>)}
            </div>)}
        </div>
      </footer>
    </div>);
};
const AppContent: React.FC = () => {
    const { isAuthenticated } = useApp();
    const publicDoc = React.useMemo(() => getPublicDocumentParam(), []);

    // 1. ISOLATED PUBLIC DOCUMENT VIEW (Sales Invoice & Quotation)
    // If a document ID is present in the URL (from a QR scan or shared public link),
    // render ONLY the dedicated public document viewer.
    // Zero exposure to Login, Logout, Dashboard, Projects, or internal ERP screens.
    if (publicDoc) {
        return (
            <div className="min-h-screen w-full bg-slate-900 text-slate-100 flex flex-col justify-start items-center">
                <InvoicePrintModal
                    invoiceId={publicDoc.id}
                    mode="invoice"
                    isPublicView={true}
                    onClose={() => {
                        // In public view, there is no modal backdrop close;
                        // user closes their browser tab or navigates back in their browser.
                    }}
                />
            </div>
        );
    }

    // 2. Normal ERP Flow (Login screen for unauthenticated, MainLayout for authenticated staff)
    if (!isAuthenticated) {
        return <Login />;
    }
    return <MainLayout />;
};
export default function App() {
    return (<ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>);
}
