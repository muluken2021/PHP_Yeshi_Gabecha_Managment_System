import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import {
  getAdminBookingsOverTime,
  getAdminDashboardMetrics,
  getAdminRevenueOverTime,
  getAdminUserGrowthOverTime,
} from '../../api/reports.js';
import { getAdminEventStats } from '../../api/eventStats.js';

const TABS = ['overview', 'bookings', 'revenue', 'users', 'events'];
const RANGES = ['week', 'month', 'quarter', 'year', 'custom'];
const COLORS = ['#8B5CF6', '#06B6D4', '#F59E0B', '#10B981', '#EF4444', '#3B82F6'];

const formatETB = (v) => `ETB ${Number(v || 0).toLocaleString()}`;

const rangeToGroupBy = (r) =>
  ({ week: 'day', month: 'day', quarter: 'week', year: 'month' }[r] ?? 'day');

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="p-3 bg-white border border-gray-200 rounded shadow-md dark:bg-gray-800 dark:border-gray-700">
      <p className="font-medium text-gray-800 dark:text-gray-200 mb-1">{label}</p>
      {payload.map((e, i) => (
        <p key={i} className="text-sm" style={{ color: e.color }}>
          {e.name}: {e.dataKey === 'revenue' ? formatETB(e.value) : e.value}
        </p>
      ))}
    </div>
  );
};

const KpiCard = ({ label, value, color }) => (
  <div className={`flex flex-col p-4 bg-white rounded-lg shadow-xs dark:bg-gray-800 border-l-4 ${color}`}>
    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</p>
    <p className="text-2xl font-semibold text-gray-700 dark:text-gray-200">{value}</p>
  </div>
);

const ChartCard = ({ title, children }) => (
  <div className="min-w-0 p-4 bg-white rounded-lg shadow-xs dark:bg-gray-800">
    <h4 className="mb-4 font-semibold text-gray-800 dark:text-gray-300">{title}</h4>
    <div className="h-72">{children}</div>
  </div>
);

const Reports = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [range, setRange] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [metrics, setMetrics] = useState({});
  const [bookingData, setBookingData] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [userGrowthData, setUserGrowthData] = useState([]);
  const [eventStats, setEventStats] = useState({ ticketCounts: [], eventBreakdown: [] });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const buildParams = useCallback(() => {
    const groupBy = rangeToGroupBy(range);
    if (range === 'custom' && customStart && customEnd) {
      return { groupBy, startDate: customStart, endDate: customEnd };
    }
    return { groupBy, range: range !== 'custom' ? range : undefined };
  }, [range, customStart, customEnd]);

  useEffect(() => {
    if (range === 'custom' && (!customStart || !customEnd)) return;
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const params = buildParams();
        const [m, bookings, revenue, userGrowth, evStats] = await Promise.all([
          getAdminDashboardMetrics(),
          getAdminBookingsOverTime(params),
          getAdminRevenueOverTime(params),
          getAdminUserGrowthOverTime(params),
          getAdminEventStats(),
        ]);
        if (!active) return;
        setMetrics(m?.totals || {});
        setBookingData(
          Array.isArray(bookings)
            ? bookings.map((r) => ({ name: String(r.period ?? ''), bookings: Number(r.count || 0) }))
            : []
        );
        setRevenueData(
          Array.isArray(revenue)
            ? revenue.map((r) => ({ name: String(r.period ?? ''), revenue: Number(r.revenue || 0), transactions: Number(r.transactions || 0) }))
            : []
        );
        setUserGrowthData(
          Array.isArray(userGrowth)
            ? userGrowth.map((r) => ({ name: String(r.period ?? ''), users: Number(r.count || 0) }))
            : []
        );
        setEventStats({
          ticketCounts: Array.isArray(evStats?.ticketCounts) ? evStats.ticketCounts : [],
          eventBreakdown: Array.isArray(evStats?.eventBreakdown) ? evStats.eventBreakdown : [],
          totalTickets: evStats?.totalTickets || 0,
          totalRevenue: evStats?.totalRevenue || 0,
        });
      } catch (e) {
        if (!active) return;
        setError(e?.message || 'Failed to load report data');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [buildParams, range, customStart, customEnd]);

  const exportCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Users', metrics.users ?? 0],
      ['Bookings', metrics.bookings ?? 0],
      ['Revenue (ETB)', metrics.revenue ?? 0],
      ['Services', metrics.services ?? 0],
      ['Events', metrics.events ?? 0],
      ['Pending Payments', metrics.pendingPayments ?? 0],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${range}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => window.print();

  const tabLabel = (tab) =>
    ({ overview: t('overview') || 'Overview', bookings: t('bookings') || 'Bookings', revenue: t('revenue') || 'Revenue', users: t('users') || 'Users', events: t('events') || 'Events' }[tab]);

  const rangeLabel = (r) =>
    ({ week: t('this_week') || 'Week', month: t('this_month') || 'Month', quarter: t('this_quarter') || 'Quarter', year: t('this_year') || 'Year', custom: t('custom') || 'Custom' }[r]);

  const kpis = [
    { label: t('total_users') || 'Total Users', value: Number(metrics.users || 0).toLocaleString(), color: 'border-blue-500' },
    { label: t('total_bookings') || 'Total Bookings', value: Number(metrics.bookings || 0).toLocaleString(), color: 'border-green-500' },
    { label: t('total_revenue') || 'Total Revenue', value: formatETB(metrics.revenue), color: 'border-purple-500' },
    { label: t('services') || 'Services', value: Number(metrics.services || 0).toLocaleString(), color: 'border-teal-500' },
    { label: t('events') || 'Events', value: Number(metrics.events || 0).toLocaleString(), color: 'border-yellow-500' },
    { label: t('pending_payments') || 'Pending Payments', value: Number(metrics.pendingPayments || 0).toLocaleString(), color: 'border-red-500' },
  ];

  return (
    <div className="container px-6 mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 my-6">
        <h1 className="text-2xl font-semibold text-gray-700 dark:text-gray-200">
          {t('reports') || 'Reports'}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-md dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 focus:outline-none focus:ring focus:border-purple-400"
          >
            {RANGES.map((r) => <option key={r} value={r}>{rangeLabel(r)}</option>)}
          </select>
          {range === 'custom' && (
            <>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-md dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 focus:outline-none focus:ring focus:border-purple-400" />
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-md dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 focus:outline-none focus:ring focus:border-purple-400" />
            </>
          )}
          <button onClick={exportCSV}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors">
            {t('export_csv') || 'Export CSV'}
          </button>
          <button onClick={exportPDF}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 transition-colors">
            {t('export_pdf') || 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="w-full p-4 mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:text-red-200 dark:border-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}>
            {tabLabel(tab)}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              <div className="grid gap-4 mb-8 sm:grid-cols-2 xl:grid-cols-3">
                {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <ChartCard title={t('bookings_over_time') || 'Bookings Over Time'}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={bookingData}>
                      <defs>
                        <linearGradient id="bGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area type="monotone" dataKey="bookings" stroke="#8B5CF6" fill="url(#bGrad)" strokeWidth={2} name={t('bookings') || 'Bookings'} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title={t('revenue_over_time') || 'Revenue Over Time'}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueData}>
                      <defs>
                        <linearGradient id="rGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `ETB ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area type="monotone" dataKey="revenue" stroke="#06B6D4" fill="url(#rGrad)" strokeWidth={2} name={t('revenue') || 'Revenue'} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </>
          )}

          {/* Bookings Tab */}
          {activeTab === 'bookings' && (
            <div className="grid gap-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-2">
                <KpiCard label={t('total_bookings') || 'Total Bookings'} value={Number(metrics.bookings || 0).toLocaleString()} color="border-green-500" />
                <KpiCard label={t('pending_bookings') || 'Pending Bookings'} value={Number(metrics.pendingBookings || 0).toLocaleString()} color="border-yellow-500" />
                <KpiCard label={t('avg_booking_value') || 'Avg Booking Value'} value={metrics.bookings ? formatETB(Math.round((metrics.revenue || 0) / metrics.bookings)) : formatETB(0)} color="border-purple-500" />
              </div>
              <ChartCard title={t('bookings_over_time') || 'Bookings Over Time'}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={bookingData}>
                    <defs>
                      <linearGradient id="bGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="bookings" stroke="#10B981" fill="url(#bGrad2)" strokeWidth={2} name={t('bookings') || 'Bookings'} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          )}

          {/* Revenue Tab */}
          {activeTab === 'revenue' && (
            <div className="grid gap-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-2">
                <KpiCard label={t('total_revenue') || 'Total Revenue'} value={formatETB(metrics.revenue)} color="border-purple-500" />
                <KpiCard label={t('pending_payments') || 'Pending Payments'} value={Number(metrics.pendingPayments || 0).toLocaleString()} color="border-red-500" />
                <KpiCard label={t('transactions') || 'Transactions'} value={revenueData.reduce((s, r) => s + r.transactions, 0).toLocaleString()} color="border-blue-500" />
              </div>
              <ChartCard title={t('revenue_over_time') || 'Revenue Over Time'}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="rGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `ETB ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" stroke="#8B5CF6" fill="url(#rGrad2)" strokeWidth={2} name={t('revenue') || 'Revenue'} />
                    <Area type="monotone" dataKey="transactions" stroke="#F59E0B" fill="none" strokeWidth={2} strokeDasharray="4 2" name={t('transactions') || 'Transactions'} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="grid gap-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-2">
                <KpiCard label={t('total_users') || 'Total Users'} value={Number(metrics.users || 0).toLocaleString()} color="border-blue-500" />
                <KpiCard label={t('new_users') || 'New Users (period)'} value={userGrowthData.reduce((s, r) => s + r.users, 0).toLocaleString()} color="border-teal-500" />
              </div>
              <ChartCard title={t('user_growth') || 'User Growth Over Time'}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={userGrowthData}>
                    <defs>
                      <linearGradient id="uGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="users" stroke="#F59E0B" fill="url(#uGrad)" strokeWidth={2} name={t('new_users') || 'New Users'} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          )}

          {/* Events Tab */}
          {activeTab === 'events' && (
            <div className="grid gap-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-2">
                <KpiCard label={t('total_events') || 'Total Events'} value={Number(metrics.events || 0).toLocaleString()} color="border-yellow-500" />
                <KpiCard label={t('tickets_sold') || 'Tickets Sold'} value={Number(eventStats.totalTickets || 0).toLocaleString()} color="border-green-500" />
                <KpiCard label={t('event_revenue') || 'Event Revenue'} value={formatETB(eventStats.totalRevenue)} color="border-purple-500" />
              </div>

              {/* Ticket sales bar chart */}
              {eventStats.ticketCounts.length > 0 && (
                <ChartCard title={t('ticket_sales_by_event') || 'Ticket Sales by Event'}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={eventStats.ticketCounts} margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="tickets" name={t('tickets') || 'Tickets'} radius={[6, 6, 0, 0]}>
                        {eventStats.ticketCounts.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {/* Event breakdown table */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xs overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-300">
                    {t('event_breakdown') || 'Event Breakdown'}
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                    <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                      <tr>
                        <th className="px-4 py-3">{t('event_title') || 'Event'}</th>
                        <th className="px-4 py-3">{t('date') || 'Date'}</th>
                        <th className="px-4 py-3 text-right">{t('tickets_sold') || 'Tickets Sold'}</th>
                        <th className="px-4 py-3 text-right">{t('revenue') || 'Revenue'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventStats.eventBreakdown.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-gray-400 dark:text-gray-500">
                            {t('no_data') || 'No data available'}
                          </td>
                        </tr>
                      ) : (
                        eventStats.eventBreakdown.map((ev) => (
                          <tr key={ev.eventId} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{ev.title}</td>
                            <td className="px-4 py-3">{ev.eventDate ? new Date(ev.eventDate).toLocaleDateString() : '—'}</td>
                            <td className="px-4 py-3 text-right">
                              {Number(ev.soldTickets || 0).toLocaleString()}
                              {ev.totalTickets ? <span className="text-gray-400 dark:text-gray-500"> / {Number(ev.totalTickets).toLocaleString()}</span> : null}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-green-600 dark:text-green-400">{formatETB(ev.revenue)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Reports;
