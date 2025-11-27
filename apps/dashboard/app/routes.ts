import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('transfer', 'routes/transfer.tsx'),
  route('transactions', 'routes/transactions.tsx'),
  route('about', 'routes/about.tsx'),
] satisfies RouteConfig;
