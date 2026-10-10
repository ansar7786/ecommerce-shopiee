import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Package,
  Store as StoreIcon,
  RotateCcw,
  Star,
  AlertCircle,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import api from '../../api/axios';
import { useCart } from '../../context/CartContext';
import {
  useToast,
  Button,
  Card,
  Badge,
  Skeleton,
  EmptyState,
  BottomSheet,
} from '../../components/ui';
import { formatPaise, formatDateTime } from '../../utils/format';

export const Orders = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { replaceCartWithItems } = useCart();
  const { showToast } = useToast();

  const isTe = i18n.language === 'te';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'past'

  // Reorder state
  const [reorderingId, setReorderingId] = useState(null);
  const [reorderModalInfo, setReorderModalInfo] = useState(null); // { addedCount, skippedCount, skippedNames, onConfirm }

  // Rating Modal state
  const [ratingSheetOpen, setRatingSheetOpen] = useState(false);
  const [selectedOrderForRating, setSelectedOrderForRating] = useState(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Complaint / Report Problem Modal state
  const [complaintSheetOpen, setComplaintSheetOpen] = useState(false);
  const [selectedOrderForComplaint, setSelectedOrderForComplaint] = useState(null);
  const [complaintMessage, setComplaintMessage] = useState('');
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  // Reviews map by order ID to show if already reviewed
  const [reviewedOrderIds, setReviewedOrderIds] = useState(new Set());

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/orders/my');
      setOrders(res.data.orders || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const activeOrders = orders.filter(
    (o) => !['DELIVERED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'DELIVERY_FAILED'].includes(o.status),
  );
  const pastOrders = orders.filter((o) =>
    ['DELIVERED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'DELIVERY_FAILED'].includes(o.status),
  );

  const displayedOrders = activeTab === 'active' ? activeOrders : pastOrders;

  // Handle Reorder
  const handleReorder = async (e, orderId) => {
    e.stopPropagation();
    try {
      setReorderingId(orderId);
      const res = await api.post(`/orders/${orderId}/reorder-check`);
      const { store, items } = res.data;

      const availableItems = items.filter((i) => i.available && i.inStock);
      const skippedItems = items.filter((i) => !i.available || !i.inStock);

      if (availableItems.length === 0) {
        showToast({
          type: 'error',
          message: isTe
            ? 'ఈ ఆర్డర్‌లోని వస్తువులన్నీ ప్రస్తుతం స్టాక్‌లో లేవు.'
            : 'All items from this order are currently out of stock.',
        });
        return;
      }

      const cartFormattedItems = availableItems.map((item) => ({
        storeProductId: String(item.storeProductId),
        name: item.name,
        nameTe: item.nameTe || '',
        unit: item.unit || '1 pc',
        price: item.currentPrice,
        mrp: item.currentMrp || item.currentPrice,
        image: item.image || null,
        qty: Math.min(10, Math.max(1, item.qty)),
      }));

      // If items were skipped, show prompt or toast
      if (skippedItems.length > 0) {
        setReorderModalInfo({
          store,
          cartFormattedItems,
          addedCount: availableItems.length,
          skippedCount: skippedItems.length,
          skippedNames: skippedItems.map((i) => (isTe && i.nameTe ? i.nameTe : i.name)).join(', '),
        });
      } else {
        replaceCartWithItems(store, cartFormattedItems);
        showToast({
          type: 'success',
          message: isTe
            ? `${availableItems.length} వస్తువులు కార్ట్‌లోకి చేర్చబడ్డాయి!`
            : `${availableItems.length} items added to your cart!`,
        });
        navigate('/app/cart');
      }
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || 'Unable to reorder items at this moment.',
      });
    } finally {
      setReorderingId(null);
    }
  };

  const confirmReorderModal = () => {
    if (!reorderModalInfo) return;
    replaceCartWithItems(reorderModalInfo.store, reorderModalInfo.cartFormattedItems);
    showToast({
      type: 'success',
      message: isTe
        ? `${reorderModalInfo.addedCount} వస్తువులు కార్ట్‌లోకి చేర్చబడ్డాయి!`
        : `${reorderModalInfo.addedCount} items added to your cart!`,
    });
    setReorderModalInfo(null);
    navigate('/app/cart');
  };

  // Open Rating modal
  const openRating = (e, order) => {
    e.stopPropagation();
    setSelectedOrderForRating(order);
    setRatingScore(5);
    setRatingComment('');
    setRatingSheetOpen(true);
  };

  // Submit Rating
  const submitRating = async () => {
    if (!selectedOrderForRating) return;
    try {
      setSubmittingRating(true);
      await api.post('/reviews', {
        orderId: selectedOrderForRating._id,
        rating: ratingScore,
        comment: ratingComment.trim(),
      });
      setReviewedOrderIds((prev) => new Set(prev).add(selectedOrderForRating._id));
      showToast({
        type: 'success',
        message: isTe ? 'మీ రేటింగ్‌కు ధన్యవాదాలు!' : 'Thank you for rating the store!',
      });
      setRatingSheetOpen(false);
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to submit review.',
      });
    } finally {
      setSubmittingRating(false);
    }
  };

  // Open Complaint modal
  const openComplaint = (e, order) => {
    e.stopPropagation();
    setSelectedOrderForComplaint(order);
    setComplaintMessage('');
    setComplaintSheetOpen(true);
  };

  // Submit Complaint
  const submitComplaint = async () => {
    if (!selectedOrderForComplaint) return;
    if (!complaintMessage.trim()) {
      showToast({
        type: 'error',
        message: isTe ? 'దయచేసి సమస్యను వివరించండి.' : 'Please describe the problem.',
      });
      return;
    }

    try {
      setSubmittingComplaint(true);
      await api.post('/complaints', {
        orderId: selectedOrderForComplaint._id,
        message: complaintMessage.trim(),
      });
      showToast({
        type: 'success',
        message: isTe
          ? 'ఫిర్యాదు నమోదు చేయబడింది. త్వరలోనే పరిశీలిస్తాము.'
          : 'Complaint submitted. Our team will review it shortly.',
      });
      setComplaintSheetOpen(false);
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to submit complaint.',
      });
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const resolveBadgeVariant = (status) => {
    switch (status) {
      case 'PLACED':
        return 'primary';
      case 'ACCEPTED':
      case 'PACKING':
      case 'READY':
        return 'accent';
      case 'OUT_FOR_DELIVERY':
        return 'primary';
      case 'DELIVERED':
        return 'success';
      case 'REJECTED':
      case 'CANCELLED':
      case 'EXPIRED':
      case 'DELIVERY_FAILED':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 pt-2 pb-24">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-extrabold text-ink-900 tracking-tight">
          {isTe ? 'నా ఆర్డర్లు' : 'My Orders'}
        </h1>
        <p className="text-xs text-ink-500 mt-0.5">
          {isTe
            ? 'మీ ప్రస్తుత మరియు గత ఆర్డర్ల వివరాలు'
            : 'Track ongoing orders and review past purchases'}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-ink-200">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`flex-1 pb-3 text-sm font-bold border-b-2 text-center transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'active'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-ink-500 hover:text-ink-800'
          }`}
        >
          <span>{isTe ? 'ప్రస్తుత ఆర్డర్లు' : 'Active Orders'}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-black ${
              activeTab === 'active' ? 'bg-primary-100 text-primary-800' : 'bg-ink-100 text-ink-600'
            }`}
          >
            {activeOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('past')}
          className={`flex-1 pb-3 text-sm font-bold border-b-2 text-center transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'past'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-ink-500 hover:text-ink-800'
          }`}
        >
          <span>{isTe ? 'గత ఆర్డర్లు' : 'Past Orders'}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-black ${
              activeTab === 'past' ? 'bg-primary-100 text-primary-800' : 'bg-ink-100 text-ink-600'
            }`}
          >
            {pastOrders.length}
          </span>
        </button>
      </div>

      {/* Orders List */}
      {displayedOrders.length === 0 ? (
        <div className="pt-8">
          <EmptyState
            icon={Package}
            title={
              activeTab === 'active'
                ? isTe
                  ? 'ప్రస్తుతం ఆర్డర్లు లేవు'
                  : 'No active orders'
                : isTe
                  ? 'గత ఆర్డర్లు లేవు'
                  : 'No past orders yet'
            }
            description={
              activeTab === 'active'
                ? isTe
                  ? 'మీరు ప్రస్తుతం ఎదురుచూస్తున్న ఆర్డర్లు ఏవీ లేవు.'
                  : 'You have no ongoing deliveries or pickups right now.'
                : isTe
                  ? 'మీరు గతంలో చేసిన ఆర్డర్ల వివరాలు ఇక్కడ కనిపిస్తాయి.'
                  : 'Your completed or cancelled orders will appear here.'
            }
            actionLabel={isTe ? 'కిరాణా దుకాణాలు చూడండి' : 'Shop Nearby Stores'}
            onAction={() => navigate('/app')}
          />
        </div>
      ) : (
        <div className="space-y-3.5">
          {displayedOrders.map((order) => {
            const isDelivered = order.status === 'DELIVERED';
            const isReviewed = reviewedOrderIds.has(order._id);
            const isReordering = reorderingId === order._id;

            return (
              <Card
                key={order._id}
                onClick={() => navigate(`/app/orders/${order._id}`)}
                className="p-4 border border-ink-200 rounded-2xl bg-white shadow-xs hover:border-primary-300 transition-all cursor-pointer space-y-3 active:scale-[0.99]"
              >
                {/* Store Header & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0 border border-primary-100">
                      <StoreIcon className="w-5 h-5 stroke-[2]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-sm text-ink-900 truncate">
                        {order.store?.name || (isTe ? 'కిరాణా దుకాణం' : 'Kirana Store')}
                      </h3>
                      <p className="text-[11px] text-ink-500 font-medium flex items-center gap-1.5 mt-0.5">
                        <Calendar className="w-3 h-3 text-ink-400" />
                        <span>{formatDateTime(order.createdAt, isTe ? 'te' : 'en')}</span>
                      </p>
                    </div>
                  </div>

                  <Badge variant={resolveBadgeVariant(order.status)}>
                    {t('status.' + order.status.toLowerCase(), order.status.replace(/_/g, ' '))}
                  </Badge>
                </div>

                {/* Items Summary & Total */}
                <div className="pt-2 border-t border-ink-100 flex items-center justify-between text-xs">
                  <div className="text-ink-600 font-medium">
                    <span>
                      {order.items?.length || 0} {isTe ? 'వస్తువులు' : 'items'}
                    </span>
                    <span className="mx-1.5 text-ink-300">•</span>
                    <span className="text-ink-500">#{order.orderNo}</span>
                  </div>

                  <div className="font-black text-sm text-ink-900">{formatPaise(order.total)}</div>
                </div>

                {/* Action Buttons Row */}
                <div className="pt-2 border-t border-ink-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Reorder Button */}
                    <button
                      type="button"
                      disabled={isReordering}
                      onClick={(e) => handleReorder(e, order._id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary-50 hover:bg-primary-100 text-primary-800 rounded-xl font-bold text-xs border border-primary-200 transition-colors active:scale-95"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isReordering ? 'animate-spin' : ''}`} />
                      <span>
                        {isReordering
                          ? isTe
                            ? '...'
                            : 'Checking...'
                          : isTe
                            ? 'మళ్ళీ ఆర్డర్'
                            : 'Reorder'}
                      </span>
                    </button>

                    {/* Rate Store Button (for Delivered orders) */}
                    {isDelivered && (
                      <button
                        type="button"
                        disabled={isReviewed}
                        onClick={(e) => openRating(e, order)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs border transition-colors active:scale-95 ${
                          isReviewed
                            ? 'bg-amber-50 text-amber-800 border-amber-200 opacity-80 cursor-default'
                            : 'bg-white hover:bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span>
                          {isReviewed
                            ? isTe
                              ? 'రేట్ చేసారు'
                              : 'Rated'
                            : isTe
                              ? 'రేట్ చేయి'
                              : 'Rate Store'}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Report Problem Button */}
                  <button
                    type="button"
                    onClick={(e) => openComplaint(e, order)}
                    className="text-xs text-ink-500 hover:text-red-700 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    {isTe ? 'సమస్యను నివేదించు' : 'Report Problem'}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Partial Reorder Modal (when items are skipped) */}
      <BottomSheet
        isOpen={Boolean(reorderModalInfo)}
        onClose={() => setReorderModalInfo(null)}
        title={isTe ? 'స్టాక్ మార్పులు' : 'Stock Availability Notice'}
      >
        <div className="space-y-4 pb-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                {isTe
                  ? `${reorderModalInfo?.skippedCount} వస్తువులు స్టాక్‌లో లేవు`
                  : `${reorderModalInfo?.skippedCount} item(s) are currently unavailable`}
              </p>
              <p className="mt-1 text-[11px] text-amber-800 leading-snug">
                {isTe
                  ? `కింది వస్తువులు దాటవేయబడ్డాయి: ${reorderModalInfo?.skippedNames}. మిగిలిన ${reorderModalInfo?.addedCount} అందుబాటులో ఉన్న వస్తువులను కార్ట్‌లో ఉంచాలనుకుంటున్నారా?`
                  : `Skipped items: ${reorderModalInfo?.skippedNames}. Would you like to proceed with the remaining ${reorderModalInfo?.addedCount} in-stock item(s)?`}
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setReorderModalInfo(null)}
              className="flex-1 text-xs font-bold min-h-[46px]"
            >
              {isTe ? 'రద్దు' : 'Cancel'}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={confirmReorderModal}
              className="flex-1 text-xs font-bold min-h-[46px]"
            >
              {isTe ? 'మిగిలినవి చేర్చు' : 'Add Available Items'}
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Rate Store BottomSheet */}
      <BottomSheet
        isOpen={ratingSheetOpen}
        onClose={() => setRatingSheetOpen(false)}
        title={isTe ? 'దుకాణాన్ని రేట్ చేయండి' : 'Rate Your Experience'}
      >
        <div className="space-y-4 pb-4">
          <div className="text-center space-y-1">
            <h4 className="text-sm font-extrabold text-ink-900">
              {selectedOrderForRating?.store?.name}
            </h4>
            <p className="text-xs text-ink-500">
              {isTe
                ? 'మీ డెలివరీ మరియు వస్తువుల నాణ్యత ఎలా ఉంది?'
                : 'How was the product quality and fulfilment?'}
            </p>
          </div>

          {/* Star selector */}
          <div className="flex items-center justify-center gap-3 py-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRatingScore(star)}
                className="p-1 hover:scale-110 active:scale-95 transition-transform"
              >
                <Star
                  className={`w-8 h-8 ${
                    star <= ratingScore
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-ink-200 fill-ink-50'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Comment text */}
          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-ink-800">
              {isTe ? 'మీ అభిప్రాయం (ఐచ్ఛికం)' : 'Comments (Optional)'}
            </label>
            <textarea
              rows={3}
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder={
                isTe ? 'తాజా వస్తువులు, త్వరిత డెలివరీ...' : 'Fresh vegetables, prompt delivery...'
              }
              className="w-full p-3 bg-white border border-ink-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRatingSheetOpen(false)}
              className="flex-1 text-xs font-bold min-h-[46px]"
            >
              {isTe ? 'రద్దు' : 'Cancel'}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={submittingRating}
              onClick={submitRating}
              className="flex-1 text-xs font-bold min-h-[46px]"
            >
              {submittingRating ? '...' : isTe ? 'రేటింగ్ సమర్పించు' : 'Submit Review'}
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Report Problem / Complaint BottomSheet */}
      <BottomSheet
        isOpen={complaintSheetOpen}
        onClose={() => setComplaintSheetOpen(false)}
        title={isTe ? 'సమస్యను నివేదించండి' : 'Report a Problem'}
      >
        <div className="space-y-4 pb-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-900">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Order #{selectedOrderForComplaint?.orderNo}</p>
              <p className="text-[11px] text-red-800 mt-0.5">
                {isTe
                  ? 'ఆర్డర్ లేదా డెలివరీలో సమస్య ఉందా? మా సహాయక బృందం పరిశీలిస్తుంది.'
                  : 'Having issues with missing items, damaged packaging, or billing? Let us know.'}
              </p>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-ink-800">
              {isTe ? 'సమస్య వివరాలు' : 'Describe the Issue'}
            </label>
            <textarea
              rows={4}
              value={complaintMessage}
              onChange={(e) => setComplaintMessage(e.target.value)}
              placeholder={
                isTe
                  ? 'వస్తువు పాడైంది లేదా డెలివరీలో ఆలస్యం...'
                  : 'Explain the issue with your order...'
              }
              className="w-full p-3 bg-white border border-ink-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setComplaintSheetOpen(false)}
              className="flex-1 text-xs font-bold min-h-[46px]"
            >
              {isTe ? 'రద్దు' : 'Cancel'}
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={submittingComplaint}
              onClick={submitComplaint}
              className="flex-1 text-xs font-bold min-h-[46px]"
            >
              {submittingComplaint ? '...' : isTe ? 'సమర్పించండి' : 'Submit Report'}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
