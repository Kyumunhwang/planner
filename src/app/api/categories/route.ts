// ============================================================
// DSMS API - Custom Categories (사용자 카테고리) CRUD
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSheetData, appendRows, deleteRow, findRows } from '@/lib/google-sheets';
import requestQueue from '@/lib/queue';
import type { CustomCategory } from '@/types';

// Column indices for CATEGORIES sheet
// id(0), user_id(1), name(2), color(3)

function rowToCategory(row: string[]): CustomCategory {
  return {
    id: row[0] || '',
    user_id: row[1] || '',
    name: row[2] || '',
    color: row[3] || '',
  };
}

// GET /api/categories
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const categories = await requestQueue.enqueue(async () => {
      const data = await getSheetData('CATEGORIES');
      if (data.length <= 1) return [];

      return data
        .slice(1)
        .filter((row) => row[1] === session.user.user_id)
        .map(rowToCategory);
    });

    return NextResponse.json({ categories }, { status: 200 });
  } catch (error) {
    console.error('[Categories GET]', error);
    return NextResponse.json(
      { error: '카테고리를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST /api/categories
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { name, color } = body;

    if (!name || !color) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다. (name, color)' },
        { status: 400 }
      );
    }

    const id = `C${Date.now()}`;

    const newCategory: CustomCategory = {
      id,
      user_id: session.user.user_id,
      name,
      color,
    };

    await requestQueue.enqueue(async () => {
      // Check for duplicate category name for this user
      const data = await getSheetData('CATEGORIES');
      const duplicate = data.slice(1).find(
        (row) => row[1] === session.user.user_id && row[2] === name
      );
      if (duplicate) {
        throw new Error('DUPLICATE');
      }

      await appendRows('CATEGORIES', [
        [newCategory.id, newCategory.user_id, newCategory.name, newCategory.color],
      ]);
    });

    return NextResponse.json({ category: newCategory }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'DUPLICATE') {
      return NextResponse.json(
        { error: '이미 동일한 이름의 카테고리가 존재합니다.' },
        { status: 409 }
      );
    }
    console.error('[Categories POST]', error);
    return NextResponse.json(
      { error: '카테고리 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE /api/categories
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    }

    await requestQueue.enqueue(async () => {
      const results = await findRows('CATEGORIES', 0, id);
      if (results.length === 0) {
        throw new Error('NOT_FOUND');
      }

      const { data: existingRow, rowIndex } = results[0];

      if (existingRow[1] !== session.user.user_id) {
        throw new Error('FORBIDDEN');
      }

      await deleteRow('CATEGORIES', rowIndex - 1);
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'NOT_FOUND') {
      return NextResponse.json({ error: '카테고리를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }
    console.error('[Categories DELETE]', error);
    return NextResponse.json(
      { error: '카테고리 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
