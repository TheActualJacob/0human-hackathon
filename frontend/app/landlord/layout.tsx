import { requireLandlord } from '@/lib/auth/server';

export default async function LandlordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireLandlord();

  return <>{children}</>;
}
