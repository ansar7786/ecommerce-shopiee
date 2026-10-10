import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, Lock, XCircle, RotateCcw, Check } from 'lucide-react';
import api from '../../api/axios';
import { BottomSheet, Button } from '../ui';
import { formatPaise } from '../../utils/format';
import {
  validateLuhn,
  detectCardBrand,
  validateExpiry,
  validateCvv,
  formatCardNumber,
  formatExpiry,
  cleanNumber,
} from '../../utils/luhn';

export const CardPaymentModal = ({
  isOpen,
  onClose,
  totalPaise,
  storeId,
  items,
  fulfilment,
  onSuccess,
  onChooseAnotherMethod,
}) => {
  const { i18n } = useTranslation();
  const isTe = i18n.language === 'te';

  // Step: 'form' | 'processing' | 'failed'
  const [step, setStep] = useState('form');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Live brand detection & validation
  const brand = useMemo(() => detectCardBrand(cardNumber), [cardNumber]);
  const isLuhnValid = useMemo(() => validateLuhn(cardNumber), [cardNumber]);
  const isExpiryValid = useMemo(() => validateExpiry(expiry), [expiry]);
  const isCvvValid = useMemo(() => validateCvv(cvv), [cvv]);
  const isNameValid = useMemo(() => cardName.trim().length >= 2, [cardName]);

  const isFormValid = isLuhnValid && isExpiryValid && isCvvValid && isNameValid;

  const handleCardNumberChange = (e) => {
    setCardNumber(formatCardNumber(e.target.value));
  };

  const handleExpiryChange = (e) => {
    setExpiry(formatExpiry(e.target.value));
  };

  const handleCvvChange = (e) => {
    const val = cleanNumber(e.target.value).slice(0, 4);
    setCvv(val);
  };

  const handlePay = async () => {
    if (!isFormValid || step === 'processing') return;

    try {
      setStep('processing');
      setErrorMessage('');

      // 1. Initiate Payment
      const initiateRes = await api.post('/payments/initiate', {
        method: 'CARD',
        storeId,
        items,
        fulfilment,
        amount: totalPaise,
      });

      const paymentId = initiateRes.data.payment._id || initiateRes.data.payment.id;

      // 2. Simulate processing for 3 seconds per guide
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 3. Confirm payment with ONLY brand and last4 (never raw card number, CVV or expiry)
      const last4 = cleanNumber(cardNumber).slice(-4);
      await api.post(`/payments/${paymentId}/confirm`, {
        details: {
          brand: brand === 'Unknown' ? 'Card' : brand,
          last4,
        },
      });

      // 4. Success callback
      onSuccess(paymentId);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message ||
          (isTe ? 'కార్డు చెల్లింపు విఫలమైంది.' : 'Payment declined by bank'),
      );
      setStep('failed');
    }
  };

  const resetForm = () => {
    setStep('form');
    setErrorMessage('');
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => {
        if (step !== 'processing') {
          onClose();
        }
      }}
      title={
        step === 'processing'
          ? isTe
            ? 'చెల్లింపు ప్రక్రియ...'
            : 'Processing Payment'
          : step === 'failed'
            ? isTe
              ? 'చెల్లింపు విఫలమైంది'
              : 'Payment Failed'
            : isTe
              ? 'కార్డు ద్వారా చెల్లించండి'
              : 'Pay by Card'
      }
    >
      {/* 1. Processing Screen */}
      {step === 'processing' && (
        <div className="py-10 flex flex-col items-center justify-center text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Lock className="w-6 h-6 text-primary-600" />
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-base text-ink-900">
              {isTe ? 'బ్యాంకుతో అనుసంధానం అవుతోంది...' : 'Processing Payment...'}
            </h3>
            <p className="text-xs text-ink-500 mt-1 max-w-xs mx-auto">
              {isTe
                ? 'దయచేసి పేజీని రీఫ్రెష్ చేయవద్దు లేదా వెనుకకు వెళ్లవద్దు.'
                : 'Please do not refresh or press back while we securely process your transaction.'}
            </p>
          </div>
          <div className="pt-2 text-xs font-black text-primary-700 bg-primary-50 px-4 py-1.5 rounded-full">
            {formatPaise(totalPaise)}
          </div>
        </div>
      )}

      {/* 2. Failure Screen */}
      {step === 'failed' && (
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <XCircle className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="font-extrabold text-base text-ink-900">
              {isTe ? 'చెల్లింపు పూర్తి కాలేదు' : 'Payment Declined'}
            </h3>
            <p className="text-xs text-red-600 font-semibold max-w-xs mx-auto">
              {errorMessage ||
                (isTe ? 'బ్యాంక్ లావాదేవీని నిరాకరించింది.' : 'Payment declined by bank')}
            </p>
            <p className="text-[11px] text-ink-500 pt-1">
              {isTe
                ? 'మీ కార్ట్ వస్తువులు భద్రంగా ఉన్నాయి.'
                : 'Your cart items are completely safe.'}
            </p>
          </div>

          <div className="w-full space-y-2 pt-3">
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={resetForm}
              className="w-full font-bold text-sm min-h-[46px] flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isTe ? 'మళ్ళీ ప్రయత్నించండి' : 'Try Again'}</span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => {
                resetForm();
                onChooseAnotherMethod();
              }}
              className="w-full font-bold text-xs min-h-[42px]"
            >
              {isTe ? 'వేరే చెల్లింపు పద్ధతి ఎంచుకోండి' : 'Choose Another Method'}
            </Button>
          </div>
        </div>
      )}

      {/* 3. Card Input Form Screen */}
      {step === 'form' && (
        <div className="space-y-4 pb-4">
          {/* Card Mock Container */}
          <div className="bg-gradient-to-tr from-ink-900 via-ink-800 to-ink-700 text-white p-4 rounded-2xl shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-300">
                {brand !== 'Unknown' ? brand : 'Debit / Credit'}
              </span>
              <span className="text-xs font-black bg-white/10 px-2.5 py-0.5 rounded-full">
                {brand}
              </span>
            </div>

            <div className="font-mono text-base tracking-widest text-ink-100 font-semibold">
              {cardNumber || '•••• •••• •••• ••••'}
            </div>

            <div className="flex items-center justify-between text-[11px] text-ink-300 font-mono">
              <div>
                <span className="text-[9px] block uppercase text-ink-400">Card Holder</span>
                <span className="font-bold text-white uppercase truncate max-w-[150px] inline-block">
                  {cardName || 'YOUR NAME'}
                </span>
              </div>
              <div>
                <span className="text-[9px] block uppercase text-ink-400">Expires</span>
                <span className="font-bold text-white">{expiry || 'MM/YY'}</span>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            {/* Card Number */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-ink-800">
                  {isTe ? 'కార్డు నంబర్' : 'Card Number'}
                </label>
                {cardNumber.length >= 15 && (
                  <span
                    className={`text-[10px] font-bold flex items-center gap-1 ${
                      isLuhnValid ? 'text-emerald-600' : 'text-red-500'
                    }`}
                  >
                    {isLuhnValid ? (
                      <>
                        <Check className="w-3 h-3 stroke-[3]" /> Valid
                      </>
                    ) : (
                      'Invalid Number'
                    )}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="4111 1111 1111 1111"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  maxLength={23}
                  className="w-full bg-ink-50 border border-ink-200 focus:border-primary-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-wider outline-none transition-all pr-10"
                />
                <CreditCard className="w-4 h-4 text-ink-400 absolute right-3.5 top-3" />
              </div>
              <p className="text-[10px] text-ink-400 mt-1">
                {isTe
                  ? 'టెస్టింగ్: 4111 1111 1111 1111 (విజయం), 4000 0000 0000 0002 (వైఫల్యం)'
                  : 'Test Cards: 4111 1111 1111 1111 (Success), 4000 0000 0000 0002 (Fail)'}
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs font-bold text-ink-800 block mb-1">
                {isTe ? 'కార్డుదారుని పేరు' : 'Cardholder Name'}
              </label>
              <input
                type="text"
                placeholder="Ravi Kumar"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                className="w-full bg-ink-50 border border-ink-200 focus:border-primary-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all"
              />
            </div>

            {/* Expiry & CVV */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-ink-800 block mb-1">
                  {isTe ? 'గడువు (MM/YY)' : 'Expiry (MM/YY)'}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="12/28"
                  value={expiry}
                  onChange={handleExpiryChange}
                  maxLength={5}
                  className={`w-full bg-ink-50 border rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-wider outline-none transition-all ${
                    expiry.length === 5 && !isExpiryValid
                      ? 'border-red-400 bg-red-50'
                      : 'border-ink-200 focus:border-primary-500 focus:bg-white'
                  }`}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink-800 block mb-1">
                  {isTe ? 'సీవీవీ (CVV)' : 'CVV'}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="•••"
                    value={cvv}
                    onChange={handleCvvChange}
                    maxLength={4}
                    className="w-full bg-ink-50 border border-ink-200 focus:border-primary-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-widest outline-none transition-all pr-8"
                  />
                  <Lock className="w-3.5 h-3.5 text-ink-400 absolute right-3 top-3.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Security guarantee note */}
          <div className="p-2.5 bg-ink-50 border border-ink-200 rounded-xl flex items-center gap-2 text-[11px] text-ink-600">
            <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>
              {isTe
                ? 'కార్డు వివరాలు సర్వర్‌లో ఎప్పటికీ నిల్వ చేయబడవు.'
                : 'Card numbers and CVV are never stored or logged on servers.'}
            </span>
          </div>

          {/* Pay Button */}
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={!isFormValid}
            onClick={handlePay}
            className="w-full font-black text-sm min-h-[48px] shadow-md flex items-center justify-center gap-2 mt-2"
          >
            <span>
              {isTe
                ? `చెల్లించండి · ${formatPaise(totalPaise)}`
                : `Pay · ${formatPaise(totalPaise)}`}
            </span>
          </Button>
        </div>
      )}
    </BottomSheet>
  );
};
