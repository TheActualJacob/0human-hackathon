// import { requireTenant } from '@/lib/auth/server';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { requireTenant } from '@/lib/auth/server';

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Restore auth requirement
  await requireTenant();

  return (
    <div className="flex h-screen">
      <Sidebar userRole="tenant" />
      <div className="flex-1 flex flex-col">
        <TopBar userRole="tenant" />
        <main className="flex-1 overflow-auto bg-muted/50">
          {children}
        </main>
      </div>
    </div>
  );
}
