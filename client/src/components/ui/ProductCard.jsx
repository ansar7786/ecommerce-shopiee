import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Plus, Package } from 'lucide-react';
import { Card } from './Card';
import { QuantityStepper } from './QuantityStepper';
import { formatPaise } from '../../utils/format';

export const ProductCard = ({ product, quantity = 0, onAdd, onUpdateQty }) => {
  const { t, i18n } = useTranslation();
  const isTe = i18n.language === 'te';

  const isOutOfStock = !product.inStock;
  const savings = Math.max(0, (product.mrp || product.price) - product.price);
  const displayName = isTe && product.nameTe ? product.nameTe : product.name;
  const categoryName =
    isTe && product.category?.nameTe ? product.category.nameTe : product.category?.name || '';

  return (
    <Card
      className={`flex flex-col justify-between overflow-hidden p-3 transition-all duration-200 border rounded-2xl ${
        isOutOfStock
          ? 'bg-gray-50/80 border-ink-200 opacity-65'
          : 'bg-white border-ink-200/90 hover:border-primary-400 hover:shadow-md shadow-xs'
      }`}
    >
      <div>
        {/* Thumbnail & Badges */}
        <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-50 border border-ink-100 flex items-center justify-center p-2">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className={`w-full h-full object-contain ${isOutOfStock ? 'grayscale opacity-75' : ''}`}
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-primary-600">
              <Package className="w-8 h-8 stroke-[1.8]" />
              <span className="text-[10px] font-bold text-center mt-1 text-ink-500 line-clamp-1">
                {categoryName}
              </span>
            </div>
          )}

          {/* Out of Stock Ribbon */}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[1px] flex items-center justify-center p-1">
              <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                {t('storeProducts.outOfStock')}
              </span>
            </div>
          )}

          {/* Savings Chip */}
          {!isOutOfStock && savings > 0 && (
            <span className="absolute top-1.5 left-1.5 bg-accent-500 text-white font-black text-[10px] px-1.5 py-0.5 rounded-md shadow-xs">
              Save {formatPaise(savings)}
            </span>
          )}
        </div>

        {/* Product Details */}
        <div className="mt-2.5">
          <h3 className="text-sm font-bold text-ink-900 leading-snug line-clamp-1">
            {displayName}
          </h3>
          <p className="text-[11px] font-medium text-ink-500 mt-1">{product.unit || '1 pc'}</p>
        </div>
      </div>

      {/* Pricing & Add/Stepper Row */}
      <div className="mt-3 pt-2 border-t border-ink-100 flex flex-wrap items-center justify-between gap-y-2 gap-x-1.5">
        <div className="flex flex-col min-w-0">
          <span className="text-base font-extrabold text-ink-900 leading-tight">
            {formatPaise(product.price)}
          </span>
          {product.mrp && product.mrp > product.price && (
            <span className="text-xs text-ink-400 line-through font-medium">
              {formatPaise(product.mrp)}
            </span>
          )}
        </div>

        {/* Action: Add Button OR QuantityStepper */}
        <div className="shrink-0 ml-auto flex justify-end">
          {isOutOfStock ? (
            <button
              disabled
              className="w-[108px] h-[44px] flex items-center justify-center text-xs font-bold rounded-xl bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
            >
              {t('catalogue.add', { defaultValue: 'Add' })}
            </button>
          ) : quantity > 0 ? (
            <QuantityStepper
              value={quantity}
              min={0}
              max={10}
              onChange={(nextQty) => onUpdateQty && onUpdateQty(product, nextQty)}
            />
          ) : (
            <button
              type="button"
              onClick={() => onAdd && onAdd(product)}
              className="w-[108px] h-[44px] flex items-center justify-center gap-1.5 text-xs font-bold bg-primary-50 text-primary-700 hover:bg-primary-600 hover:text-white border border-primary-300 rounded-xl transition-all shadow-xs active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{t('catalogue.add', { defaultValue: 'Add' })}</span>
            </button>
          )}
        </div>
      </div>
    </Card>
  );
};

ProductCard.propTypes = {
  product: PropTypes.shape({
    _id: PropTypes.string,
    storeProductId: PropTypes.string,
    name: PropTypes.string.isRequired,
    nameTe: PropTypes.string,
    brand: PropTypes.string,
    unit: PropTypes.string,
    price: PropTypes.number.isRequired,
    mrp: PropTypes.number,
    savings: PropTypes.number,
    image: PropTypes.string,
    inStock: PropTypes.bool,
    category: PropTypes.object,
  }).isRequired,
  quantity: PropTypes.number,
  onAdd: PropTypes.func,
  onUpdateQty: PropTypes.func,
};
