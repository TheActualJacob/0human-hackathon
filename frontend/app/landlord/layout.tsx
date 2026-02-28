// import { requireLandlord } from '@/lib/auth/server';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { requireLandlord } from '@/lib/auth/server';

export default async function LandlordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Restore auth requirement
  await requireLandlord();

  return (
    <div className="flex h-screen">
      <Sidebar userRole="landlord" />
      <div className="flex-1 flex flex-col">
        <TopBar userRole="landlord" />
        <main className="flex-1 overflow-auto bg-muted/50">
          {children}
        </main>
      </div>
    </div>
  );
}
