import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { AuthUser } from '@/lib/auth/client';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearAuth: () => void;
}

const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        loading: false,
        error: null,

        setUser: (user) => set({ user, error: null }),
        setLoading: (loading) => set({ loading }),
        setError: (error) => set({ error }),
        
        clearAuth: () => set({ 
          user: null, 
          error: null,
          loading: false 
        }),
      }),
      {
        name: 'auth-storage',
      }
    )
  )
);

export default useAuthStore;