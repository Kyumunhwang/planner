'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './PomodoroTimer.module.css';

interface PomodoroTimerProps {
  duration?: number; // in minutes
  onComplete?: () => void;
  blockTitle?: string;
}

export default function PomodoroTimer({
  duration = 30,
  onComplete,
  blockTitle = '학습 세션',
}: PomodoroTimerProps) {
  const totalSeconds = duration * 60;
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Play audio beep when timer ends
  const playAlertSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      // Beep three times
      setTimeout(() => oscillator.stop(), 300);
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc2.connect(gainNode);
        osc2.start();
        setTimeout(() => osc2.stop(), 300);
      }, 500);
    } catch (e) {
      console.warn('Web Audio API beep failed:', e);
    }
  }, []);

  // Timer loop
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            if (timerRef.current) clearInterval(timerRef.current);
            playAlertSound();
            if (onComplete) onComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, onComplete, playAlertSound]);

  // Reset timer if duration prop changes
  useEffect(() => {
    setTimeLeft(duration * 60);
    setIsRunning(false);
  }, [duration]);

  const handleStartPause = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setTimeLeft(totalSeconds);
  }, [totalSeconds]);

  // Display calculations
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const displayTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // SVG Progress circle calculations
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeLeft / totalSeconds) * circumference;

  // Determine state class
  const getTimerStateClass = () => {
    if (timeLeft === 0) return styles.completed;
    if (timeLeft < 60) return styles.danger; // last 1 min
    if (timeLeft < 300) return styles.warning; // last 5 min
    return styles.normal;
  };

  return (
    <div className={`${styles.timerCard} ${getTimerStateClass()}`}>
      <h3 className={styles.header}>뽀모도로 타이머</h3>
      {blockTitle && <p className={styles.blockTitle}>{blockTitle}</p>}

      {/* SVG Ring progress */}
      <div className={styles.progressContainer}>
        <svg className={styles.progressSvg} width="220" height="220" viewBox="0 0 220 220">
          <circle
            className={styles.bgCircle}
            cx="110"
            cy="110"
            r={radius}
            strokeWidth="8"
          />
          <circle
            className={styles.fgCircle}
            cx="110"
            cy="110"
            r={radius}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className={styles.timeDisplay}>
          <span className={styles.timeText}>{displayTime}</span>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <button
          className={`${styles.btn} ${isRunning ? styles.btnPause : styles.btnStart}`}
          onClick={handleStartPause}
        >
          {isRunning ? '일시정지' : '시작'}
        </button>
        <button className={`${styles.btn} ${styles.btnReset}`} onClick={handleReset}>
          초기화
        </button>
      </div>
    </div>
  );
}
