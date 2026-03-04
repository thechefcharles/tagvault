import { PendingInvitesBanner } from '@/components/PendingInvitesBanner';
import { InstallPwaButton } from '@/components/InstallPwaButton';

export const dynamic = 'force-dynamic';

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PendingInvitesBanner />
      <div className="fixed right-4 top-4 z-40">
        <InstallPwaButton />
      </div>
      {children}
    </>
  );
}
