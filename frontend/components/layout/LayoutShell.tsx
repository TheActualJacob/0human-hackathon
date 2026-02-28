'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import StoreProvider from '@/components/providers/StoreProvider';
import { onAuthStateChange, getCurrentUser, type UserRole } from '@/lib/auth/client';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicPage = pathname.startsWith('/pay/');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('landlord');

  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange(async (_event, session) => {
      setIsLoggedIn(!!session);
      if (session) {
        const user = await getCurrentUser();
        if (user) setUserRole(user.role);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (isPublicPage || isLoggedIn === false) {
    return (
      <div className="min-h-full bg-background">
        {children}
      </div>
    );
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
