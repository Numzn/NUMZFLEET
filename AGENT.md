# AGENT.md - Fleet Management System

## Commands
- **Dev**: `npm run dev` - Start development server
- **Build**: `npm run build` - Production build 
- **Type Check**: `npm run check` - TypeScript validation
- **Preview**: `npm start` - Preview production build

## Architecture
- **Frontend**: React 18 + TypeScript SPA with Vite
- **Database**: Supabase PostgreSQL with real-time subscriptions
- **UI**: shadcn/ui components with Radix UI + Tailwind CSS
- **Routing**: Wouter for client-side routing
- **State**: TanStack Query for server state management

## Code Style
- **Imports**: Use `@/` for client/src, `@shared/` for shared types
- **Components**: PascalCase, default exports for pages, named for components
- **Types**: Zod schemas in shared/schema.ts for validation
- **Files**: camelCase for utils, PascalCase for components, kebab-case for pages
- **Theme**: CSS variables for colors, class-based dark mode
- **Error Handling**: Toast notifications for user feedback, try/catch for async operations
- **Exports**: Default for pages/main components, named for utilities/hooks
