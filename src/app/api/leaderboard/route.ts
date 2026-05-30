// ============================================================
// DSMS API - Leaderboard (리더보드)
// ============================================================

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSheetData } from '@/lib/google-sheets';
import requestQueue from '@/lib/queue';
import type { LeaderboardEntry, SchedulePlan, ActualLog } from '@/types';

function calcDurationHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em - (sh * 60 + sm)) / 60;
  return Math.max(0, diff);
}

function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

// GET /api/leaderboard
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { start, end } = getWeekRange();

    const entries = await requestQueue.enqueue(async () => {
      const [usersData, plansData, logsData] = await Promise.all([
        getSheetData('USERS'),
        getSheetData('SCHEDULE_PLANS'),
        getSheetData('ACTUAL_LOGS'),
      ]);

      // Parse users (skip header)
      const users = usersData.slice(1).map((row) => ({
        user_id: row[0] || '',
        email: row[1] || '',
        name: row[2] || '',
        image: row[3] || undefined,
      }));

      // Parse all plans and logs for the week
      const allPlans: SchedulePlan[] = plansData.slice(1)
        .filter((row) => row[2] >= start && row[2] <= end)
        .map((row) => ({
          plan_id: row[0] || '',
          user_id: row[1] || '',
          target_date: row[2] || '',
          start_time: row[3] || '',
          end_time: row[4] || '',
          task_title: row[5] || '',
          category: row[6] || '',
          is_priority: row[7] === 'true',
        }));

      const allLogs: ActualLog[] = logsData.slice(1)
        .filter((row) => row[3] >= start && row[3] <= end)
        .map((row) => ({
          log_id: row[0] || '',
          user_id: row[1] || '',
          plan_id: row[2] || null,
          log_date: row[3] || '',
          start_time: row[4] || '',
          end_time: row[5] || '',
          content: row[6] || '',
          ai_tag: row[7] || '',
        }));

      // Calculate stats per user
      const leaderboard: LeaderboardEntry[] = users.map((user) => {
        const userPlans = allPlans.filter((p) => p.user_id === user.user_id);
        const userLogs = allLogs.filter((l) => l.user_id === user.user_id);

        // Total hours
        const totalHours = userLogs.reduce(
          (sum, l) => sum + calcDurationHours(l.start_time, l.end_time),
          0
        );

        // Execution rate
        const completedPlans = userPlans.filter((p) =>
          userLogs.some((l) => l.plan_id === p.plan_id)
        ).length;
        const executionRate = userPlans.length > 0
          ? Math.round((completedPlans / userPlans.length) * 100)
          : 0;

        // Streak: consecutive days with at least one log
        const logDates = [...new Set(userLogs.map((l) => l.log_date))].sort().reverse();
        let streak = 0;
        const checkDate = new Date();

        for (let i = 0; i < 365; i++) {
          const dateStr = checkDate.toISOString().split('T')[0];
          if (logDates.includes(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else if (i === 0) {
            // Today might not have a log yet, check from yesterday
            checkDate.setDate(checkDate.getDate() - 1);
            continue;
          } else {
            break;
          }
        }

        return {
          rank: 0, // will be set after sorting
          user_id: user.user_id,
          name: user.name,
          image: user.image,
          totalHours: Math.round(totalHours * 100) / 100,
          executionRate,
          streak,
          isCurrentUser: user.user_id === session.user.user_id,
        };
      });

      // Sort by totalHours descending
      leaderboard.sort((a, b) => b.totalHours - a.totalHours);

      // Assign ranks
      leaderboard.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      // Return top 10
      return leaderboard.slice(0, 10);
    });

    return NextResponse.json({ entries }, { status: 200 });
  } catch (error) {
    console.error('[Leaderboard GET]', error);
    return NextResponse.json(
      { error: '리더보드 데이터를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
