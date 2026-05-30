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

  // Teacher & Student states
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [students, setStudents] = useState<{ user_id: string; email: string; name: string }[]>([]);

  const isTeacher = useMemo(() => {
    return session?.user?.email === 'kyumun.hwang@gmail.com';
  }, [session]);

  useEffect(() => {
    if (isTeacher) {
      fetch('/api/students')
        .then((res) => res.json())
        .then((data) => {
          if (data.students) {
            setStudents(data.students);
          }
        })
        .catch((err) => console.error('Failed to load students:', err));
    }
  }, [isTeacher]);

  const isReadOnly = useMemo(() => {
    return !!(selectedStudentId && selectedStudentId !== session?.user?.user_id);
  }, [selectedStudentId, session]);

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
  } = useCalendar(selectedStudentId || undefined);

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
    if (isReadOnly) return;
    setSelectedBlock(undefined);
    setDefaultStartSlot(slot);
    setDefaultEndSlot(slot + 2); // default 1 hour (2 slots)
    setIsModalOpen(true);
  }, [isReadOnly]);

  const handleRangeSelect = useCallback((start: number, end: number) => {
    if (isReadOnly) return;
    setSelectedBlock(undefined);
    setDefaultStartSlot(start);
    setDefaultEndSlot(end);
    setIsModalOpen(true);
  }, [isReadOnly]);

  const handleBlockClick = useCallback((block: TimeBlock) => {
    setSelectedBlock(block);
    setIsModalOpen(true);
  }, []);

  const handleSaveBlock = useCallback(
    (blockData: Partial<TimeBlock>) => {
      if (isReadOnly) return;
      if (blockData.id) {
        // Edit existing
        updateBlock(blockData.id, blockData);
      } else {
        // Create new
        addBlock(blockData as Omit<TimeBlock, 'id'>);
      }
    },
    [addBlock, updateBlock, isReadOnly]
  );

  const handleDeleteBlock = useCallback(
    (id: string) => {
      if (isReadOnly) return;
      deleteBlock(id);
    },
    [deleteBlock, isReadOnly]
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

      {/* ── Date Navigator & Student Selector ── */}
      <div className={styles.navSection}>
        <DateNavigator selectedDate={selectedDate} onDateChange={setSelectedDate} />
        
        {isTeacher && (
          <div className={styles.studentFilter}>
            <label htmlFor="student-select" className={styles.filterLabel}>
              👨‍🏫 학생 모니터링:
            </label>
            <select
              id="student-select"
              className={styles.filterSelect}
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              <option value="">나의 캘린더</option>
              {students.map((student) => (
                <option key={student.user_id} value={student.user_id}>
                  {student.name} ({student.email})
                </option>
              ))}
            </select>
          </div>
        )}
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
            onBlockMove={isReadOnly ? () => {} : moveBlock}
            onBlockResize={isReadOnly ? () => {} : resizeBlock}
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
        readOnly={isReadOnly}
      />
    </div>
  );
}
