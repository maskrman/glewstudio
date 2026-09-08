import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import ReceiptScreen from './components/ReceiptScreen';

export default function ReceiptPage() {
  return (
    <AppLayout currentPath="/receipt">
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <ReceiptScreen />
      </Suspense>
    </AppLayout>
  );
}
