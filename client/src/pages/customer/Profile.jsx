import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Phone,
  Mail,
  MapPin,
  Globe,
  HelpCircle,
  ShieldCheck,
  FileText,
  LogOut,
  Trash2,
  Store,
  Plus,
  Edit2,
  Check,
  AlertTriangle,
  ChevronRight,
  Home,
  Briefcase,
  Compass,
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useLocationContext } from '../../context/LocationContext';
import { useToast, Button, Card, BottomSheet, Input } from '../../components/ui';

export const Profile = () => {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const { addresses, addAddress, updateAddress, deleteAddress } = useLocationContext();
  const { showToast } = useToast();
  const { i18n } = useTranslation();

  const isTe = i18n.language === 'te';

  // Edit Profile Modal
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Address Modal (Add / Edit)
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addrLabel, setAddrLabel] = useState('Home');
  const [addrLine, setAddrLine] = useState('');
  const [addrPincode, setAddrPincode] = useState('521356');
  const [addrLandmark, setAddrLandmark] = useState('');
  const [addrIsDefault, setAddrIsDefault] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  // Static Policy Modals
  const [helpOpen, setHelpOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // Delete Account Sheet
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Handle Edit Profile Save
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      showToast({ type: 'error', message: 'Name cannot be empty' });
      return;
    }
    if (editPhone && !/^[6-9]\d{9}$/.test(editPhone.trim())) {
      showToast({ type: 'error', message: 'Please enter a valid 10-digit Indian phone number' });
      return;
    }

    try {
      setSavingProfile(true);
      await api.patch('/users/me', {
        name: editName.trim(),
        phone: editPhone.trim(),
      });
      await refreshUser();
      showToast({ type: 'success', message: 'Profile updated successfully' });
      setEditProfileOpen(false);
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update profile',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  // Open Address Modal
  const openAddAddress = () => {
    setEditingAddressId(null);
    setAddrLabel('Home');
    setAddrLine('');
    setAddrPincode('521356');
    setAddrLandmark('');
    setAddrIsDefault(addresses.length === 0);
    setAddressModalOpen(true);
  };

  const openEditAddress = (addr) => {
    setEditingAddressId(addr._id);
    setAddrLabel(addr.label || 'Home');
    setAddrLine(addr.line || '');
    setAddrPincode(addr.pincode || '521356');
    setAddrLandmark(addr.landmark || '');
    setAddrIsDefault(Boolean(addr.isDefault));
    setAddressModalOpen(true);
  };

  // Save Address
  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (!addrLine.trim()) {
      showToast({ type: 'error', message: 'Address line is required' });
      return;
    }

    try {
      setSavingAddress(true);
      const payload = {
        label: addrLabel,
        line: addrLine.trim(),
        pincode: addrPincode.trim(),
        landmark: addrLandmark.trim(),
        latitude: 16.343565,
        longitude: 81.054082,
        isDefault: addrIsDefault,
      };

      if (editingAddressId) {
        await updateAddress(editingAddressId, payload);
        showToast({ type: 'success', message: 'Address updated successfully' });
      } else {
        await addAddress(payload);
        showToast({ type: 'success', message: 'Address added successfully' });
      }
      setAddressModalOpen(false);
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save address',
      });
    } finally {
      setSavingAddress(false);
    }
  };

  // Delete Address
  const handleDeleteAddress = async (id) => {
    try {
      await deleteAddress(id);
      showToast({ type: 'success', message: 'Address removed' });
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to delete address' });
    }
  };

  // Set Default Address
  const handleSetDefaultAddress = async (addr) => {
    try {
      await updateAddress(addr._id, { isDefault: true });
      showToast({ type: 'success', message: 'Default address updated' });
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to set default address' });
    }
  };

  // Switch Language
  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('kirana_language', lang);
    api.patch('/users/me', { language: lang }).catch(() => {});
  };

  // Handle Logout
  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Handle Soft Delete Account
  const handleDeleteAccount = async () => {
    try {
      setDeletingAccount(true);
      await api.delete('/users/me');
      showToast({
        type: 'success',
        message: isTe ? 'మీ ఖాతా విజయవంతంగా తొలగించబడింది.' : 'Your account has been deleted.',
      });
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      showToast({
        type: 'error',
        message: err.response?.data?.message || 'Failed to delete account',
      });
    } finally {
      setDeletingAccount(false);
      setDeleteSheetOpen(false);
    }
  };

  const getLabelIcon = (l) => {
    if (l === 'Home') return Home;
    if (l === 'Work') return Briefcase;
    return Compass;
  };

  return (
    <div className="space-y-4 pb-28">
      {/* Header Profile Card */}
      <Card className="p-4 border border-ink-200 rounded-2xl bg-white shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-13 h-13 rounded-2xl bg-primary-600 text-white flex items-center justify-center font-black text-xl shadow-sm">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-ink-900 truncate">
                {user?.name || 'Customer'}
              </h2>
              <p className="text-xs text-ink-500 font-medium truncate flex items-center gap-1 mt-0.5">
                <Mail className="w-3 h-3 text-ink-400" />
                <span>{user?.email || ''}</span>
              </p>
              {user?.phone && (
                <p className="text-xs text-ink-500 font-medium flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3 text-ink-400" />
                  <span>+91 {user.phone}</span>
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditName(user?.name || '');
              setEditPhone(user?.phone || '');
              setEditProfileOpen(true);
            }}
            className="p-2 text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl border border-primary-200 transition-colors shrink-0"
            title="Edit Profile"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>

        {/* Switch to Store View for Store Owners */}
        {user?.role === 'store_owner' && (
          <div className="pt-2 border-t border-ink-100">
            <button
              type="button"
              onClick={() => navigate('/store/orders')}
              className="w-full flex items-center justify-between p-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs transition-colors active:scale-98 shadow-xs"
            >
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-amber-700" />
                <span>{isTe ? 'దుకాణదారుడి వీక్షణకు మారండి' : 'Switch to Store Owner View'}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-600" />
            </button>
          </div>
        )}
      </Card>

      {/* Saved Addresses Section */}
      <Card className="p-4 border border-ink-200 rounded-2xl bg-white shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary-600" />
            <h3 className="text-xs font-bold text-ink-600 uppercase tracking-wider">
              {isTe ? 'భద్రపరచిన చిరునామాలు' : 'Saved Delivery Addresses'}
            </h3>
          </div>
          <button
            type="button"
            onClick={openAddAddress}
            className="flex items-center gap-1 text-xs font-bold text-primary-700 hover:text-primary-800 bg-primary-50 px-2.5 py-1 rounded-lg border border-primary-200 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isTe ? 'జోడించు' : 'Add New'}</span>
          </button>
        </div>

        {addresses.length === 0 ? (
          <p className="text-xs text-ink-500 py-2 text-center bg-ink-50 rounded-xl">
            {isTe
              ? 'చిరునామాలు ఏవీ లేవు. కొత్త చిరునామాను జోడించండి.'
              : 'No saved addresses yet. Add one above.'}
          </p>
        ) : (
          <div className="space-y-2.5 divide-y divide-ink-100">
            {addresses.map((addr) => {
              const Icon = getLabelIcon(addr.label);
              return (
                <div
                  key={addr._id}
                  className="pt-2.5 first:pt-0 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-ink-100 text-ink-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-ink-900">{addr.label}</span>
                        {addr.isDefault && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                            {isTe ? 'డిఫాల్ట్' : 'Default'}
                          </span>
                        )}
                      </div>
                      <p className="text-ink-600 text-xs leading-snug mt-0.5">{addr.line}</p>
                      {addr.landmark && (
                        <p className="text-ink-400 text-[11px]">
                          Near: {addr.landmark} • {addr.pincode}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!addr.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefaultAddress(addr)}
                        className="p-1.5 text-ink-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                        title={isTe ? 'డిఫాల్ట్‌గా ఉంచు' : 'Set as default'}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditAddress(addr)}
                      className="p-1.5 text-ink-500 hover:text-ink-900 hover:bg-ink-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(addr._id)}
                      className="p-1.5 text-ink-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Language Preferences Card */}
      <Card className="p-4 border border-ink-200 rounded-2xl bg-white shadow-xs space-y-2">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary-600" />
          <h3 className="text-xs font-bold text-ink-600 uppercase tracking-wider">
            {isTe ? 'భాష ఎంపిక' : 'Language Preference'}
          </h3>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleLanguageChange('te')}
            className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
              isTe
                ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                : 'bg-white text-ink-700 border-ink-200 hover:bg-ink-50'
            }`}
          >
            తెలుగు (Telugu)
          </button>
          <button
            type="button"
            onClick={() => handleLanguageChange('en')}
            className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
              !isTe
                ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                : 'bg-white text-ink-700 border-ink-200 hover:bg-ink-50'
            }`}
          >
            English
          </button>
        </div>
      </Card>

      {/* Help & Policies Links */}
      <Card className="p-2 border border-ink-200 rounded-2xl bg-white shadow-xs divide-y divide-ink-100">
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="w-full flex items-center justify-between p-3 hover:bg-ink-50 rounded-xl transition-colors text-left"
        >
          <div className="flex items-center gap-2.5 text-xs font-bold text-ink-800">
            <HelpCircle className="w-4 h-4 text-ink-500" />
            <span>{isTe ? 'సహాయం & మద్దతు (Help & FAQs)' : 'Help & Support'}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-ink-400" />
        </button>

        <button
          type="button"
          onClick={() => setPrivacyOpen(true)}
          className="w-full flex items-center justify-between p-3 hover:bg-ink-50 rounded-xl transition-colors text-left"
        >
          <div className="flex items-center gap-2.5 text-xs font-bold text-ink-800">
            <ShieldCheck className="w-4 h-4 text-ink-500" />
            <span>{isTe ? 'గోప్యతా విధానం (Privacy Policy)' : 'Privacy Policy'}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-ink-400" />
        </button>

        <button
          type="button"
          onClick={() => setTermsOpen(true)}
          className="w-full flex items-center justify-between p-3 hover:bg-ink-50 rounded-xl transition-colors text-left"
        >
          <div className="flex items-center gap-2.5 text-xs font-bold text-ink-800">
            <FileText className="w-4 h-4 text-ink-500" />
            <span>{isTe ? 'నిబంధనలు & షరతులు (Terms of Service)' : 'Terms of Service'}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-ink-400" />
        </button>
      </Card>

      {/* Account Actions (Logout & Delete Account) */}
      <div className="space-y-2 pt-2">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={handleLogout}
          className="w-full text-xs font-bold text-ink-700 min-h-[46px] flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4 text-ink-500" />
          <span>{isTe ? 'లాగ్ అవుట్' : 'Log Out'}</span>
        </Button>

        <button
          type="button"
          onClick={() => setDeleteSheetOpen(true)}
          className="w-full py-2.5 text-center text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{isTe ? 'నా ఖాతాను తొలగించండి' : 'Delete My Account'}</span>
        </button>
      </div>

      {/* Edit Profile BottomSheet */}
      <BottomSheet
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        title={isTe ? 'ప్రొఫైల్ వివరాలు సవరించండి' : 'Edit Profile'}
      >
        <form onSubmit={handleSaveProfile} className="space-y-4 pb-4">
          <Input
            label={isTe ? 'పూర్తి పేరు' : 'Full Name'}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />

          <Input
            label={isTe ? 'ఫోన్ నంబర్' : 'Phone Number'}
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            placeholder="10-digit mobile number"
          />

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditProfileOpen(false)}
              className="flex-1 text-xs font-bold min-h-[46px]"
            >
              {isTe ? 'రద్దు' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={savingProfile}
              className="flex-1 text-xs font-bold min-h-[46px]"
            >
              {savingProfile ? '...' : isTe ? 'సేవ్ చేయండి' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* Address Form BottomSheet */}
      <BottomSheet
        isOpen={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        title={
          editingAddressId
            ? isTe
              ? 'చిరునామాను సవరించండి'
              : 'Edit Address'
            : isTe
              ? 'కొత్త చిరునామా జోడించండి'
              : 'Add New Address'
        }
      >
        <form onSubmit={handleSaveAddress} className="space-y-3.5 pb-4">
          {/* Label Selector */}
          <div className="space-y-1 text-xs">
            <label className="font-bold text-ink-800">{isTe ? 'లేబుల్' : 'Address Label'}</label>
            <div className="flex gap-2">
              {['Home', 'Work', 'Other'].map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setAddrLabel(l)}
                  className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                    addrLabel === l
                      ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                      : 'bg-white text-ink-700 border-ink-200'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <Input
            label={isTe ? 'చిరునామా (ఇంటి నం, వీధి)' : 'Address Line (Flat / Street)'}
            value={addrLine}
            onChange={(e) => setAddrLine(e.target.value)}
            placeholder="e.g. D.No 4-12, Gandhi Road"
            required
          />

          <Input
            label={isTe ? 'గుర్తు (ల్యాండ్‌మార్క్)' : 'Landmark (Optional)'}
            value={addrLandmark}
            onChange={(e) => setAddrLandmark(e.target.value)}
            placeholder="Near Rama Temple, Opp. Bank"
          />

          <Input
            label={isTe ? 'పిన్‌కోడ్' : 'PIN Code'}
            value={addrPincode}
            onChange={(e) => setAddrPincode(e.target.value)}
            placeholder="521356"
            required
          />

          <div className="flex items-center gap-2 pt-1 text-xs">
            <input
              type="checkbox"
              id="isDefaultCheckbox"
              checked={addrIsDefault}
              onChange={(e) => setAddrIsDefault(e.target.checked)}
              className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
            />
            <label
              htmlFor="isDefaultCheckbox"
              className="font-semibold text-ink-700 cursor-pointer"
            >
              {isTe ? 'ఈ చిరునామాను డిఫాల్ట్‌గా ఉంచు' : 'Set as default delivery address'}
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAddressModalOpen(false)}
              className="flex-1 text-xs font-bold min-h-[46px]"
            >
              {isTe ? 'రద్దు' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={savingAddress}
              className="flex-1 text-xs font-bold min-h-[46px]"
            >
              {savingAddress ? '...' : isTe ? 'భద్రపరచు' : 'Save Address'}
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* Help Modal */}
      <BottomSheet
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={isTe ? 'సహాయం & తరచుగా అడిగే ప్రశ్నలు' : 'Help & Support'}
      >
        <div className="space-y-3 pb-4 text-xs text-ink-700 divide-y divide-ink-100 max-h-[65vh] overflow-y-auto">
          <div className="pt-2 first:pt-0 space-y-1">
            <h4 className="font-bold text-ink-900">
              {isTe ? 'ఆర్డర్ ఎలా చేయాలి?' : 'How do I place an order?'}
            </h4>
            <p className="text-ink-600 leading-relaxed">
              {isTe
                ? 'మీ స్థలాన్ని ఎంచుకోండి, సమీప కిరాణా దుకాణాన్ని బ్రౌజ్ చేయండి, వస్తువులను కార్ట్‌లోకి చేర్చి చెకౌట్ చేయండి.'
                : 'Select your local delivery address or Gudlavalleru area, browse verified nearby stores, add products to cart, and place order.'}
            </p>
          </div>

          <div className="pt-2 space-y-1">
            <h4 className="font-bold text-ink-900">
              {isTe ? 'చెల్లింపు విధానాలు ఏమిటి?' : 'What payment methods are supported?'}
            </h4>
            <p className="text-ink-600 leading-relaxed">
              {isTe
                ? 'నగదు చెల్లింపు (COD), UPI మరియు కార్డ్ సిమ్యులేషన్ అందుబాటులో ఉన్నాయి. నగదు డెలివరీ సమయంలో దుకాణదారుడికి చెల్లించవచ్చు.'
                : 'Cash on Delivery (COD), simulated UPI, and card checkout. For COD, payment is confirmed directly with the store owner upon handover.'}
            </p>
          </div>

          <div className="pt-2 space-y-1">
            <h4 className="font-bold text-ink-900">
              {isTe
                ? 'వస్తువులు అందుబాటులో లేకపోతే ఏమి జరుగుతుంది?'
                : 'What if an item is out of stock?'}
            </h4>
            <p className="text-ink-600 leading-relaxed">
              {isTe
                ? 'దుకాణదారుడు వస్తువును అందుబాటులో లేదని మార్క్ చేస్తే, ఆర్డర్ మొత్తం తగ్గి మీకు 10 నిమిషాల నిర్ధారణ నోటీసు వస్తుంది.'
                : 'The store marks it unavailable. Your bill is recomputed, and you have 10 minutes to review and accept the revised total.'}
            </p>
          </div>

          <div className="pt-2 space-y-1">
            <h4 className="font-bold text-ink-900">
              {isTe ? 'దుకాణాన్ని ఎలా సంప్రదించాలి?' : 'How do I contact the store?'}
            </h4>
            <p className="text-ink-600 leading-relaxed">
              {isTe
                ? 'ఆర్డర్ వివరాల పేజీలో లేదా దుకాణం పేజీలో నేరుగా కాల్ చేయడానికి "Call" బటన్ అందుబాటులో ఉంటుంది.'
                : 'Use the tap-to-call phone button available on the store page and order tracking screen.'}
            </p>
          </div>
        </div>
      </BottomSheet>

      {/* Privacy Policy Modal */}
      <BottomSheet
        isOpen={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        title={isTe ? 'గోప్యతా విధానం' : 'Privacy Policy'}
      >
        <div className="space-y-3 pb-4 text-xs text-ink-600 max-h-[65vh] overflow-y-auto leading-relaxed">
          <p>
            This Hyperlocal Locart Platform prototype is developed as a graduate Community Service
            Project (CSP) for local neighbourhood stores in Gudlavalleru, Andhra Pradesh.
          </p>
          <p className="font-bold text-ink-900">Data Collected:</p>
          <ul className="list-disc pl-5 space-y-1 text-ink-700">
            <li>
              Google OAuth profile credentials (name, email) for session authentication via httpOnly
              cookies.
            </li>
            <li>
              Saved delivery address lines and GPS coordinates strictly for distance calculation and
              routing.
            </li>
            <li>No actual financial instruments or real card numbers are stored or processed.</li>
          </ul>
          <p>
            You can delete or anonymise all your profile information and stored addresses at any
            time via the &quot;Delete My Account&quot; option.
          </p>
        </div>
      </BottomSheet>

      {/* Terms of Service Modal */}
      <BottomSheet
        isOpen={termsOpen}
        onClose={() => setTermsOpen(false)}
        title={isTe ? 'నిబంధనలు & షరతులు' : 'Terms of Service'}
      >
        <div className="space-y-3 pb-4 text-xs text-ink-600 max-h-[65vh] overflow-y-auto leading-relaxed">
          <p>By using this platform, you agree to neighbourhood kirana community principles:</p>
          <ul className="list-disc pl-5 space-y-1 text-ink-700">
            <li>Zero-commission local orders directly fulfilled by neighbourhood shops.</li>
            <li>
              Maximum price compliance: products are sold at or below Maximum Retail Price (MRP).
            </li>
            <li>
              Timely order acceptance: orders not confirmed by stores within 3 minutes expire
              automatically.
            </li>
            <li>Cash on delivery must be settled upon physical receipt of packaged goods.</li>
          </ul>
        </div>
      </BottomSheet>

      {/* Delete Account Confirmation Sheet */}
      <BottomSheet
        isOpen={deleteSheetOpen}
        onClose={() => setDeleteSheetOpen(false)}
        title={isTe ? 'ఖాతాను శాశ్వతంగా తొలగించాలా?' : 'Delete Account?'}
      >
        <div className="space-y-4 pb-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-xs text-red-900">
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                {isTe
                  ? 'ఈ చర్యను వెనక్కి తీసుకోలేరు'
                  : 'This action is permanent and irreversible.'}
              </p>
              <p className="mt-1 text-[11px] text-red-800 leading-snug">
                {isTe
                  ? 'మీ పేరు, ఫోన్ మరియు భద్రపరచిన చిరునామాలు తొలగించబడతాయి. మీరు లాగ్ అవుట్ చేయబడతారు.'
                  : 'Your personal information, phone number, and saved addresses will be deleted. You will be logged out immediately.'}
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteSheetOpen(false)}
              className="flex-1 text-xs font-bold min-h-[46px]"
            >
              {isTe ? 'రద్దు' : 'Keep Account'}
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={deletingAccount}
              onClick={handleDeleteAccount}
              className="flex-1 text-xs font-bold min-h-[46px]"
            >
              {deletingAccount ? '...' : isTe ? 'ఖాతా తొలగించు' : 'Confirm Delete'}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
