# Invenio Fullstack Architecture Reference

This document serves as the authoritative blueprint for reproducing the modern, highly secure **Invenio ProgressTracker** technology stack across future applications.

## I. Frontend Structure (Vite + React)
* **Framework**: React 19 + TypeScript bundled via Vite for lightning-fast HMR and optimized production outputs.
* **Routing**: `react-router-dom` using the standard `BrowserRouter` layout, explicitly guarding protected routes via an `<AuthGuard>` wrapping provider.
* **State Management**: `@tanstack/react-query` is utilized for virtually all complex analytical fetches and data mutations. It natively handles caching, loading states, and remote invalidations required by the Dashboard.
* **Charting**: `chart.js` integrated with `react-chartjs-2` to draw mathematical performance matrices like the Executive S-Curve.
* **Iconography**: `lucide-react` forms the precise, lightweight SVG foundation.

## II. Styling Foundation (Tailwind CSS v4)
* **Engine**: The newly completely rewritten `@tailwindcss/postcss` compiler. It abandons heavy `tailwind.config.js` setups in favor of a single `index.css` import directive.
* **Design System (InvenioStyle)**:
    * CSS variables mathematically matched to `tokens.ts`.
    * **Semantic Tokens**: Surfaces rely strictly on dynamic semantic variables (`bg-canvas`, `bg-surface`, `bg-raised`, `text-text`, etc.) rather than rigid `.bg-slate-900` classes.
    * **Dynamic Dark Mode**: Triggered strictly via the HTML `data-theme="dark"` attribute (via Lucide toggle), perfectly respecting native `InvenioStyle` shadow and boundary variables.

## III. Backend Architecture (Supabase / Postgres)
* **Database**: Managed remote PostgreSQL accessed purely via `@supabase/supabase-js`.
* **Multi-Tenancy Matrix**:
    * New signups are strictly intercepted by a `handle_new_user()` PostgreSQL **Trigger Function** firing upon `auth.users` row inserts.
    * Users are instantly mathematically bridged into an `app_users` table bound strictly to a structural `tenant_id`.
* **Database RPCs over Edge Functions**:
    * Instead of relying on slow, un-cached Deno Edge Functions for User Management (like standard TimekeepingApp architectures do), Admin interactions are written directly into SQL **`SECURITY DEFINER`** Postgres RPC functions (e.g., `admin_get_users`, `admin_create_user`).
    * This allows blazingly fast administrative execution on the backend while shielding the commands fully from standard `role = 'viewer'` clients.

## IV. Edge Data Pipelines
* **Deno Edge Functions**: Rather than managing logic state, Edge Functions (`import-progress-data`) are solely relegated to processing heavy I/O compute (like unpacking massive external CSVs) and strictly validating arrays before running internal bulk Upserts.

## V. Netlify Production Deployment
* **Monorepo Hooks**: ProgressTracker runs effectively as a split monorepo (frontend + backend). Deployment requires configuring `netlify.toml` natively at the root:
    ```toml
    [build]
      base = "frontend"
      command = "npm run build"
      publish = "dist"
    ```
* **Variables**: Environment inputs *must* strictly adhere to Vite architecture, requiring the heavy `VITE_` prefix (`VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY`) injected directly via the Netlify Security UI.
* **SPA Redirection**: Crucial fallback rewrites `[[redirects]] from="/*" to="/index.html" status=200` to prevent 404 errors during dynamic React routing in production.
