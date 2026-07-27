-- Replace the single paid_by column with a proper join table -- a bill can
-- be paid across multiple people's cards, not just one person.
create table expense_payers (
  id uuid default gen_random_uuid() primary key,
  expense_id uuid references expenses(id) on delete cascade not null,
  member_id uuid references group_members(id) on delete cascade not null,
  unique (expense_id, member_id)
);
alter table expense_payers enable row level security;

create policy "members can read expense_payers" on expense_payers for select
  using (exists (
    select 1 from expenses e
    join group_members gm on gm.group_id = e.group_id
    where e.id = expense_payers.expense_id and gm.user_id = auth.uid()
  ));
create policy "members can insert expense_payers" on expense_payers for insert
  with check (exists (
    select 1 from expenses e
    join group_members gm on gm.group_id = e.group_id
    where e.id = expense_payers.expense_id and gm.user_id = auth.uid()
  ));
create policy "members can delete expense_payers" on expense_payers for delete
  using (exists (
    select 1 from expenses e
    join group_members gm on gm.group_id = e.group_id
    where e.id = expense_payers.expense_id and gm.user_id = auth.uid()
  ));

-- Backfill existing single-payer data before dropping the column.
insert into expense_payers (expense_id, member_id)
select id, paid_by from expenses where paid_by is not null;

alter table expenses drop column paid_by;
