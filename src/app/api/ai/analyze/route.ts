// ============================================================
// DSMS API - AI Analysis (AI 학습 분석)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSheetData } from '@/lib/google-sheets';
import requestQueue from '@/lib/queue';
import { analyzeStudyData } from '@/lib/gemini';
import type { SchedulePlan, ActualLog } from '@/types';

function getDateRange(period: 'week' | 'month', now: Date): { start: string; end: string } {
  const end = now.toISOString().split('T')[0];

  if (period === 'week') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { start: start.toISOString().split('T')[0], end };
  } else {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 1);
    return { start: start.toISOString().split('T')[0], end };
  }
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

// POST /api/ai/analyze
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { period, userId: targetUserId } = body;

    if (!period || !['week', 'month'].includes(period)) {
      return NextResponse.json(
        { error: "period는 'week' 또는 'month'이어야 합니다." },
        { status: 400 }
      );
    }

    let queryUserId = session.user.user_id;
    if (targetUserId && targetUserId !== session.user.user_id) {
      const isTeacher = session.user.email === 'kyumun.hwang@gmail.com';
      if (!isTeacher) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
      }
      queryUserId = targetUserId;
    }

    const dateRange = getDateRange(period, new Date());

    // Fetch plans and logs for the period
    const { plans, logs } = await requestQueue.enqueue(async () => {
      const [plansData, logsData] = await Promise.all([
        getSheetData('SCHEDULE_PLANS'),
        getSheetData('ACTUAL_LOGS'),
      ]);

      const userPlans = plansData
        .slice(1)
        .filter((row) => {
          return (
            row[1] === queryUserId &&
            row[2] >= dateRange.start &&
            row[2] <= dateRange.end
          );
        })
        .map(rowToPlan);

      const userLogs = logsData
        .slice(1)
        .filter((row) => {
          return (
            row[1] === queryUserId &&
            row[3] >= dateRange.start &&
            row[3] <= dateRange.end
          );
        })
        .map(rowToLog);

      return { plans: userPlans, logs: userLogs };
    });

    if (plans.length === 0 && logs.length === 0) {
      return NextResponse.json(
        { error: '분석할 데이터가 부족합니다. 학습 기록을 먼저 추가해주세요.' },
        { status: 400 }
      );
    }

    // Call Gemini AI for analysis
    const analysis = await analyzeStudyData(plans, logs, period);

    return NextResponse.json({ analysis }, { status: 200 });
  } catch (error) {
    console.error('[AI Analyze]', error);
    const message = error instanceof Error ? error.message : 'AI 분석에 실패했습니다.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
