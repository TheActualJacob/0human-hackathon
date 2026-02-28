'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getCurrentUser } from '@/lib/auth/client';

export default function NotFound() {
  const pathname = usePathname();
  const [homeUrl, setHomeUrl] = useState('/');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function determineHome() {
      try {
        // Check if we're already in a role-specific area
        if (pathname.startsWith('/landlord/')) {
          setHomeUrl('/landlord/dashboard');
          setLoading(false);
          return;
        } else if (pathname.startsWith('/tenant/')) {
          setHomeUrl('/tenant/dashboard');
          setLoading(false);
          return;
        }

        // Otherwise, check the logged-in user's role
        const user = await getCurrentUser();
        if (user) {
          if (user.role === 'landlord') {
            setHomeUrl('/landlord/dashboard');
          } else if (user.role === 'tenant') {
            setHomeUrl('/tenant/dashboard');
          }
        }
      } catch (error) {
        console.error('Error determining home URL:', error);
      } finally {
        setLoading(false);
      }
    }

    determineHome();
  }, [pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold">404</h2>
        <p className="text-xl">Page not found</p>
        <p className="text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <Button asChild disabled={loading}>
          <Link href={homeUrl}>
            {loading ? 'Loading...' : 'Go to Dashboard'}
          </Link>
        </Button>
      </div>
    </div>
  );
}