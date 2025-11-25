# Phase 1: Project Setup - Step-by-Step Guide

## Overview

This guide provides complete setup instructions for the dashboard application. We'll install only the essential packages needed to get the app running. Additional packages will be added as we build features.

---

## Step 1: Create Directory Structure

```bash
# Create the dashboard app directory structure
mkdir -p apps/dashboard/src/{app,components,lib,styles}
mkdir -p apps/dashboard/public
```

---

## Step 2: Create Package.json

Create `apps/dashboard/package.json`:

```json
{
  "name": "@fintech/dashboard",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "typecheck": "tsc -b --noEmit",
    "format": "prettier --write \"src/**/*.{ts,tsx,css}\""
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.1.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "@types/react": "^19.0.6",
    "@types/react-dom": "^19.0.2",
    "@vitejs/plugin-react-swc": "^3.7.2",
    "eslint": "^9.17.0",
    "eslint-plugin-react-hooks": "^5.1.0",
    "eslint-plugin-react-refresh": "^0.4.16",
    "globals": "^15.13.0",
    "prettier": "^3.4.2",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "typescript": "^5.7.2",
    "typescript-eslint": "^8.18.2",
    "vite": "^6.0.5"
  }
}
```

---

## Step 3: Install Dependencies

```bash
# Navigate to dashboard directory
cd apps/dashboard

# Install dependencies using pnpm
pnpm install

# Go back to root
cd ../..
```

---

## Step 4: TypeScript Configuration

Create `apps/dashboard/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "allowJs": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

Create `apps/dashboard/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true,
    "resolveJsonModule": true
  },
  "include": ["vite.config.ts"]
}
```

---

## Step 5: Vite Configuration

Create `apps/dashboard/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router'],
          'query-vendor': ['@tanstack/react-query'],
          'chart-vendor': ['recharts'],
        },
      },
    },
  },
});
```

---

## Step 6: TailwindCSS v4 Configuration

Create `apps/dashboard/tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

Create `apps/dashboard/postcss.config.js`:

```javascript
export default {
  plugins: {
    '@tailwindcss/vite': {},
    autoprefixer: {},
  },
};
```

---

## Step 7: Global Styles

Create `apps/dashboard/src/styles/globals.css`:

```css
@import 'tailwindcss';

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings:
      'rlig' 1,
      'calt' 1;
  }
}
```

---

## Step 8: Utility Functions

Create `apps/dashboard/src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatDate(date: Date | string, format: string = 'PP'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
```

---

## Step 9: React Router Configuration

Create `apps/dashboard/src/app/router.tsx`:

```typescript
import { createBrowserRouter, Navigate } from 'react-router';

// Placeholder components - will be implemented in later phases
const DashboardLayout = () => (
  <div className="flex h-screen items-center justify-center">
    <div className="text-center">
      <h1 className="text-4xl font-bold">Dashboard Layout</h1>
      <p className="mt-4 text-muted-foreground">
        Phase 1 Setup Complete - Ready for Phase 2!
      </p>
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
```

---

## Step 10: App Component

---

## Step 10: App Component

Create `apps/dashboard/src/app/App.tsx`:

```typescript
import { RouterProvider } from 'react-router';
import { router } from './router';

export function App() {
  return <RouterProvider router={router} />;
}
```

---

## Step 11: Main Entry Point

Create `apps/dashboard/src/main.tsx`:

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/globals.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

---

## Step 12: HTML Entry Point

Create `apps/dashboard/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Modern fintech dashboard application" />
    <title>Fintech Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## Step 13: Environment Variables

Create `apps/dashboard/.env.example`:

```bash
# API Configuration (will be used in Phase 2)
VITE_API_URL=http://localhost:3000/api
VITE_API_TIMEOUT=10000
```

Create `apps/dashboard/.env`:

```bash
# Copy from .env.example and customize
VITE_API_URL=http://localhost:3000/api
VITE_API_TIMEOUT=10000
```

---

## Step 14: ESLint Configuration

Create `apps/dashboard/eslint.config.js`:

```javascript
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
```

---

## Step 15: Prettier Configuration

Create `apps/dashboard/.prettierrc`:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

Create `apps/dashboard/.prettierignore`:

```
dist
node_modules
coverage
.next
.turbo
build
```

---

## Step 16: Git Ignore

Create `apps/dashboard/.gitignore`:

```
# Dependencies
node_modules
.pnp
.pnp.js

# Testing
coverage

# Production
dist
build

# Misc
.DS_Store
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
```

---

## Step 17: Update Root Package.json

Add these scripts to your root `package.json`:

```json
{
  "scripts": {
    "dev:dashboard": "pnpm --filter @fintech/dashboard dev",
    "build:dashboard": "pnpm --filter @fintech/dashboard build",
    "preview:dashboard": "pnpm --filter @fintech/dashboard preview",
    "lint:dashboard": "pnpm --filter @fintech/dashboard lint",
    "typecheck:dashboard": "pnpm --filter @fintech/dashboard typecheck",
    "format:dashboard": "pnpm --filter @fintech/dashboard format"
  }
}
```

---

## Step 18: Update pnpm-workspace.yaml

Ensure `pnpm-workspace.yaml` at root includes:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

---

## Step 19: VS Code Settings (Optional)

Create `apps/dashboard/.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

Create `apps/dashboard/.vscode/extensions.json`:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss"
  ]
}
```

---

## Step 20: Verify Installation

Run these commands to verify everything is set up correctly:

```bash
# From root directory
cd apps/dashboard

# Check if all dependencies are installed
pnpm list

# Run type check
pnpm typecheck

# Run linter
pnpm lint

# Start dev server
pnpm dev
```

The dev server should start at `http://localhost:5173`

---

## Step 21: Test the Setup

Visit `http://localhost:5173` in your browser. You should see:

- "Dashboard Layout" text displayed with "Phase 1 Setup Complete - Ready for Phase 2!"
- No console errors
- React DevTools showing the app is running in React 19
- Styled text with TailwindCSS classes working

---

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Module Resolution Issues

```bash
# Clear pnpm cache and reinstall
pnpm store prune
rm -rf node_modules
pnpm install
```

### TypeScript Errors

```bash
# Restart TypeScript server in VS Code
# CMD/CTRL + Shift + P -> "TypeScript: Restart TS Server"
```

---

## Package Installation Summary

### Core Dependencies (Installed)

- **react** `^19.0.0` - Latest React with concurrent features
- **react-dom** `^19.0.0` - React DOM rendering
- **react-router** `^7.1.1` - Latest React Router v7 for routing

### Dev Dependencies (Installed)

- **vite** `^6.0.5` - Latest Vite build tool
- **typescript** `^5.7.2` - Latest TypeScript
- **tailwindcss** `^4.0.0` - Latest TailwindCSS v4
- **@tailwindcss/vite** `^4.0.0` - TailwindCSS Vite plugin
- **@vitejs/plugin-react-swc** `^3.7.2` - React plugin with SWC
- **eslint** `^9.17.0` - Latest ESLint
- **prettier** `^3.4.2` - Latest Prettier
- **typescript-eslint** `^8.18.2` - TypeScript ESLint plugin

### Packages to Add Later (When Needed)

These will be installed in future phases:

- `@tanstack/react-query` - Phase 2 (API integration)
- `@tanstack/react-table` - Phase 5.3 (Transaction tables)
- `react-hook-form` - Phase 4 (Forms)
- `zod` - Phase 4 (Validation)
- `axios` - Phase 2 (API calls)
- `date-fns` - Phase 5 (Date formatting)
- `clsx` + `tailwind-merge` - Phase 3 (Styling utilities)
- `recharts` - Phase 5.4 (Charts)
- `lucide-react` - Phase 3 (Icons)

---

## Next Steps

Phase 1 is complete! You now have:

- ✅ Clean project structure (only essential folders)
- ✅ Core dependencies installed (React 19, React Router v7, Vite 6)
- ✅ TypeScript configured with strict mode
- ✅ Vite with React 19 and SWC compiler
- ✅ TailwindCSS v4 configured and working
- ✅ React Router v7 set up with placeholder routes
- ✅ ESLint and Prettier configured
- ✅ Development server running
- ✅ All packages using latest versions

**Benefits of this approach:**

- Smaller initial bundle size
- Faster installation
- Only install what you need
- Easier to understand dependencies
- Add packages as features are built

Ready to proceed to **Phase 2: Core Infrastructure** when you're ready!
