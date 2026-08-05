-- App Review guideline 5.1.1(v) requires an in-app way to delete an account
-- for any app that creates one, and opening a group creates an anonymous
-- auth user (see ensureAnonymousSession). Nothing here could do that: the
-- client only ever holds the anon key, which has no rights over auth.users.
--
-- SECURITY DEFINER so the function -- not the caller -- carries the
-- privileges to delete from auth.users, scoped to auth.uid() so a caller can
-- only ever remove themselves.
create or replace function delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Groups where the caller is the only account holder are effectively
  -- theirs alone -- any other members are proxy rows the caller typed in,
  -- not people with data of their own here. Delete those outright so
  -- nothing the caller entered outlives their account; the existing
  -- cascades take the expenses, splits, flights, hotels, and wish list with
  -- them. This has to run before the auth.users delete, since created_by is
  -- what identifies the rows and it's about to be nulled.
  delete from public.groups g
  where g.created_by = v_uid
    and not exists (
      select 1 from public.group_members gm
      where gm.group_id = g.id
        and gm.user_id is not null
        and gm.user_id <> v_uid
    );

  -- The rest unwinds through foreign keys already in place: profiles
  -- cascades from auth.users, and both groups.created_by and
  -- group_members.user_id are ON DELETE SET NULL. In a group someone else
  -- has also joined, that leaves the caller's member row present but no
  -- longer tied to any account. The display name stays on purpose -- the
  -- others still need it to make sense of who owes what -- which lands the
  -- row in exactly the state of a proxy-added member who never claimed it.
  delete from auth.users where id = v_uid;
end;
$$;

grant execute on function delete_my_account() to authenticated;
