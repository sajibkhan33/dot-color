import { isPinHashed } from '../utils/securityUtils';
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BrandLogo } from './BrandLogo';
import { Globe2, LogOut, CheckCircle2, X, Save } from 'lucide-react';
interface HeaderProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}
export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
    const { language, setLanguage, activeStaff, logout, updateStaffMember, checkPermission } = useApp();
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
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [profileFormData, setProfileFormData] = useState({
        name: '',
        nameBn: '',
        phone: '',
        email: '',
        password: '',
    });
    const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
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

            {/* Right: Language Switcher & User Session */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Language Switcher */}
              <button type="button" onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 hover:border-slate-400 bg-white text-slate-800 transition-all shadow-2xs shrink-0 cursor-pointer">
                <Globe2 className="w-3.5 h-3.5 text-amber-600"/>
                <span>{language === 'bn' ? 'বাংলা' : 'EN'}</span>
              </button>

              {/* User Session & Logout */}
              {activeStaff && (<div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <button type="button" onClick={() => {
                setProfileFormData({
                    name: activeStaff.name || '',
                    nameBn: activeStaff.nameBn || '',
                    phone: activeStaff.phone || '',
                    email: activeStaff.email || '',
                    password: isPinHashed(activeStaff.password) ? '' : (activeStaff.password || '1234'),
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
            ...(canAccessPOS ? [{ id: 'pos', labelEn: 'POS Counter', labelBn: "" }] : []),
            ...(canAccessSales ? [{ id: 'sales', labelEn: 'Sales & Orders', labelBn: "Order" }] : []),
            ...(canAccessInventory ? [{ id: 'inventory', labelEn: 'Inventory', labelBn: "" }] : []),
            ...(canAccessSupply ? [{ id: 'supply', labelEn: 'Supply & Purchase', labelBn: "" }] : []),
            ...(canAccessProjects ? [{ id: 'projects', labelEn: 'Projects', labelBn: "" }] : []),
            ...(canAccessAccounting ? [{ id: 'accounting', labelEn: 'Accounting', labelBn: "" }] : []),
            ...(canAccessReports ? [{ id: 'reports', labelEn: 'Reports', labelBn: "Report" }] : []),
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
                const profileUpdates: any = {
                    name: profileFormData.name.trim(),
                    nameBn: profileFormData.nameBn.trim(),
                    phone: profileFormData.phone.trim(),
                    email: profileFormData.email.trim(),
                };
                if (profileFormData.password.trim()) {
                    profileUpdates.password = profileFormData.password.trim();
                }
                updateStaffMember(activeStaff.id, profileUpdates);
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
                <input type="text" value={profileFormData.password} onChange={(e) => setProfileFormData({ ...profileFormData, password: e.target.value })} placeholder={isPinHashed(activeStaff.password) ? "Leave blank to keep current PIN" : "e.g. 1234"} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"/>
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
