'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import StoreProvider from '@/components/providers/StoreProvider';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicPage = pathname.startsWith('/pay/');

  if (isPublicPage) {
    return (
      <div className="min-h-full bg-background">
        {children}
      </div>
    );
  }

  return (
    <StoreProvider>
      <div className="flex h-full">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </StoreProvider>
  );
}
