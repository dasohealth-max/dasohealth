@AGENTS.md

# EyeCare Pro — Architecture Overview

## Stack
- **Next.js 16** (App Router) · **React 19** · **TypeScript 5** · **Tailwind CSS 4**
- **Zustand 5** for state (persisted to `localStorage` key `ec_store`)
- **shadcn/ui** (Radix primitives) in `components/ui/`
- **Recharts** for dashboard charts · **Leaflet** for maps · **docx** for Word exports

## Folder Structure
```
eyecare-pro/
├── app/
│   ├── (dashboard)/        # 13 protected pages (campaign, patients, surgeries …)
│   │   └── layout.tsx      # Sidebar + Topbar shell
│   ├── login/              # Public login page
│   ├── layout.tsx          # Root layout
│   └── globals.css
├── components/
│   ├── forms/              # Custom composite form components (InlineForm)
│   ├── layout/             # AuthGuard, Sidebar, Topbar
│   └── ui/                 # shadcn/ui primitives only
├── lib/
│   ├── store.ts            # Zustand store + seed data (ALL domain state lives here)
│   ├── auth.ts             # Session helpers — getSession / setSession / clearSession
│   ├── permissions.ts      # RBAC — 14 roles, can() / canAccess() / maskPatient()
│   └── utils.ts            # cn() and misc helpers
├── types/
│   └── index.ts            # All TypeScript domain types
└── public/                 # Static SVG assets
```

## Authentication & Permissions
- Session stored in `localStorage` key `ec_user` (see `lib/auth.ts`)
- 14 roles ranging from Super Administrator to Donor User
- Donor Users see patient names/phones masked as `***`
- `usePermissions()` hook returns `{ role, user, can, canAccess, maskPatient }`

## Key Conventions
- No backend — all data lives in Zustand store persisted to localStorage
- All dashboard pages are `'use client'` components
- Custom form wrapper: `components/forms/InlineForm.tsx` (not a shadcn primitive)
- Somalia city data and seed patients/campaigns initialised in `lib/store.ts`
- Color palette: teal (`#0d9488`) primary, indigo (`#6366f1`) accent, amber (`#f59e0b`) secondary

## Running Locally
```bash
cd eyecare-pro
npm install
npm run dev   # http://localhost:3000
```
Login with any seeded user (see `lib/store.ts` → `INITIAL_STATE.users`).
