import { create } from 'zustand';
import { apiClient } from './api';
import type { AuthResponse, User, RoleName } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await apiClient.post<AuthResponse>('/api/v1/auth/login', {
        email,
        password,
      });
      const { user, accessToken } = response;
      localStorage.setItem('token', accessToken);
      localStorage.setItem('user', JSON.stringify(user));
      set({
        user,
        token: accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
    window.location.href = '/login';
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        set({
          user,
          token,
          isAuthenticated: true,
        });
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  },
}));

/** Extract the council IDs the current user is scoped to (via council roles). */
export function getUserCouncilIds(user: User | null): string[] {
  if (!user) return [];
  const councilRoles: RoleName[] = [
    'COUNCIL_SECRETARY',
    'COUNCIL_PRESIDENT',
    'COUNCIL_MEMBER',
    'COUNCIL_STAFF',
    'EXAM_OFFICER',
  ];
  return user.roles
    .filter((r) => councilRoles.includes(r.code) && r.councilId)
    .map((r) => r.councilId!);
}

/** Check if the user has a global role that bypasses council scoping. */
export function isGlobalRole(user: User | null): boolean {
  if (!user) return false;
  const codes = user.roles.map((r) => r.code);
  return (
    codes.includes('SYSTEM_ADMIN') ||
    codes.includes('GENERAL_SECRETARY') ||
    codes.includes('GS_OFFICE_STAFF')
  );
}
