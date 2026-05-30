'use client';

import type { LeaderboardEntry } from '@/types';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

function getMedalEmoji(rank: number): string {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return '';
  }
}

function getAvatar(name: string, image?: string): React.ReactNode {
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--radius-full)',
          objectFit: 'cover',
        }}
      />
    );
  }

  // Generate avatar from name initials
  const initial = name.charAt(0).toUpperCase();
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hue = hash % 360;

  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 'var(--radius-full)',
        background: `linear-gradient(135deg, hsl(${hue}, 60%, 50%), hsl(${(hue + 40) % 360}, 60%, 40%))`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--text-base)',
        fontWeight: 700,
        color: 'white',
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

export default function Leaderboard({ entries }: LeaderboardProps) {
  if (entries.length === 0) {
    return (
      <div
        className="glass-card"
        style={{
          padding: 'var(--space-lg)',
          textAlign: 'center',
        }}
      >
        <h3
          style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-lg)',
          }}
        >
          🏆 주간 리더보드
        </h3>
        <p style={{ color: 'var(--text-muted)', padding: 'var(--space-xl) 0' }}>
          아직 이번 주 데이터가 없습니다
        </p>
      </div>
    );
  }

  return (
    <div
      className="glass-card"
      style={{ padding: 'var(--space-lg)' }}
    >
      <h3
        style={{
          fontSize: 'var(--text-xl)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
        }}
      >
        🏆 주간 리더보드
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {entries.map((entry) => {
          const rank = entry.rank || 0;
          const isTopThree = rank > 0 && rank <= 3;
          const isCurrentUser = entry.isCurrentUser;

          return (
            <div
              key={entry.user_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: 'var(--space-md)',
                borderRadius: 'var(--radius-md)',
                background: isCurrentUser
                  ? 'rgba(99, 102, 241, 0.1)'
                  : isTopThree
                    ? 'var(--bg-tertiary)'
                    : 'transparent',
                border: isCurrentUser
                  ? '1px solid rgba(99, 102, 241, 0.3)'
                  : '1px solid transparent',
                transition: 'all var(--transition-fast)',
              }}
            >
              {/* Rank */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isTopThree ? 'var(--text-xl)' : 'var(--text-sm)',
                  fontWeight: 700,
                  color: isTopThree ? undefined : 'var(--text-muted)',
                  background: isTopThree ? 'none' : 'var(--bg-secondary)',
                  flexShrink: 0,
                }}
              >
                {isTopThree ? getMedalEmoji(rank) : rank}
              </div>

              {/* Avatar */}
              {getAvatar(entry.name, entry.image)}

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 'var(--text-base)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.name}
                  {isCurrentUser && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-primary)', marginLeft: 'var(--space-xs)' }}>
                      (나)
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-lg)',
                  flexShrink: 0,
                }}
              >
                {/* Total Hours */}
                <div style={{ textAlign: 'center', minWidth: 60 }}>
                  <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {entry.totalHours.toFixed(1)}h
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    학습
                  </div>
                </div>

                {/* Execution Rate */}
                <div style={{ textAlign: 'center', minWidth: 50 }}>
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    color: entry.executionRate >= 70
                      ? 'var(--accent-success)'
                      : entry.executionRate >= 40
                        ? 'var(--accent-warn)'
                        : 'var(--accent-danger)',
                  }}>
                    {entry.executionRate}%
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    이행률
                  </div>
                </div>

                {/* Streak */}
                <div style={{ textAlign: 'center', minWidth: 50 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--accent-warn)' }}>
                    🔥 {entry.streak}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    연속
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
