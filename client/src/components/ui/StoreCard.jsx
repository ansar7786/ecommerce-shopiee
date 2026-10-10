import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Star, Clock, MapPin, Truck, ShoppingBag, Store as StoreIcon } from 'lucide-react';
import { Badge } from './Badge';
import { Card } from './Card';
import { formatPaise } from '../../utils/format';

export const StoreCard = ({ store, onClick }) => {
  const { t } = useTranslation();

  const isClosed = !store.isOpenNow;

  return (
    <Card
      onClick={onClick}
      className={`relative overflow-hidden p-3.5 transition-all duration-200 cursor-pointer border hover:shadow-md ${
        isClosed
          ? 'bg-gray-50/90 border-ink-200 hover:border-ink-300'
          : 'bg-white border-ink-200 hover:border-primary-400 shadow-xs'
      }`}
    >
      <div className="flex gap-3.5">
        {/* Store Thumbnail */}
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-primary-50 shrink-0 border border-ink-100 flex items-center justify-center">
          {store.photo ? (
            <img
              src={store.photo}
              alt={store.name}
              className={`w-full h-full object-cover ${isClosed ? 'grayscale opacity-75' : ''}`}
              loading="lazy"
            />
          ) : (
            <div
              className={`flex flex-col items-center justify-center p-2 text-primary-700 ${isClosed ? 'grayscale opacity-70' : ''}`}
            >
              <StoreIcon className="w-8 h-8 stroke-[1.8]" />
              <span className="text-[10px] font-bold mt-1 text-center line-clamp-1">Kirana</span>
            </div>
          )}

          {/* Closed Overlay Ribbon */}
          {isClosed && (
            <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[1px] flex items-center justify-center p-1 text-center">
              <span className="bg-ink-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                {t('customer.closed')}
              </span>
            </div>
          )}
        </div>

        {/* Store Information */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div>
            {/* Header: Name & Closed badge */}
            <div className="flex items-start justify-between gap-1.5">
              <h3
                className={`text-base font-bold truncate leading-tight ${isClosed ? 'text-ink-700' : 'text-ink-900'}`}
              >
                {store.name}
              </h3>
            </div>

            {/* Address snippet if available */}
            {store.address && (
              <p className="text-xs text-ink-500 truncate mt-0.5">{store.address}</p>
            )}

            {/* Metrics Row: Rating, Distance, ETA */}
            <div className="flex items-center gap-2 mt-1.5 text-xs text-ink-600 flex-wrap">
              {/* Rating */}
              <div className="flex items-center gap-0.5 font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>{Number(store.rating || 4.5).toFixed(1)}</span>
              </div>

              <span>•</span>

              {/* Distance */}
              <div className="flex items-center gap-0.5 text-ink-600 font-medium">
                <MapPin className="w-3.5 h-3.5 text-ink-400" />
                <span>{store.distanceKm} km</span>
              </div>

              <span>•</span>

              {/* ETA */}
              <div className="flex items-center gap-0.5 text-ink-600 font-medium">
                <Clock className="w-3.5 h-3.5 text-ink-400" />
                <span>{store.eta}</span>
              </div>
            </div>
          </div>

          {/* Bottom Row: Delivery fee, Min order & Delivery tags */}
          <div className="mt-2.5 pt-2 border-t border-ink-100 flex items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-1.5 text-ink-600 truncate font-medium">
              {store.freeDeliveryAbove && store.freeDeliveryAbove > 0 ? (
                <span className="text-primary-700 font-semibold truncate">
                  {t('customer.freeDeliveryAbove', {
                    amount: formatPaise(store.freeDeliveryAbove),
                  })}
                </span>
              ) : (
                <span className="truncate">
                  {t('customer.deliveryFee', { amount: formatPaise(store.deliveryFee) })}
                </span>
              )}
              <span>•</span>
              <span className="text-ink-500 shrink-0">
                {t('customer.minOrder', { amount: formatPaise(store.minOrder) })}
              </span>
            </div>

            {/* Badges */}
            <div className="shrink-0 flex items-center gap-1">
              {isClosed ? (
                <Badge variant="expired" className="text-[10px] py-0.5 px-2">
                  {t('customer.opensAt', { time: store.opensAt })}
                </Badge>
              ) : !store.deliverable && store.supportsPickup ? (
                <Badge
                  variant="warning"
                  className="text-[10px] py-0.5 px-2 flex items-center gap-1"
                >
                  <ShoppingBag className="w-3 h-3" />
                  {t('customer.pickupOnly')}
                </Badge>
              ) : store.deliverable ? (
                <Badge
                  variant="accepted"
                  className="text-[10px] py-0.5 px-2 flex items-center gap-1"
                >
                  <Truck className="w-3 h-3" />
                  {t('customer.delivery')}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

StoreCard.propTypes = {
  store: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string.isRequired,
    slug: PropTypes.string,
    photo: PropTypes.string,
    address: PropTypes.string,
    distanceKm: PropTypes.number,
    eta: PropTypes.string,
    deliveryFee: PropTypes.number,
    freeDeliveryAbove: PropTypes.number,
    minOrder: PropTypes.number,
    rating: PropTypes.number,
    ratingCount: PropTypes.number,
    isOpenNow: PropTypes.bool,
    opensAt: PropTypes.string,
    supportsDelivery: PropTypes.bool,
    supportsPickup: PropTypes.bool,
    deliverable: PropTypes.bool,
  }).isRequired,
  onClick: PropTypes.func,
};
