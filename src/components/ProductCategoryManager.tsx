import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ProductCategory, ProductItem } from '../types';
import { Tag, Plus, Search, Edit2, Trash2, Package, AlertCircle, CheckCircle2, Boxes, X } from 'lucide-react';
export const ProductCategoryManager: React.FC = () => {
    const { productCategories, products, language, addProductCategory, updateProductCategory, deleteProductCategory, deleteProduct, checkPermission, } = useApp();
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [categoryToDelete, setCategoryToDelete] = useState<ProductCategory | null>(null);
    const [viewingCategoryForItems, setViewingCategoryForItems] = useState<ProductCategory | null>(null);
    const [itemToDelete, setItemToDelete] = useState<ProductItem | null>(null);
    const [itemSearchQuery, setItemSearchQuery] = useState('');
    const canManageCategories = checkPermission('inventory.manage_categories');
    // Form state
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        nameBn: '',
        description: '',
        isRawMaterialGroup: false,
    });
    const filteredCategories = productCategories.filter((cat) => {
        const q = searchQuery.toLowerCase().trim();
        if (!q)
            return true;
        return (cat.name.toLowerCase().includes(q) ||
            (cat.nameBn && cat.nameBn.includes(q)) ||
            cat.code.toLowerCase().includes(q));
    });
    const handleOpenAdd = () => {
        const nextCode = `CAT-${Math.floor(10 + Math.random() * 90)}`;
        setFormData({
            code: nextCode,
            name: '',
            nameBn: '',
            description: '',
            isRawMaterialGroup: false,
        });
        setEditingCategory(null);
        setShowAddModal(true);
        setDeleteError(null);
    };
    const handleOpenEdit = (cat: ProductCategory) => {
        setFormData({
            code: cat.code,
            name: cat.name,
            nameBn: cat.nameBn || '',
            description: cat.description || '',
            isRawMaterialGroup: !!cat.isRawMaterialGroup,
        });
        setEditingCategory(cat);
        setShowAddModal(true);
        setDeleteError(null);
    };
    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.code.trim())
            return;
        if (editingCategory) {
            updateProductCategory(editingCategory.id, {
                code: formData.code.trim(),
                name: formData.name.trim(),
                nameBn: formData.nameBn.trim(),
                description: formData.description.trim(),
                isRawMaterialGroup: formData.isRawMaterialGroup,
            });
        }
        else {
            addProductCategory({
                code: formData.code.trim(),
                name: formData.name.trim(),
                nameBn: formData.nameBn.trim(),
                description: formData.description.trim(),
                isRawMaterialGroup: formData.isRawMaterialGroup,
            });
        }
        setShowAddModal(false);
    };
    const handleDelete = (id: string) => {
        const res = deleteProductCategory(id);
        if (!res.success) {
            setDeleteError(res.message || 'Cannot delete category');
            setTimeout(() => setDeleteError(null), 5000);
        }
    };
    return (<div className="space-y-4">
      {deleteError && (<div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0"/>
            <span>{deleteError}</span>
          </div>
          <button type="button" onClick={() => setDeleteError(null)} className="text-rose-500 hover:text-rose-800">
            ✕
          </button>
        </div>)}

      {/* Action Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"/>
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={'Search product category...'} className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"/>
        </div>

        {canManageCategories && (<button type="button" id="btn-add-product-category" onClick={handleOpenAdd} className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-all w-full sm:w-auto justify-center">
            <Plus className="w-4 h-4"/>
            <span>{'Add New Category'}</span>
          </button>)}
      </div>

      {/* Categories Table List (Inventory & Products style) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                <th className="py-3 px-4">
                  {'Category Code'}
                </th>
                <th className="py-3 px-4">
                  {'Category Name & Description'}
                </th>
                <th className="py-3 px-4">
                  {'Classification'}
                </th>
                <th className="py-3 px-4 text-center">
                  {'Linked Items'}
                </th>
                <th className="py-3 px-4 text-right">
                  {'Action'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCategories.length === 0 ? (<tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                        <Tag className="w-5 h-5"/>
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm">
                        {'No categories found'}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {'Try searching with another keyword or add a new category.'}
                      </p>
                    </div>
                  </td>
                </tr>) : (filteredCategories.map((cat) => {
            const itemCount = products.filter((p) => p.category?.toLowerCase() === cat.name.toLowerCase()).length;
            return (<tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 align-middle">
                        <span className="font-mono text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                          {cat.code}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 align-middle">
                        <div className="font-bold text-slate-900 text-sm">{cat.name}</div>
                        {cat.nameBn && (<div className="text-xs text-slate-500 font-medium mt-0.5">{cat.nameBn}</div>)}
                        {cat.description && (<div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 max-w-md">
                            {cat.description}
                          </div>)}
                      </td>

                      <td className="py-3.5 px-4 align-middle">
                        <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${cat.isRawMaterialGroup
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                          {cat.isRawMaterialGroup
                    ?
                        'Raw Material'
                    :
                        'Finished Goods / Service'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => {
                            setViewingCategoryForItems(cat);
                            setItemSearchQuery('');
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 px-2.5 py-1 rounded-full border border-blue-200 transition-colors cursor-pointer group"
                          title="Click to view and delete items in this category"
                        >
                          <Package className="w-3.5 h-3.5 group-hover:scale-110 transition-transform"/>
                          <span>
                            {itemCount} {'Items'}
                          </span>
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right align-middle">
                        <div className="flex items-center justify-end gap-1.5">
                          <button type="button" onClick={() => handleOpenEdit(cat)} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors" title={'Edit Category'}>
                            <Edit2 className="w-3.5 h-3.5"/>
                          </button>
                          <button type="button" onClick={() => setCategoryToDelete(cat)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors" title={'Delete Category'}>
                            <Trash2 className="w-3.5 h-3.5"/>
                          </button>
                        </div>
                      </td>
                    </tr>);
        }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Category Modal */}
      {showAddModal && (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleFormSubmit} className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-600"/>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingCategory
                ?
                    'Edit Product Category'
                :
                    'Add New Product Category'}
                </h3>
              </div>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Category Code *'}
                  </label>
                  <input type="text" required value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="e.g. CAT-PRINT" className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold"/>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Category Type'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setFormData({ ...formData, isRawMaterialGroup: false })} className={`px-3 py-2 border rounded-xl text-center font-bold text-xs transition-all ${!formData.isRawMaterialGroup
                ? 'bg-slate-950 border-slate-950 text-white shadow-2xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                      {'Finished Goods / Services'}
                    </button>
                    <button type="button" onClick={() => setFormData({ ...formData, isRawMaterialGroup: true })} className={`px-3 py-2 border rounded-xl text-center font-bold text-xs transition-all ${formData.isRawMaterialGroup
                ? 'bg-slate-950 border-slate-950 text-white shadow-2xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                      {'Raw Materials'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Category Name (EN) *'}
                  </label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. DIGITAL PRINTING" className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold uppercase"/>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {'Bengali Name'}
                  </label>
                  <input type="text" value={formData.nameBn} onChange={(e) => setFormData({ ...formData, nameBn: e.target.value })} placeholder=":  Print" className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {'Description / Scope'}
                </label>
                <textarea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Items or services covered under this category..." className="w-full px-3 py-2 border border-slate-200 rounded-xl"/>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {'Cancel'}
              </button>
              <button type="submit" className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs">
                {'Save Category'}
              </button>
            </div>
          </form>
        </div>)}

      {/* CUSTOM CONFIRM DELETE CATEGORY MODAL */}
      {categoryToDelete && (() => {
            const itemCount = products.filter((p) => p.category?.toLowerCase() === categoryToDelete.name.toLowerCase()).length;
            const hasProducts = itemCount > 0;
            return (<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto border ${hasProducts
                    ? 'bg-amber-50 text-amber-600 border-amber-100'
                    : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                {hasProducts ? (<AlertCircle className="w-6 h-6"/>) : (<Trash2 className="w-6 h-6"/>)}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {hasProducts
                    ? ('Cannot Delete Category')
                    : ('Confirm Category Deletion')}
                </h3>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  {hasProducts
                    ? (`This category cannot be deleted because it has ${itemCount} product(s) assigned to it. Please reassign them first.`)
                    : (`Are you sure you want to delete the category "${categoryToDelete.name}"? This action cannot be undone.`)}
                </p>
              </div>
              <div className="flex justify-center gap-2 pt-2">
                {hasProducts ? (<button type="button" onClick={() => setCategoryToDelete(null)} className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs">
                    {'OK'}
                  </button>) : (<>
                    <button type="button" onClick={() => setCategoryToDelete(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
                      {'Cancel'}
                    </button>
                    <button type="button" onClick={() => {
                        handleDelete(categoryToDelete.id);
                        setCategoryToDelete(null);
                    }} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-2xs">
                      {'Delete'}
                    </button>
                  </>)}
              </div>
            </div>
          </div>);
        })()}

      {/* MODAL: VIEW & DELETE LINKED ITEMS FOR A CATEGORY */}
      {viewingCategoryForItems && (() => {
        const catProducts = products.filter(
          (p) => p.category?.toLowerCase() === viewingCategoryForItems.name.toLowerCase()
        );
        const filteredCatProducts = catProducts.filter((p) => {
          if (!itemSearchQuery.trim()) return true;
          const q = itemSearchQuery.toLowerCase().trim();
          return (
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q) ||
            (p.nameBn && p.nameBn.includes(q))
          );
        });

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {viewingCategoryForItems.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Linked Items ({catProducts.length}) • Code: {viewingCategoryForItems.code}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingCategoryForItems(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  placeholder="Search items in this category..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>

              {/* Items List */}
              <div className="overflow-y-auto flex-1 border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Item Code</th>
                      <th className="py-2.5 px-3">Item Name</th>
                      <th className="py-2.5 px-3 text-center">Stock (Factory / Office)</th>
                      <th className="py-2.5 px-3 text-right">Price</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCatProducts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                          {catProducts.length === 0 ? 'No items assigned to this category.' : 'No matching items found.'}
                        </td>
                      </tr>
                    ) : (
                      filteredCatProducts.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                            {item.code}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{item.name}</div>
                            {item.nameBn && <div className="text-[11px] text-slate-500">{item.nameBn}</div>}
                          </td>
                          <td className="py-2.5 px-3 text-center text-[11px] font-semibold text-slate-600">
                            {item.stockFactory} / {item.stockOffice} {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                            ৳{item.unitPrice.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setItemToDelete(item)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100 cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setViewingCategoryForItems(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CONFIRM DELETE PRODUCT ITEM MODAL */}
      {itemToDelete && (
        <div className="fixed inset-0 z-60 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto border bg-rose-50 text-rose-600 border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Delete Item</h3>
              <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                Are you sure you want to delete <strong>{itemToDelete.name}</strong> ({itemToDelete.code})? It will be removed from all devices in real time.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteProduct(itemToDelete.id);
                  setItemToDelete(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-2xs"
              >
                Delete Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>);
};
