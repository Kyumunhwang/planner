'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import styles from './login.module.css';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect to main page if already logged in
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [status, router]);

  const handleGoogleLogin = () => {
    signIn('google', { callbackUrl: '/' });
  };

  if (status === 'loading') {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.backgroundBlur} />
      <div className={styles.card}>
        <div className={styles.logoSection}>
          <div className={styles.logoIcon}>
            <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#login-logo-gradient)" />
              <path d="M10 22V10h5.5c1.5 0 2.7.4 3.5 1.2.8.8 1.2 1.8 1.2 3 0 1.2-.4 2.2-1.2 3-.8.8-2 1.2-3.5 1.2H13v3.6H10z" fill="white" fillOpacity="0.95" />
              <defs>
                <linearGradient id="login-logo-gradient" x1="0" y1="0" x2="32" y2="32">
                  <stop stopColor="hsl(255, 90%, 65%)" />
                  <stop offset="1" stopColor="hsl(275, 85%, 55%)" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className={styles.title}>DSMS</h1>
          <p className={styles.subtitle}>Daily Study Management System</p>
        </div>

        <div className={styles.divider} />

        <div className={styles.infoSection}>
          <p className={styles.infoText}>
            30분 단위 시간 계획 및 실행 기록 관리,<br />
            그리고 Gemini AI가 제공하는 초인적 집중력 코치.
          </p>
        </div>

        <button className={styles.loginBtn} onClick={handleGoogleLogin}>
          <svg className={styles.googleIcon} viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="#EA4335"
              d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99c.9-2.7 3.4-4.51 6.76-4.51z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.44h6.44c-.28 1.48-1.12 2.73-2.38 3.57l3.7 2.87c2.16-2 3.43-4.94 3.43-8.54z"
            />
            <path
              fill="#FBBC05"
              d="M5.24 14.59c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.39 7.24C.5 9.02 0 11 0 13.11s.5 4.09 1.39 5.87l3.85-2.99z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.7-2.87c-1.03.69-2.35 1.1-4.26 1.1-3.36 0-5.86-1.81-6.76-4.51L1.39 16.8C3.37 20.69 7.35 23 12 23z"
            />
          </svg>
          <span>Google 계정으로 로그인</span>
        </button>

        <div className={styles.noticeSection}>
          <div className={styles.noticeIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <p className={styles.noticeText}>
            이 시스템은 모든 학생에게 공개되어 있습니다.<br />
            구글 계정으로 손쉽게 로그인하여 바로 시작해 보세요.
          </p>
        </div>
      </div>
    </div>
  );
}
