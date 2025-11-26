import type { Route } from './+types/home';

import { Button } from '@/components/ui/button';

export function meta(_args: Route.MetaArgs) {
  return [
    { title: 'New React Router App' },
    { name: 'description', content: 'Welcome to React Router!' },
  ];
}

export default function Home() {
  return (
    <div className="p-10 flex flex-col items-center gap-4">
      <h1 className="text-3xl font-bold">Hello World</h1>
      <Button onClick={() => alert('It works!')}>Click me</Button>
    </div>
  );
}
