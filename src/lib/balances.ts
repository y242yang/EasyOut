import { supabase } from '@/lib/supabase';

export interface GroupBalances {
  // Each member's total contribution across every expense/hotel room/flight
  // they paid into, in integer cents. A member's contribution is split
  // evenly among that item's payers (cent-exact, remainder distributed),
  // since a bill can be paid across multiple people's cards.
  paidCents: Record<string, number>;
  // Each member's net position (positive = owed money, negative = owes
  // money): paidCents minus what they owe.
  balanceCents: Record<string, number>;
}

function distributeEvenly(totalCents: number, ids: string[], target: Record<string, number>, sign: 1 | -1) {
  if (ids.length === 0) return;
  const share = Math.floor(totalCents / ids.length);
  const remainder = totalCents - share * ids.length;
  ids.forEach((id, idx) => {
    target[id] = (target[id] ?? 0) + sign * (share + (idx < remainder ? 1 : 0));
  });
}

export async function computeGroupBalances(groupId: string): Promise<GroupBalances> {
  const paidCents: Record<string, number> = {};
  const balanceCents: Record<string, number> = {};

  const { data: expenses } = await supabase.from('expenses').select('id, amount').eq('group_id', groupId);
  const expenseList = expenses ?? [];

  if (expenseList.length > 0) {
    const expenseIds = expenseList.map((e) => e.id);
    const [{ data: payers }, { data: splits }] = await Promise.all([
      supabase.from('expense_payers').select('*').in('expense_id', expenseIds),
      supabase.from('expense_splits').select('*').in('expense_id', expenseIds),
    ]);

    const amountCentsByExpense: Record<string, number> = {};
    expenseList.forEach((e) => {
      amountCentsByExpense[e.id] = Math.round(Number(e.amount) * 100);
    });

    const payersByExpense: Record<string, string[]> = {};
    (payers ?? []).forEach((p) => {
      payersByExpense[p.expense_id] = [...(payersByExpense[p.expense_id] ?? []), p.member_id];
    });

    Object.entries(payersByExpense).forEach(([expenseId, payerIds]) => {
      const cents = amountCentsByExpense[expenseId] ?? 0;
      distributeEvenly(cents, payerIds, paidCents, 1);
      distributeEvenly(cents, payerIds, balanceCents, 1);
    });

    (splits ?? []).forEach((s) => {
      const cents = Math.round(Number(s.amount) * 100);
      balanceCents[s.member_id] = (balanceCents[s.member_id] ?? 0) - cents;
    });
  }

  // Hotel rooms: cost is split evenly among occupants (member_ids) and
  // credited evenly among whoever paid (paid_by) -- there's no per-member
  // splits table for rooms like there is for expenses, so the even split is
  // computed here rather than read back from storage.
  const { data: hotels } = await supabase.from('hotels').select('id').eq('group_id', groupId);
  const hotelIds = (hotels ?? []).map((h) => h.id);
  if (hotelIds.length > 0) {
    const { data: rooms } = await supabase.from('hotel_rooms').select('*').in('hotel_id', hotelIds);
    (rooms ?? []).forEach((room) => {
      const cents = Math.round(Number(room.cost) * 100);
      distributeEvenly(cents, room.paid_by, paidCents, 1);
      distributeEvenly(cents, room.paid_by, balanceCents, 1);
      distributeEvenly(cents, room.member_ids, balanceCents, -1);
    });
  }

  // Flights: booked for a single passenger (member_id), who owes its full
  // cost (ticket + luggage); whoever paid (paid_by) is credited evenly.
  const { data: flights } = await supabase.from('flights').select('*').eq('group_id', groupId);
  (flights ?? []).forEach((flight) => {
    const cents = Math.round((Number(flight.cost ?? 0) + Number(flight.luggage_cost ?? 0)) * 100);
    distributeEvenly(cents, flight.paid_by, paidCents, 1);
    distributeEvenly(cents, flight.paid_by, balanceCents, 1);
    balanceCents[flight.member_id] = (balanceCents[flight.member_id] ?? 0) - cents;
  });

  return { paidCents, balanceCents };
}
