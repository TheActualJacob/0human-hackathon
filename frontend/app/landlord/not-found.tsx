import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandlordNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold">404</h2>
        <p className="text-xl">Page not found</p>
        <p className="text-muted-foreground">
          This landlord page doesn't exist.
        </p>
        <Button asChild>
          <Link href="/landlord/dashboard">Go to Landlord Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}