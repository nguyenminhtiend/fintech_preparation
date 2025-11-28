import { ArrowLeftRight, ChevronRight, Home, Info, Receipt } from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const menuItems = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'Transfer', path: '/transfer', icon: ArrowLeftRight },
  { name: 'Transactions', path: '/transactions', icon: Receipt },
  { name: 'About', path: '/about', icon: Info },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-background">
      <div className="flex h-14 items-center border-b px-6">
        <h2 className="text-lg font-semibold tracking-tight">Dashboard</h2>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link key={item.path} to={item.path}>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start gap-3 font-normal',
                  isActive && 'bg-accent font-medium',
                )}
              >
                <Icon className="size-4" />
                <span>{item.name}</span>
                {isActive && <ChevronRight className="ml-auto size-4 opacity-50" />}
              </Button>
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
            U
          </div>
          <div className="flex-1 text-sm">
            <p className="font-medium">User</p>
            <p className="text-xs text-muted-foreground">user@example.com</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
