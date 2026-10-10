import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Fuse from 'fuse.js';
import {
  ArrowLeft,
  Phone,
  Clock,
  Star,
  Search,
  X,
  AlertCircle,
  Truck,
  ShoppingBag,
  Store as StoreIcon,
  ShoppingBasket,
  ChevronRight,
} from 'lucide-react';
import api from '../../api/axios';
import { useCart } from '../../context/CartContext';
import { ProductCard, Skeleton, EmptyState, Chip } from '../../components/ui';
import { formatPaise } from '../../utils/format';

export const StoreDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { cartStore, totalCount, subtotal, addItem, updateQty, getItemQty } = useCart();

  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Fetch Store and Products
  const fetchStoreData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [storeRes, productsRes] = await Promise.all([
        api.get(`/stores/${id}`),
        api.get(`/stores/${id}/products`),
      ]);

      setStore(storeRes.data.store);
      setProducts(productsRes.data.products || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Failed to load store or products. The store might not be available.',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStoreData();
  }, [fetchStoreData]);

  // Extract unique categories from products
  const categories = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      if (p.category && p.category._id) {
        if (!map.has(p.category._id)) {
          map.set(p.category._id, {
            id: p.category._id,
            name: p.category.name,
            nameTe: p.category.nameTe || p.category.name,
          });
        }
      }
    });
    return Array.from(map.values());
  }, [products]);

  // Setup Fuse.js for typo-tolerant Telugu + English search
  const fuse = useMemo(() => {
    return new Fuse(products, {
      keys: [
        { name: 'name', weight: 0.5 },
        { name: 'nameTe', weight: 0.5 },
        { name: 'brand', weight: 0.3 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }, [products]);

  // Filter products by category and Fuse search
  const filteredProducts = useMemo(() => {
    let result = products;

    // 1. In-store typo-tolerant search
    if (searchQuery.trim().length > 0) {
      const searchResults = fuse.search(searchQuery.trim());
      result = searchResults.map((r) => r.item);
    }

    // 2. Category filter
    if (selectedCategory !== 'all') {
      result = result.filter(
        (p) => p.category && String(p.category._id) === String(selectedCategory),
      );
    }

    return result;
  }, [products, searchQuery, selectedCategory, fuse]);

  // Check if current cart belongs to THIS store
  const isCartFromThisStore = useMemo(() => {
    if (!cartStore || !store) return false;
    return String(cartStore.id || cartStore._id) === String(store.id || store._id);
  }, [cartStore, store]);

  if (loading) {
    return (
      <div className="space-y-4 pt-1 animate-pulse pb-12">
        <div className="h-44 bg-ink-200 rounded-3xl" />
        <div className="h-6 w-3/4 bg-ink-200 rounded-lg" />
        <div className="flex gap-2">
          <div className="h-8 w-20 bg-ink-200 rounded-xl" />
          <div className="h-8 w-24 bg-ink-200 rounded-xl" />
          <div className="h-8 w-20 bg-ink-200 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="pt-6">
        <EmptyState
          icon={AlertCircle}
          title={t('common.empty')}
          description={error || t('customer.noStoresDesc')}
          actionLabel={t('common.back')}
          onAction={() => navigate('/app')}
        />
      </div>
    );
  }

  const isClosed = !store.isOpenNow || !store.isOpen;

  return (
    <div className="relative pb-28">
      {/* Top Nav Back Bar */}
      <div className="flex items-center justify-between pb-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 min-h-[48px] text-xs font-bold text-ink-700 hover:text-ink-900 bg-white border border-ink-200 px-3 py-1.5 rounded-xl shadow-xs active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('common.back')}</span>
        </button>

        <span className="text-xs font-semibold text-ink-500">
          {products.length} {t('nav.products')}
        </span>
      </div>

      {/* Store Header Card */}
      <div className="bg-white rounded-3xl border border-ink-200/90 shadow-xs overflow-hidden">
        {/* Cover Image / Banner */}
        <div className="relative h-44 w-full bg-linear-to-tr from-primary-700 via-primary-600 to-amber-600">
          {store.photo ? (
            <img src={store.photo} alt={store.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/90">
              <StoreIcon className="w-14 h-14 stroke-[1.5] mb-1" />
              <span className="text-xs font-bold tracking-wider uppercase opacity-80">
                Kirana Store
              </span>
            </div>
          )}

          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent" />

          {/* Store Status Badge on Cover */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <span
              className={`text-xs font-black px-2.5 py-1 rounded-full shadow-md backdrop-blur-md flex items-center gap-1.5 ${
                store.isOpenNow && store.isOpen
                  ? 'bg-emerald-500/90 text-white'
                  : 'bg-red-500/90 text-white'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  store.isOpenNow && store.isOpen ? 'bg-white animate-pulse' : 'bg-white/70'
                }`}
              />
              {store.isOpenNow && store.isOpen ? t('customer.openNow') : t('customer.closed')}
            </span>
          </div>

          {/* Store Name & Phone on Bottom of Cover */}
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <h1 className="text-xl font-extrabold leading-tight drop-shadow-sm line-clamp-1">
              {store.name}
            </h1>
            <p className="text-xs text-white/85 line-clamp-1 mt-0.5">{store.address}</p>
          </div>
        </div>

        {/* Store Metadata & Contact Bar */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-ink-100 pb-3">
            {/* Rating & Hours */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-lg text-xs font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>{(store.ratingAvg || 4.5).toFixed(1)}</span>
                <span className="text-[10px] text-amber-700">({store.ratingCount || 12})</span>
              </div>

              {store.timings && (
                <div className="flex items-center gap-1 text-xs text-ink-600 font-medium">
                  <Clock className="w-3.5 h-3.5 text-ink-500 shrink-0" />
                  <span>
                    {store.timings.open} - {store.timings.close}
                  </span>
                </div>
              )}
            </div>

            {/* Tap to Call */}
            {store.phone && (
              <a
                href={`tel:${store.phone}`}
                className="flex items-center gap-1.5 min-h-[48px] text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-3 py-1.5 rounded-xl transition-all shadow-xs active:scale-95"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{t('store.shopPhone')}</span>
              </a>
            )}
          </div>

          {/* Delivery & Min Order Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {store.freeDeliveryAbove > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                <Truck className="w-3 h-3 text-emerald-600" />
                {t('customer.freeDeliveryAbove', { amount: formatPaise(store.freeDeliveryAbove) })}
              </span>
            )}

            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-700 bg-ink-50 border border-ink-200 px-2.5 py-1 rounded-lg">
              <ShoppingBag className="w-3 h-3 text-ink-500" />
              {t('customer.minOrder', { amount: formatPaise(store.minOrder) })}
            </span>

            {store.deliveryFee > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-600 bg-ink-50 border border-ink-200 px-2.5 py-1 rounded-lg">
                {t('customer.deliveryFee', { amount: formatPaise(store.deliveryFee) })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Store Just Closed Banner */}
      {isClosed && (
        <div className="mt-4 p-3.5 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3 shadow-xs animate-shake">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-900 leading-snug">
            <p className="font-extrabold text-sm text-red-950">{t('customer.closed')}</p>
            <p className="mt-0.5">{t('customer.storeClosedAlert')}</p>
          </div>
        </div>
      )}

      {/* In-Store Search Bar */}
      <div className="mt-4 relative">
        <Search className="w-4 h-4 text-ink-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('customer.searchInStore')}
          className="w-full pl-10 pr-9 py-2.5 text-sm bg-white border border-ink-200 rounded-2xl placeholder:text-ink-400 focus:outline-hidden focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all shadow-xs"
        />
        {searchQuery.length > 0 && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-400 hover:text-ink-700 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Sticky Category Chips */}
      {categories.length > 0 && (
        <div className="sticky top-14 z-30 -mx-4 px-4 py-2.5 bg-page/95 backdrop-blur-md border-b border-ink-200/60 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <Chip
            label={t('customer.allProducts')}
            selected={selectedCategory === 'all'}
            onClick={() => setSelectedCategory('all')}
          />
          {categories.map((cat) => (
            <Chip
              key={cat.id}
              label={cat.nameTe || cat.name}
              selected={selectedCategory === cat.id}
              onClick={() => setSelectedCategory(cat.id)}
            />
          ))}
        </div>
      )}

      {/* 2-Column Product Grid */}
      <div className="mt-4">
        {filteredProducts.length === 0 ? (
          <div className="py-8">
            <EmptyState
              icon={ShoppingBasket}
              title={t('common.empty')}
              description={
                searchQuery
                  ? `No matching items for "${searchQuery}".`
                  : t('storeProducts.emptyInventory')
              }
              actionLabel={searchQuery ? t('common.cancel') : undefined}
              onAction={searchQuery ? () => setSearchQuery('') : undefined}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((product) => {
              const currentQty = getItemQty(product.storeProductId || product._id);
              return (
                <ProductCard
                  key={product.storeProductId || product._id}
                  product={product}
                  quantity={currentQty}
                  onAdd={(prod) => addItem(store, prod, 1)}
                  onUpdateQty={(prod, qty) => updateQty(prod.storeProductId || prod._id, qty)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Floating View Cart Bar */}
      {totalCount > 0 && (
        <aside
          aria-label="Floating cart summary"
          className="fixed bottom-20 left-0 right-0 z-35 max-w-md mx-auto px-4 pointer-events-none"
        >
          <div className="pointer-events-auto bg-primary-700 text-white rounded-2xl p-3 shadow-xl flex items-center justify-between border border-primary-600 ring-2 ring-primary-500/20 backdrop-blur-xs transition-transform active:scale-[0.99]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-black text-sm">
                {totalCount}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-primary-100">
                  {totalCount} {totalCount === 1 ? 'item' : 'items'}
                  {!isCartFromThisStore && ' (other store)'}
                </span>
                <span className="text-sm font-extrabold leading-tight">
                  {formatPaise(subtotal)}
                </span>
              </div>
            </div>

            <Link
              to="/app/cart"
              className="flex items-center gap-1.5 bg-white text-primary-700 font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-xs hover:bg-primary-50 transition-colors"
            >
              <span>{t('nav.cart')}</span>
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </Link>
          </div>
        </aside>
      )}
    </div>
  );
};
