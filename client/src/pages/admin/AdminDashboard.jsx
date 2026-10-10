import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Store,
  ShoppingBag,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import api from '../../api/axios';
import { Card, Button, Skeleton, Badge, EmptyState } from '../../components/ui';
import { formatPaise } from '../../utils/format';

const STATUS_COLORS = {
  PLACED: '#3B82F6',
  ACCEPTED: '#8B5CF6',
  PACKING: '#F59E0B',
  READY: '#EC4899',
  OUT_FOR_DELIVERY: '#06B6D4',
  DELIVERED: '#10B981',
  REJECTED: '#EF4444',
  CANCELLED: '#6B7280',
  EXPIRED: '#9CA3AF',
  AWAITING_CUSTOMER: '#F97316',
};

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isTe = i18n.language === 'te';

  const [stats, setStats] = useState(null);
  const [pendingStores, setPendingStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, storesRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/stores?status=pending'),
      ]);
      setStats(statsRes.data.stats);
      setPendingStores(storesRes.data.stores || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Format Recharts data
  const lineChartData =
    stats?.last14Days?.map((d) => ({
      date: d.date.slice(5), // 'MM-DD'
      orders: d.count,
      gmv: Math.round(d.gmv / 100), // in Rs
    })) || [];

  const pieChartData = stats?.ordersByStatus
    ? Object.entries(stats.ordersByStatus).map(([status, count]) => ({
        name: status,
        value: count,
        color: STATUS_COLORS[status] || '#6B7280',
      }))
    : [];

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto pt-12">
        <EmptyState
          icon={AlertCircle}
          title={isTe ? 'డేటా లోడ్ చేయడం విఫలమైంది' : 'Failed to Load Metrics'}
          description={error}
          actionLabel={isTe ? 'మళ్ళీ ప్రయత్నించండి' : 'Retry'}
          onAction={fetchDashboardData}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 antialiased">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink-900 tracking-tight">
            {isTe ? 'అడ్మిన్ డాష్‌బోర్డ్' : 'Admin Overview'}
          </h1>
          <p className="text-xs text-ink-500 mt-0.5">
            {isTe
              ? 'కిరాణా ప్లాట్‌ఫారమ్ ముఖ్య గణాంకాలు మరియు ఆర్డర్ విశ్లేషణ'
              : 'Real-time performance indicators and platform analytics'}
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={fetchDashboardData}
          className="text-xs font-bold self-start sm:self-auto flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isTe ? 'రిఫ్రెష్' : 'Refresh'}</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total GMV */}
        <Card className="p-4 bg-white border border-ink-200 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-xs font-extrabold uppercase tracking-wider text-ink-500">
              {isTe ? 'మొత్తం అమ్మకాలు (GMV)' : 'Gross Sales (GMV)'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-ink-900 tracking-tight">
            {formatPaise(stats?.gmv || 0)}
          </div>
          <span className="text-[11px] text-ink-500 block font-medium">
            {isTe ? 'డెలివరీ అయిన ఆర్డర్ల మొత్తం' : 'Delivered orders only'}
          </span>
        </Card>

        {/* Total Orders */}
        <Card className="p-4 bg-white border border-ink-200 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-primary-600">
            <span className="text-xs font-extrabold uppercase tracking-wider text-ink-500">
              {isTe ? 'మొత్తం ఆర్డర్లు' : 'Total Orders'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-ink-900 tracking-tight">
            {(stats?.totalOrders || 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-primary-700 font-bold block">
            {stats?.todayOrders || 0} {isTe ? 'ఈ రోజు వచ్చాయి' : 'placed today'}
          </span>
        </Card>

        {/* Stores (Approved & Pending) */}
        <Card className="p-4 bg-white border border-ink-200 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-accent-600">
            <span className="text-xs font-extrabold uppercase tracking-wider text-ink-500">
              {isTe ? 'దుకాణాలు' : 'Kirana Stores'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-ink-900 tracking-tight">
            {stats?.stores?.approved || 0}
            <span className="text-xs font-semibold text-ink-400 ml-1.5">
              / {stats?.stores?.total || 0}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            {stats?.stores?.pending > 0 ? (
              <span className="font-extrabold text-amber-600">
                {stats.stores.pending} {isTe ? 'ఆమోదం కోసం పెండింగ్' : 'pending review'}
              </span>
            ) : (
              <span className="text-ink-500 font-medium">
                {isTe ? 'అన్నీ సమీక్షించబడ్డాయి' : 'All reviewed'}
              </span>
            )}
          </div>
        </Card>

        {/* Total Users */}
        <Card className="p-4 bg-white border border-ink-200 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-indigo-600">
            <span className="text-xs font-extrabold uppercase tracking-wider text-ink-500">
              {isTe ? 'వినియోగదారులు' : 'Total Users'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-ink-900 tracking-tight">
            {(stats?.totalUsers || 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-ink-500 block font-medium">
            {isTe ? 'నమోదైన కస్టమర్లు & యజమానులు' : 'Customers & Store Owners'}
          </span>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders Line Chart */}
        <Card className="lg:col-span-2 p-5 bg-white border border-ink-200 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-ink-900">
                {isTe ? 'గత 14 రోజుల ఆర్డర్ల తీరు' : '14-Day Order Volume'}
              </h2>
              <p className="text-[11px] text-ink-500">
                {isTe ? 'రోజువారీ ఆర్డర్ల సంఖ్య' : 'Daily placed orders trend'}
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                <Tooltip
                  formatter={(value) => [`${value} orders`, 'Orders']}
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderRadius: '12px',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="#15803D"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#15803D' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Status Distribution Pie Chart */}
        <Card className="p-5 bg-white border border-ink-200 rounded-2xl shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-extrabold text-ink-900">
              {isTe ? 'ఆర్డర్ స్థితి విభాగాలు' : 'Order Status Breakdown'}
            </h2>
            <p className="text-[11px] text-ink-500">
              {isTe ? 'వివిధ స్థితులలో ఉన్న ఆర్డర్లు' : 'Distribution across statuses'}
            </p>
          </div>

          <div className="h-64 w-full">
            {pieChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-ink-400 font-semibold">
                {isTe ? 'ఆర్డర్ డేటా అందుబాటులో లేదు' : 'No order data available'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      borderRadius: '12px',
                      color: '#fff',
                      border: 'none',
                      fontSize: '11px',
                    }}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Pending Store Approvals Widget */}
      <Card className="p-5 bg-white border border-ink-200 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-ink-900">
                {isTe ? 'ఆమోదం కోసం పెండింగ్ ఉన్న దుకాణాలు' : 'Pending Store Approvals'}
              </h2>
              <p className="text-[11px] text-ink-500">
                {pendingStores.length}{' '}
                {isTe ? 'దుకాణాల దరఖాస్తులు సమీక్షించవలసి ఉంది' : 'stores waiting for verification'}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/stores')}
            className="text-xs font-bold text-primary-700 hover:text-primary-800 flex items-center gap-1"
          >
            <span>{isTe ? 'అన్నీ చూడండి' : 'View All'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {pendingStores.length === 0 ? (
          <div className="py-6 text-center text-xs text-ink-400 font-semibold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>{isTe ? 'పెండింగ్ దరఖాస్తులు ఏవీ లేవు' : 'No pending store applications'}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {pendingStores.slice(0, 3).map((st) => (
              <div
                key={st._id}
                onClick={() => navigate('/admin/stores')}
                className="p-3.5 rounded-xl border border-ink-200 bg-ink-50/50 hover:bg-white hover:border-primary-400 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-ink-900 truncate">{st.name}</span>
                    <Badge variant="warning">{isTe ? 'పెండింగ్' : 'Pending'}</Badge>
                  </div>
                  <p className="text-[11px] text-ink-600 truncate mt-1">{st.address}</p>
                  <p className="text-[10px] text-ink-400 mt-0.5 font-medium">
                    {st.phone} • {st.deliveryRadiusKm} km
                  </p>
                </div>
                <div className="text-[11px] font-bold text-primary-600 flex items-center gap-1 pt-1">
                  <span>{isTe ? 'సమీక్షించండి' : 'Review Application'}</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
