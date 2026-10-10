import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Package,
  Layers,
  AlertTriangle,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import api from '../../api/axios';
import { Button, Badge, Card, BottomSheet, useToast } from '../../components/ui';
import { formatPaise, paiseToRupees, rupeesToPaise } from '../../utils/format';

const resolveIcon = (name) => {
  if (!name) return Package;
  return LucideIcons[name] || Package;
};

export const StoreProducts = () => {
  const { t, i18n } = useTranslation();
  const isTe = i18n.language?.startsWith('te');
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // all, inStock, outOfStock
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit price modal state
  const [editProduct, setEditProduct] = useState(null);
  const [newPrice, setNewPrice] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);
  const [priceError, setPriceError] = useState('');

  // Mark category out of stock modal
  const [outOfStockCategoryModal, setOutOfStockCategoryModal] = useState(false);
  const [selectedCatToDisable, setSelectedCatToDisable] = useState('');
  const [disablingCategory, setDisablingCategory] = useState(false);

  // 1. Fetch categories
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await api.get('/categories');
        setCategories(res.data.categories || []);
      } catch {
        // Ignored
      }
    };
    fetchCats();
  }, []);

  // 2. Fetch store products
  const fetchMyProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        q: searchQuery.trim() || undefined,
        inStock: stockFilter === 'all' ? undefined : stockFilter === 'inStock' ? 'true' : 'false',
      };
      const res = await api.get('/store-products', { params });
      setProducts(res.data.products || []);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery, stockFilter, addToast]);

  useEffect(() => {
    fetchMyProducts();
  }, [fetchMyProducts]);

  // One-tap stock toggle
  const handleToggleStock = async (p) => {
    try {
      const nextStock = !p.inStock;
      // Optimistic update
      setProducts((prev) =>
        prev.map((item) => (item._id === p._id ? { ...item, inStock: nextStock } : item)),
      );

      await api.patch(`/store-products/${p._id}`, { inStock: nextStock });
      addToast(nextStock ? 'Marked In Stock' : 'Marked Out of Stock', 'info');
    } catch {
      addToast('Failed to update stock status', 'error');
      fetchMyProducts();
    }
  };

  // Open edit price drawer
  const handleOpenEditPrice = (p) => {
    setEditProduct(p);
    setNewPrice(String(paiseToRupees(p.price)));
    setPriceError('');
  };

  // Save updated price
  const handleSavePrice = async (e) => {
    e.preventDefault();
    if (!editProduct) return;

    const num = Number(newPrice);
    const mrpInRupees = paiseToRupees(editProduct.mrp);

    if (isNaN(num) || num <= 0) {
      setPriceError('Please enter a valid price greater than 0');
      return;
    }

    if (num > mrpInRupees) {
      setPriceError(`Price cannot exceed MRP of ₹${mrpInRupees}`);
      return;
    }

    setSavingPrice(true);
    try {
      await api.patch(`/store-products/${editProduct._id}`, {
        price: rupeesToPaise(num),
      });
      addToast('Price updated successfully', 'success');
      setEditProduct(null);
      fetchMyProducts();
    } catch (err) {
      setPriceError(err.response?.data?.message || 'Price update failed');
    } finally {
      setSavingPrice(false);
    }
  };

  // Remove product from store
  const handleRemove = async (p) => {
    if (!window.confirm(t('storeProducts.removeConfirm'))) return;

    try {
      await api.delete(`/store-products/${p._id}`);
      addToast('Product removed from store', 'success');
      fetchMyProducts();
    } catch {
      addToast('Failed to remove product', 'error');
    }
  };

  // Mark category out of stock
  const handleMarkCategoryOutOfStock = async () => {
    if (!selectedCatToDisable) return;

    setDisablingCategory(true);
    try {
      const res = await api.patch(`/store-products/category/${selectedCatToDisable}/out-of-stock`);
      addToast(res.data.message || 'Category marked out of stock', 'success');
      setOutOfStockCategoryModal(false);
      setSelectedCatToDisable('');
      fetchMyProducts();
    } catch {
      addToast('Failed to update category products', 'error');
    } finally {
      setDisablingCategory(false);
    }
  };

  return (
    <div className="flex flex-col pb-28 space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink-900 tracking-tight">
            {t('storeProducts.inventoryTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-ink-600 mt-0.5">
            {t('storeProducts.inventorySubtitle')}
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          className="text-xs font-bold gap-1 shrink-0"
          onClick={() => navigate('/store/products/add')}
        >
          <Plus className="w-4 h-4" />
          <span>{t('storeProducts.addMore')}</span>
        </Button>
      </div>

      {/* Search & Bulk Category Action */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t('storeProducts.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-ink-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs"
          />
        </div>

        <Button
          variant="secondary"
          size="md"
          className="text-xs font-semibold shrink-0 gap-1"
          onClick={() => setOutOfStockCategoryModal(true)}
        >
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span className="hidden sm:inline">{t('storeProducts.markCategoryOut')}</span>
        </Button>
      </div>

      {/* Category Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
            selectedCategory === 'all'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'bg-white border border-ink-300 text-ink-700 hover:bg-gray-50'
          }`}
        >
          {t('storeProducts.all')}
        </button>

        {categories.map((c) => {
          const IconComponent = resolveIcon(c.icon);
          const isSelected = selectedCategory === c._id;
          return (
            <button
              key={c._id}
              type="button"
              onClick={() => setSelectedCategory(c._id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                isSelected
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-white border border-ink-300 text-ink-700 hover:bg-gray-50'
              }`}
            >
              <IconComponent className="w-3.5 h-3.5" />
              <span>{isTe && c.nameTe ? c.nameTe : c.name}</span>
            </button>
          );
        })}
      </div>

      {/* Stock Filter Pills */}
      <div className="flex gap-2">
        <button
          onClick={() => setStockFilter('all')}
          className={`text-xs px-3 py-1 rounded-lg font-medium ${
            stockFilter === 'all' ? 'bg-ink-900 text-white' : 'bg-gray-100 text-ink-700'
          }`}
        >
          All ({products.length})
        </button>
        <button
          onClick={() => setStockFilter('inStock')}
          className={`text-xs px-3 py-1 rounded-lg font-medium ${
            stockFilter === 'inStock' ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-ink-700'
          }`}
        >
          In Stock
        </button>
        <button
          onClick={() => setStockFilter('outOfStock')}
          className={`text-xs px-3 py-1 rounded-lg font-medium ${
            stockFilter === 'outOfStock' ? 'bg-red-700 text-white' : 'bg-gray-100 text-ink-700'
          }`}
        >
          Out of Stock
        </button>
      </div>

      {/* Products List */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-ink-500">{t('common.loading')}</span>
        </div>
      ) : products.length === 0 ? (
        <Card className="text-center py-12 space-y-3">
          <Layers className="w-10 h-10 text-ink-300 mx-auto" />
          <p className="text-sm font-semibold text-ink-700">{t('storeProducts.emptyInventory')}</p>
          <Button
            variant="primary"
            size="md"
            className="text-xs font-bold mx-auto gap-1"
            onClick={() => navigate('/store/products/add')}
          >
            <Plus className="w-4 h-4" />
            {t('storeProducts.addMore')}
          </Button>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {products.map((p) => {
            const master = p.masterProduct;
            const name = p.customName || master?.name || 'Item';
            const nameTe = master?.nameTe || '';
            const brand = master?.brand || 'Local';
            const unit = master?.unit || '';
            const image = p.customImage || master?.image;
            const IconComp = resolveIcon(master?.category?.icon);

            return (
              <div
                key={p._id}
                className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white ${
                  p.inStock ? 'border-ink-200 shadow-xs' : 'border-red-200 bg-red-50/20 opacity-80'
                }`}
              >
                {/* Product Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-50 shrink-0 border border-ink-100 flex items-center justify-center p-1">
                    {image ? (
                      <img
                        src={image}
                        alt={name}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-primary-700">
                        <IconComp className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  {/* Name & Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-ink-900 leading-snug truncate">
                        {isTe && nameTe ? nameTe : name}
                      </h3>
                      {!p.inStock && (
                        <Badge variant="rejected" className="text-[10px] py-0 px-1.5">
                          {t('storeProducts.outOfStock')}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-500">
                      <span>{brand}</span>
                      {unit && (
                        <>
                          <span>•</span>
                          <span>{unit}</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="text-ink-400">MRP: {formatPaise(p.mrp)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Price & One-Tap Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-ink-100 shrink-0">
                  {/* Selling Price Display with Edit button */}
                  <button
                    type="button"
                    onClick={() => handleOpenEditPrice(p)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 hover:bg-primary-50 border border-ink-200 hover:border-primary-300 transition-colors group"
                    title={t('storeProducts.editPrice')}
                  >
                    <span className="text-sm font-bold text-ink-900 group-hover:text-primary-700">
                      {formatPaise(p.price)}
                    </span>
                    <Edit2 className="w-3.5 h-3.5 text-ink-400 group-hover:text-primary-600" />
                  </button>

                  {/* One-Tap In Stock / Out of Stock Switch */}
                  <button
                    type="button"
                    onClick={() => handleToggleStock(p)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all min-h-[44px] flex items-center gap-1.5 ${
                      p.inStock
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                        : 'bg-red-50 text-red-700 border border-red-300 hover:bg-red-100'
                    }`}
                  >
                    {p.inStock ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>{t('storeProducts.inStock')}</span>
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4 text-red-600" />
                        <span>{t('storeProducts.outOfStock')}</span>
                      </>
                    )}
                  </button>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => handleRemove(p)}
                    className="p-2 text-ink-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    title={t('storeProducts.remove')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Price Drawer */}
      <BottomSheet
        isOpen={Boolean(editProduct)}
        onClose={() => setEditProduct(null)}
        title={t('storeProducts.editPrice')}
      >
        {editProduct && (
          <form onSubmit={handleSavePrice} className="space-y-4 pb-4">
            <div>
              <span className="text-xs font-semibold text-ink-500 block">Product</span>
              <p className="text-sm font-bold text-ink-900">
                {isTe && editProduct.masterProduct?.nameTe
                  ? editProduct.masterProduct.nameTe
                  : editProduct.customName || editProduct.masterProduct?.name || editProduct.name}
              </p>
              <p className="text-xs text-ink-600">MRP: {formatPaise(editProduct.mrp)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1">
                {t('storeProducts.sellingPrice')}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-600">
                  ₹
                </span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max={paiseToRupees(editProduct.mrp)}
                  value={newPrice}
                  onChange={(e) => {
                    setNewPrice(e.target.value);
                    setPriceError('');
                  }}
                  className="w-full pl-8 pr-3 py-2.5 text-base font-bold bg-white border border-ink-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-ink-900"
                  required
                />
              </div>
              {priceError && (
                <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {priceError}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={savingPrice}
              className="w-full min-h-[56px] text-base font-bold shadow-md"
            >
              {t('common.save')}
            </Button>
          </form>
        )}
      </BottomSheet>

      {/* Mark Category Out of Stock Modal */}
      <BottomSheet
        isOpen={outOfStockCategoryModal}
        onClose={() => setOutOfStockCategoryModal(false)}
        title={t('storeProducts.markCategoryOut')}
      >
        <div className="space-y-4 pb-4">
          <p className="text-xs text-ink-600">{t('storeProducts.selectCategory')}</p>

          <select
            value={selectedCatToDisable}
            onChange={(e) => setSelectedCatToDisable(e.target.value)}
            className="w-full p-3 text-sm bg-white border border-ink-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-ink-900"
          >
            <option value="">-- Choose Category --</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {isTe && c.nameTe ? c.nameTe : c.name}
              </option>
            ))}
          </select>

          <div className="pt-2 flex gap-2">
            <Button
              variant="secondary"
              size="lg"
              className="flex-1 min-h-[56px]"
              onClick={() => setOutOfStockCategoryModal(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              size="lg"
              disabled={!selectedCatToDisable}
              loading={disablingCategory}
              className="flex-1 min-h-[56px] font-bold"
              onClick={handleMarkCategoryOutOfStock}
            >
              Mark Out of Stock
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
