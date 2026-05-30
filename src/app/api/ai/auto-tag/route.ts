// ============================================================
// DSMS API - Auto-Tag (자동 카테고리 태깅)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { autoTagContent } from '@/lib/gemini';

// POST /api/ai/auto-tag
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: '태깅할 content가 필요합니다.' },
        { status: 400 }
      );
    }

    const tag = await autoTagContent(content.trim());

    return NextResponse.json({ tag }, { status: 200 });
  } catch (error) {
    console.error('[Auto-Tag]', error);
    return NextResponse.json(
      { tag: '기타', error: '자동 태깅에 실패했습니다. 기본값이 적용됩니다.' },
      { status: 200 } // Still return 200 with fallback tag
    );
  }
}
