import type { Route } from './+types/about';

export function meta(_args: Route.MetaArgs) {
  return [
    { title: 'About - Dashboard' },
    { name: 'description', content: 'Learn more about our dashboard' },
  ];
}

export default function About() {
  return (
    <div className="p-10 flex flex-col items-center gap-4">
      <h1 className="text-3xl font-bold">About Page</h1>
      <p className="text-gray-600">This is a simple about page example.</p>
    </div>
  );
}
