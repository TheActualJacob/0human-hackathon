'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import StoreProvider from '@/components/providers/StoreProvider';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/auth/client';

const supabase = createClient();

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Public pages — never show sidebar, never block on auth check
  const isPublicPage =
    pathname === '/' ||
    pathname.startsWith('/pay/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/demo');

  const [ready, setReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // Role from actual auth session — used for shared routes like /properties
  const [authRole, setAuthRole] = useState<UserRole>('landlord');

  // Derive role: explicit path prefixes override, shared routes use real auth role
  const userRole: UserRole = pathname.startsWith('/tenant/')
    ? 'tenant'
    : pathname.startsWith('/landlord/')
      ? 'landlord'
      : authRole;

  useEffect(() => {
    // Clear any previously corrupted auth-storage from the old persist middleware
    try { localStorage.removeItem('auth-storage'); } catch {}

    // Fast: use local session cache — no network round-trip
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      // user_metadata.role is embedded in the JWT — no extra DB call needed
      const role = session?.user?.user_metadata?.role as UserRole | undefined;
      if (role === 'tenant' || role === 'landlord') setAuthRole(role);
      setReady(true);
    });

    // Keep in sync if user logs in/out in another tab
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      const role = session?.user?.user_metadata?.role as UserRole | undefined;
      if (role === 'tenant' || role === 'landlord') setAuthRole(role);
      setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Public pages render instantly — no auth check needed
  if (isPublicPage) {
    return <div className="min-h-full bg-background">{children}</div>;
  }

  // Protected pages — wait only for the session cache (fast)
  if (!ready) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <div className="min-h-full bg-background">{children}</div>;
  }

  return (
    <StoreProvider>
      <div className="flex h-full">
        <Sidebar userRole={userRole} />
        <div className="flex flex-1 flex-col">
          <TopBar userRole={userRole} />
          <main className="flex-1 overflow-y-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </StoreProvider>
  );
}
