import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Phone, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { Button, Input, Card, useToast } from '../../components/ui';
import { LanguageToggle } from '../../components/LanguageToggle';

export const CompleteProfile = () => {
  const { t, i18n } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [phoneError, setPhoneError] = useState('');
  const [language, setLanguage] = useState(
    user?.language ||
      (typeof window !== 'undefined' ? localStorage.getItem('kirana_language') : null) ||
      'en',
  );

  // OTP mock flow: 'input_phone' | 'otp_sent' | 'verified'
  const [otpStep, setOtpStep] = useState(user?.phone ? 'verified' : 'input_phone');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validatePhone = (number) => {
    return /^[6-9]\d{9}$/.test(number.trim());
  };

  const handleSendOtp = () => {
    setPhoneError('');
    if (!validatePhone(phone)) {
      setPhoneError(t('auth.invalidPhone'));
      return;
    }
    setOtpStep('otp_sent');
    showToast({
      type: 'info',
      message: `${t('auth.otpHint')}`,
    });
  };

  const handleVerifyOtp = () => {
    setOtpError('');
    if (otpCode.trim() !== '123456') {
      setOtpError(t('auth.invalidOtp'));
      return;
    }
    setOtpStep('verified');
    showToast({
      type: 'success',
      message: 'Mobile number verified successfully!',
    });
  };

  const handleSelectLanguage = (lang) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kirana_language', lang);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast({ type: 'error', message: 'Name cannot be empty' });
      return;
    }

    if (otpStep !== 'verified') {
      showToast({ type: 'error', message: 'Please verify your phone number with OTP first' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.patch('/users/me', {
        name: name.trim(),
        phone: phone.trim(),
        language,
      });

      if (res.data?.success) {
        const updated = await refreshUser();
        showToast({ type: 'success', message: 'Profile updated successfully!' });

        if (updated?.role === 'store_owner') {
          navigate('/store/orders', { replace: true });
        } else if (updated?.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/app', { replace: true });
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update profile';
      showToast({ type: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-page flex flex-col justify-between p-4 sm:p-6 antialiased">
      {/* Top Header */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-primary-600 text-white font-bold flex items-center justify-center shadow-sm">
            K
          </span>
          <span className="font-bold text-ink-900">{t('app.name')}</span>
        </div>
        <LanguageToggle />
      </div>

      {/* Main Container */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <Card className="shadow-md">
          <div className="w-14 h-14 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
            <UserCheck className="w-7 h-7 stroke-[2.2]" />
          </div>

          <h1 className="text-2xl font-bold text-ink-900 text-center tracking-tight">
            {t('auth.completeProfileTitle')}
          </h1>
          <p className="text-xs text-ink-600 text-center mt-1 mb-6">
            {t('auth.completeProfileDesc')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5 text-left">
            {/* Name Input */}
            <Input
              label={t('auth.fullName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />

            {/* Mobile & OTP Section */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-900">{t('auth.mobileNumber')}</label>

              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (otpStep === 'verified') setOtpStep('input_phone');
                    }}
                    placeholder="10-digit mobile number"
                    leftIcon={Phone}
                    disabled={otpStep === 'verified'}
                    error={phoneError}
                    maxLength={10}
                  />
                </div>

                {otpStep === 'input_phone' && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="whitespace-nowrap px-3 text-sm font-semibold"
                    onClick={handleSendOtp}
                  >
                    {t('auth.sendOtp')}
                  </Button>
                )}

                {otpStep === 'verified' && (
                  <div className="h-12 min-h-[48px] px-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 text-xs font-bold">
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Verified</span>
                  </div>
                )}
              </div>

              {/* OTP Input Step */}
              {otpStep === 'otp_sent' && (
                <div className="mt-3 p-3.5 bg-page rounded-xl border border-ink-300/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-900">{t('auth.enterOtp')}</span>
                    <span className="text-[11px] text-ink-600 font-mono">Mock OTP: 123456</span>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="123456"
                        maxLength={6}
                        error={otpError}
                      />
                    </div>
                    <Button type="button" variant="primary" size="md" onClick={handleVerifyOtp}>
                      Verify
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Language Preference - Two Big Cards */}
            <div className="space-y-2 pt-1">
              <label className="text-sm font-medium text-ink-900 block">
                {t('auth.preferredLanguage')}
              </label>

              <div className="grid grid-cols-2 gap-3">
                {/* English Card */}
                <button
                  type="button"
                  onClick={() => handleSelectLanguage('en')}
                  className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between min-h-[84px] select-none ${
                    language === 'en'
                      ? 'border-primary-600 bg-primary-50/60 shadow-sm'
                      : 'border-ink-300/60 bg-white hover:border-ink-300 hover:bg-page'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm font-bold text-ink-900">English</span>
                    {language === 'en' && (
                      <span className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-ink-600 mt-1">Default language</span>
                </button>

                {/* Telugu Card */}
                <button
                  type="button"
                  onClick={() => handleSelectLanguage('te')}
                  className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between min-h-[84px] select-none ${
                    language === 'te'
                      ? 'border-primary-600 bg-primary-50/60 shadow-sm'
                      : 'border-ink-300/60 bg-white hover:border-ink-300 hover:bg-page'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-base font-bold text-ink-900 font-sans lang-te">
                      తెలుగు
                    </span>
                    {language === 'te' && (
                      <span className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-ink-600 mt-1">ప్రాంతీయ భాష</span>
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                loading={submitting}
                rightIcon={ShieldCheck}
              >
                {t('common.save')}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* Footer */}
      <footer className="text-center py-2 text-xs text-ink-600">
        &copy; {new Date().getFullYear()} Locart.
      </footer>
    </div>
  );
};
