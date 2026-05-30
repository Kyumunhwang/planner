'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { TimeBlock as TimeBlockType } from '@/types';
import TimeBlockComponent from './TimeBlock';
import styles from './TimeGrid.module.css';

const SLOT_HEIGHT = 48;
const TOTAL_SLOTS = 48;

interface TimeGridProps {
  blocks: TimeBlockType[];
  onSlotClick: (slot: number) => void;
  onRangeSelect: (start: number, end: number) => void;
  onBlockClick: (block: TimeBlockType) => void;
  onBlockMove: (id: string, newStart: number) => void;
  onBlockResize: (id: string, newEnd: number) => void;
}

function getHourLabel(slot: number): string | null {
  if (slot % 2 !== 0) return null;
  return `${slot / 2}시`;
}

export default function TimeGrid({
  blocks,
  onSlotClick,
  onRangeSelect,
  onBlockClick,
  onBlockMove,
  onBlockResize,
}: TimeGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTimePos, setCurrentTimePos] = useState<number | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectStart, setSelectStart] = useState<number | null>(null);
  const [selectEnd, setSelectEnd] = useState<number | null>(null);

  // ── Current time indicator ──────────────────────────────────────────────
  const updateCurrentTime = useCallback(() => {
    const now = new Date();
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
    const pos = (minutesSinceMidnight / 30) * SLOT_HEIGHT;
    setCurrentTimePos(pos);
  }, []);

  useEffect(() => {
    updateCurrentTime();
    const interval = setInterval(updateCurrentTime, 60_000);
    return () => clearInterval(interval);
  }, [updateCurrentTime]);

  // ── Scroll to current time on mount ─────────────────────────────────────
  useEffect(() => {
    if (containerRef.current && currentTimePos !== null) {
      const scrollTo = Math.max(0, currentTimePos - 200);
      containerRef.current.scrollTop = scrollTo;
    }
    // Only scroll on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Slot index from pointer Y ──────────────────────────────────────────
  const getSlotFromY = useCallback((clientY: number): number => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollTop = containerRef.current.scrollTop;
    const y = clientY - rect.top + scrollTop;
    return Math.max(0, Math.min(TOTAL_SLOTS - 1, Math.floor(y / SLOT_HEIGHT)));
  }, []);

  // ── Range selection via pointer events ──────────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only select on left button on the grid area (not on blocks)
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      // If clicking on a block, don't start range selection
      if (target.closest('[data-block]')) return;

      const slot = getSlotFromY(e.clientY);
      setSelecting(true);
      setSelectStart(slot);
      setSelectEnd(slot);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [getSlotFromY]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!selecting) return;
      const slot = getSlotFromY(e.clientY);
      setSelectEnd(slot);
    },
    [selecting, getSlotFromY]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!selecting) return;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      setSelecting(false);

      if (selectStart !== null && selectEnd !== null) {
        const start = Math.min(selectStart, selectEnd);
        const end = Math.max(selectStart, selectEnd) + 1; // endSlot is exclusive
        if (start === end - 1) {
          onSlotClick(start);
        } else {
          onRangeSelect(start, end);
        }
      }
      setSelectStart(null);
      setSelectEnd(null);
    },
    [selecting, selectStart, selectEnd, onSlotClick, onRangeSelect]
  );

  // ── Selection highlight range ──────────────────────────────────────────
  const selectionRange =
    selectStart !== null && selectEnd !== null
      ? {
          top: Math.min(selectStart, selectEnd) * SLOT_HEIGHT,
          height:
            (Math.abs(selectEnd - selectStart) + 1) * SLOT_HEIGHT,
        }
      : null;

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className={styles.gridInner}
        style={{ height: `${TOTAL_SLOTS * SLOT_HEIGHT}px` }}
      >
        {/* ── Time labels + grid rows ── */}
        {Array.from({ length: TOTAL_SLOTS }, (_, i) => {
          const hourLabel = getHourLabel(i);
          const isHour = i % 2 === 0;
          const isPM = i >= 24;
          return (
            <div
              key={i}
              className={`${styles.row} ${isHour ? styles.hourRow : styles.halfRow} ${
                isPM ? styles.pmRow : ''
              }`}
              style={{ top: `${i * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
            >
              <div className={styles.gutter}>
                {hourLabel && (
                  <span className={styles.timeLabel}>{hourLabel}</span>
                )}
              </div>
              <div className={styles.cell} />
            </div>
          );
        })}

        {/* ── Selection overlay ── */}
        {selecting && selectionRange && (
          <div
            className={styles.selectionOverlay}
            style={{
              top: `${selectionRange.top}px`,
              height: `${selectionRange.height}px`,
            }}
          />
        )}

        {/* ── Time Blocks ── */}
        <div className={styles.blocksLayer}>
          {blocks.map((block) => (
            <TimeBlockComponent
              key={block.id}
              block={block}
              onClick={onBlockClick}
              onMove={onBlockMove}
              onResize={onBlockResize}
            />
          ))}
        </div>

        {/* ── Current time indicator ── */}
        {currentTimePos !== null && (
          <div
            className={styles.currentTime}
            style={{ top: `${currentTimePos}px` }}
          >
            <div className={styles.currentTimeDot} />
            <div className={styles.currentTimeLine} />
          </div>
        )}
      </div>
    </div>
  );
}
