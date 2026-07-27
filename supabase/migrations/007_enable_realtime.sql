-- The supabase_realtime publication had zero tables registered, so every
-- .channel(...).on('postgres_changes', ...) subscription in the app
-- (Expenses, Groups list, Wishlist) was silently receiving nothing --
-- screens only ever showed correct data at initial mount.
alter publication supabase_realtime add table
  expenses, groups, wish_list_items, group_members, expense_splits,
  flights, flight_splits, hotels, hotel_rooms, trip_days;
