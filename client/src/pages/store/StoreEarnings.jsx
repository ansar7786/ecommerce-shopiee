import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, TrendingUp, ShoppingBag, AlertTriangle, Award, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../../api/axios';
import { Card, Skeleton, EmptyState } from '../../components/ui';
import { formatPaise } from '../../utils/format';

export const StoreEarnings = () => {
  const { i18n } = useTranslation();
  const isTe = i18n.language === 'te';

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/store/analytics');
      setAnalytics(res.data.analytics);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load store earnings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const barChartData =
    analytics?.last7Days?.map((d) => ({
      date: d.date.slice(5), // 'MM-DD'
      orders: d.orders,
      revenue: Math.round(d.revenue / 100), // in Rs
    })) || [];

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <Skeleton className="h-8 w-44 rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-8">
        <EmptyState
          icon={AlertTriangle}
          title={isTe ? 'ఆదాయం వివరాలు లోడ్ కాలేదు' : 'Failed to Load Earnings'}
          description={error}
          actionLabel={isTe ? 'మళ్ళీ ప్రయత్నించండి' : 'Retry'}
          onAction={fetchAnalytics}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28 antialiased">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900 tracking-tight">
            {isTe ? 'దుకాణం ఆదాయం & గణాంకాలు' : 'Earnings & Analytics'}
          </h1>
          <p className="text-xs text-ink-500 mt-0.5">
            {isTe
              ? 'డెలివరీ అయిన ఆర్డర్ల అమ్మకాలు మరియు పనితీరు'
              : 'Revenue from delivered orders & sales metrics'}
          </p>
        </div>

        <button
          type="button"
          onClick={fetchAnalytics}
          className="p-2 text-ink-600 hover:text-ink-900 bg-white border border-ink-200 rounded-xl shadow-xs"
          aria-label="Refresh earnings"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Today's Revenue */}
        <Card className="p-3.5 bg-white border border-ink-200 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400">
              {isTe ? 'నేటి ఆదాయం' : "Today's Revenue"}
            </span>
            <Wallet className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-black text-ink-900">
            {formatPaise(analytics?.todayRevenue || 0)}
          </div>
          <span className="text-[10px] text-ink-400 block font-medium">
            {analytics?.todayOrders || 0} {isTe ? 'నేటి ఆర్డర్లు' : 'orders placed'}
          </span>
        </Card>

        {/* This Week's Revenue */}
        <Card className="p-3.5 bg-white border border-ink-200 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-primary-600">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400">
              {isTe ? 'ఈ వారం ఆదాయం' : 'This Week'}
            </span>
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-black text-ink-900">
            {formatPaise(analytics?.thisWeekRevenue || 0)}
          </div>
          <span className="text-[10px] text-ink-400 block font-medium">
            {isTe ? 'గత 7 రోజుల మొత్తం' : 'Last 7 days delivered'}
          </span>
        </Card>

        {/* Today's Orders */}
        <Card className="p-3.5 bg-white border border-ink-200 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-accent-600">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400">
              {isTe ? 'నేటి ఆర్డర్లు' : "Today's Orders"}
            </span>
            <ShoppingBag className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-black text-ink-900">{analytics?.todayOrders || 0}</div>
          <span className="text-[10px] text-emerald-700 block font-bold">
            {isTe ? 'ప్రత్యక్ష వ్యాపారం' : 'Live incoming'}
          </span>
        </Card>

        {/* Cancelled / Rejected */}
        <Card className="p-3.5 bg-white border border-ink-200 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-red-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400">
              {isTe ? 'రద్దు / తిరస్కరణ' : 'Lost Orders'}
            </span>
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-black text-ink-900">
            {analytics?.rejectedCancelledCount || 0}
          </div>
          <span className="text-[10px] text-ink-400 block font-medium">
            {isTe ? 'రద్దు చేయబడినవి' : 'Rejected / cancelled'}
          </span>
        </Card>
      </div>

      {/* 7-Day Revenue Bar Chart */}
      <Card className="p-4 bg-white border border-ink-200 rounded-2xl shadow-xs space-y-3">
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-ink-900">
            {isTe ? 'గత 7 రోజుల అమ్మకాల చార్ట్ (₹)' : 'Last 7 Days Sales Trend (₹)'}
          </h2>
          <p className="text-[10px] text-ink-400">
            {isTe ? 'రోజువారీ ఆదాయం' : 'Delivered revenue in Rupees'}
          </p>
        </div>

        <div className="h-48 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6B7280' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
              <Tooltip
                formatter={(val) => [`₹${val}`, isTe ? 'ఆదాయం' : 'Revenue']}
                contentStyle={{
                  backgroundColor: '#111827',
                  borderRadius: '10px',
                  color: '#fff',
                  border: 'none',
                  fontSize: '11px',
                }}
              />
              <Bar dataKey="revenue" fill="#15803D" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Top 5 Best Selling Items */}
      <Card className="p-4 bg-white border border-ink-200 rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center gap-1.5">
          <Award className="w-4 h-4 text-accent-600" />
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-ink-900">
            {isTe ? 'అత్యధికంగా అమ్ముడైన 5 వస్తువులు' : 'Top 5 Best-Selling Items'}
          </h2>
        </div>

        {analytics?.topItems?.length === 0 ? (
          <p className="text-xs text-ink-400 py-3 text-center font-medium">
            {isTe ? 'ఇంకా డెలివరీ ఆర్డర్లు లేవు' : 'No delivered product sales yet'}
          </p>
        ) : (
          <div className="divide-y divide-ink-100">
            {analytics?.topItems?.map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-ink-100 text-ink-700 font-black text-[10px] flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-extrabold text-ink-900 truncate">
                      {isTe && item.nameTe ? item.nameTe : item.name}
                    </p>
                    <p className="text-[10px] text-ink-400 font-medium">
                      {item.qty} {isTe ? 'అమ్మబడ్డాయి' : 'units sold'}
                    </p>
                  </div>
                </div>

                <span className="font-black text-ink-900 shrink-0">
                  {formatPaise(item.revenue)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
