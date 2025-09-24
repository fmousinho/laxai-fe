# Copilot Instructions for laxai-fe (Next.js Admin Dashboard)

## Project Architecture
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (custom colors/fonts via globals.css)
- **UI Components:** Shadcn UI, custom SVG icons
- **Auth:** Auth0 via @auth0/nextjs-auth0 (App Router pattern)
- **Database:** Vercel/Neon Postgres, Drizzle ORM
- **Deployment:** Vercel
- **Analytics:** Vercel Analytics

## Key Directories & Files
- `app/` — Main app pages, layouts, and routing
- `app/(dashboard)/uploads/page.tsx` — File upload UI (react-dropzone, styled with Tailwind)
- `app/(dashboard)/providers.tsx` — React context providers (Auth0Provider, TooltipProvider)
- `lib/auth.ts` — Auth0 server-side utilities (getSession, getAccessToken, withPageAuthRequired)
- `lib/db.ts` — Database connection logic
- `.env.local` — All secrets and config (see README for required variables)
- `public/` — Static assets and SVG icons
- `globals.css` — Tailwind and custom CSS variables

## Developer Workflows
- **Install dependencies:** `pnpm install` (pnpm is preferred)
- **Start dev server:** `pnpm dev`
- **Deploy:** Use Vercel CLI (`vercel link`, `vercel env pull`, `vercel deploy`)
- **Database setup:** Use Vercel Postgres dashboard and SQL schema from README
- **Seed data:** Uncomment `app/api/seed.ts` and visit `/api/seed` locally

## Patterns & Conventions
- **App Router:** Use file-based routing in `app/` (no pages/ directory)
- **Providers:** Wrap client context providers in `app/(dashboard)/providers.tsx` (e.g., Auth0Provider, TooltipProvider)
- **Auth0:** Do not use NextAuth. Use @auth0/nextjs-auth0 for all authentication. Configure via `.env.local` and use server utilities from `lib/auth.ts`.
- **Environment Variables:** Use `.env.local` with project-specific names (e.g., `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `APP_BASE_URL`). For client-side access, use `NEXT_PUBLIC_` prefix.
- **Styling:** Use Tailwind CSS classes and custom variables from `globals.css`. Follow existing color/font patterns.
- **File Uploads:** Use react-dropzone for drag-and-drop UI. See `app/(dashboard)/uploads/page.tsx` for example.
- **SVG Icons:** Place in `public/` and import as needed.

## Integration Points
- **Auth0:** All authentication flows use @auth0/nextjs-auth0. Do not mix with NextAuth.
- **Database:** Use Drizzle ORM for queries. Connection logic in `lib/db.ts`.
- **Analytics:** Use Vercel Analytics via `@vercel/analytics/react` in layout files.

## Example: Auth0 Usage
```tsx
// lib/auth.ts
import { getSession, getAccessToken } from '@auth0/nextjs-auth0/edge';
import { withPageAuthRequired } from '@auth0/nextjs-auth0';
export { getSession, getAccessToken, withPageAuthRequired };
```

## Example: Providers
```tsx
// app/(dashboard)/providers.tsx
import { Auth0Provider } from '@auth0/nextjs-auth0/client';
export default function Providers({ children }) {
  return <Auth0Provider>{children}</Auth0Provider>;
}
```

---
If any conventions or workflows are unclear, please ask for clarification or review the README for setup details.
