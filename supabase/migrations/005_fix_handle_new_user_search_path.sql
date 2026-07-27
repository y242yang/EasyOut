-- handle_new_user() is invoked as a trigger on auth.users, which executes
-- with a search_path that doesn't include public by default. The bare
-- "profiles" reference was failing with "relation profiles does not exist"
-- on every new signup (anonymous or not). Qualify the table and pin the
-- function's search_path explicitly.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(split_part(new.email, '@', 1), 'Guest'));
  return new;
end;
$$;
