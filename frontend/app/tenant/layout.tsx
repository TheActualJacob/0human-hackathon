import { requireTenant } from '@/lib/auth/server';

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTenant();

  return <>{children}</>;
}
