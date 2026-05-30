'use client';

import { useState, useEffect } from 'react';
import type { AIAnalysis } from '@/types';

interface AICoachCardProps {
  period: 'week' | 'month';
  userId?: string;
}

export default function AICoachCard({ period, userId }: AICoachCardProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset analysis on student or period change
  useEffect(() => {
    setAnalysis(null);
    setError(null);
  }, [userId, period]);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period, userId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'AI 분석에 실패했습니다.');
      }

      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : '분석에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'improving':
        return { icon: '📈', label: '향상 중', color: 'var(--accent-success)' };
      case 'declining':
        return { icon: '📉', label: '하락 중', color: 'var(--accent-danger)' };
      default:
        return { icon: '➡️', label: '유지 중', color: 'var(--accent-warn)' };
    }
  };

  return (
    <div
      className="glass-card"
      style={{
        padding: 'var(--space-lg)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Gradient accent border at top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary), var(--accent-tertiary))',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
        }}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <span style={{ fontSize: 'var(--text-2xl)' }}>✨</span>
          <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            AI 학습 코치
          </h3>
        </div>
        <button
          onClick={fetchAnalysis}
          disabled={loading}
          style={{
            padding: 'var(--space-sm) var(--space-lg)',
            background: loading ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            transition: 'all var(--transition-fast)',
            boxShadow: loading ? 'none' : '0 2px 12px rgba(var(--accent-primary-rgb), 0.3)',
          }}
        >
          {loading ? '분석 중...' : '리포트 생성'}
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="skeleton" style={{ height: 20, width: '80%' }} />
          <div className="skeleton" style={{ height: 20, width: '60%' }} />
          <div className="skeleton" style={{ height: 100 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="skeleton" style={{ height: 80 }} />
            <div className="skeleton" style={{ height: 80 }} />
          </div>
          <div className="skeleton" style={{ height: 60 }} />
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
          <p style={{ color: 'var(--accent-danger)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-md)' }}>
            ⚠️ {error}
          </p>
          <button
            onClick={fetchAnalysis}
            style={{
              padding: 'var(--space-sm) var(--space-lg)',
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

      {/* Analysis Results */}
      {analysis && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          {/* Summary */}
          <div>
            <p style={{
              fontSize: 'var(--text-base)',
              color: 'var(--text-secondary)',
              lineHeight: 1.8,
              padding: 'var(--space-md)',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              borderLeft: '3px solid var(--accent-primary)',
            }}>
              {analysis.summary}
            </p>
          </div>

          {/* Focus Time Analysis */}
          <div>
            <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-sm)' }}>
              ⏰ 집중 시간대 분석
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div style={{
                padding: 'var(--space-md)',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--accent-success)', fontWeight: 600, marginBottom: 'var(--space-xs)' }}>
                  🟢 집중력 높은 시간
                </div>
                {analysis.focusTimeAnalysis.peakHours.map((h, i) => (
                  <div key={i} style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', padding: '2px 0' }}>
                    {h}
                  </div>
                ))}
              </div>
              <div style={{
                padding: 'var(--space-md)',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--accent-warn)', fontWeight: 600, marginBottom: 'var(--space-xs)' }}>
                  🟡 집중력 낮은 시간
                </div>
                {analysis.focusTimeAnalysis.lowHours.map((h, i) => (
                  <div key={i} style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', padding: '2px 0' }}>
                    {h}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Category Balance */}
          <div>
            <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-sm)' }}>
              📊 카테고리 밸런스
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {analysis.categoryBalance.map((cat, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-sm) var(--space-md)',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {cat.category}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {cat.percentage}%
                    </span>
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', maxWidth: '50%', textAlign: 'right' }}>
                    {cat.recommendation}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Execution Rate by Category */}
          <div>
            <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-sm)' }}>
              ✅ 카테고리별 이행률
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {analysis.executionRate.byCategory.map((cat, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', width: 80, flexShrink: 0 }}>
                    {cat.category}
                  </span>
                  <div style={{
                    flex: 1,
                    height: 8,
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden',
                  }}>
                    <div
                      style={{
                        width: `${Math.min(cat.rate, 100)}%`,
                        height: '100%',
                        background: cat.rate >= 70
                          ? 'var(--accent-success)'
                          : cat.rate >= 40
                            ? 'var(--accent-warn)'
                            : 'var(--accent-danger)',
                        borderRadius: 'var(--radius-full)',
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', width: 40, textAlign: 'right' }}>
                    {cat.rate}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Suggestions */}
          <div>
            <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-sm)' }}>
              💡 학습 제안
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {analysis.suggestions.map((suggestion, i) => (
                <li
                  key={i}
                  style={{
                    padding: 'var(--space-sm) var(--space-md)',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                    borderLeft: '3px solid var(--accent-secondary)',
                    lineHeight: 1.6,
                  }}
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>

          {/* Weekly Trend */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-sm)',
            padding: 'var(--space-md)',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
          }}>
            {(() => {
              const trend = getTrendIcon(analysis.weeklyTrend);
              return (
                <>
                  <span style={{ fontSize: 'var(--text-2xl)' }}>{trend.icon}</span>
                  <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: trend.color }}>
                    {period === 'week' ? '주간' : '월간'} 추세: {trend.label}
                  </span>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Initial state */}
      {!analysis && !loading && !error && (
        <div style={{
          textAlign: 'center',
          padding: 'var(--space-2xl)',
          color: 'var(--text-muted)',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🤖</div>
          <p style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-sm)' }}>
            AI가 학습 패턴을 분석하고 맞춤형 코칭을 제공합니다
          </p>
          <p style={{ fontSize: 'var(--text-sm)' }}>
            위의 &apos;리포트 생성&apos; 버튼을 클릭하세요
          </p>
        </div>
      )}
    </div>
  );
}
