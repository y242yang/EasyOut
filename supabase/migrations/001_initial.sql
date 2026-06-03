-- profiles: extends auth.users
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now() not null
);
alter table profiles enable row level security;
create policy "users can read any profile" on profiles for select using (true);
create policy "users can update own profile" on profiles for update using (auth.uid() = id);

-- groups (hangout or trip)
create table groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null check (type in ('hangout', 'trip')),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  start_date date,
  end_date date
);
alter table groups enable row level security;

-- group_members
create table group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete set null,
  display_name text not null,
  joined_at timestamptz default now() not null
);
alter table group_members enable row level security;

-- RLS: only members can see/modify their group
create policy "members can read own groups" on groups for select
  using (exists (
    select 1 from group_members where group_id = groups.id and user_id = auth.uid()
  ));
create policy "members can read group_members" on group_members for select
  using (exists (
    select 1 from group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid()
  ));
create policy "members can insert group_members" on group_members for insert
  with check (exists (
    select 1 from group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid()
  ));
create policy "authenticated can create groups" on groups for insert
  with check (auth.uid() = created_by);
create policy "creator can update group" on groups for update
  using (auth.uid() = created_by);

-- trip_days
create table trip_days (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups(id) on delete cascade not null,
  date date not null,
  label text,
  "order" integer not null default 0
);
alter table trip_days enable row level security;
create policy "members can read trip_days" on trip_days for select
  using (exists (
    select 1 from group_members where group_id = trip_days.group_id and user_id = auth.uid()
  ));
create policy "members can insert trip_days" on trip_days for insert
  with check (exists (
    select 1 from group_members where group_id = trip_days.group_id and user_id = auth.uid()
  ));
create policy "members can update trip_days" on trip_days for update
  using (exists (
    select 1 from group_members where group_id = trip_days.group_id and user_id = auth.uid()
  ));

-- expenses
create table expenses (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups(id) on delete cascade not null,
  day_id uuid references trip_days(id) on delete set null,
  category text not null check (category in ('general','uber','meal','activity','car_rental','hotel','flight')),
  title text not null,
  amount numeric(10,2) not null,
  currency text not null default 'USD',
  paid_by uuid references group_members(id) on delete set null,
  date date not null,
  receipt_url text,
  notes text,
  created_at timestamptz default now() not null
);
alter table expenses enable row level security;
create policy "members can read expenses" on expenses for select
  using (exists (
    select 1 from group_members where group_id = expenses.group_id and user_id = auth.uid()
  ));
create policy "members can insert expenses" on expenses for insert
  with check (exists (
    select 1 from group_members where group_id = expenses.group_id and user_id = auth.uid()
  ));
create policy "members can update expenses" on expenses for update
  using (exists (
    select 1 from group_members where group_id = expenses.group_id and user_id = auth.uid()
  ));
create policy "members can delete expenses" on expenses for delete
  using (exists (
    select 1 from group_members where group_id = expenses.group_id and user_id = auth.uid()
  ));

-- expense_splits
create table expense_splits (
  id uuid default gen_random_uuid() primary key,
  expense_id uuid references expenses(id) on delete cascade not null,
  member_id uuid references group_members(id) on delete cascade not null,
  amount numeric(10,2) not null,
  is_paid boolean not null default false
);
alter table expense_splits enable row level security;
create policy "members can read splits" on expense_splits for select
  using (exists (
    select 1 from expenses e
    join group_members gm on gm.group_id = e.group_id
    where e.id = expense_splits.expense_id and gm.user_id = auth.uid()
  ));
create policy "members can insert splits" on expense_splits for insert
  with check (exists (
    select 1 from expenses e
    join group_members gm on gm.group_id = e.group_id
    where e.id = expense_splits.expense_id and gm.user_id = auth.uid()
  ));
create policy "members can update splits" on expense_splits for update
  using (exists (
    select 1 from expenses e
    join group_members gm on gm.group_id = e.group_id
    where e.id = expense_splits.expense_id and gm.user_id = auth.uid()
  ));

-- flights (trip-only)
create table flights (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups(id) on delete cascade not null,
  member_id uuid references group_members(id) on delete cascade not null,
  airline text,
  flight_number text,
  departure_airport text not null,
  arrival_airport text not null,
  departure_time timestamptz not null,
  arrival_time timestamptz not null,
  cost numeric(10,2)
);
alter table flights enable row level security;
create policy "members can read flights" on flights for select
  using (exists (
    select 1 from group_members where group_id = flights.group_id and user_id = auth.uid()
  ));
create policy "members can insert flights" on flights for insert
  with check (exists (
    select 1 from group_members where group_id = flights.group_id and user_id = auth.uid()
  ));
create policy "members can update flights" on flights for update
  using (exists (
    select 1 from group_members where group_id = flights.group_id and user_id = auth.uid()
  ));
create policy "members can delete flights" on flights for delete
  using (exists (
    select 1 from group_members where group_id = flights.group_id and user_id = auth.uid()
  ));

-- flight_splits
create table flight_splits (
  id uuid default gen_random_uuid() primary key,
  flight_id uuid references flights(id) on delete cascade not null,
  member_id uuid references group_members(id) on delete cascade not null,
  amount numeric(10,2) not null
);
alter table flight_splits enable row level security;
create policy "members can read flight_splits" on flight_splits for select
  using (exists (
    select 1 from flights f
    join group_members gm on gm.group_id = f.group_id
    where f.id = flight_splits.flight_id and gm.user_id = auth.uid()
  ));
create policy "members can insert flight_splits" on flight_splits for insert
  with check (exists (
    select 1 from flights f
    join group_members gm on gm.group_id = f.group_id
    where f.id = flight_splits.flight_id and gm.user_id = auth.uid()
  ));

-- hotels (trip-only)
create table hotels (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups(id) on delete cascade not null,
  name text not null,
  check_in date not null,
  check_out date not null,
  notes text,
  created_at timestamptz default now() not null
);
alter table hotels enable row level security;
create policy "members can read hotels" on hotels for select
  using (exists (
    select 1 from group_members where group_id = hotels.group_id and user_id = auth.uid()
  ));
create policy "members can insert hotels" on hotels for insert
  with check (exists (
    select 1 from group_members where group_id = hotels.group_id and user_id = auth.uid()
  ));
create policy "members can update hotels" on hotels for update
  using (exists (
    select 1 from group_members where group_id = hotels.group_id and user_id = auth.uid()
  ));
create policy "members can delete hotels" on hotels for delete
  using (exists (
    select 1 from group_members where group_id = hotels.group_id and user_id = auth.uid()
  ));

-- hotel_rooms
create table hotel_rooms (
  id uuid default gen_random_uuid() primary key,
  hotel_id uuid references hotels(id) on delete cascade not null,
  room_label text not null,
  cost numeric(10,2) not null,
  member_ids uuid[] not null default '{}'
);
alter table hotel_rooms enable row level security;
create policy "members can read hotel_rooms" on hotel_rooms for select
  using (exists (
    select 1 from hotels h
    join group_members gm on gm.group_id = h.group_id
    where h.id = hotel_rooms.hotel_id and gm.user_id = auth.uid()
  ));
create policy "members can insert hotel_rooms" on hotel_rooms for insert
  with check (exists (
    select 1 from hotels h
    join group_members gm on gm.group_id = h.group_id
    where h.id = hotel_rooms.hotel_id and gm.user_id = auth.uid()
  ));
create policy "members can update hotel_rooms" on hotel_rooms for update
  using (exists (
    select 1 from hotels h
    join group_members gm on gm.group_id = h.group_id
    where h.id = hotel_rooms.hotel_id and gm.user_id = auth.uid()
  ));

-- wish_list_items (trip-only)
create table wish_list_items (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups(id) on delete cascade not null,
  title text not null,
  description text,
  location text,
  added_by uuid references group_members(id) on delete set null,
  votes uuid[] not null default '{}',
  is_completed boolean not null default false,
  created_at timestamptz default now() not null
);
alter table wish_list_items enable row level security;
create policy "members can read wish_list" on wish_list_items for select
  using (exists (
    select 1 from group_members where group_id = wish_list_items.group_id and user_id = auth.uid()
  ));
create policy "members can insert wish_list" on wish_list_items for insert
  with check (exists (
    select 1 from group_members where group_id = wish_list_items.group_id and user_id = auth.uid()
  ));
create policy "members can update wish_list" on wish_list_items for update
  using (exists (
    select 1 from group_members where group_id = wish_list_items.group_id and user_id = auth.uid()
  ));
create policy "members can delete wish_list" on wish_list_items for delete
  using (exists (
    select 1 from group_members where group_id = wish_list_items.group_id and user_id = auth.uid()
  ));

-- auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
