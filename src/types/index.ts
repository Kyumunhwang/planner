// ============================================================
// DSMS - Daily Study Management System
// 타입 정의 및 유틸리티 함수
// ============================================================

// ---- User (사용자) ----
export interface User {
  user_id: string;
  email: string;
  name: string;
  image?: string;
  created_at: string;
}

// ---- Schedule Plan (일정 계획) ----
export interface SchedulePlan {
  plan_id: string;
  user_id: string;
  target_date: string; // YYYY-MM-DD
  start_time: string;  // HH:MM
  end_time: string;    // HH:MM
  task_title: string;
  category: string;
  is_priority: boolean;
}

// ---- Actual Log (실제 기록) ----
export interface ActualLog {
  log_id: string;
  user_id: string;
  plan_id: string | null;
  log_date: string;    // YYYY-MM-DD
  start_time: string;  // HH:MM
  end_time: string;    // HH:MM
  content: string;
  ai_tag: string;
}

// ---- Custom Category (사용자 카테고리) ----
export interface CustomCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
}

// ---- Time Block (캘린더 UI용 시간 블록) ----
export interface TimeBlock {
  id: string;
  type: 'plan' | 'log';
  title: string;
  content?: string;
  category: string;
  startSlot: number;   // 0-47 (각 슬롯 = 30분)
  endSlot: number;     // 1-48
  isPriority: boolean;
  isCompleted?: boolean;
  planId?: string;
  logId?: string;
}

// ---- 기본 카테고리 ----
export const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
  { name: '수업', color: 'hsl(260, 95%, 75%)' },
  { name: '숙제', color: 'hsl(195, 95%, 70%)' },
  { name: '개인공부', color: 'hsl(285, 95%, 72%)' },
  { name: '잠', color: 'hsl(220, 60%, 70%)' },
  { name: '이동시간', color: 'hsl(38, 95%, 68%)' },
  { name: '식사', color: 'hsl(145, 85%, 68%)' },
  { name: '휴식', color: 'hsl(170, 90%, 65%)' },
  { name: '기타', color: 'hsl(210, 20%, 75%)' },
];

// ---- 카테고리 색상 조회 ----
export function getCategoryColor(
  categoryName: string,
  customCategories?: { name: string; color: string }[]
): string {
  const defaultCat = DEFAULT_CATEGORIES.find((c) => c.name === categoryName);
  if (defaultCat) return defaultCat.color;

  const customCat = customCategories?.find((c) => c.name === categoryName);
  if (customCat) return customCat.color;

  // 기본 색상 (기타)
  return 'hsl(225, 15%, 50%)';
}

// ---- 시간 ↔ 슬롯 변환 유틸리티 ----

/** 시간 문자열(HH:MM)을 슬롯 인덱스(0-47)로 변환 */
export function timeToSlot(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 2 + (minutes >= 30 ? 1 : 0);
}

/** 슬롯 인덱스(0-47)를 시간 문자열(HH:MM)로 변환 */
export function slotToTime(slot: number): string {
  const hours = Math.floor(slot / 2);
  const minutes = slot % 2 === 0 ? '00' : '30';
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

// ---- AI 분석 결과 ----
export interface AIAnalysis {
  summary: string;
  focusTimeAnalysis: {
    peakHours: string[];
    lowHours: string[];
  };
  categoryBalance: {
    category: string;
    percentage: number;
    recommendation: string;
  }[];
  executionRate: {
    overall: number;
    byCategory: { category: string; rate: number }[];
  };
  suggestions: string[];
  weeklyTrend: 'improving' | 'stable' | 'declining';
}

// ---- 게이미피케이션 ----
export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  todayCompleted: boolean;
  level: 'bronze' | 'silver' | 'gold' | 'diamond';
}

export interface LeaderboardEntry {
  user_id: string;
  name: string;
  image?: string;
  totalHours: number;
  executionRate: number;
  streak: number;
  rank?: number;
  isCurrentUser?: boolean;
}

// ---- Stats / Dashboard Response ----
export interface CategoryBreakdown {
  category: string;
  hours: number;
  percentage: number;
}

export interface DailyData {
  date: string;
  plannedHours: number;
  actualHours: number;
}

export interface StatsResponse {
  totalStudyHours: number;
  categoryBreakdown: CategoryBreakdown[];
  executionRate: number;
  dailyData: DailyData[];
  streak: StreakData;
  categoryCount: number;
}

