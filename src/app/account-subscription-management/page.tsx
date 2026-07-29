import React from 'react';
import AppLayout from '@/components/AppLayout';
import AccountScreen from './components/AccountScreen';

export default function AccountPage() {
  return (
    <AppLayout currentPath="/account-subscription-management" fullWidth>
      <AccountScreen />
    </AppLayout>
  );
}