-- Auto-generate trip_days rows when a trip group has start/end dates
create or replace function generate_trip_days()
returns trigger as $$
declare
  d date;
  ord integer := 0;
begin
  if new.type = 'trip' and new.start_date is not null and new.end_date is not null then
    d := new.start_date;
    while d <= new.end_date loop
      insert into trip_days (group_id, date, "order")
      values (new.id, d, ord);
      ord := ord + 1;
      d := d + interval '1 day';
    end loop;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_group_created_generate_days
  after insert on groups
  for each row execute procedure generate_trip_days();
