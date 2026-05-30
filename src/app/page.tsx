'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useCalendar } from '@/hooks/useCalendar';
import DateNavigator from '@/components/Calendar/DateNavigator';
import TimeGrid from '@/components/Calendar/TimeGrid';
import BlockModal from '@/components/Calendar/BlockModal';
import type { TimeBlock } from '@/types';
import styles from './page.module.css';

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  // Calendar hook
  const {
    blocks,
    selectedDate,
    isLoading,
    error,
    addBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
    resizeBlock,
    setSelectedDate,
  } = useCalendar();

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<TimeBlock | undefined>(undefined);
  const [defaultStartSlot, setDefaultStartSlot] = useState<number | undefined>(undefined);
  const [defaultEndSlot, setDefaultEndSlot] = useState<number | undefined>(undefined);

  // Stats calculation
  const stats = useMemo(() => {
    let planned = 0;
    let actual = 0;

    blocks.forEach((block) => {
      const duration = (block.endSlot - block.startSlot) * 0.5;
      if (block.type === 'plan') {
        planned += duration;
      } else {
        actual += duration;
      }
    });

    return { planned, actual };
  }, [blocks]);

  // Action handlers
  const handleSlotClick = useCallback((slot: number) => {
    setSelectedBlock(undefined);
    setDefaultStartSlot(slot);
    setDefaultEndSlot(slot + 2); // default 1 hour (2 slots)
    setIsModalOpen(true);
  }, []);

  const handleRangeSelect = useCallback((start: number, end: number) => {
    setSelectedBlock(undefined);
    setDefaultStartSlot(start);
    setDefaultEndSlot(end);
    setIsModalOpen(true);
  }, []);

  const handleBlockClick = useCallback((block: TimeBlock) => {
    setSelectedBlock(block);
    setIsModalOpen(true);
  }, []);

  const handleSaveBlock = useCallback(
    (blockData: Partial<TimeBlock>) => {
      if (blockData.id) {
        // Edit existing
        updateBlock(blockData.id, blockData);
      } else {
        // Create new
        addBlock(blockData as Omit<TimeBlock, 'id'>);
      }
    },
    [addBlock, updateBlock]
  );

  const handleDeleteBlock = useCallback(
    (id: string) => {
      deleteBlock(id);
    },
    [deleteBlock]
  );

  if (status === 'loading' || (status === 'unauthenticated')) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* ── Page Header ── */}
      <header className={styles.header}>
        <div className={styles.headerTitleSection}>
          <h1 className={styles.title}>오늘의 몰입</h1>
          <p className={styles.subtitle}>시간 블록을 더블클릭하거나 드래그하여 하루를 기록하세요.</p>
        </div>

        {/* Stats card */}
        <div className={styles.statsCard}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>계획 시간</span>
            <span className={styles.statValue}>{stats.planned}시간</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statLabel}>실제 실행</span>
            <span className={`${styles.statValue} ${styles.statValueActual}`}>{stats.actual}시간</span>
          </div>
        </div>
      </header>

      {/* ── Date Navigator ── */}
      <div className={styles.navSection}>
        <DateNavigator selectedDate={selectedDate} onDateChange={setSelectedDate} />
      </div>

      {/* ── Error message ── */}
      {error && (
        <div className={styles.errorAlert}>
          <svg className={styles.errorIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* ── Time Grid Area ── */}
      <div className={styles.gridSection}>
        {isLoading ? (
          <div className={styles.skeletonContainer}>
            <div className={styles.skeletonGrid}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className={styles.skeletonRow} />
              ))}
            </div>
          </div>
        ) : (
          <TimeGrid
            blocks={blocks}
            onSlotClick={handleSlotClick}
            onRangeSelect={handleRangeSelect}
            onBlockClick={handleBlockClick}
            onBlockMove={moveBlock}
            onBlockResize={resizeBlock}
          />
        )}
      </div>

      {/* ── Block Detail Modal ── */}
      <BlockModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveBlock}
        onDelete={handleDeleteBlock}
        block={selectedBlock}
        defaultStartSlot={defaultStartSlot}
        defaultEndSlot={defaultEndSlot}
      />
    </div>
  );
}
