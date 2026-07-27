-- group_members' own SELECT/INSERT policies queried group_members to check
-- membership, which is self-referential: evaluating the policy re-triggers
-- the same policy, causing "infinite recursion detected in policy for
-- relation group_members". Route the membership check through a
-- SECURITY DEFINER function so it bypasses RLS internally instead of
-- recursing into it.
create or replace function is_member_of_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from group_members where group_id = p_group_id and user_id = auth.uid()
  );
$$;

alter policy "members can read group_members" on group_members
  using (is_member_of_group(group_id));

alter policy "members can insert group_members" on group_members
  with check (is_member_of_group(group_id));
