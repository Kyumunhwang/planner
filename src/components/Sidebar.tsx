'use client';

import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useCallback } from 'react';
import styles from './Sidebar.module.css';

// ---- 네비게이션 항목 ----
const NAV_ITEMS = [
  {
    href: '/',
    label: '캘린더',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <rect x="7" y="14" width="3" height="3" rx="0.5" />
      </svg>
    ),
  },
  {
    href: '/dashboard',
    label: '대시보드',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const toggleMobile = useCallback(() => {
    setIsMobileOpen((prev) => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  const handleSignOut = useCallback(() => {
    signOut({ callbackUrl: '/login' });
  }, []);

  // 로그인 페이지에서는 사이드바 숨김
  if (pathname === '/login') return null;

  return (
    <>
      {/* 모바일 햄버거 버튼 */}
      <button
        className={styles.mobileToggle}
        onClick={toggleMobile}
        aria-label="메뉴 열기"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* 모바일 오버레이 */}
      {isMobileOpen && (
        <div className={styles.overlay} onClick={closeMobile} />
      )}

      {/* 사이드바 */}
      <aside
        className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''} ${
          isMobileOpen ? styles.mobileOpen : ''
        }`}
      >
        {/* 헤더 영역 */}
        <div className={styles.header}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="url(#logo-gradient)" />
                <path d="M10 22V10h5.5c1.5 0 2.7.4 3.5 1.2.8.8 1.2 1.8 1.2 3 0 1.2-.4 2.2-1.2 3-.8.8-2 1.2-3.5 1.2H13v3.6H10z" fill="white" fillOpacity="0.95" />
                <defs>
                  <linearGradient id="logo-gradient" x1="0" y1="0" x2="32" y2="32">
                    <stop stopColor="hsl(255, 90%, 65%)" />
                    <stop offset="1" stopColor="hsl(275, 85%, 55%)" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            {!isCollapsed && (
              <div className={styles.logoText}>
                <span className={styles.logoTitle}>DSMS</span>
                <span className={styles.logoSubtitle}>Study Planner</span>
              </div>
            )}
          </div>

          {/* 접기/펼치기 토글 */}
          <button
            className={styles.collapseBtn}
            onClick={toggleCollapse}
            aria-label={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: isCollapsed ? 'rotate(180deg)' : 'none',
                transition: 'transform 250ms ease',
              }}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        {/* 네비게이션 */}
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${
                  isActive ? styles.navItemActive : ''
                }`}
                onClick={closeMobile}
                title={item.label}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {!isCollapsed && (
                  <span className={styles.navLabel}>{item.label}</span>
                )}
                {isActive && <div className={styles.activeIndicator} />}
              </Link>
            );
          })}
        </nav>

        {/* 하단 사용자 프로필 */}
        <div className={styles.footer}>
          {session?.user ? (
            <>
              <div className={styles.userInfo}>
                <div className={styles.avatar}>
                  {session.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.user.image}
                      alt={session.user.name || '프로필'}
                      className={styles.avatarImg}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className={styles.avatarFallback}>
                      {(session.user.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                {!isCollapsed && (
                  <div className={styles.userDetails}>
                    <span className={styles.userName}>
                      {session.user.name || '사용자'}
                    </span>
                    <span className={styles.userEmail}>
                      {session.user.email || ''}
                    </span>
                  </div>
                )}
              </div>

              <button
                className={styles.signOutBtn}
                onClick={handleSignOut}
                title="로그아웃"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                {!isCollapsed && <span>로그아웃</span>}
              </button>
            </>
          ) : (
            !isCollapsed && (
              <div className={styles.loginPrompt}>
                <Link href="/login" className={styles.loginBtn}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  <span>로그인</span>
                </Link>
              </div>
            )
          )}
        </div>
      </aside>
    </>
  );
}
