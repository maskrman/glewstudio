import React from 'react';
import AppLayout from '@/components/AppLayout';
import AdminPanel from './components/AdminPanel';

export default function AdminPage() {
  return (
    <AppLayout currentPath="/admin">
      <AdminPanel />
    </AppLayout>
  );
}
