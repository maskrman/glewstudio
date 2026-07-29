import React from 'react';
import Topbar from './Topbar';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPath?: string;
  fullWidth?: boolean;
}

export default function AppLayout({
  children,
  currentPath = '',
  fullWidth = false,
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Topbar currentPath={currentPath} />
      <main className={fullWidth ? 'w-full' : 'w-full'}>
        {children}
      </main>
    </div>
  );
}