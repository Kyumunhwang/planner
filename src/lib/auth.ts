// ============================================================
// DSMS - NextAuth v5 인증 설정
// Google OAuth + JWT + Google Sheets 사용자 관리
// ============================================================

import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { getSheetData, appendRows, findRows } from './google-sheets';

// ---- next-auth 타입 확장 ----
declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      user_id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    user_id?: string;
  }
}

declare module 'next-auth' {
  interface JWT {
    user_id?: string;
  }
}

// ---- UUID 생성 (crypto 기반) ----
function generateUserId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // 폴백: 타임스탬프 기반 ID
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ---- NextAuth 설정 ----
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30일
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    /**
     * 로그인 콜백: 사용자 등록 및 인원 제한 처리
     */
    async signIn({ user }) {
      try {
        const email = user.email;
        if (!email) return false;

        // 이메일로 기존 사용자 검색 (USERS 시트의 email 열 = index 1)
        const existingUsers = await findRows('USERS', 1, email);

        if (existingUsers.length > 0) {
          // 기존 사용자: 로그인 허용
          return true;
        }

        // 신규 사용자: 전체 사용자 수 확인
        const allUsers = await getSheetData('USERS');
        // 헤더 제외
        const userCount = Math.max(0, allUsers.length - 1);

        if (userCount >= 10) {
          // 최대 인원(10명) 초과 → 가입 거부
          console.warn(
            `[Auth] 최대 사용자 수 초과로 가입 거부: ${email}`
          );
          return false;
        }

        // 자동 등록
        const userId = generateUserId();
        const now = new Date().toISOString();

        await appendRows('USERS', [
          [userId, email, user.name || '', user.image || '', now],
        ]);

        console.log(`[Auth] 새 사용자 등록: ${email} (${userId})`);
        return true;
      } catch (error) {
        console.error('[Auth] 로그인 콜백 오류:', error);
        // 시트 연결 실패 시에도 로그인은 허용 (graceful degradation)
        return true;
      }
    },

    /**
     * JWT 콜백: 토큰에 user_id 추가
     */
    async jwt({ token, trigger }) {
      // 로그인 시 또는 토큰에 user_id가 없을 때 조회
      if (trigger === 'signIn' || !token.user_id) {
        try {
          if (token.email) {
            const users = await findRows('USERS', 1, token.email);
            if (users.length > 0) {
              token.user_id = users[0].data[0]; // user_id는 첫 번째 열
            }
          }
        } catch (error) {
          console.error('[Auth] JWT 콜백에서 user_id 조회 실패:', error);
        }
      }

      return token;
    },

    /**
     * 세션 콜백: session.user에 user_id 추가
     */
    async session({ session, token }) {
      if (token.user_id) {
        session.user.user_id = token.user_id as string;
      }
      return session;
    },

    /**
     * 리다이렉트 콜백
     */
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
});
