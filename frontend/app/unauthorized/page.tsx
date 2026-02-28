'use client';

import Link from 'next/link';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';

export default function UnauthorizedPage() {
  const pathname = usePathname();
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/50">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center h-20 w-20 bg-destructive/10 rounded-full">
          <ShieldX className="h-10 w-10 text-destructive" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access this page. This area is restricted to {' '}
            {pathname.includes('/landlord/') ? 'landlords' : 'tenants'} only.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="default">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go to Home
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/auth/login">
              Sign in with different account
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}