'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TimeBlock, SchedulePlan, ActualLog } from '@/types';
import { timeToSlot, slotToTime } from '@/types';

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Convert raw API plan to a TimeBlock.
 */
function planToBlock(p: SchedulePlan): TimeBlock {
  return {
    id: `plan-${p.plan_id}`,
    type: 'plan',
    title: p.task_title,
    category: p.category,
    startSlot: timeToSlot(p.start_time),
    endSlot: timeToSlot(p.end_time),
    isPriority: p.is_priority,
    isCompleted: false,
    planId: p.plan_id,
  };
}

/**
 * Convert raw API log to a TimeBlock.
 */
function logToBlock(l: ActualLog): TimeBlock {
  return {
    id: `log-${l.log_id}`,
    type: 'log',
    title: l.content || '기록',
    content: l.content,
    category: l.ai_tag || '기타',
    startSlot: timeToSlot(l.start_time),
    endSlot: timeToSlot(l.end_time),
    isPriority: false,
    isCompleted: true,
    logId: l.log_id,
    planId: l.plan_id ?? undefined,
  };
}

export function useCalendar(selectedStudentId?: string) {
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [selectedDate, setSelectedDateState] = useState<string>(todayString());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Keep a ref for rollback on optimistic failure
  const prevBlocksRef = useRef<TimeBlock[]>([]);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchBlocks = useCallback(async (date: string, studentId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const plansUrl = studentId ? `/api/plans?date=${date}&userId=${studentId}` : `/api/plans?date=${date}`;
      const logsUrl = studentId ? `/api/logs?date=${date}&userId=${studentId}` : `/api/logs?date=${date}`;
      
      const [plansRes, logsRes] = await Promise.all([
        fetch(plansUrl),
        fetch(logsUrl),
      ]);

      if (!plansRes.ok || !logsRes.ok) {
        throw new Error('일정 데이터를 불러오는데 실패했습니다.');
      }

      const plansData = await plansRes.json();
      const logsData = await logsRes.json();
      
      const plansList: SchedulePlan[] = plansData.plans || [];
      const logsList: ActualLog[] = logsData.logs || [];

      const merged: TimeBlock[] = [
        ...plansList.map(planToBlock),
        ...logsList.map(logToBlock),
      ];
      setBlocks(merged);
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(message);
      setBlocks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Add Block ────────────────────────────────────────────────────────────
  const addBlock = useCallback(
    async (block: Omit<TimeBlock, 'id'>) => {
      setError(null);
      const endpoint = block.type === 'plan' ? '/api/plans' : '/api/logs';

      const body =
        block.type === 'plan'
          ? {
              target_date: selectedDate,
              start_time: slotToTime(block.startSlot),
              end_time: slotToTime(block.endSlot),
              task_title: block.title,
              category: block.category,
              is_priority: block.isPriority,
            }
          : {
              log_date: selectedDate,
              start_time: slotToTime(block.startSlot),
              end_time: slotToTime(block.endSlot),
              content: block.content || block.title,
              ai_tag: block.category,
              plan_id: block.planId || null,
            };

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('블록 추가에 실패했습니다.');
        // Re-fetch to get server-generated IDs
        await fetchBlocks(selectedDate);
      } catch (err) {
        const message = err instanceof Error ? err.message : '블록 추가 중 오류가 발생했습니다.';
        setError(message);
      }
    },
    [selectedDate, fetchBlocks]
  );

  // ── Update Block ─────────────────────────────────────────────────────────
  const updateBlock = useCallback(
    async (id: string, updates: Partial<TimeBlock>) => {
      setError(null);
      prevBlocksRef.current = blocks;

      // Optimistic update
      setBlocks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
      );

      const block = blocks.find((b) => b.id === id);
      if (!block) return;

      const rawId = block.type === 'plan' ? block.planId : block.logId;
      const endpoint = block.type === 'plan' ? '/api/plans' : '/api/logs';

      const merged = { ...block, ...updates };
      const body =
        block.type === 'plan'
          ? {
              plan_id: rawId,
              start_time: slotToTime(merged.startSlot),
              end_time: slotToTime(merged.endSlot),
              task_title: merged.title,
              category: merged.category,
              is_priority: merged.isPriority,
            }
          : {
              log_id: rawId,
              start_time: slotToTime(merged.startSlot),
              end_time: slotToTime(merged.endSlot),
              content: merged.content || merged.title,
              ai_tag: merged.category,
            };

      try {
        const res = await fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('블록 수정에 실패했습니다.');
      } catch (err) {
        // Revert optimistic update
        setBlocks(prevBlocksRef.current);
        const message = err instanceof Error ? err.message : '블록 수정 중 오류가 발생했습니다.';
        setError(message);
      }
    },
    [blocks]
  );

  // ── Delete Block ─────────────────────────────────────────────────────────
  const deleteBlock = useCallback(
    async (id: string) => {
      setError(null);
      prevBlocksRef.current = blocks;

      const block = blocks.find((b) => b.id === id);
      if (!block) return;

      // Optimistic update
      setBlocks((prev) => prev.filter((b) => b.id !== id));

      const rawId = block.type === 'plan' ? block.planId : block.logId;
      const endpoint = block.type === 'plan' ? '/api/plans' : '/api/logs';
      const body = block.type === 'plan' ? { plan_id: rawId } : { log_id: rawId };

      try {
        const res = await fetch(endpoint, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('블록 삭제에 실패했습니다.');
      } catch (err) {
        setBlocks(prevBlocksRef.current);
        const message = err instanceof Error ? err.message : '블록 삭제 중 오류가 발생했습니다.';
        setError(message);
      }
    },
    [blocks]
  );

  // ── Move Block (drag) ────────────────────────────────────────────────────
  const moveBlock = useCallback(
    (id: string, newStartSlot: number) => {
      const block = blocks.find((b) => b.id === id);
      if (!block) return;
      const duration = block.endSlot - block.startSlot;
      const clampedStart = Math.max(0, Math.min(48 - duration, newStartSlot));
      updateBlock(id, {
        startSlot: clampedStart,
        endSlot: clampedStart + duration,
      });
    },
    [blocks, updateBlock]
  );

  // ── Resize Block ─────────────────────────────────────────────────────────
  const resizeBlock = useCallback(
    (id: string, newEndSlot: number) => {
      const block = blocks.find((b) => b.id === id);
      if (!block) return;
      const minEnd = block.startSlot + 1; // at least 1 slot
      const clampedEnd = Math.max(minEnd, Math.min(48, newEndSlot));
      updateBlock(id, { endSlot: clampedEnd });
    },
    [blocks, updateBlock]
  );

  // ── Set Date (with auto-fetch) ──────────────────────────────────────────
  const setSelectedDate = useCallback(
    (date: string) => {
      setSelectedDateState(date);
    },
    []
  );

  // Auto-fetch on mount, date change & student change
  useEffect(() => {
    fetchBlocks(selectedDate, selectedStudentId);
  }, [selectedDate, selectedStudentId, fetchBlocks]);

  return {
    blocks,
    selectedDate,
    isLoading,
    error,
    fetchBlocks,
    addBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
    resizeBlock,
    setSelectedDate,
  };
}
