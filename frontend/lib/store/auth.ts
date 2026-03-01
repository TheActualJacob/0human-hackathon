import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
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

// Auth state is intentionally NOT persisted to localStorage.
// The Supabase session is the source of truth and is rehydrated on every page load.
// Persisting AuthUser caused corruption bugs where the raw JWT string was stored
// as the user object, crashing with "Cannot create property 'user' on string".
const useAuthStore = create<AuthState>()(
  devtools(
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
    })
  )
);

export default useAuthStore;