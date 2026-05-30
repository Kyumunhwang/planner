'use client';

import { useRef, useState, useCallback } from 'react';
import styles from './DateNavigator.module.css';

interface DateNavigatorProps {
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function formatKoreanDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dayOfWeek = DAY_NAMES[d.getDay()];
  return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DateNavigator({ selectedDate, onDateChange }: DateNavigatorProps) {
  const [showPicker, setShowPicker] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const goToPrevDay = useCallback(() => {
    onDateChange(addDays(selectedDate, -1));
  }, [selectedDate, onDateChange]);

  const goToNextDay = useCallback(() => {
    onDateChange(addDays(selectedDate, 1));
  }, [selectedDate, onDateChange]);

  const goToToday = useCallback(() => {
    onDateChange(todayString());
  }, [onDateChange]);

  const handleDateTextClick = useCallback(() => {
    setShowPicker(true);
    // Focus the hidden input after state update
    setTimeout(() => {
      dateInputRef.current?.showPicker?.();
      dateInputRef.current?.focus();
    }, 50);
  }, []);

  const handleDateInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value) {
        onDateChange(e.target.value);
      }
      setShowPicker(false);
    },
    [onDateChange]
  );

  const handleDateInputBlur = useCallback(() => {
    setShowPicker(false);
  }, []);

  const isToday = selectedDate === todayString();

  return (
    <nav className={styles.navigator}>
      <button
        className={styles.arrowBtn}
        onClick={goToPrevDay}
        aria-label="이전 날"
        title="이전 날"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <div className={styles.center}>
        <button
          className={styles.dateText}
          onClick={handleDateTextClick}
          title="날짜 선택"
        >
          {formatKoreanDate(selectedDate)}
        </button>

        {!isToday && (
          <button className={styles.todayBtn} onClick={goToToday}>
            오늘
          </button>
        )}

        <input
          ref={dateInputRef}
          type="date"
          className={styles.hiddenInput}
          value={selectedDate}
          onChange={handleDateInputChange}
          onBlur={handleDateInputBlur}
          tabIndex={showPicker ? 0 : -1}
        />
      </div>

      <button
        className={styles.arrowBtn}
        onClick={goToNextDay}
        aria-label="다음 날"
        title="다음 날"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </nav>
  );
}
