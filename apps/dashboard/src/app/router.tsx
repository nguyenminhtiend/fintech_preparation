import { createBrowserRouter, Navigate } from 'react-router';

// Placeholder components - will be implemented in later phases
const DashboardLayout = () => (
  <div className="flex h-screen items-center justify-center">
    <div className="text-center">
      <h1 className="text-4xl font-bold">Dashboard Layout</h1>
      <p className="mt-4 text-muted-foreground">Phase 1 Setup Complete - Ready for Phase 2!</p>
    </div>
  </div>
);

const DashboardHome = () => (
  <div className="p-8">
    <h2 className="text-2xl font-semibold">Dashboard Home</h2>
  </div>
);

const LoginPage = () => (
  <div className="flex h-screen items-center justify-center">
    <div className="text-center">
      <h1 className="text-3xl font-bold">Login Page</h1>
      <p className="mt-2 text-muted-foreground">Coming in Phase 4</p>
    </div>
  </div>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/dashboard',
    element: <DashboardLayout />,
    children: [
      {
        index: true,
        element: <DashboardHome />,
      },
      // More routes will be added in later phases
    ],
  },
]);
