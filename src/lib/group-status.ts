import type { Group } from '@/types';

export type GroupStatus = 'future' | 'current' | 'past';

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRY_GRACE_DAYS = 30;

// Local calendar date, not UTC -- toISOString() would roll over to the next
// day for anyone west of UTC in the evening, misclassifying a group that's
// happening today as "Future" until midnight UTC catches up.
function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// A hangout has a single day (start_date === end_date); a trip spans
// start_date to end_date. Groups created before hangouts captured a date
// have neither and are treated as always "current" so they stay visible.
export function getGroupStatus(group: Group): GroupStatus {
  const start = group.start_date;
  const end = group.end_date ?? group.start_date;
  if (!start || !end) return 'current';

  const today = todayString();
  if (today < start) return 'future';
  if (today > end) return 'past';
  return 'current';
}

// Days remaining until the group auto-deletes (30 days after its last day),
// or null if it has no date and therefore never expires.
export function daysUntilExpiry(group: Group): number | null {
  const end = group.end_date ?? group.start_date;
  if (!end) return null;

  const expiry = new Date(end + 'T00:00:00').getTime() + EXPIRY_GRACE_DAYS * DAY_MS;
  return Math.ceil((expiry - Date.now()) / DAY_MS);
}
