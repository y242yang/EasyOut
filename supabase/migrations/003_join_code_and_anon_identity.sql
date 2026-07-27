-- Anonymous auth users have no email, so profiles.email can no longer be required.
alter table profiles alter column email drop not null;

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, display_name)
  values (new.id, new.email, coalesce(split_part(new.email, '@', 1), 'Guest'));
  return new;
end;
$$ language plpgsql security definer;

-- Short, shareable per-group join code.
alter table groups add column join_code text unique;

create or replace function generate_unique_join_code()
returns text as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- excludes 0/O/1/I/L to avoid ambiguity
  code text;
  already_used boolean;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, (floor(random() * length(chars)) + 1)::integer, 1);
    end loop;
    select exists(select 1 from groups where join_code = code) into already_used;
    exit when not already_used;
  end loop;
  return code;
end;
$$ language plpgsql;

-- Creates a group and its creator's member row in one step, generating the join code.
-- SECURITY DEFINER: bypasses RLS since the caller has no group_members row yet (nothing to match against).
create or replace function create_group_with_creator(
  p_name text,
  p_type text,
  p_start_date date,
  p_end_date date,
  p_creator_display_name text
)
returns groups
language plpgsql
security definer
as $$
declare
  v_group groups;
begin
  insert into groups (name, type, created_by, start_date, end_date, join_code)
  values (p_name, p_type, auth.uid(), p_start_date, p_end_date, generate_unique_join_code())
  returning * into v_group;

  insert into group_members (group_id, user_id, display_name)
  values (v_group.id, auth.uid(), p_creator_display_name);

  return v_group;
end;
$$;

grant execute on function create_group_with_creator(text, text, date, date, text) to anon, authenticated;

-- Looks up a group and its member list by join code, for someone who isn't a member yet.
-- SECURITY DEFINER: bypasses RLS deliberately -- the join code itself is the credential here.
create or replace function find_group_by_code(p_code text)
returns table (
  group_id uuid,
  group_name text,
  group_type text,
  member_id uuid,
  member_display_name text,
  member_is_claimed boolean
)
language plpgsql
security definer
as $$
begin
  return query
    select g.id, g.name, g.type, gm.id, gm.display_name, (gm.user_id is not null)
    from groups g
    join group_members gm on gm.group_id = g.id
    where g.join_code = upper(p_code)
    order by gm.joined_at;
end;
$$;

grant execute on function find_group_by_code(text) to anon, authenticated;

-- Claims an existing, unclaimed member row (e.g. a proxy-added member) as the caller's own identity.
create or replace function claim_member(p_code text, p_member_id uuid)
returns group_members
language plpgsql
security definer
as $$
declare
  v_member group_members;
begin
  select gm.* into v_member
  from group_members gm
  join groups g on g.id = gm.group_id
  where gm.id = p_member_id and g.join_code = upper(p_code);

  if v_member.id is null then
    raise exception 'Member not found for this code';
  end if;

  if v_member.user_id is not null then
    raise exception 'This member has already been claimed';
  end if;

  update group_members set user_id = auth.uid() where id = p_member_id
  returning * into v_member;

  return v_member;
end;
$$;

grant execute on function claim_member(text, uuid) to anon, authenticated;

-- Adds the caller as a brand new member of a group they found via join code.
create or replace function join_as_new_member(p_code text, p_display_name text)
returns group_members
language plpgsql
security definer
as $$
declare
  v_group_id uuid;
  v_member group_members;
begin
  select id into v_group_id from groups where join_code = upper(p_code);

  if v_group_id is null then
    raise exception 'Invalid join code';
  end if;

  insert into group_members (group_id, user_id, display_name)
  values (v_group_id, auth.uid(), p_display_name)
  returning * into v_member;

  return v_member;
end;
$$;

grant execute on function join_as_new_member(text, text) to anon, authenticated;
