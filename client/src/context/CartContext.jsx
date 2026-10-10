/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { BottomSheet, Button } from '../components/ui';
import { AlertTriangle } from 'lucide-react';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  // Store info associated with current cart: { id, name, slug, freeDeliveryAbove, deliveryFee, minOrder }
  const [cartStore, setCartStore] = useState(() => {
    try {
      const saved = localStorage.getItem('kirana_cart_store');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Items: array of { storeProductId, name, nameTe, unit, price, mrp, image, qty }
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem('kirana_cart_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [fulfilment, setFulfilment] = useState(() => {
    try {
      return localStorage.getItem('kirana_cart_fulfilment') || 'delivery';
    } catch {
      return 'delivery';
    }
  });

  // State for store replacement modal
  const [pendingReplacement, setPendingReplacement] = useState(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      if (items.length > 0 && cartStore) {
        localStorage.setItem('kirana_cart_items', JSON.stringify(items));
        localStorage.setItem('kirana_cart_store', JSON.stringify(cartStore));
        localStorage.setItem('kirana_cart_fulfilment', fulfilment);
      } else {
        localStorage.removeItem('kirana_cart_items');
        localStorage.removeItem('kirana_cart_store');
        localStorage.removeItem('kirana_cart_fulfilment');
      }
    } catch {
      // Ignored
    }
  }, [items, cartStore, fulfilment]);

  // Total count of units in cart
  const totalCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.qty, 0);
  }, [items]);

  // Subtotal in integer paise
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.qty, 0);
  }, [items]);

  // MRP total in integer paise
  const mrpTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.mrp || item.price) * item.qty, 0);
  }, [items]);

  // Savings in integer paise
  const savings = useMemo(() => {
    return Math.max(0, mrpTotal - subtotal);
  }, [mrpTotal, subtotal]);

  // Get current quantity for a specific store product
  const getItemQty = useCallback(
    (storeProductId) => {
      const existing = items.find((i) => i.storeProductId === storeProductId);
      return existing ? existing.qty : 0;
    },
    [items],
  );

  // Clear cart completely
  const clearCart = useCallback(() => {
    setItems([]);
    setCartStore(null);
    setPendingReplacement(null);
    try {
      localStorage.removeItem('kirana_cart_items');
      localStorage.removeItem('kirana_cart_store');
      localStorage.removeItem('kirana_cart_fulfilment');
    } catch {
      // Ignored
    }
  }, []);

  // Update quantity of an item
  const updateQty = useCallback((storeProductId, nextQty) => {
    const clamped = Math.max(0, Math.min(10, nextQty));
    setItems((prev) => {
      if (clamped <= 0) {
        const filtered = prev.filter((i) => i.storeProductId !== storeProductId);
        if (filtered.length === 0) {
          setCartStore(null);
        }
        return filtered;
      }
      return prev.map((item) =>
        item.storeProductId === storeProductId ? { ...item, qty: clamped } : item,
      );
    });
  }, []);

  // Remove an item entirely
  const removeItem = useCallback((storeProductId) => {
    setItems((prev) => {
      const filtered = prev.filter((i) => i.storeProductId !== storeProductId);
      if (filtered.length === 0) {
        setCartStore(null);
      }
      return filtered;
    });
  }, []);

  // Add an item to cart (with single-store rule enforcement)
  const addItem = useCallback(
    (targetStore, product, qty = 1) => {
      const targetStoreId = String(targetStore.id || targetStore._id);

      // Check if cart already has items from another store
      if (
        items.length > 0 &&
        cartStore &&
        String(cartStore.id || cartStore._id) !== targetStoreId
      ) {
        // Trigger modal prompt to replace cart
        setPendingReplacement({
          store: targetStore,
          product,
          qty,
        });
        return;
      }

      // First item or same store
      if (!cartStore || items.length === 0) {
        setCartStore({
          id: targetStore.id || targetStore._id,
          name: targetStore.name,
          slug: targetStore.slug,
          freeDeliveryAbove: targetStore.freeDeliveryAbove,
          deliveryFee: targetStore.deliveryFee,
          minOrder: targetStore.minOrder,
          supportsDelivery: targetStore.supportsDelivery,
          supportsPickup: targetStore.supportsPickup,
        });
      }

      const pId = String(product.storeProductId || product._id);
      setItems((prev) => {
        const existing = prev.find((i) => i.storeProductId === pId);
        if (existing) {
          const nextQty = Math.min(10, existing.qty + qty);
          return prev.map((i) => (i.storeProductId === pId ? { ...i, qty: nextQty } : i));
        }

        return [
          ...prev,
          {
            storeProductId: pId,
            name: product.name,
            nameTe: product.nameTe || '',
            unit: product.unit || '1 pc',
            price: product.price,
            mrp: product.mrp || product.price,
            image: product.image || null,
            qty: Math.min(10, Math.max(1, qty)),
          },
        ];
      });
    },
    [items, cartStore],
  );

  // Confirm replacing current cart with items from another store
  const confirmReplaceStore = useCallback(() => {
    if (!pendingReplacement) return;
    const { store: newStore, product, qty } = pendingReplacement;

    const pId = String(product.storeProductId || product._id);
    setCartStore({
      id: newStore.id || newStore._id,
      name: newStore.name,
      slug: newStore.slug,
      freeDeliveryAbove: newStore.freeDeliveryAbove,
      deliveryFee: newStore.deliveryFee,
      minOrder: newStore.minOrder,
      supportsDelivery: newStore.supportsDelivery,
      supportsPickup: newStore.supportsPickup,
    });

    setItems([
      {
        storeProductId: pId,
        name: product.name,
        nameTe: product.nameTe || '',
        unit: product.unit || '1 pc',
        price: product.price,
        mrp: product.mrp || product.price,
        image: product.image || null,
        qty: Math.min(10, Math.max(1, qty)),
      },
    ]);

    setPendingReplacement(null);
  }, [pendingReplacement]);

  const cancelReplaceStore = useCallback(() => {
    setPendingReplacement(null);
  }, []);

  // Update item prices and stock status from server validation
  const syncValidatedItems = useCallback((validatedLines) => {
    if (!Array.isArray(validatedLines)) return;
    setItems((prev) =>
      prev.map((item) => {
        const found = validatedLines.find(
          (v) => String(v.storeProductId) === String(item.storeProductId),
        );
        if (found && found.currentPrice !== undefined) {
          return {
            ...item,
            price: found.currentPrice,
            mrp: found.currentMrp || item.mrp,
            inStock: found.inStock,
          };
        }
        return item;
      }),
    );
  }, []);

  // Replace cart directly with items from an order (reorder)
  const replaceCartWithItems = useCallback((targetStore, itemsList) => {
    setCartStore({
      id: targetStore.id || targetStore._id,
      name: targetStore.name,
      slug: targetStore.slug,
      freeDeliveryAbove: targetStore.freeDeliveryAbove,
      deliveryFee: targetStore.deliveryFee,
      minOrder: targetStore.minOrder,
      supportsDelivery: targetStore.supportsDelivery,
      supportsPickup: targetStore.supportsPickup,
    });
    setItems(itemsList);
  }, []);

  return (
    <CartContext.Provider
      value={{
        cartStore,
        items,
        fulfilment,
        setFulfilment,
        totalCount,
        subtotal,
        mrpTotal,
        savings,
        addItem,
        updateQty,
        removeItem,
        clearCart,
        getItemQty,
        syncValidatedItems,
        replaceCartWithItems,
      }}
    >
      {children}

      {/* Replace Store Confirmation BottomSheet */}
      <BottomSheet
        isOpen={Boolean(pendingReplacement)}
        onClose={cancelReplaceStore}
        title="Replace Cart Items?"
      >
        <div className="space-y-4 pb-4">
          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-900 leading-snug">
              Your cart currently contains items from{' '}
              <span className="font-bold">{cartStore?.name}</span>. A single order can only be
              placed from one neighbourhood kirana store at a time.
            </p>
          </div>

          <p className="text-sm font-semibold text-ink-900">
            Would you like to discard your current cart and add items from{' '}
            <span className="font-bold text-primary-700">{pendingReplacement?.store?.name}</span>{' '}
            instead?
          </p>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={cancelReplaceStore}
              className="flex-1 font-bold text-sm min-h-[48px]"
            >
              Keep Current Cart
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={confirmReplaceStore}
              className="flex-1 font-bold text-sm min-h-[48px] shadow-md"
            >
              Replace Cart
            </Button>
          </div>
        </div>
      </BottomSheet>
    </CartContext.Provider>
  );
};

CartProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
