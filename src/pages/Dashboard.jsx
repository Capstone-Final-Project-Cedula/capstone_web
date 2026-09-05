import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { formsAPI } from '../api/forms';
import {
  Activity,
  Banknote,
  CalendarDays,
  Clock,
  FileText,
  Inbox,
  Keyboard,
  LayoutDashboard,
  Layers,
  MapPinned,
  Mic,
  PieChart,
  Plus,
  QrCode,
  TrendingUp,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonStatCard, SkeletonLine } from '../components/ui/Skeleton';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat('en-PH');

const chartColors = {
  primary: '#3B4BC4',
  voice: '#0F8B7C',
  qr: '#B5670A',
  info: '#1D6FB8',
};

const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 600, easing: 'easeOutQuart' },
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        boxWidth: 10,
        boxHeight: 10,
        usePointStyle: true,
        color: '#4C5366',
        font: { family: 'Inter', size: 12 },
        padding: 16,
      },
    },
    tooltip: {
      backgroundColor: '#14161C',
      titleFont: { family: 'Inter', size: 12, weight: '600' },
      bodyFont: { family: 'Inter', size: 12 },
      padding: 10,
      cornerRadius: 8,
      displayColors: false,
    },
  },
};

const axisOptions = {
  ...baseChartOptions,
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#6B7386', font: { family: 'Inter', size: 11 }, maxRotation: 0 },
    },
    y: {
      beginAtZero: true,
      grid: { color: '#EEF0F3' },
      ticks: {
        color: '#6B7386',
        precision: 0,
        font: { family: 'Inter', size: 11 },
      },
    },
  },
};

// Presentational-only helper: maps an input method string to an icon + color
// treatment. Falls back gracefully for any value the backend sends.
const METHOD_META = {
  voice: { icon: Mic, bg: 'bg-[var(--color-success-light)]', text: 'text-[var(--color-success)]' },
  qr: { icon: QrCode, bg: 'bg-[var(--color-qr-light)]', text: 'text-[var(--color-qr)]' },
  manual: { icon: Keyboard, bg: 'bg-[var(--color-info-light)]', text: 'text-[var(--color-info)]' },
};

const getMethodMeta = (method) => {
  const key = (method || '').toLowerCase();
  return METHOD_META[key] || { icon: FileText, bg: 'bg-[var(--color-neutral-50)]', text: 'text-[var(--color-neutral-600)]' };
};

const ChartCard = ({ title, icon: Icon, iconBg, iconTone, children, empty = false, style }) => (
  <Card
    className="group p-6 min-h-[320px] transition-shadow duration-200 hover:shadow-[var(--shadow-md,0_8px_24px_rgba(20,22,28,0.08))] animate-rise-in"
    style={style}
  >
    <div className="flex items-center gap-3 pb-4 mb-5 border-b border-[var(--color-neutral-100)]">
      {Icon && (
        <div
          className={`${iconBg} w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105`}
        >
          <Icon className={`w-[18px] h-[18px] ${iconTone}`} aria-hidden="true" />
        </div>
      )}
      <h3 className="font-display text-base font-semibold tracking-tight text-[var(--color-neutral-800)]">
        {title}
      </h3>
    </div>
    {empty ? (
      <EmptyState
        icon={Inbox}
        title="No analytics yet"
        description="Charts will update as CTCs are issued."
      />
    ) : (
      <div className="h-64">{children}</div>
    )}
  </Card>
);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await formsAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const dailyData = stats?.daily_data || [];
  const monthlyData = stats?.monthly_data || [];
  const inputMethods = stats?.input_method_breakdown || [];
  const taxBreakdown = stats?.tax_classification_breakdown || [];
  const topBarangays = stats?.top_barangays || [];
  const recentActivity = stats?.recent_activity || [];
  const hasIssuedRecords = (stats?.total_issued || 0) > 0;

  const statsCards = [
    {
      title: 'Total Issued',
      value: numberFormatter.format(stats?.total_issued || 0),
      icon: FileText,
      tone: 'text-[var(--color-primary)]',
      bg: 'bg-[var(--color-primary-light)]',
    },
    {
      title: "Today's Applications",
      value: numberFormatter.format(stats?.today_issued || 0),
      icon: CalendarDays,
      tone: 'text-[var(--color-success)]',
      bg: 'bg-[var(--color-success-light)]',
    },
    {
      title: 'Total Revenue',
      value: currencyFormatter.format(stats?.total_revenue || 0),
      icon: Banknote,
      tone: 'text-[var(--color-info)]',
      bg: 'bg-[var(--color-info-light)]',
    },
    {
      title: 'Average Paid',
      value: currencyFormatter.format(stats?.average_paid || 0),
      icon: TrendingUp,
      tone: 'text-[var(--color-qr)]',
      bg: 'bg-[var(--color-qr-light)]',
    },
  ];

  const dailyTrendChart = {
    labels: dailyData.map((item) =>
      new Date(`${item.date}T00:00:00`).toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
      })
    ),
    datasets: [
      {
        label: 'Issued',
        data: dailyData.map((item) => item.count),
        borderColor: chartColors.primary,
        backgroundColor: 'rgba(59, 75, 196, 0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: chartColors.primary,
        pointHoverBackgroundColor: '#FFFFFF',
        pointHoverBorderColor: chartColors.primary,
        pointHoverBorderWidth: 2,
      },
    ],
  };

  const monthlyRevenueChart = {
    labels: monthlyData.map((item) => item.month),
    datasets: [
      {
        label: 'Revenue',
        data: monthlyData.map((item) => item.revenue),
        backgroundColor: chartColors.voice,
        hoverBackgroundColor: '#0B6E61',
        borderRadius: 8,
        maxBarThickness: 44,
      },
    ],
  };

  const inputMethodChart = {
    labels: inputMethods.map((item) => item.method),
    datasets: [
      {
        data: inputMethods.map((item) => item.count),
        backgroundColor: [chartColors.voice, chartColors.qr, chartColors.primary],
        hoverBackgroundColor: [chartColors.voice, chartColors.qr, chartColors.primary],
        hoverOffset: 6,
        borderColor: '#FFFFFF',
        borderWidth: 3,
      },
    ],
  };

  const taxClassChart = {
    labels: taxBreakdown.map((item) => `Class ${item.classification}`),
    datasets: [
      {
        label: 'Applicants',
        data: taxBreakdown.map((item) => item.count),
        backgroundColor: chartColors.info,
        hoverBackgroundColor: '#155A94',
        borderRadius: 8,
        maxBarThickness: 44,
      },
    ],
  };

  const barangayChart = {
    labels: topBarangays.map((item) => item.barangay),
    datasets: [
      {
        label: 'Issued',
        data: topBarangays.map((item) => item.count),
        backgroundColor: chartColors.qr,
        hoverBackgroundColor: '#8F5108',
        borderRadius: 8,
        maxBarThickness: 36,
      },
    ],
  };

  const revenueOptions = {
    ...axisOptions,
    scales: {
      ...axisOptions.scales,
      y: {
        ...axisOptions.scales.y,
        ticks: {
          ...axisOptions.scales.y.ticks,
          callback: (value) => compactCurrencyFormatter.format(value),
        },
      },
    },
    plugins: {
      ...axisOptions.plugins,
      tooltip: {
        ...axisOptions.plugins.tooltip,
        callbacks: {
          label: (context) => `Revenue: ${currencyFormatter.format(context.raw || 0)}`,
        },
      },
    },
  };

  const methodTotal = inputMethods.reduce((sum, item) => sum + item.count, 0);
  const hasTaxBreakdown = taxBreakdown.some((item) => item.count > 0);
  const hasBarangays = topBarangays.some((item) => item.count > 0);

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div className="flex items-start gap-3.5">
          <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-[var(--color-primary-light)] items-center justify-center shrink-0">
            <LayoutDashboard className="w-5 h-5 text-[var(--color-primary)]" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-neutral-900)]">
              Dashboard
            </h1>
            <p className="text-[var(--color-neutral-500)] mt-1 leading-relaxed">
              Welcome back — here's your real-time processing overview.
            </p>
          </div>
        </div>
        <Button icon={Plus} onClick={() => navigate('/new-application')}>
          New Application
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
          : statsCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <Card
                  key={card.title}
                  hoverable
                  className="group p-6 animate-rise-in transition-shadow duration-200"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold tracking-wide uppercase text-[var(--color-neutral-400)]">
                        {card.title}
                      </p>
                      <p className="font-display text-[1.7rem] leading-tight font-bold tabular-nums text-[var(--color-neutral-900)] mt-2 break-words">
                        {card.value}
                      </p>
                    </div>
                    <div
                      className={`${card.bg} w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3`}
                    >
                      <Icon className={`w-5 h-5 ${card.tone}`} aria-hidden="true" />
                    </div>
                  </div>
                </Card>
              );
            })}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="p-6 min-h-[320px]">
              <SkeletonLine width="40%" height="1.25rem" />
              <div className="space-y-4 mt-8">
                <SkeletonLine width="100%" height="2rem" />
                <SkeletonLine width="80%" height="2rem" />
                <SkeletonLine width="92%" height="2rem" />
                <SkeletonLine width="70%" height="2rem" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <ChartCard
              title="7-Day Issuance Trend"
              icon={Activity}
              iconBg="bg-[var(--color-primary-light)]"
              iconTone="text-[var(--color-primary)]"
              empty={!hasIssuedRecords}
              style={{ animationDelay: '0ms' }}
            >
              <Line data={dailyTrendChart} options={axisOptions} />
            </ChartCard>

            <ChartCard
              title="6-Month Revenue Trend"
              icon={Banknote}
              iconBg="bg-[var(--color-success-light)]"
              iconTone="text-[var(--color-success)]"
              empty={!hasIssuedRecords}
              style={{ animationDelay: '40ms' }}
            >
              <Bar data={monthlyRevenueChart} options={revenueOptions} />
            </ChartCard>

            <ChartCard
              title="Input Method Mix"
              icon={PieChart}
              iconBg="bg-[var(--color-qr-light)]"
              iconTone="text-[var(--color-qr)]"
              empty={methodTotal === 0}
              style={{ animationDelay: '80ms' }}
            >
              <div className="relative h-full">
                <Doughnut data={inputMethodChart} options={{ ...baseChartOptions, cutout: '68%' }} />
                {methodTotal > 0 && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center -translate-y-3">
                    <span className="font-display text-2xl font-bold tabular-nums text-[var(--color-neutral-900)]">
                      {numberFormatter.format(methodTotal)}
                    </span>
                    <span className="text-xs text-[var(--color-neutral-500)]">Total</span>
                  </div>
                )}
              </div>
            </ChartCard>

            <ChartCard
              title="Tax Classification"
              icon={Layers}
              iconBg="bg-[var(--color-info-light)]"
              iconTone="text-[var(--color-info)]"
              empty={!hasTaxBreakdown}
              style={{ animationDelay: '120ms' }}
            >
              <Bar data={taxClassChart} options={axisOptions} />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-3">
              <ChartCard
                title="Top Barangays"
                icon={MapPinned}
                iconBg="bg-[var(--color-qr-light)]"
                iconTone="text-[var(--color-qr)]"
                empty={!hasBarangays}
                style={{ animationDelay: '160ms' }}
              >
                <Bar data={barangayChart} options={axisOptions} />
              </ChartCard>
            </div>

            <Card className="xl:col-span-2 p-6 animate-rise-in" style={{ animationDelay: '200ms' }}>
              <div className="flex items-center gap-3 pb-4 mb-2 border-b border-[var(--color-neutral-100)]">
                <div className="w-10 h-10 rounded-2xl bg-[var(--color-neutral-50)] flex items-center justify-center shrink-0">
                  <Clock className="w-[18px] h-[18px] text-[var(--color-neutral-600)]" aria-hidden="true" />
                </div>
                <h3 className="font-display text-base font-semibold tracking-tight text-[var(--color-neutral-800)]">
                  Recent Activity
                </h3>
              </div>
              {recentActivity.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="No recent activity"
                  description="Issued CTCs will show up here as staff process new applications."
                />
              ) : (
                <div className="divide-y divide-[var(--color-neutral-100)]">
                  {recentActivity.map((activity) => {
                    const meta = getMethodMeta(activity.input_method);
                    const MethodIcon = meta.icon;
                    return (
                      <div
                        key={activity.id}
                        className="group flex items-center gap-3 py-3.5 first:pt-1 last:pb-1 -mx-2 px-2 rounded-2xl transition-colors duration-150 hover:bg-[var(--color-neutral-50)]"
                      >
                        <div
                          className={`${meta.bg} w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105`}
                        >
                          <MethodIcon className={`w-4 h-4 ${meta.text}`} aria-hidden="true" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-[var(--color-neutral-900)] truncate">
                            {activity.applicant_name}
                          </p>
                          <p className="text-xs text-[var(--color-neutral-500)] mt-0.5 truncate">
                            {activity.ctc_number}
                            {activity.issued_at && (
                              <>
                                {' · '}
                                {new Date(activity.issued_at).toLocaleString('en-PH', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </>
                            )}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="font-semibold tabular-nums text-[var(--color-neutral-900)]">
                            {currencyFormatter.format(activity.amount_paid || 0)}
                          </p>
                          <p className={`text-[11px] font-medium mt-0.5 ${meta.text}`}>
                            {activity.input_method}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;