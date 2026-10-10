import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  Edit2,
  X,
  Upload,
  Milk,
  Wheat,
  Cookie,
  Coffee,
  Droplet,
  Flame,
  Sparkles,
  Home,
  Cake,
  Utensils,
  Package,
  Layers,
  Check,
} from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency, paiseToRupees, rupeesToPaise } from '../../utils/format';
import { Button, Input, Card, Badge, DataTable, useToast } from '../../components/ui';

const ICON_MAP = {
  milk: Milk,
  wheat: Wheat,
  cookie: Cookie,
  coffee: Coffee,
  droplet: Droplet,
  flame: Flame,
  sparkles: Sparkles,
  home: Home,
  cake: Cake,
  utensils: Utensils,
};

const getCategoryIconComponent = (iconName) => {
  const key = String(iconName || '').toLowerCase();
  return ICON_MAP[key] || Package;
};

export const Catalogue = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'categories'

  // Categories State
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    nameTe: '',
    icon: 'Package',
    sortOrder: 0,
    isActive: true,
  });

  // Products State
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });
  const [productDrawerOpen, setProductDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '',
    nameTe: '',
    brand: '',
    category: '',
    unit: '',
    mrpRupees: '',
    isActive: true,
  });
  const [productImageFile, setProductImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);

  // Fetch Categories
  const fetchCategories = useCallback(async () => {
    try {
      setCategoriesLoading(true);
      const res = await api.get('/admin/categories');
      if (res.data?.success) {
        setCategories(res.data.categories || []);
      }
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load categories',
      });
    } finally {
      setCategoriesLoading(false);
    }
  }, [showToast]);

  // Fetch Products
  const fetchProducts = useCallback(async () => {
    try {
      setProductsLoading(true);
      const params = {
        page,
        limit: 15,
      };
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (selectedCategory) params.category = selectedCategory;

      const res = await api.get('/admin/master-products', { params });
      if (res.data?.success) {
        setProducts(res.data.products || []);
        setPagination(res.data.pagination || { totalPages: 1, total: 0 });
      }
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load master products',
      });
    } finally {
      setProductsLoading(false);
    }
  }, [page, searchQuery, selectedCategory, showToast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (activeTab === 'products') {
      fetchProducts();
    }
  }, [activeTab, fetchProducts]);

  // Handle Product Active Toggle
  const handleToggleProductActive = async (prod) => {
    try {
      const nextActive = !prod.isActive;
      const res = await api.put(`/admin/master-products/${prod._id}`, { isActive: nextActive });
      if (res.data?.success) {
        setProducts((prev) =>
          prev.map((p) => (p._id === prod._id ? { ...p, isActive: nextActive } : p)),
        );
        showToast({
          type: 'success',
          message: `${prod.name} is now ${nextActive ? 'Active' : 'Inactive'}`,
        });
      }
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update status',
      });
    }
  };

  // Open Product Drawer
  const openProductDrawer = (prod = null) => {
    setEditingProduct(prod);
    setProductImageFile(null);
    if (prod) {
      setProductForm({
        name: prod.name || '',
        nameTe: prod.nameTe || '',
        brand: prod.brand || '',
        category: prod.category?._id || prod.category || '',
        unit: prod.unit || '',
        mrpRupees: paiseToRupees(prod.mrp),
        isActive: prod.isActive ?? true,
      });
      setImagePreview(prod.image || null);
    } else {
      setProductForm({
        name: '',
        nameTe: '',
        brand: '',
        category: categories[0]?._id || '',
        unit: '',
        mrpRupees: '',
        isActive: true,
      });
      setImagePreview(null);
    }
    setProductDrawerOpen(true);
  };

  // Open Category Drawer
  const openCategoryDrawer = (cat = null) => {
    setEditingCategory(cat);
    if (cat) {
      setCategoryForm({
        name: cat.name || '',
        nameTe: cat.nameTe || '',
        icon: cat.icon || 'Package',
        sortOrder: cat.sortOrder || 0,
        isActive: cat.isActive ?? true,
      });
    } else {
      setCategoryForm({
        name: '',
        nameTe: '',
        icon: 'Package',
        sortOrder: (categories.length + 1) * 10,
        isActive: true,
      });
    }
    setCategoryDrawerOpen(true);
  };

  // Handle Image Selection
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast({ type: 'error', message: 'Image size exceeds 2 MB limit' });
        return;
      }
      setProductImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Save Product
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      setSavingProduct(true);
      const mrpPaise = rupeesToPaise(productForm.mrpRupees);
      if (!mrpPaise || mrpPaise <= 0) {
        showToast({ type: 'error', message: 'Please enter a valid MRP in rupees' });
        return;
      }

      const payload = {
        name: productForm.name.trim(),
        nameTe: productForm.nameTe.trim(),
        brand: productForm.brand.trim(),
        category: productForm.category,
        unit: productForm.unit.trim(),
        mrp: mrpPaise,
        isActive: productForm.isActive,
      };

      let savedProduct;
      if (editingProduct) {
        const res = await api.put(`/admin/master-products/${editingProduct._id}`, payload);
        savedProduct = res.data?.product;
      } else {
        const res = await api.post('/admin/master-products', payload);
        savedProduct = res.data?.product;
      }

      // If an image was selected, upload it
      if (productImageFile && savedProduct?._id) {
        const formData = new FormData();
        formData.append('image', productImageFile);
        await api.post(`/admin/master-products/${savedProduct._id}/image`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      showToast({
        type: 'success',
        message: editingProduct ? 'Product updated successfully' : 'Product created successfully',
      });
      setProductDrawerOpen(false);
      fetchProducts();
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save product',
      });
    } finally {
      setSavingProduct(false);
    }
  };

  // Save Category
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    try {
      setSavingCategory(true);
      const payload = {
        name: categoryForm.name.trim(),
        nameTe: categoryForm.nameTe.trim(),
        icon: categoryForm.icon.trim(),
        sortOrder: Number(categoryForm.sortOrder) || 0,
        isActive: categoryForm.isActive,
      };

      if (editingCategory) {
        await api.put(`/admin/categories/${editingCategory._id}`, payload);
      } else {
        await api.post('/admin/categories', payload);
      }

      showToast({
        type: 'success',
        message: editingCategory ? 'Category updated' : 'Category added',
      });
      setCategoryDrawerOpen(false);
      fetchCategories();
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save category',
      });
    } finally {
      setSavingCategory(false);
    }
  };

  // Product Table Columns
  const productColumns = [
    {
      key: 'image',
      header: t('catalogue.image'),
      render: (prod) => {
        const CatIcon = getCategoryIconComponent(prod.category?.icon);
        return (
          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-ink-300/60 bg-primary-50">
            {prod.image ? (
              <img
                src={prod.image}
                alt={prod.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <CatIcon className="w-6 h-6 text-primary-700 stroke-[2.2]" />
            )}
          </div>
        );
      },
      className: 'w-16',
    },
    {
      key: 'name',
      header: t('catalogue.nameEn'),
      render: (prod) => (
        <div>
          <div className="font-semibold text-ink-900 leading-snug">{prod.name}</div>
          <div className="text-xs text-ink-600 font-sans lang-te mt-0.5">{prod.nameTe}</div>
        </div>
      ),
    },
    {
      key: 'brand',
      header: t('catalogue.brand'),
      render: (prod) => <span className="font-medium text-ink-600">{prod.brand}</span>,
    },
    {
      key: 'category',
      header: t('catalogue.category'),
      render: (prod) => (
        <Badge variant="accepted" className="text-[11px]">
          {prod.category?.name || 'Uncategorized'}
        </Badge>
      ),
    },
    {
      key: 'unit',
      header: t('catalogue.unit'),
      render: (prod) => <span className="text-xs font-semibold text-ink-600">{prod.unit}</span>,
    },
    {
      key: 'mrp',
      header: t('catalogue.mrp'),
      render: (prod) => (
        <span className="font-bold text-ink-900 tabular-nums">{formatCurrency(prod.mrp)}</span>
      ),
    },
    {
      key: 'isActive',
      header: t('catalogue.status'),
      render: (prod) => (
        <button
          type="button"
          onClick={() => handleToggleProductActive(prod)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors select-none ${
            prod.isActive
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${prod.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`}
          />
          <span>{prod.isActive ? t('catalogue.active') : t('catalogue.inactive')}</span>
        </button>
      ),
    },
    {
      key: 'actions',
      header: t('catalogue.actions'),
      render: (prod) => (
        <Button
          variant="secondary"
          size="md"
          className="h-9 min-h-[36px] px-3 text-xs"
          leftIcon={Edit2}
          onClick={() => openProductDrawer(prod)}
        >
          {t('common.edit')}
        </Button>
      ),
      className: 'text-right',
    },
  ];

  // Category Table Columns
  const categoryColumns = [
    {
      key: 'icon',
      header: t('catalogue.icon'),
      render: (cat) => {
        const IconComponent = getCategoryIconComponent(cat.icon);
        return (
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center border border-primary-200">
            <IconComponent className="w-5 h-5 stroke-[2.2]" />
          </div>
        );
      },
      className: 'w-14',
    },
    {
      key: 'name',
      header: t('catalogue.nameEn'),
      render: (cat) => (
        <div>
          <span className="font-semibold text-ink-900">{cat.name}</span>
          <span className="text-xs text-ink-600 block lang-te">{cat.nameTe}</span>
        </div>
      ),
    },
    {
      key: 'sortOrder',
      header: t('catalogue.sortOrder'),
      render: (cat) => <span className="font-mono text-xs">{cat.sortOrder}</span>,
    },
    {
      key: 'status',
      header: t('catalogue.status'),
      render: (cat) => (
        <Badge variant={cat.isActive ? 'delivered' : 'expired'}>
          {cat.isActive ? t('catalogue.active') : t('catalogue.inactive')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('catalogue.actions'),
      render: (cat) => (
        <Button
          variant="secondary"
          size="md"
          className="h-9 min-h-[36px] px-3 text-xs"
          leftIcon={Edit2}
          onClick={() => openCategoryDrawer(cat)}
        >
          {t('common.edit')}
        </Button>
      ),
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-6 antialiased">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900 tracking-tight">
            {t('catalogue.title')}
          </h1>
          <p className="text-xs text-ink-600 mt-1">
            Manage the centralized master catalogue of packaged products and categories.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'products' ? (
            <Button variant="primary" size="md" leftIcon={Plus} onClick={() => openProductDrawer()}>
              {t('catalogue.addProduct')}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              leftIcon={Plus}
              onClick={() => openCategoryDrawer()}
            >
              {t('catalogue.addCategory')}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-ink-300/60 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors ${
            activeTab === 'products'
              ? 'bg-primary-50 text-primary-600 border border-primary-200'
              : 'text-ink-600 hover:text-ink-900'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>{t('catalogue.productsTab')}</span>
          <span className="text-xs bg-white/80 px-2 py-0.5 rounded-full border border-ink-300/40 font-mono">
            {pagination.total || products.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors ${
            activeTab === 'categories'
              ? 'bg-primary-50 text-primary-600 border border-primary-200'
              : 'text-ink-600 hover:text-ink-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{t('catalogue.categoriesTab')}</span>
          <span className="text-xs bg-white/80 px-2 py-0.5 rounded-full border border-ink-300/40 font-mono">
            {categories.length}
          </span>
        </button>
      </div>

      {/* TAB 1: PRODUCTS */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Search & Category Filter Bar */}
          <Card className="p-4 flex flex-col sm:flex-row gap-3 items-center">
            <div className="flex-1 w-full">
              <Input
                placeholder={t('catalogue.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                leftIcon={Search}
              />
            </div>

            <div className="w-full sm:w-64">
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full h-12 min-h-[48px] px-3.5 bg-white text-ink-900 rounded-xl border border-ink-300 text-sm outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20"
              >
                <option value="">{t('catalogue.allCategories')}</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.nameTe})
                  </option>
                ))}
              </select>
            </div>
          </Card>

          {/* Products DataTable */}
          <DataTable
            columns={productColumns}
            data={products}
            loading={productsLoading}
            emptyMessage={t('catalogue.emptyProducts')}
            onRetry={fetchProducts}
          />

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-ink-600">
                Page <span className="font-bold">{page}</span> of{' '}
                <span className="font-bold">{pagination.totalPages}</span> ({pagination.total}{' '}
                items)
              </span>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-4 text-xs h-10 min-h-[40px]"
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 text-xs h-10 min-h-[40px]"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <DataTable
            columns={categoryColumns}
            data={categories}
            loading={categoriesLoading}
            emptyMessage={t('catalogue.emptyCategories')}
            onRetry={fetchCategories}
          />
        </div>
      )}

      {/* PRODUCT ADD / EDIT RIGHT-SIDE DRAWER */}
      {productDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-ink-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setProductDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative z-10 w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto p-6 animate-in slide-in-from-right duration-200">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-ink-300/40">
                <h3 className="text-lg font-bold text-ink-900">
                  {editingProduct ? t('catalogue.editProduct') : t('catalogue.addProduct')}
                </h3>
                <button
                  type="button"
                  onClick={() => setProductDrawerOpen(false)}
                  className="p-1 rounded-lg text-ink-600 hover:text-ink-900 hover:bg-page"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form id="product-form" onSubmit={handleSaveProduct} className="space-y-4">
                {/* Image Upload & Preview */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ink-900 block">
                    {t('catalogue.image')}
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-ink-300 overflow-hidden flex items-center justify-center bg-page flex-shrink-0">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-8 h-8 text-ink-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-ink-300 bg-white hover:bg-page transition-colors">
                        <Upload className="w-4 h-4 text-primary-600" />
                        <span>{t('catalogue.uploadImage')}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={handleImageChange}
                        />
                      </label>
                      <p className="text-[11px] text-ink-600 mt-1">
                        JPEG, PNG, or WebP. Max 2 MB. Leave empty for category tile.
                      </p>
                    </div>
                  </div>
                </div>

                {/* English Name */}
                <Input
                  label={t('catalogue.nameEn')}
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="e.g. Aashirvaad Shudh Chakki Atta"
                  required
                />

                {/* Telugu Name */}
                <Input
                  label={t('catalogue.nameTe')}
                  value={productForm.nameTe}
                  onChange={(e) => setProductForm({ ...productForm, nameTe: e.target.value })}
                  placeholder="ఉదా: ఆశీర్వాద్ గోధుమ పిండి"
                  required
                />

                {/* Brand */}
                <Input
                  label={t('catalogue.brand')}
                  value={productForm.brand}
                  onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                  placeholder="e.g. Aashirvaad"
                  required
                />

                <div className="grid grid-cols-2 gap-3">
                  {/* Category Selection */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-ink-900 block">
                      {t('catalogue.category')}
                    </label>
                    <select
                      value={productForm.category}
                      onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                      required
                      className="w-full h-12 min-h-[48px] px-3 bg-white text-ink-900 rounded-xl border border-ink-300 text-sm outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20"
                    >
                      <option value="" disabled>
                        Select Category
                      </option>
                      {categories.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Unit */}
                  <Input
                    label={t('catalogue.unit')}
                    value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    placeholder="e.g. 1 kg, 500 ml"
                    required
                  />
                </div>

                {/* MRP in Rupees */}
                <Input
                  label={`${t('catalogue.mrp')} (₹)`}
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={productForm.mrpRupees}
                  onChange={(e) => setProductForm({ ...productForm, mrpRupees: e.target.value })}
                  placeholder="e.g. 58.00"
                  required
                />

                {/* Active Checkbox */}
                <label className="flex items-center gap-3 pt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={productForm.isActive}
                    onChange={(e) => setProductForm({ ...productForm, isActive: e.target.checked })}
                    className="w-5 h-5 rounded border-ink-300 text-primary-600 focus:ring-primary-600"
                  />
                  <span className="text-sm font-semibold text-ink-900">
                    Product is available in Master Catalogue
                  </span>
                </label>
              </form>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-ink-300/40 flex justify-end gap-2">
              <Button variant="secondary" size="md" onClick={() => setProductDrawerOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                form="product-form"
                variant="primary"
                size="md"
                loading={savingProduct}
                rightIcon={Check}
              >
                {t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY ADD / EDIT MODAL / DRAWER */}
      {categoryDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-ink-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setCategoryDrawerOpen(false)}
            aria-hidden="true"
          />

          <div className="relative z-10 w-full max-w-md bg-white rounded-card shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-ink-300/40">
              <h3 className="text-lg font-bold text-ink-900">
                {editingCategory ? t('catalogue.editCategory') : t('catalogue.addCategory')}
              </h3>
              <button
                type="button"
                onClick={() => setCategoryDrawerOpen(false)}
                className="p-1 rounded-lg text-ink-600 hover:text-ink-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <Input
                label={t('catalogue.nameEn')}
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="e.g. Dairy"
                required
              />

              <Input
                label={t('catalogue.nameTe')}
                value={categoryForm.nameTe}
                onChange={(e) => setCategoryForm({ ...categoryForm, nameTe: e.target.value })}
                placeholder="ఉదా: పాలు"
                required
              />

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink-900 block">
                  {t('catalogue.icon')}
                </label>
                <select
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                  className="w-full h-12 min-h-[48px] px-3 bg-white text-ink-900 rounded-xl border border-ink-300 text-sm outline-none focus:border-primary-600"
                >
                  {[
                    'Milk',
                    'Wheat',
                    'Cookie',
                    'Coffee',
                    'Droplet',
                    'Flame',
                    'Sparkles',
                    'Home',
                    'Cake',
                    'Utensils',
                    'Package',
                  ].map((ic) => (
                    <option key={ic} value={ic}>
                      {ic}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label={t('catalogue.sortOrder')}
                type="number"
                value={categoryForm.sortOrder}
                onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: e.target.value })}
                required
              />

              <div className="flex justify-end gap-2 pt-3 border-t border-ink-300/40">
                <Button variant="secondary" size="md" onClick={() => setCategoryDrawerOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" variant="primary" size="md" loading={savingCategory}>
                  {t('common.save')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
