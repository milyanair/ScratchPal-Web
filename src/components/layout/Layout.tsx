import { ReactNode } from 'react';
import { Header } from './Header';
import { BottomNav } from './BottomNav';

interface LayoutProps {
  children: ReactNode;
  hideNav?: boolean;
}

export function Layout({ children, hideNav = false }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col relative">
      <Header />
      <main className={`flex-1 ${hideNav ? 'pb-4' : 'pb-20'} relative z-0`}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
