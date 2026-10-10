import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Store as StoreIcon,
  MapPin,
  Clock,
  ShieldCheck,
  Upload,
  CheckCircle2,
  AlertCircle,
  Truck,
  ShoppingBag,
} from 'lucide-react';
import api from '../../api/axios';
import { Input, Button, Card, useToast } from '../../components/ui';
import { LocationPickerMap } from '../../components/map/LocationPickerMap';
import { rupeesToPaise, paiseToRupees } from '../../utils/format';

// Helper to compress images client-side under 2 MB
const compressImage = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.82) => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('File is not an image'));
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Canvas compression failed'));
            const compressed = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressed);
          },
          'image/jpeg',
          quality,
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

export const StoreRegister = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';
  const { addToast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Shop details
    name: '',
    phone: '',
    photo: null,
    photoPreview: null,
    // Step 2: Location
    latitude: 16.3477, // Gudlavalleru default
    longitude: 81.0457,
    address: '',
    pincode: '521356',
    // Step 3: Timings & Delivery
    openTime: '07:00',
    closeTime: '21:00',
    deliveryRadiusKm: 3,
    deliveryFee: '20', // in rupees
    freeDeliveryAbove: '299', // in rupees
    minOrder: '99', // in rupees
    supportsDelivery: true,
    supportsPickup: true,
    // Step 4: Verification
    gstNumber: '',
    fssaiNumber: '',
  });

  const fileInputRef = useRef(null);

  // Check if store already exists
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const res = await api.get('/stores/me');
        if (res.data.store) {
          const s = res.data.store;
          if (s.status === 'approved' && !isEditMode) {
            navigate('/store/orders', { replace: true });
            return;
          }
          if (s.status === 'pending' && !isEditMode) {
            navigate('/store/pending', { replace: true });
            return;
          }
          // Pre-populate for resubmission or editing
          setFormData((prev) => ({
            ...prev,
            name: s.name || '',
            phone: s.phone || '',
            photoPreview: s.photo || null,
            latitude: s.location?.coordinates?.[1] || 16.3477,
            longitude: s.location?.coordinates?.[0] || 81.0457,
            address: s.address || '',
            pincode: s.pincode || '521356',
            openTime: s.timings?.open || '07:00',
            closeTime: s.timings?.close || '21:00',
            deliveryRadiusKm: s.deliveryRadiusKm || 3,
            deliveryFee: String(paiseToRupees(s.deliveryFee || 2000)),
            freeDeliveryAbove: String(paiseToRupees(s.freeDeliveryAbove || 29900)),
            minOrder: String(paiseToRupees(s.minOrder || 9900)),
            supportsDelivery: s.supportsDelivery ?? true,
            supportsPickup: s.supportsPickup ?? true,
            gstNumber: s.gstNumber || '',
            fssaiNumber: s.fssaiNumber || '',
          }));
        }
      } catch {
        // No store or error
      } finally {
        setLoadingInitial(false);
      }
    };
    fetchExisting();
  }, [navigate, isEditMode]);

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      const previewUrl = URL.createObjectURL(compressed);
      setFormData((prev) => ({
        ...prev,
        photo: compressed,
        photoPreview: previewUrl,
      }));
      addToast(t('store.compressNote'), 'info');
    } catch {
      addToast('Image processing failed. Please select another image.', 'error');
    }
  };

  // Step validation
  const validateStep = (step) => {
    setErrorMsg('');
    if (step === 1) {
      if (!formData.name.trim()) {
        setErrorMsg('Please enter your shop name');
        return false;
      }
      if (!formData.phone.trim() || formData.phone.trim().length < 10) {
        setErrorMsg('Please enter a valid 10-digit phone number');
        return false;
      }
      return true;
    }
    if (step === 2) {
      if (!formData.address.trim()) {
        setErrorMsg('Please enter your shop street address');
        return false;
      }
      if (!/^\d{6}$/.test(formData.pincode.trim())) {
        setErrorMsg('Please enter a valid 6-digit PIN code');
        return false;
      }
      return true;
    }
    if (step === 3) {
      if (!formData.supportsDelivery && !formData.supportsPickup) {
        setErrorMsg('At least one of Delivery or Pickup must be enabled');
        return false;
      }
      const fee = Number(formData.deliveryFee);
      const freeAbove = Number(formData.freeDeliveryAbove);
      const minOrd = Number(formData.minOrder);
      if (isNaN(fee) || fee < 0 || isNaN(freeAbove) || isNaN(minOrd)) {
        setErrorMsg('Please enter valid fee and minimum order amounts');
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setErrorMsg('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) {
      setCurrentStep(3);
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        pincode: formData.pincode.trim(),
        latitude: formData.latitude,
        longitude: formData.longitude,
        timings: {
          open: formData.openTime,
          close: formData.closeTime,
        },
        deliveryRadiusKm: Number(formData.deliveryRadiusKm),
        deliveryFee: rupeesToPaise(Number(formData.deliveryFee) || 0),
        freeDeliveryAbove: rupeesToPaise(Number(formData.freeDeliveryAbove) || 0),
        minOrder: rupeesToPaise(Number(formData.minOrder) || 0),
        supportsDelivery: formData.supportsDelivery,
        supportsPickup: formData.supportsPickup,
        gstNumber: formData.gstNumber.trim(),
        fssaiNumber: formData.fssaiNumber.trim(),
      };

      const res = isEditMode
        ? await api.patch('/stores/me', payload)
        : await api.post('/stores/register', payload);

      // If photo was chosen, upload via multipart
      if (formData.photo) {
        const photoData = new FormData();
        photoData.append('photo', formData.photo);
        await api.post('/stores/me/photo', photoData);
      }

      addToast(
        isEditMode
          ? 'Store details updated successfully!'
          : res.data.message || 'Store submitted for approval!',
        'success',
      );
      navigate(isEditMode ? '/store/orders' : '/store/pending', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please check your inputs.';
      setErrorMsg(msg);
      addToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium text-ink-600">{t('common.loading')}</span>
      </div>
    );
  }

  const stepsMeta = [
    { num: 1, label: t('store.step1'), icon: StoreIcon },
    { num: 2, label: t('store.step2'), icon: MapPin },
    { num: 3, label: t('store.step3'), icon: Clock },
    { num: 4, label: t('store.step4'), icon: ShieldCheck },
  ];

  return (
    <div className="flex flex-col pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-ink-900 tracking-tight">
          {t('store.registerTitle')}
        </h1>
        <p className="text-xs sm:text-sm text-ink-600 mt-1">{t('store.registerSubtitle')}</p>
      </div>

      {/* 4-Step Stepper Header */}
      <div className="bg-white rounded-2xl p-3 border border-ink-300/50 shadow-xs mb-6">
        <div className="flex items-center justify-between relative">
          {/* Connector line */}
          <div className="absolute top-1/2 left-6 right-6 h-0.5 bg-ink-200 -translate-y-1/2 z-0" />
          <div
            className="absolute top-1/2 left-6 h-0.5 bg-primary-600 -translate-y-1/2 z-0 transition-all duration-300"
            style={{ width: `${((currentStep - 1) / 3) * 88}%` }}
          />

          {stepsMeta.map((s) => {
            const isCompleted = currentStep > s.num;
            const isCurrent = currentStep === s.num;
            const Icon = s.icon;
            return (
              <div key={s.num} className="relative z-10 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => s.num < currentStep && setCurrentStep(s.num)}
                  disabled={s.num > currentStep}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-primary-600 text-white font-bold shadow-xs'
                      : isCurrent
                        ? 'bg-white border-2 border-primary-600 text-primary-700 shadow-sm ring-4 ring-primary-50'
                        : 'bg-white border border-ink-300 text-ink-400'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </button>
                <span
                  className={`text-[11px] font-medium mt-1 truncate max-w-[70px] text-center ${
                    isCurrent ? 'text-primary-700 font-bold' : 'text-ink-600'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error alert if any */}
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Step 1: Shop details */}
      {currentStep === 1 && (
        <Card className="space-y-5">
          <div className="border-b border-ink-100 pb-3">
            <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
              <StoreIcon className="w-5 h-5 text-primary-600" />
              {t('store.step1')}
            </h2>
          </div>

          <Input
            label={t('store.shopName')}
            placeholder="e.g. Siva Kirana & General Stores"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Input
            label={t('store.shopPhone')}
            placeholder="10-digit mobile number"
            type="tel"
            maxLength={10}
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
          />

          {/* Photo Upload with Client-Side Compress */}
          <div>
            <label className="block text-sm font-medium text-ink-900 mb-1.5">
              {t('store.shopPhoto')}
            </label>
            <div className="border-2 border-dashed border-ink-300 rounded-xl p-4 text-center bg-gray-50/50 hover:bg-gray-50 transition-colors">
              {formData.photoPreview ? (
                <div className="space-y-3">
                  <div className="w-full h-44 rounded-lg overflow-hidden bg-black/5 flex items-center justify-center">
                    <img
                      src={formData.photoPreview}
                      alt="Shop Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change Photo
                  </Button>
                </div>
              ) : (
                <div
                  className="py-6 flex flex-col items-center justify-center cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mb-2">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-semibold text-primary-600">
                    {t('store.uploadPhoto')}
                  </span>
                  <p className="text-xs text-ink-500 mt-1 max-w-xs">{t('store.compressNote')}</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Location & Address */}
      {currentStep === 2 && (
        <Card className="space-y-4">
          <div className="border-b border-ink-100 pb-3">
            <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary-600" />
              {t('store.step2')}
            </h2>
            <p className="text-xs text-ink-600 mt-1">{t('store.mapInstruction')}</p>
          </div>

          {/* Interactive Leaflet Map with Draggable Pin */}
          <LocationPickerMap
            latitude={formData.latitude}
            longitude={formData.longitude}
            radiusKm={formData.deliveryRadiusKm}
            height="260px"
            onChange={({ latitude, longitude }) => {
              setFormData((prev) => ({ ...prev, latitude, longitude }));
            }}
          />

          <div className="text-[11px] text-ink-500 flex justify-between px-1">
            <span>Latitude: {formData.latitude.toFixed(5)}</span>
            <span>Longitude: {formData.longitude.toFixed(5)}</span>
          </div>

          <Input
            label={t('store.address')}
            placeholder="e.g. Main Bazaar, Opposite Ramalayam"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            required
          />

          <Input
            label={t('store.pincode')}
            placeholder="e.g. 521356"
            maxLength={6}
            value={formData.pincode}
            onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
            required
          />
        </Card>
      )}

      {/* Step 3: Timings & Operations */}
      {currentStep === 3 && (
        <Card className="space-y-5">
          <div className="border-b border-ink-100 pb-3">
            <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-600" />
              {t('store.step3')}
            </h2>
          </div>

          {/* Timings */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('store.openTime')}
              type="time"
              value={formData.openTime}
              onChange={(e) => setFormData({ ...formData, openTime: e.target.value })}
              required
            />
            <Input
              label={t('store.closeTime')}
              type="time"
              value={formData.closeTime}
              onChange={(e) => setFormData({ ...formData, closeTime: e.target.value })}
              required
            />
          </div>

          {/* Delivery Radius Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium text-ink-900">
              <label>{t('store.deliveryRadius')}</label>
              <span className="text-primary-700 font-bold bg-primary-50 px-2.5 py-1 rounded-lg">
                {formData.deliveryRadiusKm} km
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={formData.deliveryRadiusKm}
              onChange={(e) =>
                setFormData({ ...formData, deliveryRadiusKm: Number(e.target.value) })
              }
              className="w-full h-2 bg-ink-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
            <div className="flex justify-between text-[11px] text-ink-500">
              <span>1 km</span>
              <span>3 km</span>
              <span>5 km</span>
            </div>
          </div>

          {/* Fees & Minimums */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={t('store.deliveryFee')}
              type="number"
              min="0"
              value={formData.deliveryFee}
              onChange={(e) => setFormData({ ...formData, deliveryFee: e.target.value })}
            />
            <Input
              label={t('store.freeDeliveryAbove')}
              type="number"
              min="0"
              value={formData.freeDeliveryAbove}
              onChange={(e) => setFormData({ ...formData, freeDeliveryAbove: e.target.value })}
            />
            <Input
              label={t('store.minOrder')}
              type="number"
              min="0"
              value={formData.minOrder}
              onChange={(e) => setFormData({ ...formData, minOrder: e.target.value })}
            />
          </div>

          {/* Delivery / Pickup Toggles */}
          <div className="space-y-3 pt-2">
            <label className="flex items-center justify-between p-3 rounded-xl border border-ink-200 hover:bg-gray-50/50 cursor-pointer">
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5 text-primary-600" />
                <span className="text-sm font-medium text-ink-900">
                  {t('store.supportsDelivery')}
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.supportsDelivery}
                onChange={(e) => setFormData({ ...formData, supportsDelivery: e.target.checked })}
                className="w-5 h-5 accent-primary-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-ink-200 hover:bg-gray-50/50 cursor-pointer">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-accent-600" />
                <span className="text-sm font-medium text-ink-900">
                  {t('store.supportsPickup')}
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.supportsPickup}
                onChange={(e) => setFormData({ ...formData, supportsPickup: e.target.checked })}
                className="w-5 h-5 accent-primary-600 rounded"
              />
            </label>
          </div>
        </Card>
      )}

      {/* Step 4: Verification & Summary */}
      {currentStep === 4 && (
        <Card className="space-y-5">
          <div className="border-b border-ink-100 pb-3">
            <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary-600" />
              {t('store.step4')}
            </h2>
          </div>

          <Input
            label={t('store.gstNumber')}
            placeholder="e.g. 37AAAAA0000A1Z5 (optional)"
            value={formData.gstNumber}
            onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
          />

          <Input
            label={t('store.fssaiNumber')}
            placeholder="14-digit FSSAI license (optional)"
            maxLength={14}
            value={formData.fssaiNumber}
            onChange={(e) => setFormData({ ...formData, fssaiNumber: e.target.value })}
          />

          {/* Review Summary */}
          <div className="bg-primary-50/60 rounded-xl p-4 border border-primary-200/50 space-y-3">
            <h3 className="text-sm font-bold text-primary-900">{t('store.reviewTitle')}</h3>
            <div className="text-xs space-y-1.5 text-ink-700">
              <p>
                <strong>Shop:</strong> {formData.name} ({formData.phone})
              </p>
              <p>
                <strong>Address:</strong> {formData.address}, PIN: {formData.pincode}
              </p>
              <p>
                <strong>Timings:</strong> {formData.openTime} - {formData.closeTime}
              </p>
              <p>
                <strong>Delivery:</strong> Radius: {formData.deliveryRadiusKm} km | Fee: ₹
                {formData.deliveryFee} | Free above: ₹{formData.freeDeliveryAbove}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Sticky Bottom Bar with 56px Touch Target Primary Action */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-ink-200 p-3 shadow-lg md:max-w-md md:mx-auto md:rounded-t-2xl">
        <div className="flex items-center gap-2">
          {currentStep > 1 && (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="min-h-[56px] px-5"
              onClick={handleBack}
            >
              {t('store.back')}
            </Button>
          )}

          {currentStep < 4 ? (
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="flex-1 min-h-[56px] text-base font-bold shadow-md"
              onClick={handleNext}
            >
              {t('store.next')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="lg"
              loading={submitting}
              className="flex-1 min-h-[56px] text-base font-bold shadow-md"
              onClick={handleSubmit}
            >
              {isEditMode ? t('store.resubmit') : t('store.submit')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
