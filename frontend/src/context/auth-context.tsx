'use client';

import React, { createContext, useContext, useCallback, useEffect, useState, useRef } from 'react';
import { api, UserPublic } from '@/lib/api';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: UserPublic | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  demoLogin: (role?: 'owner' | 'collaborator') => Promise<{ success: boolean; error?: string }>;
  register: (data: { email: string; password: string; confirmPassword: string; displayName: string }) => Promise<{ success: boolean; error?: string }>;
  logout: (customRedirect?: string | unknown) => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (user: UserPublic) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/invite', '/share', '/checklist'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const initialCheckDone = useRef(false);

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Check authentication on mount
  const checkAuth = useCallback(async () => {
    try {
      const result = await api.getMe();
      if (result.success && result.data?.user) {
        setUser(result.data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
      initialCheckDone.current = true;
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Redirect logic
  useEffect(() => {
    if (isLoading || !initialCheckDone.current) return;

    if (!user && !isPublicPath) {
      const redirectTo = pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${redirectTo}`);
      return;
    }

    if (user && isPublicPath) {
      // Do not redirect away from active invitation or share links
      if (pathname.startsWith('/invite') || pathname.startsWith('/share')) {
        return;
      }

      // Check if an explicit redirect query parameter exists (e.g. ?redirect=/invite/...)
      let redirectTarget: string | null = null;
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const red = params.get('redirect');
        if (red && red.startsWith('/') && !red.startsWith('//')) {
          redirectTarget = red;
        }
      }

      if (redirectTarget) {
        router.replace(redirectTarget);
        return;
      }

      if (!user.onboardingComplete) {
        router.replace('/onboarding');
      } else {
        router.replace('/dashboard');
      }
    }

    if (user && !user.emailVerified && pathname !== '/verify-email/pending' && !isPublicPath && pathname !== '/onboarding') {
      // Allow non-verified users to access the app but show a banner
    }
  }, [user, isLoading, pathname, isPublicPath, router]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login({ email, password });
    if (result.success && result.data?.user) {
      setUser(result.data.user);
      return { success: true };
    }
    return { success: false, error: result.error?.message || 'Login failed' };
  }, []);

  const demoLogin = useCallback(async (role: 'owner' | 'collaborator' = 'owner') => {
    const result = await api.demoLogin(role);
    if (result.success && result.data?.user) {
      setUser(result.data.user);
      return { success: true };
    }
    return { success: false, error: result.error?.message || 'Demo authentication failed' };
  }, []);

  const register = useCallback(async (data: { email: string; password: string; confirmPassword: string; displayName: string }) => {
    const result = await api.register(data);
    if (result.success && result.data?.user) {
      setUser(result.data.user);
      return { success: true };
    }
    return { success: false, error: result.error?.message || 'Registration failed' };
  }, []);

  const logout = useCallback(async (customRedirect?: string | unknown) => {
    await api.logout();
    setUser(null);
    const target = typeof customRedirect === 'string' ? customRedirect : '/login';
    router.replace(target);
  }, [router]);

  const refreshUser = useCallback(async () => {
    const result = await api.getMe();
    if (result.success && result.data?.user) {
      setUser(result.data.user);
    }
  }, []);

  const updateUser = useCallback((updatedUser: UserPublic) => {
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        demoLogin,
        register,
        logout,
        refreshUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
