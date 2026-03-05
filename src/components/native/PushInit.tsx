'use client';

import { useEffect } from 'react';
import { initPush } from '@/lib/native/push';

export function PushInit() {
  useEffect(() => {
    initPush();
  }, []);
  return null;
}
