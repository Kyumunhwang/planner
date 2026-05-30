'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import styles from './dashboard.module.css';
import CategoryChart from '@/components/Dashboard/CategoryChart';
import ExecutionRateChart from '@/components/Dashboard/ExecutionRateChart';
import AICoachCard from '@/components/Dashboard/AICoachCard';
import Leaderboard from '@/components/Dashboard/Leaderboard';
import type { StatsResponse, LeaderboardEntry } from '@/types';

type Period = 'week' | 'month';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [period, setPeriod] = useState<Period>('week');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Teacher & Student states
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [students, setStudents] = useState<{ user_id: string; email: string; name: string }[]>([]);

  const isTeacher = useMemo(() => {
    return session?.user?.email === 'kyumun.hwang@gmail.com';
  }, [session]);

  useEffect(() => {
    if (isTeacher) {
      fetch('/api/students')
        .then((res) => res.json())
        .then((data) => {
          if (data.students) {
            setStudents(data.students);
          }
        })
        .catch((err) => console.error('Failed to load students:', err));
    }
  }, [isTeacher]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const statsUrl = selectedStudentId
        ? `/api/stats?period=${period}&date=${today}&userId=${selectedStudentId}`
        : `/api/stats?period=${period}&date=${today}`;

      const [statsRes, leaderboardRes] = await Promise.all([
        fetch(statsUrl),
        fetch('/api/leaderboard'),
      ]);

      if (!statsRes.ok) {
        throw new Error('통계 데이터를 불러오는데 실패했습니다.');
      }

      const statsData: StatsResponse = await statsRes.json();
      setStats(statsData);

      if (leaderboardRes.ok) {
        const lbData = await leaderboardRes.json();
        setLeaderboardEntries(lbData.entries || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [period, selectedStudentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const summaryCards = stats
    ? [
        {
          icon: '📚',
          value: `${stats.totalStudyHours.toFixed(1)}h`,
          label: '총 학습시간',
          trend: null,
        },
        {
          icon: '✅',
          value: `${stats.executionRate}%`,
          label: '계획 이행률',
          trend: stats.executionRate >= 70 ? 'up' : stats.executionRate >= 40 ? null : 'down',
        },
        {
          icon: '🔥',
          value: `${stats.streak.currentStreak}일`,
          label: '연속 달성일',
          trend: stats.streak.todayCompleted ? 'up' : null,
        },
        {
          icon: '📊',
          value: `${stats.categoryCount}개`,
          label: '카테고리 수',
          trend: null,
        },
      ]
    : [];

  return (
    <div className={styles.dashboardContainer}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>대시보드</h1>
        <div className={styles.headerActions}>
          {isTeacher && (
            <div className={styles.studentFilter}>
              <label htmlFor="student-select" className={styles.filterLabel}>
                👨‍🏫 학생 모니터링:
              </label>
              <select
                id="student-select"
                className={styles.filterSelect}
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              >
                <option value="">나의 대시보드</option>
                {students.map((student) => (
                  <option key={student.user_id} value={student.user_id}>
                    {student.name} ({student.email})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className={styles.periodToggle}>
            <button
              className={`${styles.periodBtn} ${period === 'week' ? styles.periodBtnActive : ''}`}
              onClick={() => setPeriod('week')}
            >
              주간
            </button>
            <button
              className={`${styles.periodBtn} ${period === 'month' ? styles.periodBtnActive : ''}`}
              onClick={() => setPeriod('month')}
            >
              월간
            </button>
          </div>
        </div>
      </header>

      {/* Error State */}
      {error && (
        <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-xl)', borderColor: 'var(--accent-danger)' }}>
          <p style={{ color: 'var(--accent-danger)' }}>⚠️ {error}</p>
          <button
            onClick={fetchData}
            style={{
              marginTop: 'var(--space-md)',
              padding: 'var(--space-sm) var(--space-md)',
              background: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            다시 시도
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`glass-card skeleton ${styles.skeletonCard}`} />
            ))
          : summaryCards.map((card, i) => (
              <div key={i} className={`glass-card ${styles.summaryCard}`}>
                <div className={styles.cardIcon}>{card.icon}</div>
                <div className={styles.cardValue}>{card.value}</div>
                <div className={styles.cardLabel}>{card.label}</div>
                {card.trend && (
                  <div
                    className={`${styles.cardTrend} ${
                      card.trend === 'up' ? styles.trendUp : styles.trendDown
                    }`}
                  >
                    {card.trend === 'up' ? '▲' : '▼'}{' '}
                    {card.trend === 'up' ? '좋은 추세' : '개선 필요'}
                  </div>
                )}
              </div>
            ))}
      </div>

      {/* Charts Section */}
      <div className={styles.chartsGrid}>
        {loading ? (
          <>
            <div className={`glass-card skeleton ${styles.skeletonChart}`} />
            <div className={`glass-card skeleton ${styles.skeletonChart}`} />
          </>
        ) : stats ? (
          <>
            <CategoryChart data={stats.categoryBreakdown} />
            <ExecutionRateChart data={stats.dailyData} />
          </>
        ) : null}
      </div>

      {/* AI Coach Section */}
      <section className={styles.section}>
        <AICoachCard period={period} userId={selectedStudentId || undefined} />
      </section>

      {/* Leaderboard Section */}
      <section className={styles.section}>
        {loading ? (
          <div className={`glass-card skeleton ${styles.skeletonAI}`} />
        ) : (
          <Leaderboard entries={leaderboardEntries} />
        )}
      </section>
    </div>
  );
}
