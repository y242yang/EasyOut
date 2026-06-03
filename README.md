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
2. In the SQL editor, run both migration files in order:
   - `supabase/migrations/001_initial.sql`
   - `supabase/migrations/002_trip_days_trigger.sql`

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
    (auth)/         # Sign-in / sign-up screens
    (tabs)/         # Bottom tab navigation (Groups, Profile)
    group/
      new.tsx       # Create a hangout or trip
      [id]/
        index.tsx   # Group overview
        expenses.tsx
        expense/new.tsx
        members.tsx
        itinerary.tsx   # Trip only
        flights.tsx     # Trip only
        hotels.tsx      # Trip only
        wishlist.tsx    # Trip only
  components/
    member-avatar.tsx   # Color-coded avatar (12-color collision-free palette)
  constants/
    theme.ts
  hooks/
    use-auth.ts
  lib/
    supabase.ts
  types/
    index.ts
supabase/
  migrations/       # SQL schema + triggers
```
