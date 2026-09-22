# newcimt

CIMT — Critical Incident Management Team app for OSI Group. Modernization of the legacy ASP.NET WebForms app to React 19 + TypeScript (Vite) with a Node/Express API over SQL Server.

## Stack

- **Frontend**: React 19, TypeScript, Vite, react-router 7, TanStack Query, react-hook-form, Tailwind 4
- **API**: Express 5 + mssql (SQL Server on NDCSQLB1, database `CIMT`)
- **Shared types**: `shared/types.ts` (alias `@shared`)

## Setup

1. Copy `.env.example` to `.env` and fill in the SQL Server credentials
2. `npm install` and `npm install --prefix server`
3. `npm run db:migrate` — creates the schema (idempotent)
4. `npm run import:excel` — imports internal contacts from `docs/CIMT Contact Information Form.xlsx`
5. `npm run db:seed` — loads guides/checklist content and sample data

## Run

- `npm run dev` — Vite (:5173) + API (:3001) together
- `npm run demo` — production build served by Express on :3001

## Structure

- `src/` — React app (public pages + `/admin` dashboard where everything is editable)
- `server/` — Express API (generic CRUD + denormalized reads)
- `scripts/` — migration, Excel import, legacy content extraction, seeds
- `BACKLOG.md` — post-demo roadmap (alerts/OnSolve layer, coverage panel, SSO, i18n)
