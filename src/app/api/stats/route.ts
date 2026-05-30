// ============================================================
// DSMS API - Stats / Dashboard Data (통계)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSheetData } from '@/lib/google-sheets';
import requestQueue from '@/lib/queue';
import type { SchedulePlan, ActualLog, StreakData, CategoryBreakdown, DailyData, StatsResponse } from '@/types';

function getDateRange(
  period: 'week' | 'month',
  refDate: Date
): { start: Date; end: Date; dates: string[] } {
  const dates: string[] = [];

  if (period === 'week') {
    // Get the Monday of the reference date's week
    const dayOfWeek = refDate.getDay();
    const monday = new Date(refDate);
    monday.setDate(refDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const endDate = new Date(monday);
    endDate.setDate(monday.getDate() + 6);
    return { start: monday, end: endDate, dates };
  } else {
    // Full calendar month of the reference date
    const year = refDate.getFullYear();
    const month = refDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      dates.push(d.toISOString().split('T')[0]);
    }

    return {
      start: new Date(year, month, 1),
      end: new Date(year, month, daysInMonth),
      dates,
    };
  }
}

function calcDurationHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em - (sh * 60 + sm)) / 60;
  return Math.max(0, diff);
}

function rowToPlan(row: string[]): SchedulePlan {
  return {
    plan_id: row[0] || '',
    user_id: row[1] || '',
    target_date: row[2] || '',
    start_time: row[3] || '',
    end_time: row[4] || '',
    task_title: row[5] || '',
    category: row[6] || '',
    is_priority: row[7] === 'true',
  };
}

function rowToLog(row: string[]): ActualLog {
  return {
    log_id: row[0] || '',
    user_id: row[1] || '',
    plan_id: row[2] || null,
    log_date: row[3] || '',
    start_time: row[4] || '',
    end_time: row[5] || '',
    content: row[6] || '',
    ai_tag: row[7] || '',
  };
}

function calculateStreak(plans: SchedulePlan[], logs: ActualLog[]): StreakData {
  // Get all unique dates that have at least one completed priority task
  const priorityPlanIds = new Set(
    plans.filter((p) => p.is_priority).map((p) => p.plan_id)
  );

  // A day is "completed" if it has a log linked to a priority plan
  const completedDates = new Set<string>();
  for (const log of logs) {
    if (log.plan_id && priorityPlanIds.has(log.plan_id)) {
      completedDates.add(log.log_date);
    }
  }

  // If no priority plans exist, count days with any log as completed
  if (priorityPlanIds.size === 0) {
    for (const log of logs) {
      completedDates.add(log.log_date);
    }
  }

  const sortedDates = Array.from(completedDates).sort();

  if (sortedDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, todayCompleted: false, level: 'bronze' };
  }

  // Calculate current streak (counting back from today)
  const today = new Date().toISOString().split('T')[0];
  const todayCompleted = completedDates.has(today);

  let currentStreak = 0;
  const checkDate = new Date();
  if (!todayCompleted) {
    checkDate.setDate(checkDate.getDate() - 1); // start from yesterday if today not done
  }

  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (completedDates.has(dateStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let streak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]);
    const curr = new Date(sortedDates[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      streak++;
    } else {
      longestStreak = Math.max(longestStreak, streak);
      streak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, streak);

  // Determine level
  let level: StreakData['level'] = 'bronze';
  if (currentStreak >= 30) level = 'diamond';
  else if (currentStreak >= 14) level = 'gold';
  else if (currentStreak >= 7) level = 'silver';

  return { currentStreak, longestStreak, todayCompleted, level };
}

// GET /api/stats?period=week|month&date=YYYY-MM-DD
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') || 'week') as 'week' | 'month';
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const refDate = new Date(dateStr + 'T00:00:00');

    if (!['week', 'month'].includes(period)) {
      return NextResponse.json(
        { error: "period는 'week' 또는 'month'이어야 합니다." },
        { status: 400 }
      );
    }

    const { dates, start, end } = getDateRange(period, refDate);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    const { plans, logs, allPlans, allLogs } = await requestQueue.enqueue(async () => {
      const [plansData, logsData] = await Promise.all([
        getSheetData('SCHEDULE_PLANS'),
        getSheetData('ACTUAL_LOGS'),
      ]);

      // Plans and logs for the specific period
      const periodPlans = plansData
        .slice(1)
        .filter((row) => row[1] === session.user.user_id && row[2] >= startStr && row[2] <= endStr)
        .map(rowToPlan);

      const periodLogs = logsData
        .slice(1)
        .filter((row) => row[1] === session.user.user_id && row[3] >= startStr && row[3] <= endStr)
        .map(rowToLog);

      // All user data for streak calculation
      const userPlans = plansData.slice(1).filter((row) => row[1] === session.user.user_id).map(rowToPlan);
      const userLogs = logsData.slice(1).filter((row) => row[1] === session.user.user_id).map(rowToLog);

      return { plans: periodPlans, logs: periodLogs, allPlans: userPlans, allLogs: userLogs };
    });

    // 1. Total study hours
    const totalStudyHours = logs.reduce((sum, log) => {
      return sum + calcDurationHours(log.start_time, log.end_time);
    }, 0);

    // 2. Category breakdown
    const categoryMap = new Map<string, number>();
    for (const log of logs) {
      const cat = log.ai_tag || '기타';
      const hours = calcDurationHours(log.start_time, log.end_time);
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + hours);
    }

    const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryMap.entries())
      .map(([category, hours]) => ({
        category,
        hours: Math.round(hours * 100) / 100,
        percentage: totalStudyHours > 0 ? Math.round((hours / totalStudyHours) * 100) : 0,
      }))
      .sort((a, b) => b.hours - a.hours);

    // 3. Execution rate
    const totalPlannedBlocks = plans.length;
    const completedBlocks = plans.filter((plan) =>
      logs.some((log) => log.plan_id === plan.plan_id)
    ).length;
    const executionRate = totalPlannedBlocks > 0
      ? Math.round((completedBlocks / totalPlannedBlocks) * 100)
      : 0;

    // 4. Daily data
    const dailyData: DailyData[] = dates.map((date) => {
      const dayPlans = plans.filter((p) => p.target_date === date);
      const dayLogs = logs.filter((l) => l.log_date === date);

      const plannedHours = dayPlans.reduce(
        (sum, p) => sum + calcDurationHours(p.start_time, p.end_time),
        0
      );
      const actualHours = dayLogs.reduce(
        (sum, l) => sum + calcDurationHours(l.start_time, l.end_time),
        0
      );

      return {
        date,
        plannedHours: Math.round(plannedHours * 100) / 100,
        actualHours: Math.round(actualHours * 100) / 100,
      };
    });

    // 5. Streak
    const streak = calculateStreak(allPlans, allLogs);

    // 6. Category count
    const categoryCount = categoryMap.size;

    const stats: StatsResponse = {
      totalStudyHours: Math.round(totalStudyHours * 100) / 100,
      categoryBreakdown,
      executionRate,
      dailyData,
      streak,
      categoryCount,
    };

    return NextResponse.json(stats, { status: 200 });
  } catch (error) {
    console.error('[Stats GET]', error);
    return NextResponse.json(
      { error: '통계 데이터를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
