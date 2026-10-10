import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Check, Plus, ArrowRight, Package, Layers, AlertCircle } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import api from '../../api/axios';
import { Input, Button, Badge, Card, BottomSheet, useToast } from '../../components/ui';
import { formatPaise, paiseToRupees, rupeesToPaise } from '../../utils/format';

const resolveIcon = (name) => {
  if (!name) return Package;
  return LucideIcons[name] || Package;
};

export const StoreAddProducts = () => {
  const { t, i18n } = useTranslation();
  const isTe = i18n.language?.startsWith('te');
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [masterProducts, setMasterProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Store total product count
  const [storeTotalCount, setStoreTotalCount] = useState(0);

  // Map of selected items: masterProductId -> sellingPrice (in rupees string)
  const [selectedItems, setSelectedItems] = useState({});

  // Custom product drawer state
  const [customDrawerOpen, setCustomDrawerOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customSubmitting, setCustomSubmitting] = useState(false);

  // 1. Fetch categories & existing store product count
  const fetchInitialData = useCallback(async () => {
    try {
      const [catsRes, myProdsRes] = await Promise.all([
        api.get('/categories'),
        api.get('/store-products'),
      ]);
      setCategories(catsRes.data.categories || []);
      setStoreTotalCount(myProdsRes.data.totalCount || 0);
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // 2. Fetch master products
  const fetchMasterProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        q: searchQuery.trim() || undefined,
        limit: 100,
      };
      const res = await api.get('/master-products', { params });
      setMasterProducts(res.data.products || []);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load catalogue', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery, addToast]);

  useEffect(() => {
    fetchMasterProducts();
  }, [fetchMasterProducts]);

  // Toggle selection of a master product
  const toggleSelect = (p) => {
    if (p.alreadyAdded) return;
    const id = p._id;
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[id] !== undefined) {
        delete next[id];
      } else {
        // Prefill selling price with MRP in rupees
        next[id] = String(paiseToRupees(p.mrp));
      }
      return next;
    });
  };

  const updatePrice = (id, priceStr) => {
    setSelectedItems((prev) => ({
      ...prev,
      [id]: priceStr,
    }));
  };

  // Check if any selected item violates price <= MRP
  const validationErrors = useMemo(() => {
    const errors = {};
    for (const [id, priceStr] of Object.entries(selectedItems)) {
      const p = masterProducts.find((item) => item._id === id);
      if (!p) continue;
      const numPrice = Number(priceStr);
      const mrpRupees = paiseToRupees(p.mrp);
      if (isNaN(numPrice) || numPrice <= 0) {
        errors[id] = 'Price must be greater than 0';
      } else if (numPrice > mrpRupees) {
        errors[id] = `Cannot exceed ₹${mrpRupees}`;
      }
    }
    return errors;
  }, [selectedItems, masterProducts]);

  const hasErrors = Object.keys(validationErrors).length > 0;
  const selectedCount = Object.keys(selectedItems).length;

  // Save selected master products in bulk
  const handleSaveBulk = async () => {
    if (selectedCount === 0 || hasErrors) return;

    setSaving(true);
    try {
      const items = Object.entries(selectedItems).map(([id, priceStr]) => ({
        masterProductId: id,
        price: rupeesToPaise(Number(priceStr)),
      }));

      const savedIds = new Set(Object.keys(selectedItems));
      const res = await api.post('/store-products/bulk', { items });

      // Clear the ticks, mark saved products "In Store", show Toast, and refetch saved count
      setSelectedItems({});
      setMasterProducts((prev) =>
        prev.map((p) => (savedIds.has(p._id) ? { ...p, alreadyAdded: true } : p)),
      );

      addToast(res.data.message || `Saved ${res.data.count || savedIds.size} products!`, 'success');

      await Promise.all([fetchInitialData(), fetchMasterProducts()]);
    } catch (err) {
      addToast(
        err.response?.data?.message ||
          'Failed to save products. Check that prices do not exceed MRP.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  // Create custom product
  const handleCreateCustom = async (e) => {
    e.preventDefault();
    if (!customName.trim() || !customPrice) return;

    setCustomSubmitting(true);
    try {
      await api.post('/store-products/custom', {
        name: customName.trim(),
        price: rupeesToPaise(Number(customPrice)),
      });
      addToast('Custom product added to your store!', 'success');
      setCustomName('');
      setCustomPrice('');
      setCustomDrawerOpen(false);
      await fetchInitialData();
      await fetchMasterProducts();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to add custom product', 'error');
    } finally {
      setCustomSubmitting(false);
    }
  };

  const savedCount = storeTotalCount;
  const tickedCount = selectedCount;
  const totalCount = savedCount + tickedCount;
  const unlockSelling = savedCount >= 10;
  const progressPercent = Math.min(100, (totalCount / 10) * 100);

  const progressText =
    i18n.language === 'te'
      ? `${savedCount} సేవ్ చేయబడ్డాయి · ${tickedCount} ఎంపిక చేయబడ్డాయి · ${totalCount} / 10`
      : `${savedCount} saved · ${tickedCount} selected · ${totalCount} / 10`;

  return (
    <div className={`flex flex-col space-y-4 ${selectedCount > 0 ? 'pb-52' : 'pb-28'}`}>
      {/* Top Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-ink-900 tracking-tight">
          {t('storeProducts.addTitle')}
        </h1>
        <p className="text-xs sm:text-sm text-ink-600 mt-0.5">{t('storeProducts.addSubtitle')}</p>
      </div>

      {/* Progress & Milestone Card */}
      <Card className="p-4 bg-white border border-primary-100 shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="font-semibold text-ink-900">{progressText}</span>

          {unlockSelling && (
            <Button
              size="md"
              variant="primary"
              className="text-xs font-bold py-1.5 px-3 shadow-xs gap-1 shrink-0"
              onClick={() => navigate('/store/orders')}
            >
              {t('storeProducts.startSelling')}
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Progress Bar based on saved + ticked (0 to 10) */}
        <div className="w-full bg-ink-200 h-2.5 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </Card>

      {/* Search & Custom Product Trigger */}
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
          type="button"
          variant="secondary"
          size="md"
          className="text-xs font-semibold shrink-0 gap-1"
          onClick={() => setCustomDrawerOpen(true)}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t('storeProducts.addCustom')}</span>
        </Button>
      </div>

      {/* Horizontal Category Chips */}
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

      {/* Product List */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-ink-500">{t('common.loading')}</span>
        </div>
      ) : masterProducts.length === 0 ? (
        <Card className="text-center py-10 space-y-2">
          <Layers className="w-10 h-10 text-ink-300 mx-auto" />
          <p className="text-sm font-semibold text-ink-700">{t('common.empty')}</p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {masterProducts.map((p) => {
            const isSelected = selectedItems[p._id] !== undefined;
            const isAlreadyAdded = p.alreadyAdded;
            const IconComp = resolveIcon(p.category?.icon);
            const err = validationErrors[p._id];

            return (
              <div
                key={p._id}
                onClick={() => !isAlreadyAdded && toggleSelect(p)}
                className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isAlreadyAdded
                    ? 'bg-gray-50/80 border-ink-200 opacity-60 cursor-not-allowed'
                    : isSelected
                      ? 'bg-primary-50/40 border-primary-500 ring-2 ring-primary-100 cursor-pointer'
                      : 'bg-white border-ink-200 hover:border-ink-300 shadow-xs cursor-pointer'
                }`}
              >
                {/* Left: Thumbnail & Name Details */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Selection Checkbox */}
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors shrink-0 ${
                      isAlreadyAdded
                        ? 'bg-gray-200 border-gray-300 text-gray-500'
                        : isSelected
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'border-ink-300 bg-white'
                    }`}
                  >
                    {(isSelected || isAlreadyAdded) && <Check className="w-4 h-4 stroke-[3]" />}
                  </div>

                  {/* Thumbnail / Category Icon Placeholder */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-50 shrink-0 border border-ink-100 flex items-center justify-center p-1">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-primary-700">
                        <IconComp className="w-6 h-6" />
                        <span className="text-[8px] font-bold mt-0.5 truncate max-w-[45px]">
                          {isTe && p.category?.nameTe ? p.category.nameTe : p.category?.name || ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Name, Telugu & Unit */}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-ink-900 leading-snug truncate">
                      {isTe && p.nameTe ? p.nameTe : p.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-500">
                      <span>{p.brand}</span>
                      <span>•</span>
                      <span>{p.unit}</span>
                      <span>•</span>
                      <span className="font-semibold text-ink-800">MRP: {formatPaise(p.mrp)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Inline Price Editor when selected */}
                <div
                  className="flex items-center justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-ink-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isAlreadyAdded ? (
                    <Badge variant="accepted">{t('storeProducts.alreadyAdded')}</Badge>
                  ) : isSelected ? (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-ink-700">₹</span>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          max={paiseToRupees(p.mrp)}
                          value={selectedItems[p._id] || ''}
                          onChange={(e) => updatePrice(p._id, e.target.value)}
                          className={`w-24 px-2 py-1.5 text-sm font-bold text-right bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                            err
                              ? 'border-red-500 text-red-700 focus:ring-red-400'
                              : 'border-primary-500 text-primary-900 focus:ring-primary-500'
                          }`}
                        />
                      </div>
                      {err && (
                        <span className="text-[10px] font-semibold text-red-600 flex items-center gap-0.5">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          {err}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-ink-600 bg-gray-100 px-2 py-1 rounded-lg">
                      {formatPaise(p.mrp)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky Bottom Bar with 56px Action Button - appears ABOVE bottom nav */}
      {selectedCount > 0 && (
        <div
          className="fixed left-0 right-0 z-30 max-w-md mx-auto px-4 pb-2"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <Button
            type="button"
            variant="primary"
            size="lg"
            loading={saving}
            disabled={hasErrors}
            className="w-full h-14 min-h-[56px] text-base font-bold shadow-lg gap-2 rounded-2xl"
            onClick={handleSaveBulk}
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
            {t('storeProducts.saveSelected', { count: selectedCount })}
          </Button>
        </div>
      )}

      {/* Custom Product Drawer */}
      <BottomSheet
        isOpen={customDrawerOpen}
        onClose={() => setCustomDrawerOpen(false)}
        title={t('storeProducts.customTitle')}
      >
        <form onSubmit={handleCreateCustom} className="space-y-4 pb-4">
          <p className="text-xs text-ink-600">{t('storeProducts.customDesc')}</p>

          <Input
            label={t('storeProducts.customName')}
            placeholder="e.g. Loose Sugar / బెల్లం"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            required
          />

          <Input
            label={t('storeProducts.customPrice')}
            type="number"
            min="1"
            placeholder="e.g. 50"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
            required
          />

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={customSubmitting}
              className="w-full min-h-[56px] text-base font-bold shadow-md"
            >
              {t('common.save')}
            </Button>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
};
