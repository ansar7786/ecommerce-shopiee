import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Smartphone,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import api from '../../api/axios';
import { BottomSheet, Button } from '../ui';
import { formatPaise } from '../../utils/format';
import { validateUpiId, COMMON_UPI_HANDLES } from '../../utils/upi';

export const UpiPaymentModal = ({
  isOpen,
  onClose,
  totalPaise,
  storeId,
  items,
  fulfilment,
  onSuccess,
}) => {
  const { i18n } = useTranslation();
  const isTe = i18n.language === 'te';

  // Step: 'input' | 'waiting' | 'success' | 'failed'
  const [step, setStep] = useState('input');
  const [upiId, setUpiId] = useState('');
  const [paymentId, setPaymentId] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(20);
  const [errorMessage, setErrorMessage] = useState('');
  const [initiating, setInitiating] = useState(false);

  const timerRef = useRef(null);

  const isValidUpi = validateUpiId(upiId);

  // Suffix chip click
  const handleSuffixClick = (suffix) => {
    if (!upiId) {
      setUpiId(`user${suffix}`);
      return;
    }
    const clean = upiId.includes('@') ? upiId.split('@')[0] : upiId;
    setUpiId(`${clean}${suffix}`);
  };

  // 1. Verify & Pay -> Initiate Payment
  const handleVerifyAndPay = async () => {
    if (!isValidUpi || initiating) return;

    try {
      setInitiating(true);
      setErrorMessage('');

      const res = await api.post('/payments/initiate', {
        method: 'UPI',
        storeId,
        items,
        fulfilment,
        amount: totalPaise,
      });

      const pId = res.data.payment._id || res.data.payment.id;
      setPaymentId(pId);
      setSecondsLeft(20);
      setStep('waiting');
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message ||
          (isTe ? 'చెల్లింపు ప్రారంభం కాలేదు.' : 'Failed to initiate UPI payment.'),
      );
    } finally {
      setInitiating(false);
    }
  };

  // 2. Countdown timer effect during 'waiting' step
  useEffect(() => {
    if (step === 'waiting') {
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step]);

  // 3. When countdown reaches 0, trigger confirm
  useEffect(() => {
    if (step === 'waiting' && secondsLeft === 0 && paymentId) {
      const confirmUpi = async () => {
        try {
          await api.post(`/payments/${paymentId}/confirm`, {
            upiId: upiId.trim(),
          });
          setStep('success');

          // Wait 1.5 seconds on success screen then place order
          setTimeout(() => {
            onSuccess(paymentId);
          }, 1500);
        } catch (err) {
          setErrorMessage(
            err.response?.data?.message ||
              (isTe ? 'యూపీఐ చెల్లింపు విఫలమైంది.' : 'UPI payment failed.'),
          );
          setStep('failed');
        }
      };

      confirmUpi();
    }
  }, [step, secondsLeft, paymentId, upiId, onSuccess, isTe]);

  // Cancel action
  const handleCancelPayment = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (paymentId) {
      try {
        await api.post(`/payments/${paymentId}/cancel`);
      } catch {
        // Ignored
      }
    }
    setStep('input');
    setSecondsLeft(20);
    onClose();
  };

  // Try again action
  const handleTryAgain = () => {
    setStep('input');
    setErrorMessage('');
    setSecondsLeft(20);
  };

  // Progress ring math
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (secondsLeft / 20) * circumference;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => {
        if (step === 'waiting') {
          handleCancelPayment();
        } else {
          onClose();
        }
      }}
      title={
        step === 'waiting'
          ? isTe
            ? 'అనుమతి కోసం ఎదురుచూస్తున్నాము...'
            : 'Awaiting Approval...'
          : step === 'success'
            ? isTe
              ? 'చెల్లింపు స్వీకరించబడింది!'
              : 'Payment Received!'
            : step === 'failed'
              ? isTe
                ? 'చెల్లింపు విఫలమైంది'
                : 'Payment Failed'
              : isTe
                ? 'యూపీఐ ద్వారా చెల్లించండి'
                : 'Pay via UPI'
      }
    >
      {/* Step 1: Input Screen */}
      {step === 'input' && (
        <div className="space-y-4 pb-4">
          <div className="bg-primary-50/70 border border-primary-200 p-3.5 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary-600 text-white flex items-center justify-center font-black text-xs">
                UPI
              </div>
              <div>
                <span className="text-xs font-bold text-ink-900 block">
                  {isTe ? 'తక్షణ యూపీఐ చెల్లింపు' : 'Instant UPI Payment'}
                </span>
                <span className="text-[11px] text-ink-500">GPay, PhonePe, Paytm, BHIM</span>
              </div>
            </div>
            <span className="text-xs font-black text-primary-800">{formatPaise(totalPaise)}</span>
          </div>

          {/* UPI ID Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink-800 block">
              {isTe ? 'యూపీఐ ఐడీ (VPA)' : 'Enter UPI ID / VPA'}
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="example@okhdfcbank"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value.trim().toLowerCase())}
                className="w-full bg-ink-50 border border-ink-200 focus:border-primary-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none transition-all pr-10"
              />
              <Smartphone className="w-4 h-4 text-ink-400 absolute right-3.5 top-3" />
            </div>
            <p className="text-[10px] text-ink-400">
              {isTe
                ? 'టెస్టింగ్: customer@oksbi (విజయం), testfail@ybl (వైఫల్యం)'
                : 'Testing: customer@oksbi (Success), testfail@ybl (Failure)'}
            </p>
          </div>

          {/* Bank Suffix Chips */}
          <div>
            <span className="text-[11px] font-bold text-ink-500 block mb-1.5">
              {isTe ? 'త్వరిత ముగింపులు' : 'Quick Suffixes'}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_UPI_HANDLES.map((suffix) => (
                <button
                  key={suffix}
                  type="button"
                  onClick={() => handleSuffixClick(suffix)}
                  className="px-2.5 py-1 bg-ink-100 hover:bg-primary-100 hover:text-primary-800 text-ink-700 text-xs font-semibold rounded-lg transition-colors border border-ink-200"
                >
                  {suffix}
                </button>
              ))}
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Verify & Pay CTA */}
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={!isValidUpi || initiating}
            onClick={handleVerifyAndPay}
            className="w-full font-black text-sm min-h-[48px] shadow-md flex items-center justify-center gap-2 mt-2"
          >
            <span>
              {initiating
                ? isTe
                  ? 'ప్రక్రియ...'
                  : 'Verifying...'
                : isTe
                  ? `ధృవీకరించి చెల్లించండి · ${formatPaise(totalPaise)}`
                  : `Verify & Pay · ${formatPaise(totalPaise)}`}
            </span>
            {!initiating && <ArrowRight className="w-4 h-4" />}
          </Button>
        </div>
      )}

      {/* Step 2: Waiting Screen (20-Second Countdown & Animated Phone) */}
      {step === 'waiting' && (
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-5">
          {/* Circular Countdown Progress */}
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="56"
                cy="56"
                r={radius}
                className="text-ink-100"
                strokeWidth="6"
                stroke="currentColor"
                fill="transparent"
              />
              <circle
                cx="56"
                cy="56"
                r={radius}
                className="text-primary-600 transition-all duration-1000 ease-linear"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
              />
            </svg>

            {/* Inner Phone Icon & Seconds */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Smartphone className="w-6 h-6 text-primary-600 animate-bounce" />
              <span className="text-base font-black text-ink-900 mt-0.5">{secondsLeft}s</span>
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="font-extrabold text-base text-ink-900">
              {isTe ? 'చెల్లింపు అభ్యర్థన పంపబడింది' : 'Payment Request Sent'}
            </h3>
            <p className="text-xs text-ink-600 font-medium">
              {isTe ? 'అభ్యర్థన పంపబడిన ఐడీ:' : 'Approval requested on:'}{' '}
              <span className="font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md">
                {upiId}
              </span>
            </p>
            <p className="text-[11px] text-ink-500 pt-1 max-w-xs mx-auto">
              {isTe
                ? 'మీ యూపీఐ యాప్ తెరిచి చెల్లింపును ఆమోదించండి.'
                : 'Open your UPI app (GPay / PhonePe / Paytm) and approve the transaction.'}
            </p>
          </div>

          {/* Amount Badge */}
          <div className="text-xs font-black text-ink-900 bg-ink-100 px-4 py-1.5 rounded-full">
            {formatPaise(totalPaise)}
          </div>

          {/* Cancel Button */}
          <div className="w-full pt-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={handleCancelPayment}
              className="w-full text-xs font-bold text-red-600 hover:bg-red-50 min-h-[42px]"
            >
              {isTe ? 'చెల్లింపును రద్దు చేయండి' : 'Cancel Payment'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Success Screen */}
      {step === 'success' && (
        <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-pulse">
            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-ink-900">
              {isTe ? 'చెల్లింపు స్వీకరించబడింది!' : 'Payment Received!'}
            </h3>
            <p className="text-xs text-ink-500 mt-1">
              {isTe
                ? 'మీ ఆర్డర్ ఇప్పుడు స్వయంచాలకంగా ఉంచబడుతోంది...'
                : 'Placing your order automatically...'}
            </p>
          </div>
          <div className="text-sm font-black text-emerald-700 bg-emerald-50 px-4 py-1.5 rounded-full">
            {formatPaise(totalPaise)}
          </div>
        </div>
      )}

      {/* Step 4: Failed Screen */}
      {step === 'failed' && (
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <XCircle className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="font-extrabold text-base text-ink-900">
              {isTe ? 'చెల్లింపు విఫలమైంది' : 'Payment Failed'}
            </h3>
            <p className="text-xs text-red-600 font-semibold max-w-xs mx-auto">
              {errorMessage || (isTe ? 'లావాదేవీ పూర్తి కాలేదు.' : 'Transaction was not approved.')}
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
              onClick={handleTryAgain}
              className="w-full font-bold text-sm min-h-[46px] flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isTe ? 'మళ్ళీ ప్రయత్నించండి' : 'Try Again'}</span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleCancelPayment}
              className="w-full font-bold text-xs min-h-[42px]"
            >
              {isTe ? 'రద్దు చేసి చెక్అవుట్‌కు తిరిగి వెళ్లండి' : 'Return to Checkout'}
            </Button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
};
