import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Store, ShoppingBag } from 'lucide-react';
import api from '../../api/axios';
import { useToast, Card, Button } from '../../components/ui';

export const AdminReports = () => {
  const { i18n } = useTranslation();
  const { showToast } = useToast();
  const isTe = i18n.language === 'te';

  const [downloadingOrders, setDownloadingOrders] = useState(false);
  const [downloadingStores, setDownloadingStores] = useState(false);

  const downloadCsv = async (type) => {
    const isOrders = type === 'orders';
    const setDownloading = isOrders ? setDownloadingOrders : setDownloadingStores;

    try {
      setDownloading(true);
      const response = await api.get(`/admin/reports/export?type=${type}`, {
        responseType: 'blob',
      });

      // Create a blob URL and trigger browser download
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `kirana-${type}-report-${new Date().toISOString().split('T')[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showToast({
        type: 'success',
        message: isTe
          ? `${isOrders ? 'ఆర్డర్ల' : 'దుకాణాల'} నివేదిక విజయవంతంగా డౌన్‌లోడ్ చేయబడింది`
          : `${isOrders ? 'Orders' : 'Stores'} CSV exported successfully`,
      });
    } catch {
      showToast({
        type: 'error',
        message: isTe ? 'నివేదిక డౌన్‌లోడ్ చేయడం విఫలమైంది' : 'Failed to export report CSV',
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 antialiased">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-ink-900 tracking-tight">
          {isTe ? 'డేటా నివేదికలు & ఎగుమతులు' : 'Data Reports & CSV Export'}
        </h1>
        <p className="text-xs text-ink-500 mt-0.5">
          {isTe
            ? 'విశ్లేషణ మరియు ఆడిట్ కోసం ప్లాట్‌ఫారమ్ ఆర్డర్లు మరియు దుకాణాల వివరాలను CSV ఫైల్స్‌గా డౌన్‌లోడ్ చేసుకోండి'
            : 'Download raw platform datasets, audit order histories, and analyze store performance'}
        </p>
      </div>

      {/* Export Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Orders Report Card */}
        <Card className="p-6 bg-white border border-ink-200 rounded-3xl shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-100 text-primary-700 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 stroke-[2]" />
            </div>

            <div>
              <h2 className="text-base font-extrabold text-ink-900">
                {isTe ? 'అన్ని ఆర్డర్ల సమగ్ర నివేదిక' : 'Master Orders Report'}
              </h2>
              <p className="text-xs text-ink-600 mt-1 leading-relaxed">
                {isTe
                  ? 'ప్రతి ఆర్డర్ సంఖ్య, తేదీ, దుకాణం పేరు, కస్టమర్ వివరాలు, డెలివరీ రుసుము, మొత్తం విలువ, చెల్లింపు విధానం మరియు చివరి స్థితితో కూడిన పూర్తి జాబితా.'
                  : 'Comprehensive order ledger including Order No, store, customer details, fulfilment type, itemized subtotal, delivery fees, payment status, and final lifecycle state.'}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-ink-50 border border-ink-200 text-[11px] text-ink-600 space-y-1">
              <span className="font-bold text-ink-800 block uppercase tracking-wider text-[10px]">
                Included CSV Fields:
              </span>
              <p>
                Order No • Date • Store Name • Customer Name • Phone • Fulfilment • Subtotal •
                Delivery Fee • Total (₹) • Payment Method • Status
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={downloadingOrders}
            onClick={() => downloadCsv('orders')}
            className="w-full font-black text-sm min-h-[48px] shadow-sm flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>
              {downloadingOrders
                ? isTe
                  ? 'డౌన్‌లోడ్ అవుతోంది...'
                  : 'Generating CSV...'
                : isTe
                  ? 'ఆర్డర్ల CSV డౌన్‌లోడ్ చేయండి'
                  : 'Download Orders CSV'}
            </span>
          </Button>
        </Card>

        {/* 2. Stores Directory Report Card */}
        <Card className="p-6 bg-white border border-ink-200 rounded-3xl shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-accent-100 text-accent-700 flex items-center justify-center">
              <Store className="w-6 h-6 stroke-[2]" />
            </div>

            <div>
              <h2 className="text-base font-extrabold text-ink-900">
                {isTe ? 'దుకాణాల డైరెక్టరీ నివేదిక' : 'Stores Directory Report'}
              </h2>
              <p className="text-xs text-ink-600 mt-1 leading-relaxed">
                {isTe
                  ? 'ప్లాట్‌ఫారమ్‌లోని అన్ని కిరాణా దుకాణాలు, యజమాని వివరాలు, చిరునామా, డెలివరీ పరిధి, రేటింగ్స్ మరియు ప్రస్తుత ఆమోద స్థితితో కూడిన రికార్డు.'
                  : 'Complete registry of registered kirana stores, owner contact details, geographical coordinates, delivery radius, ratings, and operating flags.'}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-ink-50 border border-ink-200 text-[11px] text-ink-600 space-y-1">
              <span className="font-bold text-ink-800 block uppercase tracking-wider text-[10px]">
                Included CSV Fields:
              </span>
              <p>
                Store Name • Owner Name • Phone • Address • Pincode • Status • Is Open • Radius (km)
                • Delivery Fee • Min Order • Rating Avg • Rating Count
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={downloadingStores}
            onClick={() => downloadCsv('stores')}
            className="w-full font-black text-sm min-h-[48px] shadow-sm flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>
              {downloadingStores
                ? isTe
                  ? 'డౌన్‌లోడ్ అవుతోంది...'
                  : 'Generating CSV...'
                : isTe
                  ? 'దుకాణాల CSV డౌన్‌లోడ్ చేయండి'
                  : 'Download Stores CSV'}
            </span>
          </Button>
        </Card>
      </div>
    </div>
  );
};
