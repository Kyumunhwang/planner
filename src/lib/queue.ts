// ============================================================
// DSMS - API 요청 큐 미들웨어
// 동시성 제한, 속도 제한, 재시도 로직
// ============================================================

type QueuedTask<T> = {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  userId?: string;
  retries: number;
};

// ---- 속도 제한 추적 ----
interface RateLimitEntry {
  timestamps: number[];
}

// ---- 요청 큐 클래스 ----
export class RequestQueue {
  private readonly concurrencyLimit: number;
  private readonly maxRequestsPerMinute: number;
  private readonly maxRetries: number;

  private activeCount: number = 0;
  private queue: QueuedTask<unknown>[] = [];
  private rateLimitMap: Map<string, RateLimitEntry> = new Map();

  constructor(
    concurrencyLimit: number = 3,
    maxRequestsPerMinute: number = 60,
    maxRetries: number = 3
  ) {
    this.concurrencyLimit = concurrencyLimit;
    this.maxRequestsPerMinute = maxRequestsPerMinute;
    this.maxRetries = maxRetries;
  }

  /**
   * 작업을 큐에 추가하고 결과를 반환하는 Promise를 반환
   * @param fn - 실행할 비동기 함수
   * @param userId - 속도 제한을 위한 사용자 식별자 (선택)
   */
  enqueue<T>(fn: () => Promise<T>, userId?: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        fn,
        resolve: resolve as (value: unknown) => void,
        reject,
        userId,
        retries: 0,
      });
      this.processQueue();
    });
  }

  /**
   * 큐에서 대기 중인 작업 처리
   */
  private processQueue(): void {
    while (this.activeCount < this.concurrencyLimit && this.queue.length > 0) {
      // 속도 제한을 통과하는 첫 번째 작업 찾기
      const taskIndex = this.queue.findIndex((task) =>
        this.checkRateLimit(task.userId)
      );

      if (taskIndex === -1) {
        // 모든 대기 작업이 속도 제한에 걸림 → 잠시 후 재시도
        setTimeout(() => this.processQueue(), 1000);
        break;
      }

      const task = this.queue.splice(taskIndex, 1)[0];
      this.executeTask(task);
    }
  }

  /**
   * 사용자별 속도 제한 확인
   */
  private checkRateLimit(userId?: string): boolean {
    if (!userId) return true;

    const now = Date.now();
    const entry = this.rateLimitMap.get(userId);

    if (!entry) return true;

    // 1분 이내의 요청만 카운트
    const recentTimestamps = entry.timestamps.filter(
      (ts) => now - ts < 60_000
    );
    entry.timestamps = recentTimestamps;

    return recentTimestamps.length < this.maxRequestsPerMinute;
  }

  /**
   * 속도 제한 기록 추가
   */
  private recordRequest(userId?: string): void {
    if (!userId) return;

    let entry = this.rateLimitMap.get(userId);
    if (!entry) {
      entry = { timestamps: [] };
      this.rateLimitMap.set(userId, entry);
    }
    entry.timestamps.push(Date.now());
  }

  /**
   * 작업 실행 (재시도 로직 포함)
   */
  private async executeTask(task: QueuedTask<unknown>): Promise<void> {
    this.activeCount++;
    this.recordRequest(task.userId);

    try {
      const result = await task.fn();
      task.resolve(result);
    } catch (error) {
      if (task.retries < this.maxRetries && this.isRetryableError(error)) {
        // 지수 백오프 재시도
        const delay = this.getBackoffDelay(task.retries);
        task.retries++;

        console.warn(
          `[RequestQueue] 재시도 ${task.retries}/${this.maxRetries} (${delay}ms 후)`
        );

        setTimeout(() => {
          this.queue.unshift(task);
          this.processQueue();
        }, delay);
      } else {
        task.reject(error);
      }
    } finally {
      this.activeCount--;
      this.processQueue();
    }
  }

  /**
   * 재시도 가능한 에러인지 확인
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // 네트워크 오류, 타임아웃, 서버 오류(5xx), 속도 제한(429)
      if (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnreset') ||
        message.includes('econnrefused') ||
        message.includes('fetch failed')
      ) {
        return true;
      }
    }

    // HTTP 상태 코드 기반 판단
    if (
      error &&
      typeof error === 'object' &&
      'status' in error
    ) {
      const status = (error as { status: number }).status;
      return status === 429 || status >= 500;
    }

    return false;
  }

  /**
   * 지수 백오프 딜레이 계산
   * @param retryCount - 현재 재시도 횟수
   * @returns 대기 시간 (밀리초)
   */
  private getBackoffDelay(retryCount: number): number {
    const baseDelay = 1000; // 1초
    const maxDelay = 30_000; // 최대 30초
    const jitter = Math.random() * 500; // 0-500ms 지터

    const delay = Math.min(
      baseDelay * Math.pow(2, retryCount) + jitter,
      maxDelay
    );

    return Math.round(delay);
  }

  /**
   * 현재 큐 상태 조회 (디버깅용)
   */
  getStatus(): {
    activeCount: number;
    queueLength: number;
    rateLimitedUsers: number;
  } {
    return {
      activeCount: this.activeCount,
      queueLength: this.queue.length,
      rateLimitedUsers: this.rateLimitMap.size,
    };
  }

  /**
   * 속도 제한 맵 정리 (오래된 엔트리 제거)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [userId, entry] of this.rateLimitMap.entries()) {
      entry.timestamps = entry.timestamps.filter((ts) => now - ts < 60_000);
      if (entry.timestamps.length === 0) {
        this.rateLimitMap.delete(userId);
      }
    }
  }
}

// ---- 싱글톤 인스턴스 ----
export const requestQueue = new RequestQueue(3, 60, 3);

export default requestQueue;

// 5분마다 오래된 속도 제한 기록 정리
if (typeof setInterval !== 'undefined') {
  setInterval(() => requestQueue.cleanup(), 5 * 60 * 1000);
}

