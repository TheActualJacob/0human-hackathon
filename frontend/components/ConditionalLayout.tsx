'use client';

import { usePathname } from 'next/navigation';
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import StoreProvider from "@/components/providers/StoreProvider";

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicPage =
    pathname === '/' ||
    pathname.startsWith('/apply') ||
    pathname.startsWith('/sign') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/demo');

  if (isPublicPage) {
    return <>{children}</>;
  }

  return (
    <StoreProvider>
      <div className="flex h-full">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-y-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </StoreProvider>
  );
}
