'use client';

import { useEffect } from 'react';
import { initializeStore } from '@/lib/store/initializeStore';

export default function StoreProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializeStore();
  }, []);

  return <>{children}</>;
}