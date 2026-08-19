import React from 'react';
import Topbar from './Topbar';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPath?: string;
  /**
   * @deprecated fullWidth has no effect — both branches render identically.
   * Kept for backward compatibility; will be removed in a future cleanup.
   */
  fullWidth?: boolean;
}

export default function AppLayout({
  children,
  currentPath = '',
  fullWidth: _fullWidth = false,
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Topbar currentPath={currentPath} />
      <main className="w-full">{children}</main>
    </div>
  );
}