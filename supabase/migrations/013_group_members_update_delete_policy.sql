-- group_members only had SELECT/INSERT policies -- renaming or removing a
-- member (both new features) would silently fail under RLS. Uses the same
-- is_member_of_group() helper as the existing policies to avoid the
-- self-referential recursion problem fixed in migration 004.
create policy "members can update group_members" on group_members for update
  using (is_member_of_group(group_id));

create policy "members can delete group_members" on group_members for delete
  using (is_member_of_group(group_id));
