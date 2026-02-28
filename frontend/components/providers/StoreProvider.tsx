'use client';

import { useEffect } from 'react';
import useStore from '@/lib/store/useStore';

export default function StoreProvider({ children }: { children: React.ReactNode }) {
  const fetchData = useStore((state) => state.fetchData);
  const setupSubscriptions = useStore((state) => state.setupSubscriptions);
  const cleanupSubscriptions = useStore((state) => state.cleanupSubscriptions);

  useEffect(() => {
    // Fetch initial data from Supabase
    fetchData();
    
    // Set up real-time subscriptions
    setupSubscriptions();
    
    // Cleanup on unmount
    return () => {
      cleanupSubscriptions();
    };
  }, [fetchData, setupSubscriptions, cleanupSubscriptions]);

  return <>{children}</>;
}