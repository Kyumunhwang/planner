'use client';

import type { StreakData } from '@/types';
import styles from './StreakBadge.module.css';

interface StreakBadgeProps {
  streak: StreakData;
}

const LEVEL_LABELS = {
  bronze: '브론즈 플래너',
  silver: '실버 플래너',
  gold: '골드 플래너',
  diamond: '다이아몬드 플래너',
};

export default function StreakBadge({ streak }: StreakBadgeProps) {
  const { currentStreak, longestStreak, todayCompleted, level } = streak;

  return (
    <div className={`${styles.badgeCard} ${styles[level]} ${todayCompleted ? styles.completedToday : ''}`}>
      <div className={styles.fireContainer}>
        {/* Fire glow & icon */}
        <div className={styles.fireGlow} />
        <span className={styles.fireIcon} role="img" aria-label="streak fire">
          🔥
        </span>
      </div>

      <div className={styles.details}>
        <div className={styles.streakCount}>
          <span className={styles.count}>{currentStreak}</span>
          <span className={styles.unit}>일 연속</span>
        </div>
        <div className={styles.levelBadge}>{LEVEL_LABELS[level]}</div>
        <p className={styles.helperText}>
          {todayCompleted ? '오늘의 우선순위 과업을 완료했습니다! 🎉' : '오늘의 과업을 완료해 스트릭을 이어가세요!'}
        </p>
        <div className={styles.longest}>
          최장 기록: <strong>{longestStreak}일</strong>
        </div>
      </div>
    </div>
  );
}
