import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ProductItem, UnitType, ServiceCategory, ProductCategory } from '../types';
import { Package, Boxes, ArrowRightLeft, AlertTriangle, Plus, Search, Filter, Layers, ArrowDownRight, ArrowUpRight, History, Factory, Building2, DollarSign, TrendingDown, Edit2, Trash2, UploadCloud, FileSpreadsheet, Tag, AlertCircle, } from 'lucide-react';
import { BulkProductImportModal } from './BulkProductImportModal';
import { ProductCategoryManager } from './ProductCategoryManager';
export const InventoryModule: React.FC = () => {
    const { products, productCategories, profile, language, activeLocation, addProduct, updateProduct, deleteProduct, adjustStock, addProductCategory, updateProductCategory, checkPermission, activeStaff, } = useApp();

    const isSuperAdmin = (activeStaff?.role || '').toLowerCase() === 'super admin' ||
        (activeStaff?.role || '').toLowerCase() === 'superadmin' ||
        activeStaff?.customRoleId === 'role-superadmin' ||
        (activeStaff?.name || '').toLowerCase().includes('super admin');
    const canAddProduct = isSuperAdmin || Boolean(checkPermission && checkPermission('inventory.add_product'));
    const canEditProduct = isSuperAdmin || Boolean(checkPermission && checkPermission('inventory.edit_product'));
    const canDeleteProduct = isSuperAdmin || Boolean(checkPermission && checkPermission('inventory.delete_product'));
    const canAdjustStock = isSuperAdmin || Boolean(checkPermission && checkPermission('inventory.adjust_stock'));
    const canBulkImport = isSuperAdmin || Boolean(checkPermission && checkPermission('inventory.bulk_import'));
    const canManageCategories = isSuperAdmin || Boolean(checkPermission && checkPermission('inventory.manage_categories'));
    const [activeTab, setActiveTab] = useState<'inventory' | 'categories'>('inventory');
    const [filterType, setFilterType] = useState<'ALL' | 'RAW' | 'FINISHED' | 'LOW_STOCK'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showBulkImportModal, setShowBulkImportModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
    const [adjustModalProduct, setAdjustModalProduct] = useState<ProductItem | null>(null);
    const [productToDelete, setProductToDelete] = useState<ProductItem | null>(null);
    // Category quick add/edit modal states within Add/Edit Item modal
    const [showCategoryQuickModal, setShowCategoryQuickModal] = useState(false);
    const [categoryQuickEditTarget, setCategoryQuickEditTarget] = useState<ProductCategory | null>(null);
    const [categoryFormData, setCategoryFormData] = useState({
        code: '',
        name: '',
        nameBn: '',
        description: '',
        isRawMaterialGroup: false,
    });
    const [categoryFormError, setCategoryFormError] = useState<string | null>(null);
    // Form states for Product Add/Edit
    const [formData, setFormData] = useState({
        name: '',
        nameBn: '',
        category: 'DIGITAL PRINTING' as ServiceCategory | 'RAW MATERIAL',
        isRawMaterial: false,
        unit: 'pcs' as UnitType,
        unitPrice: 100,
        costPrice: 60,
        stockFactory: 10,
        stockOffice: 0,
        minStockAlert: 5,
        description: '',
    });
    // Adjust Form state
    const [adjustType, setAdjustType] = useState<'IN' | 'OUT' | 'TRANSFER'>('IN');
    const [adjustQty, setAdjustQty] = useState(1);
    const [adjustLocation, setAdjustLocation] = useState<'Factory' | 'Office'>('Factory');
    const [adjustTargetLocation, setAdjustTargetLocation] = useState<'Factory' | 'Office'>('Office');
    const [adjustReason, setAdjustReason] = useState('');
    // Filtering
    const filteredProducts = products.filter((p) => {
        const totalStock = p.stockFactory + p.stockOffice;
        const isLow = !p.isRawMaterial && totalStock <= p.minStockAlert;
        if (filterType === 'RAW' && !p.isRawMaterial)
            return false;
        if (filterType === 'FINISHED' && p.isRawMaterial)
            return false;
        if (filterType === 'LOW_STOCK' && !isLow)
            return false;
        const q = (searchQuery || '').toLowerCase().trim();
        const match = !q ||
            (p.name && p.name.toLowerCase().includes(q)) ||
            (p.nameBn && p.nameBn.includes(q)) ||
            (p.code && p.code.toLowerCase().includes(q)) ||
            (p.category && p.category.toLowerCase().includes(q));
        return match;
    });
    // Valuations
    const totalStockValuation = products.reduce((acc, p) => {
        const totalQty = p.stockFactory + p.stockOffice;
        return acc + totalQty * p.costPrice;
    }, 0);
    const rawMaterialsValuation = products
        .filter((p) => p.isRawMaterial)
        .reduce((acc, p) => acc + (p.stockFactory + p.stockOffice) * p.costPrice, 0);
    const lowStockCount = products.filter((p) => !p.isRawMaterial && p.stockFactory + p.stockOffice <= p.minStockAlert).length;
    const selectedCategoryObj = (productCategories || []).find((c) => c.name.toLowerCase() === (formData.category || '').toLowerCase());

    const handleOpenAddCategoryFromItem = () => {
        const nextCode = `CAT-${Math.floor(10 + Math.random() * 90)}`;
        setCategoryFormData({
            code: nextCode,
            name: '',
            nameBn: '',
            description: '',
            isRawMaterialGroup: Boolean(formData.isRawMaterial),
        });
        setCategoryQuickEditTarget(null);
        setCategoryFormError(null);
        setShowCategoryQuickModal(true);
    };

    const handleOpenEditCategoryFromItem = (cat?: ProductCategory) => {
        const target = cat || selectedCategoryObj;
        if (!target) return;
        setCategoryFormData({
            code: target.code,
            name: target.name,
            nameBn: target.nameBn || '',
            description: target.description || '',
            isRawMaterialGroup: Boolean(target.isRawMaterialGroup ?? target.isRawMaterial),
        });
        setCategoryQuickEditTarget(target);
        setCategoryFormError(null);
        setShowCategoryQuickModal(true);
    };

    const handleSaveCategoryQuick = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = categoryFormData.name.trim();
        const trimmedCode = categoryFormData.code.trim();
        if (!trimmedName || !trimmedCode) {
            setCategoryFormError('Please enter both Category Name and Category Code');
            return;
        }

        const isDuplicate = productCategories.some(
            c => c.name.toLowerCase() === trimmedName.toLowerCase() && c.id !== categoryQuickEditTarget?.id
        );
        if (isDuplicate) {
            setCategoryFormError(`A category with name "${trimmedName}" already exists.`);
            return;
        }

        if (categoryQuickEditTarget) {
            updateProductCategory(categoryQuickEditTarget.id, {
                code: trimmedCode,
                name: trimmedName,
                nameBn: categoryFormData.nameBn.trim(),
                description: categoryFormData.description.trim(),
                isRawMaterialGroup: categoryFormData.isRawMaterialGroup,
                isRawMaterial: categoryFormData.isRawMaterialGroup,
            });
            setFormData(prev => ({
                ...prev,
                category: trimmedName as any,
                isRawMaterial: categoryFormData.isRawMaterialGroup,
            }));
        } else {
            const newCat = addProductCategory({
                code: trimmedCode,
                name: trimmedName,
                nameBn: categoryFormData.nameBn.trim(),
                description: categoryFormData.description.trim(),
                isRawMaterialGroup: categoryFormData.isRawMaterialGroup,
                isRawMaterial: categoryFormData.isRawMaterialGroup,
            });
            setFormData(prev => ({
                ...prev,
                category: newCat.name as any,
                isRawMaterial: categoryFormData.isRawMaterialGroup,
            }));
        }

        setShowCategoryQuickModal(false);
        setCategoryQuickEditTarget(null);
    };

    const handleOpenAdd = () => {
        setEditingProduct(null);
        const defaultCat = productCategories && productCategories.length > 0 ? productCategories[0] : null;
        setFormData({
            name: '',
            nameBn: '',
            category: (defaultCat ? defaultCat.name : 'DIGITAL PRINTING') as any,
            isRawMaterial: defaultCat ? Boolean(defaultCat.isRawMaterialGroup ?? defaultCat.isRawMaterial) : false,
            unit: 'pcs',
            unitPrice: 100,
            costPrice: 60,
            stockFactory: 10,
            stockOffice: 0,
            minStockAlert: 5,
            description: '',
        });
        setShowAddModal(true);
    };
    const handleOpenEdit = (p: ProductItem) => {
        setEditingProduct(p);
        setFormData({
            name: p.name,
            nameBn: p.nameBn || '',
            category: p.category,
            isRawMaterial: p.isRawMaterial,
            unit: p.unit,
            unitPrice: p.unitPrice,
            costPrice: p.costPrice,
            stockFactory: p.stockFactory,
            stockOffice: p.stockOffice,
            minStockAlert: p.minStockAlert,
            description: p.description || '',
        });
        setShowAddModal(true);
    };
    const handleSaveProduct = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name)
            return;
        if (editingProduct) {
            updateProduct(editingProduct.id, formData);
        }
        else {
            addProduct(formData);
        }
        setShowAddModal(false);
    };
    const handleStockAdjustmentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!adjustModalProduct || adjustQty <= 0)
            return;
        adjustStock(adjustModalProduct.id, adjustType, adjustQty, adjustLocation, adjustType === 'TRANSFER' ? adjustTargetLocation : undefined, adjustReason || (adjustType === 'TRANSFER' ? 'Branch transfer' : 'Manual stock update'));
        setAdjustModalProduct(null);
        setAdjustQty(1);
        setAdjustReason('');
    };
    return (<div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 block mb-1">
            {'Total Stock Asset Value'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {profile.currencySymbol}
            {totalStockValuation.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {products.length} {'SKUs tracked in total'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-amber-700 block mb-1">
            {'Raw Materials Inventory Value'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-amber-700">
            {profile.currencySymbol}
            {rawMaterialsValuation.toLocaleString()}
          </div>
          <span className="text-[11px] text-amber-600/80 mt-1 block font-medium">
            {'Flex, Vinyl, Inks, Acrylic & blanks'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-rose-600 block mb-1">
            {'Low Stock Items'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-rose-600">
            {lowStockCount} {'Items'}
          </div>
          <span className="text-[11px] text-rose-500 mt-1 block font-medium">
            {'Below safety threshold'}
          </span>
        </div>
      </div>

      {/* Tabs and Add Button */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button type="button" onClick={() => setActiveTab('inventory')} className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'inventory' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
            {'Inventory & Products'}
          </button>
          {canManageCategories && (
            <button type="button" id="tab-inventory-categories" onClick={() => setActiveTab('categories')} className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'categories' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
              {'Category Manager'}
            </button>
          )}
        </div>

        {activeTab === 'inventory' && (<div className="flex items-center gap-2 w-full md:w-auto">
            {canBulkImport && (
              <button type="button" id="btn-open-bulk-import" onClick={() => setShowBulkImportModal(true)} className="flex-1 md:flex-none px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all" title={'Bulk upload products via CSV template'}>
                <UploadCloud className="w-4 h-4 text-emerald-600"/>
                <span>{'Bulk Import CSV'}</span>
              </button>
            )}

            {canAddProduct && (
              <button type="button" id="btn-open-add-product" onClick={handleOpenAdd} className="flex-1 md:flex-none px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all">
                <Plus className="w-4 h-4 text-amber-400"/>
                <span>{'+ Add New Item'}</span>
              </button>
            )}
          </div>)}
      </div>

      {activeTab === 'inventory' && (<div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Search & Filters */}
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={'Search SKU, name or category...'} className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"/>
            </div>

            <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              {[
                { id: 'ALL', labelEn: 'All Items', labelBn: "" },
                { id: 'FINISHED', labelEn: 'Finished Services/Goods', labelBn: "" },
                { id: 'RAW', labelEn: 'Raw Materials', labelBn: "" },
                { id: 'LOW_STOCK', labelEn: 'Low Stock Only', labelBn: "" },
            ].map((f) => (<button key={f.id} type="button" onClick={() => setFilterType(f.id as any)} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterType === f.id
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {f.labelEn}
                </button>))}
            </div>
          </div>

          {/* Product Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <th className="py-3 px-4"></th>
                  <th className="py-3 px-4"></th>
                  <th className="py-3 px-4 text-center"></th>
                  <th className="py-3 px-4 text-center">Total Stock</th>
                  <th className="py-3 px-4 text-right"></th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                const total = p.stockFactory + p.stockOffice;
                const isLow = !p.isRawMaterial && total <= p.minStockAlert;
                return (<tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {p.code}
                          </span>
                          <div>
                            <div className="font-bold text-slate-900">
                              {p.name}
                            </div>
                            {p.description && (<div className="text-[10px] text-slate-400 truncate max-w-xs">
                                {p.description}
                              </div>)}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${p.isRawMaterial
                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                        : 'bg-slate-100 text-slate-800'}`}>
                          {p.category}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                          {'Central Warehouse'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`font-black text-xs px-2.5 py-1 rounded-full ${isLow
                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                          {total} {p.unit}
                        </span>
                        {isLow && (<div className="text-[10px] font-bold text-rose-600 mt-0.5">
                            {'Low Stock'}
                          </div>)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="font-bold text-slate-900">
                          {p.isRawMaterial ? (<span className="text-slate-600 font-medium">:</span>) : (<span className="text-slate-600 font-medium">:</span>)}
                          {profile.currencySymbol}
                          {(p.isRawMaterial ? p.costPrice : p.unitPrice).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">:{profile.currencySymbol}
                          {p.costPrice.toLocaleString()}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Stock In/Out/Transfer Adjust button (Disabled) */}
                          {canAdjustStock && (
                            <button
                              type="button"
                              disabled
                              className="p-1.5 text-amber-500/40 bg-amber-50/40 rounded-lg border border-amber-200/40 text-[10px] font-bold cursor-not-allowed opacity-50"
                              title="Stock adjustment / transfer is disabled"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5"/>
                            </button>
                          )}

                          {/* Edit Product */}
                          {canEditProduct && (
                            <button type="button" onClick={() => handleOpenEdit(p)} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200" title="Edit Item">
                              <Edit2 className="w-3.5 h-3.5"/>
                            </button>
                          )}

                          {/* Delete Product */}
                          {canDeleteProduct && (
                            <button type="button" onClick={() => setProductToDelete(p)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200" title={'Delete Item'}>
                              <Trash2 className="w-3.5 h-3.5"/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>);
            })}

                {filteredProducts.length === 0 && (<tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                          <Package className="w-6 h-6"/>
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">
                            {'No inventory items found'}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1">
                            {searchQuery
                    ?
                        'Try adjusting your search criteria or filter tags.'
                    :
                        'Speed up setup by importing your product catalog and raw materials in bulk via CSV.'}
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-1">
                          <button type="button" onClick={() => setShowBulkImportModal(true)} className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs inline-flex items-center gap-1.5 transition-all">
                            <UploadCloud className="w-4 h-4"/>
                            <span>{'Bulk Import via CSV'}</span>
                          </button>
                          <button type="button" onClick={handleOpenAdd} className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs inline-flex items-center gap-1.5 transition-all">
                            <Plus className="w-4 h-4 text-amber-400"/>
                            <span>{'Add Item'}</span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </div>)}

      {/* SUB-TAB: CATEGORIES */}
      {activeTab === 'categories' && <ProductCategoryManager />}

      {/* ADJUST / TRANSFER STOCK MODAL */}
      {adjustModalProduct && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleStockAdjustmentSubmit} className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {adjustModalProduct.code}
                </span>
                <h3 className="font-bold text-slate-900 text-sm mt-1">
                  {adjustModalProduct.name}
                </h3>
              </div>
              <button type="button" onClick={() => setAdjustModalProduct(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex justify-around text-center">
                <div>
                  <span className="text-slate-400 block text-[10px]">Factory</span>
                  <span className="font-bold text-slate-800">
                    {adjustModalProduct.stockFactory} {adjustModalProduct.unit}
                  </span>
                </div>
                <div className="border-r border-slate-200"/>
                <div>
                  <span className="text-slate-400 block text-[10px]"></span>
                  <span className="font-bold text-slate-800">
                    {adjustModalProduct.stockOffice} {adjustModalProduct.unit}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Operation Type'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setAdjustType('IN')} className={`py-2 rounded-lg font-bold text-xs ${adjustType === 'IN'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>+IN</button>
                  <button type="button" onClick={() => setAdjustType('OUT')} className={`py-2 rounded-lg font-bold text-xs ${adjustType === 'OUT'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>OUT</button>
                  <button type="button" onClick={() => setAdjustType('TRANSFER')} className={`py-2 rounded-lg font-bold text-xs ${adjustType === 'TRANSFER'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>⇄</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {adjustType === 'TRANSFER'
                ?
                    'From'
                :
                    'Location'}
                  </label>
                  <select value={adjustLocation} onChange={(e) => setAdjustLocation(e.target.value as any)} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium">
                    <option value="Office">
                      {'Central Warehouse'}
                    </option>
                  </select>
                </div>

                {adjustType === 'TRANSFER' ? (<div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {'To Branch'}
                    </label>
                    <select value={adjustTargetLocation} onChange={(e) => setAdjustTargetLocation(e.target.value as any)} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium">
                      <option value="Office">
                        {'Central Warehouse'}
                      </option>
                    </select>
                  </div>) : (<div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {'Quantity'}
                    </label>
                    <input type="number" step="any" min="1" required value={adjustQty} onChange={(e) => setAdjustQty(Math.max(1, Number(e.target.value)))} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"/>
                  </div>)}
              </div>

              {adjustType === 'TRANSFER' && (<div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Transfer Quantity'}
                  </label>
                  <input type="number" step="any" min="1" required value={adjustQty} onChange={(e) => setAdjustQty(Math.max(1, Number(e.target.value)))} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"/>
                </div>)}

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Reason / Reference'}
                </label>
                <input type="text" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="e.g. Broken packaging, showroom sample, physical audit adjustment" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setAdjustModalProduct(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {'Cancel'}
              </button>
              <button type="submit" className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs">
                {'Apply Adjustment'}
              </button>
            </div>
          </form>
        </div>)}

      {/* ADD / EDIT PRODUCT MODAL */}
      {showAddModal && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveProduct} className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingProduct
                ?
                    'Edit Item'
                :
                    'Add New Item / Raw Material'}
              </h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Item Name (EN) *'}
                  </label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Glossy Vinyl Sticker" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Bengali Name'}
                  </label>
                  <input type="text" value={formData.nameBn} onChange={(e) => setFormData({ ...formData, nameBn: e.target.value })} placeholder=":" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 block">
                      {'Category *'}
                    </label>
                    <div className="flex items-center gap-2">
                      {selectedCategoryObj && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditCategoryFromItem(selectedCategoryObj)}
                          className="text-[11px] text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                          title={`Edit "${selectedCategoryObj.name}"`}
                        >
                          <Edit2 className="w-3 h-3 text-amber-600" />
                          <span>Edit</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleOpenAddCategoryFromItem}
                        className="text-[11px] text-amber-600 hover:text-amber-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                        title="Create a new category"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ New Category</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <select
                      value={formData.category}
                      onChange={(e) => {
                        const selectedVal = e.target.value;
                        const matchedCat = productCategories?.find((c) => c.name === selectedVal);
                        setFormData({
                          ...formData,
                          category: selectedVal as any,
                          isRawMaterial: matchedCat ? Boolean(matchedCat.isRawMaterialGroup ?? matchedCat.isRawMaterial) : selectedVal === 'RAW MATERIAL',
                        });
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-xs"
                    >
                      {productCategories && productCategories.length > 0 ? (
                        productCategories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name} {c.isRawMaterialGroup || c.isRawMaterial ? ' [Raw Material]' : ''}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="DIGITAL PRINTING">DIGITAL PRINTING</option>
                          <option value="SIGN MAKING & LETTERING">SIGN MAKING & LETTERING</option>
                          <option value="BRANDED PROMOTIONAL GIFTS">BRANDED PROMOTIONAL GIFTS</option>
                          <option value="PRINTING & PACKAGING">PRINTING & PACKAGING</option>
                          <option value="GRAPHIC DESIGN">GRAPHIC DESIGN</option>
                          <option value="EXHIBITION">EXHIBITION</option>
                          <option value="EVENTS MANAGEMENT">EVENTS MANAGEMENT</option>
                          <option value="VENUE SOURCING">VENUE SOURCING</option>
                          <option value="RAW MATERIAL">RAW MATERIAL</option>
                        </>
                      )}
                    </select>

                    {selectedCategoryObj && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditCategoryFromItem(selectedCategoryObj)}
                        className="p-2 border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors cursor-pointer shrink-0"
                        title={`Edit "${selectedCategoryObj.name}"`}
                      >
                        <Edit2 className="w-4 h-4 text-slate-600" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleOpenAddCategoryFromItem}
                      className="px-2.5 py-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                      title="Add new category"
                    >
                      <Plus className="w-4 h-4 text-amber-600" />
                      <span className="hidden sm:inline">New</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Unit'}
                  </label>
                  <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value as any })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium">
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="sqft">Square Feet (sqft)</option>
                    <option value="roll">Rolls (roll)</option>
                    <option value="box">Boxes (box)</option>
                    <option value="set">Sets (set)</option>
                    <option value="job">Per Job (job)</option>
                    <option value="ream">Ream (ream)</option>
                    <option value="ltr">Liter (ltr)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Selling Price'}
                  </label>
                  <input type="number" step="any" min="0" value={formData.unitPrice} onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"/>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Cost / Production Price'}
                  </label>
                  <input type="number" step="any" min="0" value={formData.costPrice} onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Central Stock Qty'}
                  </label>
                  <input type="number" step="any" min="0" value={formData.stockOffice + formData.stockFactory} onChange={(e) => setFormData({
                ...formData,
                stockOffice: Number(e.target.value),
                stockFactory: 0,
            })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"/>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Min Alert'}
                  </label>
                  <input type="number" step="any" min="0" value={formData.minStockAlert} onChange={(e) => setFormData({ ...formData, minStockAlert: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"/>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Description'}
                </label>
                <textarea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="e.g. 340gsm frontlit solvent roll, 10ft width" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"/>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {'Cancel'}
              </button>
              <button type="submit" className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs">
                {editingProduct
                ?
                    'Save Changes'
                :
                    'Add Item'}
              </button>
            </div>
          </form>
        </div>)}

      {/* BULK PRODUCT IMPORT MODAL */}
      <BulkProductImportModal isOpen={showBulkImportModal} onClose={() => setShowBulkImportModal(false)}/>

      {/* CUSTOM CONFIRM DELETE MODAL */}
      {productToDelete && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="w-6 h-6"/>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {'Confirm Deletion'}
              </h3>
              <p className="text-slate-500 text-xs mt-1">
                {`Are you sure you want to delete "${productToDelete.name}"? This action cannot be undone.`}
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button type="button" onClick={() => setProductToDelete(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {'Cancel'}
              </button>
              <button type="button" onClick={() => {
                deleteProduct(productToDelete.id);
                setProductToDelete(null);
            }} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-2xs">
                {'Delete'}
              </button>
            </div>
          </div>
        </div>)}

      {/* QUICK ADD / EDIT CATEGORY MODAL (CAN BE OPENED ON TOP OF ITEM MODAL) */}
      {showCategoryQuickModal && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveCategoryQuick}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-fade-in"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  {categoryQuickEditTarget ? 'Edit Product Category' : 'Create New Product Category'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryQuickModal(false);
                  setCategoryQuickEditTarget(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {categoryFormError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{categoryFormError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Category Code *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={categoryFormData.code}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, code: e.target.value })}
                    placeholder="e.g. CAT-PRINT"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Category Type'}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCategoryFormData({ ...categoryFormData, isRawMaterialGroup: false })}
                      className={`px-2 py-2 border rounded-xl text-center font-bold text-[11px] transition-all cursor-pointer ${
                        !categoryFormData.isRawMaterialGroup
                          ? 'bg-slate-950 border-slate-950 text-white shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {'Finished / Service'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryFormData({ ...categoryFormData, isRawMaterialGroup: true })}
                      className={`px-2 py-2 border rounded-xl text-center font-bold text-[11px] transition-all cursor-pointer ${
                        categoryFormData.isRawMaterialGroup
                          ? 'bg-slate-950 border-slate-950 text-white shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {'Raw Material'}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Category Name (EN) *'}
                </label>
                <input
                  type="text"
                  required
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  placeholder="e.g. BSRM Steel Ltd. / DIGITAL PRINTING"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold uppercase focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Bengali Name'}
                </label>
                <input
                  type="text"
                  value={categoryFormData.nameBn}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, nameBn: e.target.value })}
                  placeholder="e.g. Category Name in Bengali (Optional)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Description / Scope'}
                </label>
                <textarea
                  rows={2}
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  placeholder="Items or services covered under this category..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowCategoryQuickModal(false);
                  setCategoryQuickEditTarget(null);
                }}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                {'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer"
              >
                {categoryQuickEditTarget ? 'Save Changes' : 'Create Category'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>);
};
