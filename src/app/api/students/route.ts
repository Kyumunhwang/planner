// ============================================================
// DSMS API - 교사용 학생 목록 조회
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSheetData } from '@/lib/google-sheets';
import requestQueue from '@/lib/queue';

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 교사 계정인지 확인 (kyumun.hwang@gmail.com)
    const isTeacher = session.user.email === 'kyumun.hwang@gmail.com';
    if (!isTeacher) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const students = await requestQueue.enqueue(async () => {
      const data = await getSheetData('USERS');
      if (data.length <= 1) return [];

      // 헤더 제외하고 매핑
      return data.slice(1).map((row) => ({
        user_id: row[0],
        email: row[1],
        name: row[2],
        image: row[3],
      }));
    });

    return NextResponse.json({ students }, { status: 200 });
  } catch (error) {
    console.error('[Students GET]', error);
    return NextResponse.json(
      { error: '학생 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
