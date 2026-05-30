// ============================================================
// DSMS - Google Sheets API v4 연결 모듈
// 서비스 계정 인증 및 CRUD 작업
// ============================================================

import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';

// ---- 환경 변수 검증 ----
function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`환경 변수 ${name}이(가) 설정되지 않았습니다.`);
  }
  return value;
}

// ---- 시트 헤더 정의 ----
const SHEET_HEADERS: Record<string, string[]> = {
  USERS: ['user_id', 'email', 'name', 'image', 'created_at'],
  SCHEDULE_PLANS: [
    'plan_id',
    'user_id',
    'target_date',
    'start_time',
    'end_time',
    'task_title',
    'category',
    'is_priority',
  ],
  ACTUAL_LOGS: [
    'log_id',
    'user_id',
    'plan_id',
    'log_date',
    'start_time',
    'end_time',
    'content',
    'ai_tag',
  ],
  CATEGORIES: ['id', 'user_id', 'name', 'color'],
};

// ---- 싱글톤 인증 인스턴스 ----
let jwtClient: JWT | null = null;
let sheetsApi: sheets_v4.Sheets | null = null;

function getAuth(): JWT {
  if (jwtClient) return jwtClient;

  const email = getEnvVar('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = getEnvVar('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');

  jwtClient = new JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return jwtClient;
}

function getSheetsApi(): sheets_v4.Sheets {
  if (sheetsApi) return sheetsApi;

  const auth = getAuth();
  sheetsApi = google.sheets({ version: 'v4', auth });
  return sheetsApi;
}

function getSpreadsheetId(): string {
  return getEnvVar('GOOGLE_SPREADSHEET_ID');
}

let isInitialized = false;
async function ensureInitialized() {
  if (isInitialized) return;
  // Prevent infinite loop if initializeSpreadsheet calls sheets API which calls ensureInitialized
  isInitialized = true; 
  try {
    await initializeSpreadsheet();
  } catch (error) {
    isInitialized = false;
    throw error;
  }
}

// ============================================================
// CRUD 함수
// ============================================================

/**
 * 시트 데이터 조회
 * @param sheetName - 시트 이름 (예: 'USERS')
 * @param range - 범위 (예: 'A2:E'). 미지정 시 전체
 */
export async function getSheetData(
  sheetName: string,
  range?: string
): Promise<string[][]> {
  await ensureInitialized();
  const sheets = getSheetsApi();
  const spreadsheetId = getSpreadsheetId();
  const fullRange = range ? `${sheetName}!${range}` : sheetName;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: fullRange,
    });

    return (response.data.values as string[][]) || [];
  } catch (error) {
    console.error(`[Google Sheets] 데이터 조회 실패 (${sheetName}):`, error);
    throw new Error(`시트 '${sheetName}' 데이터 조회에 실패했습니다.`);
  }
}

/**
 * 시트에 행 추가
 * @param sheetName - 시트 이름
 * @param values - 추가할 행 데이터 (2차원 배열)
 */
export async function appendRows(
  sheetName: string,
  values: string[][]
): Promise<sheets_v4.Schema$AppendValuesResponse> {
  await ensureInitialized();
  const sheets = getSheetsApi();
  const spreadsheetId = getSpreadsheetId();

  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });

    return response.data;
  } catch (error) {
    console.error(`[Google Sheets] 행 추가 실패 (${sheetName}):`, error);
    throw new Error(`시트 '${sheetName}'에 데이터 추가를 실패했습니다.`);
  }
}

/**
 * 특정 행 업데이트
 * @param sheetName - 시트 이름
 * @param rowIndex - 행 인덱스 (1-based, 헤더 포함)
 * @param values - 업데이트할 값 배열
 */
export async function updateRow(
  sheetName: string,
  rowIndex: number,
  values: string[]
): Promise<sheets_v4.Schema$UpdateValuesResponse> {
  await ensureInitialized();
  const sheets = getSheetsApi();
  const spreadsheetId = getSpreadsheetId();

  try {
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] },
    });

    return response.data;
  } catch (error) {
    console.error(`[Google Sheets] 행 업데이트 실패 (${sheetName}, row ${rowIndex}):`, error);
    throw new Error(`시트 '${sheetName}'의 행 ${rowIndex} 업데이트에 실패했습니다.`);
  }
}

/**
 * 특정 행 삭제
 * @param sheetName - 시트 이름
 * @param rowIndex - 행 인덱스 (0-based, 시트 API 기준)
 */
export async function deleteRow(
  sheetName: string,
  rowIndex: number
): Promise<void> {
  await ensureInitialized();
  const sheets = getSheetsApi();
  const spreadsheetId = getSpreadsheetId();

  try {
    // 먼저 시트 ID를 조회
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties',
    });

    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === sheetName
    );

    if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) {
      throw new Error(`시트 '${sheetName}'을(를) 찾을 수 없습니다.`);
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheet.properties.sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });
  } catch (error) {
    console.error(`[Google Sheets] 행 삭제 실패 (${sheetName}, row ${rowIndex}):`, error);
    throw new Error(`시트 '${sheetName}'의 행 삭제에 실패했습니다.`);
  }
}

/**
 * 특정 열 값으로 행 검색
 * @param sheetName - 시트 이름
 * @param columnIndex - 열 인덱스 (0-based)
 * @param value - 검색할 값
 * @returns 매칭된 행 데이터와 행 인덱스(1-based) 배열
 */
export async function findRows(
  sheetName: string,
  columnIndex: number,
  value: string
): Promise<{ data: string[]; rowIndex: number }[]> {
  try {
    const allData = await getSheetData(sheetName);

    if (allData.length === 0) return [];

    const results: { data: string[]; rowIndex: number }[] = [];

    // 첫 번째 행은 헤더이므로 1부터 시작
    for (let i = 1; i < allData.length; i++) {
      const row = allData[i];
      if (row[columnIndex] === value) {
        results.push({
          data: row,
          // rowIndex는 시트 기준 1-based (헤더가 1행이므로 데이터는 i+1)
          rowIndex: i + 1,
        });
      }
    }

    return results;
  } catch (error) {
    console.error(`[Google Sheets] 행 검색 실패 (${sheetName}, col ${columnIndex}):`, error);
    throw new Error(`시트 '${sheetName}'에서 검색에 실패했습니다.`);
  }
}

// ============================================================
// 스프레드시트 초기화
// ============================================================

/**
 * 필요한 시트가 존재하는지 확인하고, 없으면 헤더와 함께 생성
 */
export async function initializeSpreadsheet(): Promise<void> {
  const sheets = getSheetsApi();
  const spreadsheetId = getSpreadsheetId();

  try {
    // 기존 시트 목록 조회
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });

    const existingSheets = new Set(
      spreadsheet.data.sheets?.map((s) => s.properties?.title || '') || []
    );

    const requiredSheets = Object.keys(SHEET_HEADERS);
    const sheetsToCreate = requiredSheets.filter(
      (name) => !existingSheets.has(name)
    );

    if (sheetsToCreate.length === 0) {
      console.log('[Google Sheets] 모든 시트가 이미 존재합니다.');
      return;
    }

    // 새 시트 추가 요청
    const addSheetRequests = sheetsToCreate.map((title) => ({
      addSheet: {
        properties: { title },
      },
    }));

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: addSheetRequests },
    });

    // 각 시트에 헤더 추가
    for (const sheetName of sheetsToCreate) {
      const headers = SHEET_HEADERS[sheetName];
      if (headers) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [headers] },
        });
      }
    }

    console.log(
      `[Google Sheets] 시트 생성 완료: ${sheetsToCreate.join(', ')}`
    );
  } catch (error) {
    console.error('[Google Sheets] 스프레드시트 초기화 실패:', error);
    throw new Error('스프레드시트 초기화에 실패했습니다.');
  }
}
