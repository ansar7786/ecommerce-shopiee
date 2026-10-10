import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ShoppingBag,
  Clock,
  LogOut,
  ChevronRight,
  Globe,
  Share2,
  QrCode,
  Copy,
  Check,
  HelpCircle,
  Printer,
  Power,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useToast, Button, Card, Skeleton, BottomSheet } from '../../components/ui';

export const StoreSettings = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { i18n } = useTranslation();
  const { showToast } = useToast();

  const isTe = i18n.language === 'te';

  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Form states
  const [isOpen, setIsOpen] = useState(true);
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('22:00');
  const [radiusKm, setRadiusKm] = useState(3);
  const [deliveryFeeRs, setDeliveryFeeRs] = useState(20);
  const [freeDeliveryRs, setFreeDeliveryRs] = useState(300);
  const [minOrderRs, setMinOrderRs] = useState(50);
  const [supportsDelivery, setSupportsDelivery] = useState(true);
  const [supportsPickup, setSupportsPickup] = useState(true);

  // Modals
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const printPosterRef = useRef(null);

  const fetchStore = async () => {
    try {
      setLoading(true);
      const res = await api.get('/stores/me');
      const st = res.data.store;
      setStore(st);
      if (st) {
        setIsOpen(st.isOpen ?? true);
        setOpenTime(st.timings?.open || '08:00');
        setCloseTime(st.timings?.close || '22:00');
        setRadiusKm(st.deliveryRadiusKm || 3);
        setDeliveryFeeRs(st.deliveryFee ? st.deliveryFee / 100 : 20);
        setFreeDeliveryRs(st.freeDeliveryAbove ? st.freeDeliveryAbove / 100 : 300);
        setMinOrderRs(st.minOrder ? st.minOrder / 100 : 50);
        setSupportsDelivery(st.supportsDelivery ?? true);
        setSupportsPickup(st.supportsPickup ?? true);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStore();
  }, []);

  const storeShareUrl = store?.slug
    ? `${window.location.origin}/s/${store.slug}`
    : `${window.location.origin}/app/store/${store?._id}`;

  // Quick Open/Close Toggle
  const handleToggleOpen = async () => {
    try {
      const nextOpen = !isOpen;
      setIsOpen(nextOpen);
      await api.patch('/stores/me/open', { isOpen: nextOpen });
      showToast({
        type: 'success',
        message: isTe
          ? `దుకాణం ఇప్పుడు ${nextOpen ? 'తెరిచి ఉంది' : 'మూసివేయబడింది'}`
          : `Store marked ${nextOpen ? 'Open' : 'Closed'}`,
      });
    } catch {
      setIsOpen(!isOpen);
      showToast({
        type: 'error',
        message: isTe ? 'స్థితిని నవీకరించడం విఫలమైంది' : 'Failed to update store status',
      });
    }
  };

  // Save Delivery and Operating Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      const payload = {
        isOpen,
        timings: {
          open: openTime,
          close: closeTime,
        },
        deliveryRadiusKm: Number(radiusKm),
        deliveryFee: Math.round(Number(deliveryFeeRs) * 100),
        freeDeliveryAbove: Math.round(Number(freeDeliveryRs) * 100),
        minOrder: Math.round(Number(minOrderRs) * 100),
        supportsDelivery,
        supportsPickup,
      };

      const res = await api.patch('/stores/me', payload);
      setStore(res.data.store);
      showToast({
        type: 'success',
        message: isTe ? 'దుకాణ సెట్టింగ్‌లు భద్రపరచబడ్డాయి' : 'Store settings updated successfully',
      });
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update settings',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  // Copy Store Link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(storeShareUrl);
    setCopiedLink(true);
    showToast({
      type: 'success',
      message: isTe ? 'దుకాణం లింక్ కాపీ చేయబడింది!' : 'Store link copied to clipboard!',
    });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('kirana_language', lang);
    api.patch('/users/me', { language: lang }).catch(() => {});
  };

  const handlePrintPoster = () => {
    window.print();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (loading) {
    return (
      <div className="space-y-4 pt-2 pb-24">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28 antialiased">
      {/* 1. Switch to Customer View Banner */}
      <Card className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-emerald-950">
                {isTe ? 'కస్టమర్ వీక్షణకు మారండి' : 'Switch to Customer View'}
              </h3>
              <p className="text-xs text-emerald-800">
                {isTe
                  ? 'కస్టమర్ అనుభవాన్ని పరీక్షించండి లేదా సమీప దుకాణాల నుండి కొనండి'
                  : 'Browse nearby kirana shops and test the buyer experience'}
              </p>
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => navigate('/app')}
          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs min-h-[42px] flex items-center justify-center gap-1.5 shadow-xs"
        >
          <span>{isTe ? 'కస్టమర్ యాప్‌ను తెరవండి' : 'Open Customer App'}</span>
          <ChevronRight className="w-4 h-4 stroke-[2.5]" />
        </Button>
      </Card>

      {/* 2. Store Open / Closed Status Card */}
      <Card className="p-4 border border-ink-200 rounded-2xl bg-white shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
              }`}
            >
              <Power className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-xs font-extrabold text-ink-900 block">
                {isTe ? 'దుకాణం స్థితి' : 'Store Status'}
              </span>
              <span className="text-[11px] text-ink-500 font-medium">
                {isOpen
                  ? isTe
                    ? 'ప్రస్తుతం ఆర్డర్లను స్వీకరిస్తోంది'
                    : 'Currently accepting live orders'
                  : isTe
                    ? 'తాత్కాలికంగా మూసివేయబడింది'
                    : 'Temporarily closed for orders'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleOpen}
            className={`px-3 py-1.5 rounded-full text-xs font-black transition-all ${
              isOpen
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
            }`}
          >
            {isOpen ? (isTe ? 'తెరిచి ఉంది' : 'OPEN') : isTe ? 'మూసివేయబడింది' : 'CLOSED'}
          </button>
        </div>
      </Card>

      {/* 3. Share Store & Downloadable QR Poster */}
      <Card className="p-4 border border-ink-200 rounded-2xl bg-white shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Share2 className="w-4 h-4 text-primary-600" />
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-ink-900">
            {isTe ? 'దుకాణం లింక్ & క్యూఆర్ పోస్టర్' : 'Share Store & QR Poster'}
          </h2>
        </div>

        <div className="p-3 bg-ink-50 rounded-xl border border-ink-200 flex items-center justify-between gap-2">
          <span className="text-xs font-mono text-ink-700 truncate select-all">
            {storeShareUrl}
          </span>
          <button
            type="button"
            onClick={handleCopyLink}
            className="p-1.5 text-primary-700 hover:bg-primary-100 rounded-lg shrink-0 transition-colors"
            title="Copy link"
          >
            {copiedLink ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => setQrModalOpen(true)}
          className="w-full text-xs font-bold min-h-[42px] flex items-center justify-center gap-2"
        >
          <QrCode className="w-4 h-4 text-ink-700" />
          <span>
            {isTe ? 'క్యూఆర్ కోడ్ పోస్టర్ చూడండి & డౌన్‌లోడ్ చేయండి' : 'View & Print QR Poster'}
          </span>
        </Button>
      </Card>

      {/* 4. Store Operations & Delivery Rules Form */}
      <Card className="p-4 border border-ink-200 rounded-2xl bg-white shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary-600" />
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-ink-900">
            {isTe ? 'డెలివరీ & పని వేళల సెట్టింగ్‌లు' : 'Delivery & Operational Rules'}
          </h2>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-3.5">
          {/* Timings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="settings-open-time"
                className="text-[11px] font-bold text-ink-700 block mb-1"
              >
                {isTe ? 'ప్రారంభ సమయం' : 'Opening Time'}
              </label>
              <input
                id="settings-open-time"
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="w-full bg-ink-50 border border-ink-200 focus:border-primary-500 focus:bg-white rounded-xl px-3 py-2 text-xs font-semibold outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="settings-close-time"
                className="text-[11px] font-bold text-ink-700 block mb-1"
              >
                {isTe ? 'ముగింపు సమయం' : 'Closing Time'}
              </label>
              <input
                id="settings-close-time"
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="w-full bg-ink-50 border border-ink-200 focus:border-primary-500 focus:bg-white rounded-xl px-3 py-2 text-xs font-semibold outline-none"
              />
            </div>
          </div>

          {/* Fulfilment Toggles */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <label className="p-3 border rounded-xl flex items-center justify-between cursor-pointer border-ink-200 hover:border-ink-300">
              <span className="text-xs font-bold text-ink-800">
                {isTe ? 'హోమ్ డెలివరీ' : 'Delivery'}
              </span>
              <input
                type="checkbox"
                checked={supportsDelivery}
                onChange={(e) => setSupportsDelivery(e.target.checked)}
                className="w-4 h-4 rounded text-primary-600"
              />
            </label>

            <label className="p-3 border rounded-xl flex items-center justify-between cursor-pointer border-ink-200 hover:border-ink-300">
              <span className="text-xs font-bold text-ink-800">
                {isTe ? 'షాప్ పికప్' : 'Store Pickup'}
              </span>
              <input
                type="checkbox"
                checked={supportsPickup}
                onChange={(e) => setSupportsPickup(e.target.checked)}
                className="w-4 h-4 rounded text-primary-600"
              />
            </label>
          </div>

          {/* Delivery Radius */}
          <div>
            <label
              htmlFor="settings-radius"
              className="text-[11px] font-bold text-ink-700 block mb-1"
            >
              {isTe ? 'డెలివరీ పరిధి (కి.మీ)' : 'Delivery Radius (km)'}
            </label>
            <input
              id="settings-radius"
              type="number"
              step="0.5"
              min="0.5"
              max="20"
              value={radiusKm}
              onChange={(e) => setRadiusKm(e.target.value)}
              className="w-full bg-ink-50 border border-ink-200 focus:border-primary-500 focus:bg-white rounded-xl px-3 py-2 text-xs font-semibold outline-none"
            />
          </div>

          {/* Fees & Thresholds */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label
                htmlFor="settings-delivery-fee"
                className="text-[10px] font-bold text-ink-700 block mb-1"
              >
                Fee (₹)
              </label>
              <input
                id="settings-delivery-fee"
                type="number"
                min="0"
                value={deliveryFeeRs}
                onChange={(e) => setDeliveryFeeRs(e.target.value)}
                className="w-full bg-ink-50 border border-ink-200 focus:border-primary-500 focus:bg-white rounded-xl px-2 py-2 text-xs font-semibold outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="settings-free-delivery"
                className="text-[10px] font-bold text-ink-700 block mb-1"
              >
                Free Above (₹)
              </label>
              <input
                id="settings-free-delivery"
                type="number"
                min="0"
                value={freeDeliveryRs}
                onChange={(e) => setFreeDeliveryRs(e.target.value)}
                className="w-full bg-ink-50 border border-ink-200 focus:border-primary-500 focus:bg-white rounded-xl px-2 py-2 text-xs font-semibold outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="settings-min-order"
                className="text-[10px] font-bold text-ink-700 block mb-1"
              >
                Min Order (₹)
              </label>
              <input
                id="settings-min-order"
                type="number"
                min="0"
                value={minOrderRs}
                onChange={(e) => setMinOrderRs(e.target.value)}
                className="w-full bg-ink-50 border border-ink-200 focus:border-primary-500 focus:bg-white rounded-xl px-2 py-2 text-xs font-semibold outline-none"
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={savingSettings}
            className="w-full font-black text-xs min-h-[44px] mt-2"
          >
            <span>
              {savingSettings
                ? isTe
                  ? 'భద్రపరుస్తోంది...'
                  : 'Saving...'
                : isTe
                  ? 'సెట్టింగ్‌లను సేవ్ చేయి'
                  : 'Save Store Settings'}
            </span>
          </Button>
        </form>
      </Card>

      {/* 5. Language Selector Card */}
      <Card className="p-4 border border-ink-200 rounded-2xl bg-white shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary-600" />
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-ink-900">
            {isTe ? 'భాష ఎంపిక' : 'Language Preference'}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleLanguageChange('te')}
            className={`p-3 rounded-xl border text-xs font-extrabold transition-all ${
              isTe
                ? 'border-primary-600 bg-primary-50 text-primary-800 ring-2 ring-primary-100'
                : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300'
            }`}
          >
            తెలుగు (Telugu)
          </button>
          <button
            type="button"
            onClick={() => handleLanguageChange('en')}
            className={`p-3 rounded-xl border text-xs font-extrabold transition-all ${
              !isTe
                ? 'border-primary-600 bg-primary-50 text-primary-800 ring-2 ring-primary-100'
                : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300'
            }`}
          >
            English
          </button>
        </div>
      </Card>

      {/* 6. Help & Support */}
      <Card className="p-4 border border-ink-200 rounded-2xl bg-white shadow-xs space-y-2">
        <button
          type="button"
          onClick={() => setHelpModalOpen(true)}
          className="w-full flex items-center justify-between text-xs font-bold text-ink-800 hover:text-primary-700 py-1"
        >
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-4 h-4 text-ink-500" />
            <span>{isTe ? 'సహాయం & మద్దతు' : 'Help & Store Support'}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-ink-400" />
        </button>
      </Card>

      {/* 7. Logout */}
      <Button
        type="button"
        variant="ghost"
        size="lg"
        onClick={handleLogout}
        className="w-full text-xs font-extrabold text-red-600 hover:bg-red-50 min-h-[46px] flex items-center justify-center gap-2 border border-red-200 rounded-2xl"
      >
        <LogOut className="w-4 h-4" />
        <span>{isTe ? 'లాగ్ అవుట్' : 'Logout from Store'}</span>
      </Button>

      {/* QR Code Printable Poster Modal */}
      <BottomSheet
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title={isTe ? 'క్యూఆర్ కోడ్ పోస్టర్' : 'Store QR Poster'}
      >
        <div className="space-y-4 pb-4">
          {/* Printable Poster Area */}
          <div
            ref={printPosterRef}
            className="p-6 bg-white border-2 border-primary-600 rounded-3xl text-center space-y-4 shadow-sm"
          >
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-primary-700 bg-primary-50 px-3 py-1 rounded-full">
                Zero Commission Neighbourhood Kirana
              </span>
              <h2 className="text-xl font-black text-ink-900 mt-2">{store?.name}</h2>
              <p className="text-xs text-ink-500 mt-0.5">{store?.address}</p>
            </div>

            {/* QR Code SVG */}
            <div className="p-4 bg-white border border-ink-200 rounded-2xl inline-block shadow-xs">
              <QRCodeSVG value={storeShareUrl} size={180} level="H" includeMargin={true} />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-black text-ink-900">
                {isTe
                  ? 'ఆర్డర్ చేయడానికి మీ మొబైల్ కెమెరాతో స్కాన్ చేయండి'
                  : 'Scan to Order Online'}
              </p>
              <p className="text-[11px] text-ink-500">
                Works with any Camera, Google Lens, or UPI App
              </p>
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={handleCopyLink}
              className="flex-1 font-bold text-xs flex items-center justify-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{isTe ? 'లింక్ కాపీ చేయి' : 'Copy Link'}</span>
            </Button>

            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={handlePrintPoster}
              className="flex-1 font-extrabold text-xs flex items-center justify-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isTe ? 'ప్రింట్ పోస్టర్' : 'Print Poster'}</span>
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Help Modal */}
      <BottomSheet
        isOpen={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
        title={isTe ? 'సహాయం & మద్దతు' : 'Help & Store Support'}
      >
        <div className="space-y-3 pb-4 text-xs text-ink-600 leading-relaxed">
          <p>
            {isTe
              ? 'ఈ కిరాణా ప్లాట్‌ఫారమ్ గుడ్లవల్లేరులోని స్థానిక దుకాణాల కోసం ప్రత్యేకంగా రూపొందించబడింది.'
              : 'This platform empowers local neighbourhood kirana stores in Gudlavalleru with zero commission direct customer ordering.'}
          </p>
          <div className="p-3 bg-ink-50 rounded-xl space-y-1 font-medium">
            <p className="font-bold text-ink-900">Support Contact:</p>
            <p>Phone: +91 98765 43210</p>
            <p>Email: support@kirana-platform.csp</p>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
