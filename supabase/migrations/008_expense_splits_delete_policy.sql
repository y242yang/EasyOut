-- Editing an expense re-splits it from scratch (delete old splits, insert
-- new ones), but expense_splits never had a DELETE policy.
create policy "members can delete splits" on expense_splits for delete
  using (exists (
    select 1 from expenses e
    join group_members gm on gm.group_id = e.group_id
    where e.id = expense_splits.expense_id and gm.user_id = auth.uid()
  ));
