// ============================================================
// DSMS - Gemini AI 클라이언트
// 학습 데이터 분석 및 콘텐츠 자동 분류
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIAnalysis, ActualLog, SchedulePlan } from '@/types';

// ---- 클라이언트 초기화 ----
function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');
  }
  return new GoogleGenerativeAI(apiKey);
}

// ---- 모델 가져오기 ----
function getModel() {
  const client = getGeminiClient();
  return client.getGenerativeModel({
    model: 'gemini-1.5-pro',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });
}

// ============================================================
// 학습 데이터 분석
// ============================================================

/**
 * 학습 기록과 계획 데이터를 분석하여 AI 인사이트를 반환
 * @param logs - 실제 학습 기록 배열
 * @param plans - 일정 계획 배열
 * @returns AIAnalysis 구조의 분석 결과
 */
export async function analyzeStudyData(
  plans: SchedulePlan[],
  logs: ActualLog[],
  period: 'week' | 'month'
): Promise<AIAnalysis> {
  const model = getModel();

  // 데이터 포맷팅
  const logsFormatted = logs.map((log) => ({
    날짜: log.log_date,
    시작: log.start_time,
    종료: log.end_time,
    내용: log.content,
    카테고리: log.ai_tag,
    연결된_계획: log.plan_id || '없음',
  }));

  const plansFormatted = plans.map((plan) => ({
    날짜: plan.target_date,
    시작: plan.start_time,
    종료: plan.end_time,
    제목: plan.task_title,
    카테고리: plan.category,
    우선순위: plan.is_priority ? '높음' : '보통',
  }));

  const systemPrompt = `당신은 학습 관리 전문 AI 분석가입니다. 학생의 학습 계획과 실제 기록을 분석하여 구체적이고 실행 가능한 피드백을 제공합니다.

분석 시 고려사항:
1. 계획 대비 실행률 (계획 시간과 실제 기록 시간 비교)
2. 집중 시간대 분석 (가장 학습 효율이 높은 시간대)
3. 카테고리별 시간 배분 균형
4. 주간 추세 (개선/유지/하락)
5. 구체적이고 실천 가능한 제안

응답은 반드시 아래 JSON 형식으로 반환하세요:
{
  "summary": "전체 학습 패턴 요약 (한국어, 2-3문장)",
  "focusTimeAnalysis": {
    "peakHours": ["09:00-11:00", "14:00-16:00"],
    "lowHours": ["13:00-14:00", "21:00-22:00"]
  },
  "categoryBalance": [
    {
      "category": "카테고리명",
      "percentage": 30,
      "recommendation": "구체적인 조언"
    }
  ],
  "executionRate": {
    "overall": 75,
    "byCategory": [
      { "category": "카테고리명", "rate": 80 }
    ]
  },
  "suggestions": [
    "구체적인 제안 1",
    "구체적인 제안 2",
    "구체적인 제안 3"
  ],
  "weeklyTrend": "improving"
}`;

  const userPrompt = `다음 ${period === 'week' ? '주간' : '월간'} 학습 데이터를 분석해 주세요.

## 학습 계획 (${plans.length}건)
${JSON.stringify(plansFormatted, null, 2)}

## 실제 기록 (${logs.length}건)
${JSON.stringify(logsFormatted, null, 2)}

위 데이터를 기반으로 종합적인 학습 분석을 JSON 형식으로 제공해 주세요.`;

  try {
    const result = await model.generateContent([
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: '네, 학습 데이터를 분석하여 JSON 형식으로 결과를 제공하겠습니다.' }] },
      { role: 'user', parts: [{ text: userPrompt }] },
    ] as never);

    const response = result.response;
    const text = response.text();
    const analysis: AIAnalysis = JSON.parse(text);

    return analysis;
  } catch (error) {
    console.error('[Gemini] 학습 데이터 분석 실패:', error);

    // 폴백 응답 반환
    return {
      summary: '분석 데이터가 부족하여 상세한 분석을 제공할 수 없습니다. 더 많은 기록을 남겨주세요.',
      focusTimeAnalysis: {
        peakHours: [],
        lowHours: [],
      },
      categoryBalance: [],
      executionRate: {
        overall: 0,
        byCategory: [],
      },
      suggestions: [
        '학습 기록을 꾸준히 남겨보세요.',
        '계획을 먼저 세우고 실행해 보세요.',
        '매일 최소 3개 이상의 기록을 남기면 정확한 분석이 가능합니다.',
      ],
      weeklyTrend: 'stable',
    };
  }
}

// ============================================================
// 콘텐츠 자동 태깅
// ============================================================

// 유효한 카테고리 목록
const VALID_CATEGORIES = [
  '수업',
  '숙제',
  '개인공부',
  '잠',
  '이동시간',
  '식사',
  '휴식',
  '기타',
] as const;

/**
 * 자유 입력 텍스트를 카테고리로 자동 분류
 * @param content - 분류할 텍스트
 * @returns 카테고리 이름
 */
export async function autoTagContent(content: string): Promise<string> {
  if (!content || content.trim().length === 0) {
    return '기타';
  }

  const model = getModel();

  const prompt = `당신은 학습 활동 분류기입니다. 주어진 텍스트를 아래 카테고리 중 하나로 분류해 주세요.

카테고리 목록:
- 수업: 강의, 수업, 특강, 세미나, 수강, 온라인 강의 등
- 숙제: 과제, 레포트, 발표 준비, 프로젝트, 실험 보고서 등
- 개인공부: 자습, 복습, 예습, 문제 풀이, 독서, 시험 공부, 코딩 연습 등
- 잠: 수면, 낮잠, 기상 등
- 이동시간: 통학, 이동, 등교, 하교, 버스, 지하철 등
- 식사: 아침, 점심, 저녁, 간식, 야식, 카페 등
- 휴식: 게임, 산책, 운동, 유튜브, SNS, 전화, 친구 만남 등
- 기타: 위 카테고리에 해당하지 않는 활동

반드시 다음 JSON 형식으로 응답하세요:
{ "category": "카테고리명" }

분류할 텍스트: "${content}"`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const parsed = JSON.parse(text);

    // 유효한 카테고리인지 확인
    if (
      parsed.category &&
      VALID_CATEGORIES.includes(parsed.category as typeof VALID_CATEGORIES[number])
    ) {
      return parsed.category;
    }

    return '기타';
  } catch (error) {
    console.error('[Gemini] 자동 태깅 실패:', error);

    // 간단한 키워드 기반 폴백
    return fallbackTagging(content);
  }
}

/**
 * Gemini API 실패 시 키워드 기반 폴백 분류
 */
function fallbackTagging(content: string): string {
  const text = content.toLowerCase();

  const keywordMap: [string[], string][] = [
    [['강의', '수업', '특강', '세미나', '수강'], '수업'],
    [['과제', '숙제', '레포트', '발표', '프로젝트', '보고서'], '숙제'],
    [['자습', '복습', '예습', '공부', '문제', '독서', '시험', '코딩', '풀이'], '개인공부'],
    [['수면', '잠', '낮잠', '기상', '취침'], '잠'],
    [['통학', '이동', '등교', '하교', '버스', '지하철', '택시'], '이동시간'],
    [['아침', '점심', '저녁', '식사', '간식', '야식', '카페', '밥'], '식사'],
    [['게임', '산책', '운동', '유튜브', '휴식', '친구', '전화', 'sns'], '휴식'],
  ];

  for (const [keywords, category] of keywordMap) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      return category;
    }
  }

  return '기타';
}
