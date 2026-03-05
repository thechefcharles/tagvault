'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { initPush } from '@/lib/native/push';

export function PushInit() {
  const router = useRouter();
  useEffect(() => {
    initPush((url) => router.push(url));
  }, [router]);
  return null;
}
