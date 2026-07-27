import { supabase } from '@/lib/supabase';

export interface GroupBalances {
  // Each member's total contribution across every expense they paid into, in
  // integer cents. A member's contribution to an expense is split evenly
  // among that expense's payers (cent-exact, remainder distributed), since a
  // bill can be paid across multiple people's cards.
  paidCents: Record<string, number>;
  // Each member's net position (positive = owed money, negative = owes
  // money): paidCents minus what they owe across expense_splits.
  balanceCents: Record<string, number>;
}

export async function computeGroupBalances(groupId: string): Promise<GroupBalances> {
  const { data: expenses } = await supabase.from('expenses').select('id, amount').eq('group_id', groupId);
  const expenseList = expenses ?? [];
  if (expenseList.length === 0) return { paidCents: {}, balanceCents: {} };

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

  const paidCents: Record<string, number> = {};

  Object.entries(payersByExpense).forEach(([expenseId, payerIds]) => {
    const totalCents = amountCentsByExpense[expenseId] ?? 0;
    const share = Math.floor(totalCents / payerIds.length);
    const remainder = totalCents - share * payerIds.length;
    payerIds.forEach((memberId, idx) => {
      paidCents[memberId] = (paidCents[memberId] ?? 0) + share + (idx < remainder ? 1 : 0);
    });
  });

  const balanceCents: Record<string, number> = { ...paidCents };

  (splits ?? []).forEach((s) => {
    const cents = Math.round(Number(s.amount) * 100);
    balanceCents[s.member_id] = (balanceCents[s.member_id] ?? 0) - cents;
  });

  return { paidCents, balanceCents };
}
