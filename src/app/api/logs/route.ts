// ============================================================
// DSMS API - Actual Logs (실제 기록) CRUD
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSheetData, appendRows, updateRow, deleteRow, findRows } from '@/lib/google-sheets';
import requestQueue from '@/lib/queue';
import { autoTagContent } from '@/lib/gemini';
import type { ActualLog } from '@/types';

// Column indices for ACTUAL_LOGS sheet
// log_id(0), user_id(1), plan_id(2), log_date(3), start_time(4), end_time(5), content(6), ai_tag(7)

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

// GET /api/logs?date=YYYY-MM-DD
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

    const logs = await requestQueue.enqueue(async () => {
      const data = await getSheetData('ACTUAL_LOGS');
      if (data.length <= 1) return [];

      return data
        .slice(1)
        .filter((row) => row[1] === queryUserId && row[3] === date)
        .map(rowToLog);
    });

    return NextResponse.json({ logs }, { status: 200 });
  } catch (error) {
    console.error('[Logs GET]', error);
    return NextResponse.json(
      { error: '기록 데이터를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST /api/logs
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { log_date, start_time, end_time, content, plan_id } = body;

    if (!log_date || !start_time || !end_time || !content) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다. (log_date, start_time, end_time, content)' },
        { status: 400 }
      );
    }

    // Auto-tag content using AI
    let ai_tag = '기타';
    try {
      ai_tag = await autoTagContent(content);
    } catch (tagError) {
      console.warn('[Logs POST] 자동 태깅 실패, 기본값 사용:', tagError);
    }

    const log_id = `L${Date.now()}`;

    const newLog: ActualLog = {
      log_id,
      user_id: session.user.user_id,
      plan_id: plan_id || null,
      log_date,
      start_time,
      end_time,
      content,
      ai_tag,
    };

    await requestQueue.enqueue(async () => {
      await appendRows('ACTUAL_LOGS', [
        [
          newLog.log_id,
          newLog.user_id,
          newLog.plan_id || '',
          newLog.log_date,
          newLog.start_time,
          newLog.end_time,
          newLog.content,
          newLog.ai_tag,
        ],
      ]);
    });

    return NextResponse.json({ log: newLog }, { status: 201 });
  } catch (error) {
    console.error('[Logs POST]', error);
    return NextResponse.json(
      { error: '기록 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// PUT /api/logs
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { log_id, ...updates } = body;

    if (!log_id) {
      return NextResponse.json({ error: 'log_id가 필요합니다.' }, { status: 400 });
    }

    const updatedLog = await requestQueue.enqueue(async () => {
      const results = await findRows('ACTUAL_LOGS', 0, log_id);
      if (results.length === 0) {
        return null;
      }

      const { data: existingRow, rowIndex } = results[0];

      if (existingRow[1] !== session.user.user_id) {
        return 'forbidden';
      }

      // Re-tag if content changed
      let aiTag = existingRow[7];
      if (updates.content && updates.content !== existingRow[6]) {
        try {
          aiTag = await autoTagContent(updates.content);
        } catch {
          // Keep existing tag on failure
        }
      }

      const updated: string[] = [
        existingRow[0], // log_id
        existingRow[1], // user_id
        updates.plan_id !== undefined ? (updates.plan_id || '') : existingRow[2],
        updates.log_date ?? existingRow[3],
        updates.start_time ?? existingRow[4],
        updates.end_time ?? existingRow[5],
        updates.content ?? existingRow[6],
        aiTag,
      ];

      await updateRow('ACTUAL_LOGS', rowIndex, updated);
      return rowToLog(updated);
    });

    if (updatedLog === null) {
      return NextResponse.json({ error: '기록을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (updatedLog === 'forbidden') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    return NextResponse.json({ log: updatedLog }, { status: 200 });
  } catch (error) {
    console.error('[Logs PUT]', error);
    return NextResponse.json(
      { error: '기록 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE /api/logs
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { log_id } = body;

    if (!log_id) {
      return NextResponse.json({ error: 'log_id가 필요합니다.' }, { status: 400 });
    }

    await requestQueue.enqueue(async () => {
      const results = await findRows('ACTUAL_LOGS', 0, log_id);
      if (results.length === 0) {
        throw new Error('NOT_FOUND');
      }

      const { data: existingRow, rowIndex } = results[0];

      if (existingRow[1] !== session.user.user_id) {
        throw new Error('FORBIDDEN');
      }

      await deleteRow('ACTUAL_LOGS', rowIndex - 1);
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'NOT_FOUND') {
      return NextResponse.json({ error: '기록을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }
    console.error('[Logs DELETE]', error);
    return NextResponse.json(
      { error: '기록 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
