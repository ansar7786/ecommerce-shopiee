import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const OfflineNotice = () => {
  const { i18n } = useTranslation();
  const isTe = i18n.language === 'te';
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [justCameOnline, setJustCameOnline] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setJustCameOnline(true);
      setTimeout(() => setJustCameOnline(false), 3500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setJustCameOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = async () => {
    setChecking(true);
    try {
      // Attempt a lightweight cache-busted fetch to test connectivity
      await fetch('/api/health?t=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
      setIsOnline(true);
      setJustCameOnline(true);
      setTimeout(() => setJustCameOnline(false), 3500);
    } catch {
      // Still offline
      setIsOnline(false);
    } finally {
      setChecking(false);
    }
  };

  if (justCameOnline) {
    return (
      <aside
        aria-label="Network status banner"
        className="fixed top-0 left-0 right-0 z-50 bg-emerald-600 text-white text-xs font-bold py-2 px-4 shadow-md flex items-center justify-center gap-2 transition-all duration-300"
      >
        <CheckCircle2 className="w-4 h-4" />
        <span>
          {isTe ? 'ఇంటర్నెట్ కనెక్షన్ పునరుద్ధరించబడింది' : 'Internet connection restored'}
        </span>
      </aside>
    );
  }

  if (!isOnline) {
    return (
      <aside
        aria-label="Offline warning banner"
        className="fixed bottom-0 left-0 right-0 md:top-0 md:bottom-auto z-50 bg-amber-900/95 backdrop-blur-md text-amber-50 p-3.5 shadow-2xl border-t md:border-t-0 md:border-b border-amber-700/60"
      >
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-800 text-amber-200 flex items-center justify-center flex-shrink-0">
              <WifiOff className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-white truncate">
                {isTe ? 'మీరు ఆఫ్‌లైన్‌లో ఉన్నారు' : 'You are currently offline'}
              </p>
              <p className="text-[11px] text-amber-200/90 truncate">
                {isTe
                  ? 'కనెక్షన్ కోసం వేచి ఉంది. కొన్ని ఫీచర్లు పరిమితం.'
                  : 'Reconnecting to network. Data may be cached.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRetry}
            disabled={checking}
            className="flex-shrink-0 px-3 py-1.5 min-h-[48px] bg-white text-amber-950 hover:bg-amber-100 font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>{isTe ? 'మళ్లీ ప్రయత్నించండి' : 'Retry'}</span>
          </button>
        </div>
      </aside>
    );
  }

  return null;
};
