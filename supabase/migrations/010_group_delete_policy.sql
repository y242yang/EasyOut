-- No DELETE policy existed on groups, so deleting a group (e.g. cleaning up
-- a settled hangout) silently failed under RLS. Restrict deletion to the
-- creator, matching the existing "creator can update group" policy -- all
-- child rows (members, expenses, splits, payers, etc.) cascade automatically.
create policy "creator can delete group" on groups for delete
  using (auth.uid() = created_by);
