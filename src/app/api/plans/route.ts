// ============================================================
// DSMS API - Schedule Plans (일정 계획) CRUD
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSheetData, appendRows, updateRow, deleteRow, findRows } from '@/lib/google-sheets';
import requestQueue from '@/lib/queue';
import type { SchedulePlan } from '@/types';

// Column indices for SCHEDULE_PLANS sheet
// plan_id(0), user_id(1), target_date(2), start_time(3), end_time(4), task_title(5), category(6), is_priority(7)

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

// GET /api/plans?date=YYYY-MM-DD
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    if (!date) {
      return NextResponse.json({ error: 'date 파라미터가 필요합니다.' }, { status: 400 });
    }

    const targetUserId = searchParams.get('userId');
    let queryUserId = session.user.user_id;

    if (targetUserId && targetUserId !== session.user.user_id) {
      const isTeacher = session.user.email === 'kyumun.hwang@gmail.com';
      if (!isTeacher) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
      }
      queryUserId = targetUserId;
    }

    const plans = await requestQueue.enqueue(async () => {
      const data = await getSheetData('SCHEDULE_PLANS');
      if (data.length <= 1) return []; // header only

      return data
        .slice(1) // skip header
        .filter((row) => row[1] === queryUserId && row[2] === date)
        .map(rowToPlan);
    });

    return NextResponse.json({ plans }, { status: 200 });
  } catch (error) {
    console.error('[Plans GET]', error);
    return NextResponse.json(
      { error: '계획 데이터를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST /api/plans
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { target_date, start_time, end_time, task_title, category, is_priority } = body;

    if (!target_date || !start_time || !end_time || !task_title || !category) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다. (target_date, start_time, end_time, task_title, category)' },
        { status: 400 }
      );
    }

    const plan_id = `P${Date.now()}`;

    const newPlan: SchedulePlan = {
      plan_id,
      user_id: session.user.user_id,
      target_date,
      start_time,
      end_time,
      task_title,
      category,
      is_priority: is_priority === true,
    };

    await requestQueue.enqueue(async () => {
      await appendRows('SCHEDULE_PLANS', [
        [
          newPlan.plan_id,
          newPlan.user_id,
          newPlan.target_date,
          newPlan.start_time,
          newPlan.end_time,
          newPlan.task_title,
          newPlan.category,
          String(newPlan.is_priority),
        ],
      ]);
    });

    return NextResponse.json({ plan: newPlan }, { status: 201 });
  } catch (error) {
    console.error('[Plans POST]', error);
    return NextResponse.json(
      { error: '계획 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// PUT /api/plans
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { plan_id, ...updates } = body;

    if (!plan_id) {
      return NextResponse.json({ error: 'plan_id가 필요합니다.' }, { status: 400 });
    }

    const updatedPlan = await requestQueue.enqueue(async () => {
      // Find the row by plan_id (column 0)
      const results = await findRows('SCHEDULE_PLANS', 0, plan_id);
      if (results.length === 0) {
        return null;
      }

      const { data: existingRow, rowIndex } = results[0];

      // Verify ownership
      if (existingRow[1] !== session.user.user_id) {
        return 'forbidden';
      }

      // Merge updates
      const updated: string[] = [
        existingRow[0], // plan_id
        existingRow[1], // user_id
        updates.target_date ?? existingRow[2],
        updates.start_time ?? existingRow[3],
        updates.end_time ?? existingRow[4],
        updates.task_title ?? existingRow[5],
        updates.category ?? existingRow[6],
        updates.is_priority !== undefined ? String(updates.is_priority) : existingRow[7],
      ];

      await updateRow('SCHEDULE_PLANS', rowIndex, updated);
      return rowToPlan(updated);
    });

    if (updatedPlan === null) {
      return NextResponse.json({ error: '계획을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (updatedPlan === 'forbidden') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    return NextResponse.json({ plan: updatedPlan }, { status: 200 });
  } catch (error) {
    console.error('[Plans PUT]', error);
    return NextResponse.json(
      { error: '계획 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE /api/plans
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { plan_id } = body;

    if (!plan_id) {
      return NextResponse.json({ error: 'plan_id가 필요합니다.' }, { status: 400 });
    }

    await requestQueue.enqueue(async () => {
      const results = await findRows('SCHEDULE_PLANS', 0, plan_id);
      if (results.length === 0) {
        throw new Error('NOT_FOUND');
      }

      const { data: existingRow, rowIndex } = results[0];

      // Verify ownership
      if (existingRow[1] !== session.user.user_id) {
        throw new Error('FORBIDDEN');
      }

      // deleteRow expects 0-based index
      await deleteRow('SCHEDULE_PLANS', rowIndex - 1);
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'NOT_FOUND') {
      return NextResponse.json({ error: '계획을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }
    console.error('[Plans DELETE]', error);
    return NextResponse.json(
      { error: '계획 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
