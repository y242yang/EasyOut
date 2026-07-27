// Ported from the standalone easyout-settlement C++ library: given each
// member's net balance (positive = owed money, negative = owes money),
// compute the minimum number of transactions to settle everyone up by
// greedily matching the largest creditor with the largest debtor.
//
// Unlike the C++ version, balances here are integer cents, so comparisons
// are exact -- no epsilon needed.

export interface Transaction {
  from: string; // who pays
  to: string; // who receives
  amountCents: number;
}

export function settleBalances(balanceCents: Record<string, number>): Transaction[] {
  const creditors: [string, number][] = [];
  const debtors: [string, number][] = [];

  for (const [memberId, balance] of Object.entries(balanceCents)) {
    if (balance > 0) creditors.push([memberId, balance]);
    else if (balance < 0) debtors.push([memberId, -balance]);
  }

  // Largest first so big debts resolve in fewer steps.
  creditors.sort((a, b) => b[1] - a[1]);
  debtors.sort((a, b) => b[1] - a[1]);

  const result: Transaction[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.min(creditor[1], debtor[1]);

    result.push({ from: debtor[0], to: creditor[0], amountCents: amount });

    creditor[1] -= amount;
    debtor[1] -= amount;

    if (creditor[1] === 0) ci++;
    if (debtor[1] === 0) di++;
  }

  return result;
}
