import { Link, useLocation } from 'react-router';

import { cn } from '@/lib/utils';

const menuItems = [
  { name: 'Home', path: '/' },
  { name: 'Transfer', path: '/transfer' },
  { name: 'Transactions', path: '/transactions' },
  { name: 'About', path: '/about' },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Dashboard</h2>
      </div>
      <nav>
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={cn(
                  'block px-4 py-2 rounded-lg transition-colors',
                  location.pathname === item.path
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                )}
              >
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
