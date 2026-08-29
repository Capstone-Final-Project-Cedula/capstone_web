import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formsAPI } from '../api/forms';
import { FileText, CalendarDays, Mic, QrCode, Plus, Inbox } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonStatCard, SkeletonLine } from '../components/ui/Skeleton';

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

  const statsCards = [
    {
      title: 'Total Issued',
      value: stats?.total_issued || 0,
      icon: FileText,
      tone: 'text-[var(--color-primary)]',
      bg: 'bg-[var(--color-primary-light)]',
    },
    {
      title: "Today's Applications",
      value: stats?.today_issued || 0,
      icon: CalendarDays,
      tone: 'text-[var(--color-success)]',
      bg: 'bg-[var(--color-success-light)]',
    },
    {
      title: 'Voice Processed',
      value: stats?.voice_processed || 0,
      icon: Mic,
      tone: 'text-[var(--color-voice)]',
      bg: 'bg-[var(--color-voice-light)]',
    },
    {
      title: 'QR Processed',
      value: stats?.qr_processed || 0,
      icon: QrCode,
      tone: 'text-[var(--color-qr)]',
      bg: 'bg-[var(--color-qr-light)]',
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-neutral-900)]">
            Dashboard
          </h1>
          <p className="text-[var(--color-neutral-500)] mt-1">
            Welcome back! Here's your processing overview.
          </p>
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
                  key={index}
                  hoverable
                  className="p-6 animate-rise-in"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[var(--color-neutral-500)]">{card.title}</p>
                      <p className="font-display text-2xl font-bold text-[var(--color-neutral-900)] mt-1">
                        {card.value}
                      </p>
                    </div>
                    <div className={`${card.bg} w-11 h-11 rounded-[var(--radius-md)] flex items-center justify-center shrink-0`}>
                      <Icon className={`w-5 h-5 ${card.tone}`} aria-hidden="true" />
                    </div>
                  </div>
                </Card>
              );
            })}
      </div>

      <Card className="p-6">
        <h3 className="font-display text-base font-semibold text-[var(--color-neutral-800)] mb-1">
          Recent Activity
        </h3>
        {loading ? (
          <div className="space-y-3 mt-5">
            <SkeletonLine width="100%" height="1rem" />
            <SkeletonLine width="90%" height="1rem" />
            <SkeletonLine width="95%" height="1rem" />
          </div>
        ) : (
          <EmptyState
            icon={Inbox}
            title="No recent activity"
            description="Issued CTCs will show up here as staff process new applications."
          />
        )}
      </Card>
    </div>
  );
};

export default Dashboard;