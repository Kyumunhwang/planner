'use client';

import { useRef, useCallback, useState } from 'react';
import type { TimeBlock as TimeBlockType } from '@/types';
import { getCategoryColor, slotToTime } from '@/types';
import styles from './TimeBlock.module.css';

const SLOT_HEIGHT = 48;

interface TimeBlockProps {
  block: TimeBlockType;
  onClick: (block: TimeBlockType) => void;
  onMove: (id: string, newStart: number) => void;
  onResize: (id: string, newEnd: number) => void;
}

export default function TimeBlockComponent({
  block,
  onClick,
  onMove,
  onResize,
}: TimeBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef({ y: 0, startSlot: 0 });
  const [dragOffset, setDragOffset] = useState(0);
  const [resizeOffset, setResizeOffset] = useState(0);

  const categoryColor = getCategoryColor(block.category);
  const duration = block.endSlot - block.startSlot;
  const isSmall = duration <= 1;
  const top = block.startSlot * SLOT_HEIGHT;
  const height = duration * SLOT_HEIGHT;

  const timeRange = `${slotToTime(block.startSlot)} - ${slotToTime(block.endSlot)}`;

  // ── Drag (move) ──────────────────────────────────────────────────────────
  const handleDragPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      setIsDragging(true);
      setDragOffset(0);
      dragStartRef.current = {
        y: e.clientY,
        startSlot: block.startSlot,
      };
    },
    [block.startSlot]
  );

  const handleDragPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      const deltaY = e.clientY - dragStartRef.current.y;
      setDragOffset(deltaY);
    },
    [isDragging]
  );

  const handleDragPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      target.releasePointerCapture(e.pointerId);
      setIsDragging(false);

      const deltaY = e.clientY - dragStartRef.current.y;
      const slotDelta = Math.round(deltaY / SLOT_HEIGHT);
      const newStart = dragStartRef.current.startSlot + slotDelta;
      setDragOffset(0);

      if (slotDelta !== 0) {
        onMove(block.id, newStart);
      }
    },
    [isDragging, block.id, onMove]
  );

  // ── Resize ───────────────────────────────────────────────────────────────
  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      setIsResizing(true);
      setResizeOffset(0);
      dragStartRef.current = {
        y: e.clientY,
        startSlot: block.endSlot,
      };
    },
    [block.endSlot]
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isResizing) return;
      e.preventDefault();
      const deltaY = e.clientY - dragStartRef.current.y;
      setResizeOffset(deltaY);
    },
    [isResizing]
  );

  const handleResizePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isResizing) return;
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      target.releasePointerCapture(e.pointerId);
      setIsResizing(false);

      const deltaY = e.clientY - dragStartRef.current.y;
      const slotDelta = Math.round(deltaY / SLOT_HEIGHT);
      const newEnd = dragStartRef.current.startSlot + slotDelta;
      setResizeOffset(0);

      if (slotDelta !== 0) {
        onResize(block.id, newEnd);
      }
    },
    [isResizing, block.id, onResize]
  );

  // ── Click ────────────────────────────────────────────────────────────────
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isDragging && !isResizing) {
        onClick(block);
      }
    },
    [block, onClick, isDragging, isResizing]
  );

  const isPlan = block.type === 'plan';
  const isUncompletedPlan = isPlan && !block.isCompleted;

  const dynamicTop = isDragging ? top + dragOffset : top;
  const dynamicHeight = isResizing ? height + resizeOffset : height;

  return (
    <div
      ref={blockRef}
      className={`${styles.block} ${block.isPriority ? styles.priority : ''} ${
        isUncompletedPlan ? styles.planIncomplete : ''
      } ${isDragging ? styles.dragging : ''} ${isResizing ? styles.resizing : ''}`}
      style={{
        top: `${dynamicTop}px`,
        height: `${Math.max(dynamicHeight, SLOT_HEIGHT)}px`,
        borderLeftColor: categoryColor,
        ['--cat-color' as string]: categoryColor,
      }}
      onClick={handleClick}
    >
      {/* Drag handle = entire body */}
      <div
        className={styles.body}
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerUp}
        onPointerCancel={handleDragPointerUp}
      >
        <div className={styles.header}>
          {block.isPriority && (
            <span className={styles.lockIcon} title="우선순위">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11.5 6V4.5a3.5 3.5 0 10-7 0V6H3v7a2 2 0 002 2h6a2 2 0 002-2V6h-1.5zM6 4.5a2 2 0 114 0V6H6V4.5z" />
              </svg>
            </span>
          )}
          <span className={`${styles.title} ${isSmall ? styles.titleSmall : ''}`}>
            {block.title}
          </span>
        </div>
        {!isSmall && (
          <span className={styles.timeLabel}>{timeRange}</span>
        )}
      </div>

      {/* Resize handle */}
      <div
        className={styles.resizeHandle}
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerCancel={handleResizePointerUp}
      />
    </div>
  );
}
