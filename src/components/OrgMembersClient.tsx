'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Member = { user_id: string; role: string; email?: string };
type PendingInvite = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
};
type SeatUsage = {
  membersCount: number;
  pendingInvitesCount: number;
  seatLimit: number;
  overLimit: boolean;
};

export function OrgMembersClient({
  orgId,
  members,
  pendingInvites,
  seatUsage,
  currentUserId,
  canManage,
  isOwner,
}: {
  orgId: string;
  members: Member[];
  pendingInvites: PendingInvite[];
  seatUsage: SeatUsage;
  currentUserId: string;
  canManage: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteUpgrade, setInviteUpgrade] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteStatus('loading');
    setInviteError(null);
    setInviteLink(null);
    setInviteUpgrade(false);
    try {
      const res = await fetch(`/api/orgs/${orgId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteStatus('error');
        setInviteError(data.error ?? 'Failed to create invite');
        setInviteUpgrade(res.status === 402);
        return;
      }
      setInviteLink(data.invite_link ?? null);
      setInviteEmail('');
      router.refresh();
      setInviteStatus('idle');
    } catch {
      setInviteStatus('error');
      setInviteError('Something went wrong');
    }
  }

  async function revokeInvite(inviteId: string) {
    setActionTarget(inviteId);
    try {
      const res = await fetch(`/api/orgs/${orgId}/invites/${inviteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? 'Failed to revoke');
      } else {
        router.refresh();
      }
    } finally {
      setActionTarget(null);
    }
  }

  async function updateRole(memberUserId: string, newRole: string) {
    setActionTarget(memberUserId);
    try {
      const res = await fetch(`/api/orgs/${orgId}/members/${memberUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? 'Failed to update role');
      } else {
        router.refresh();
      }
    } finally {
      setActionTarget(null);
    }
  }

  async function removeMember(memberUserId: string) {
    if (!confirm('Remove this member from the organization?')) return;
    setActionTarget(memberUserId);
    try {
      const res = await fetch(`/api/orgs/${orgId}/members/${memberUserId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? 'Failed to remove');
      } else {
        router.refresh();
      }
    } finally {
      setActionTarget(null);
    }
  }

  const canChangeRole = (m: Member) =>
    isOwner && m.user_id !== currentUserId && m.role !== 'owner';
  const canRemove = (m: Member) => {
    if (m.user_id === currentUserId) return false;
    if (m.role === 'owner') return false;
    if (isOwner) return true;
    if (m.role === 'admin') return false;
    return canManage;
  };

  async function handleTransfer(newOwnerId: string) {
    if (!confirm('Transfer ownership to this member? You will become an admin.')) return;
    setActionTarget(newOwnerId);
    try {
      const res = await fetch(`/api/orgs/${orgId}/transfer-ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_owner_user_id: newOwnerId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? 'Failed to transfer');
      } else {
        router.refresh();
      }
    } finally {
      setActionTarget(null);
    }
  }

  async function handleLeave() {
    if (!confirm('Leave this organization?')) return;
    setActionTarget('leave');
    try {
      const res = await fetch(`/api/orgs/${orgId}/leave`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? 'Failed to leave');
      } else {
        router.push('/orgs');
        router.refresh();
      }
    } finally {
      setActionTarget(null);
    }
  }

  return (
    <div className="space-y-8">
      {seatUsage.overLimit && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Seat limit reached ({seatUsage.seatLimit})
          </p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            Upgrade to add more members.
          </p>
          <Link
            href="/pricing"
            className="mt-2 inline-block text-sm font-medium text-amber-800 underline dark:text-amber-200"
          >
            Upgrade plan →
          </Link>
        </div>
      )}

      <section>
        <h2 className="mb-2 text-lg font-medium">
          Members
          <span className="ml-2 text-sm font-normal text-neutral-500">
            Seats: {seatUsage.membersCount} / {seatUsage.seatLimit}
            {seatUsage.pendingInvitesCount > 0 && ` (pending: ${seatUsage.pendingInvitesCount})`}
          </span>
        </h2>
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between py-2">
              <div>
                <span className="font-medium">{m.email ?? m.user_id}</span>
                {m.user_id === currentUserId && (
                  <span className="ml-2 text-xs text-neutral-500">(you)</span>
                )}
                <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-xs dark:bg-neutral-700">
                  {m.role}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {canChangeRole(m) && (
                  <select
                    value={m.role}
                    onChange={(e) => updateRole(m.user_id, e.target.value)}
                    disabled={!!actionTarget}
                    className="rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800"
                  >
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                  </select>
                )}
                {isOwner && m.role !== 'owner' && (
                  <button
                    type="button"
                    onClick={() => handleTransfer(m.user_id)}
                    disabled={!!actionTarget}
                    className="text-sm text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
                  >
                    Transfer owner
                  </button>
                )}
                {canRemove(m) && (
                  <button
                    type="button"
                    onClick={() => removeMember(m.user_id)}
                    disabled={!!actionTarget}
                    className="text-sm text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {canManage && (
        <>
          <section>
            <h2 className="mb-2 text-lg font-medium">Invite by email</h2>
            <form onSubmit={handleInvite} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div>
                <label htmlFor="invite-email" className="block text-sm text-neutral-600 dark:text-neutral-400">
                  Email
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 dark:border-neutral-600 dark:bg-neutral-900"
                />
              </div>
              <div>
                <label htmlFor="invite-role" className="block text-sm text-neutral-600 dark:text-neutral-400">
                  Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}
                  className="mt-1 rounded border border-neutral-300 px-2 py-1.5 dark:border-neutral-600 dark:bg-neutral-900"
                >
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviteStatus === 'loading'}
                className="rounded bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                {inviteStatus === 'loading' ? 'Creating…' : 'Send invite'}
              </button>
            </form>
            {inviteStatus === 'error' && inviteError && (
              <div className="mt-2">
                <p className="text-sm text-red-600 dark:text-red-400">{inviteError}</p>
                {inviteUpgrade && (
                  <Link
                    href="/pricing"
                    className="mt-1 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Upgrade to add more members →
                  </Link>
                )}
              </div>
            )}
            {inviteLink && (
              <div className="mt-2 rounded border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-neutral-800">
                <p className="text-xs text-neutral-600 dark:text-neutral-400">Invite link (share once):</p>
                <code className="mt-1 block break-all text-sm">{inviteLink}</code>
              </div>
            )}
          </section>

          {pendingInvites.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-medium">Pending invites</h2>
              <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {pendingInvites.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between py-2">
                    <span>
                      {inv.email}
                      <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-xs dark:bg-neutral-700">
                        {inv.role}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => revokeInvite(inv.id)}
                      disabled={!!actionTarget}
                      className="text-sm text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {!isOwner && (
        <section>
          <h2 className="mb-2 text-lg font-medium">Leave organization</h2>
          <button
            type="button"
            onClick={handleLeave}
            disabled={!!actionTarget}
            className="rounded border border-red-200 bg-transparent px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Leave org
          </button>
        </section>
      )}
    </div>
  );
}
