import { PendingInvitesBanner } from '@/components/PendingInvitesBanner';

export const dynamic = 'force-dynamic';

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PendingInvitesBanner />
      {children}
    </>
  );
}
