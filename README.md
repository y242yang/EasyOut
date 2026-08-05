# EasyOut

Split expenses and plan trips with friends — no more mental math or awkward "you owe me" texts.

## Features

**Hangout mode**
- Create a group, add members by name (no account required for members)
- Add expenses with categories (meal, Uber, activity, car rental, etc.)
- Assign who paid and split among any subset of members
- Real-time sync — everyone sees updates instantly

**Trip mode** (everything above, plus)
- Day-by-day itinerary — expenses are organized by day
- Flights — log each person's arrival/departure with optional cost split
- Hotels — add rooms, assign members per room, see per-person cost automatically
- Wish list — shared list of places to visit; anyone can add and vote

## Tech stack

- **React Native + Expo** (SDK 56) — iOS & Android from one codebase
- **Expo Router** — file-based navigation
- **Supabase** — PostgreSQL database, Auth, and real-time subscriptions
- **TypeScript**

## Getting started

### 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. In the SQL editor, run every file in `supabase/migrations/` in numeric
   order, starting with `001_initial.sql`. Each one builds on the last, so
   skipping or reordering them will fail.

### 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Both values are in your Supabase project under **Settings → API**.

### 3. Run the app

```bash
npm install
npm run ios      # iOS simulator
npm run android  # Android emulator
```

## Project structure

```
src/
  app/
    index.tsx       # Group list (home)
    join.tsx        # Join a group by code
    settings.tsx    # Account + delete account
    group/
      new.tsx       # Create a hangout or trip
      [id]/
        index.tsx   # Group overview
        expenses.tsx
        balances.tsx    # Who owes whom, settled up
        members.tsx
        expense/
          new.tsx
          [expenseId].tsx
          scan.tsx      # Receipt scan → itemized split
        itinerary.tsx   # Trip only
        flights.tsx     # Trip only
        hotels.tsx      # Trip only
  components/
    member-avatar.tsx   # Color-coded avatar (12-color collision-free palette)
    date-field.tsx
    time-field.tsx
  constants/
    theme.ts
  hooks/
    use-auth.ts
  lib/
    supabase.ts
    balances.ts     # Per-member paid/owed totals
    settlement.ts   # Minimal set of payments to settle a group
    group-status.ts # Current / future / past + expiry
  types/
    index.ts
modules/
  receipt-scanner/  # Local Expo module: on-device OCR + C++ receipt parser (iOS)
supabase/
  migrations/       # SQL schema, RLS policies, triggers, RPCs
```

## Authentication

There are no sign-in screens. The first time you create or join a group,
EasyOut signs you in anonymously — no email, no password — and that session
identifies you from then on. Members added by name alone are proxy rows with
no account behind them; they become real when someone claims one with the
group's join code.

Settings → Delete Account removes the auth user via the `delete_my_account()`
RPC, taking with it every group where you were the only account holder. In
groups you share, your member row stays but is unlinked from any account, so
the others can still settle up.
