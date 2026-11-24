import React from 'react';
import AppLayout from '@/components/AppLayout';
import WatchlistScreen from './components/WatchlistScreen';

export default function WatchlistPage() {
  return (
    <AppLayout currentPath="/watchlist">
      <WatchlistScreen />
    </AppLayout>
  );
}
