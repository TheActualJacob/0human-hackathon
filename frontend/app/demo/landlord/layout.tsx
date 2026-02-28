'use client';

import DemoSidebar from '@/components/demo/DemoSidebar';
import DemoTopBar from '@/components/demo/DemoTopBar';
import { useEffect } from 'react';
import { useDemoStore } from '@/lib/store/demo';

export default function DemoLandlordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialize = useDemoStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <div className="flex h-screen overflow-hidden">
      <DemoSidebar userRole="landlord" />
      <div className="flex-1 flex flex-col min-w-0">
        <DemoTopBar userRole="landlord" />
        <main className="flex-1 overflow-auto bg-muted/50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
