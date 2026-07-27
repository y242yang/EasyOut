-- hotel_rooms had no DELETE policy. Editing a hotel deletes all its rooms
-- before re-inserting the edited set -- without this, that delete silently
-- affects 0 rows under RLS, so old rooms never actually go away and pile up
-- alongside the new ones (room removed in the edit form, but cost doubles).
create policy "members can delete hotel_rooms" on hotel_rooms for delete
  using (exists (
    select 1 from hotels h
    join group_members gm on gm.group_id = h.group_id
    where h.id = hotel_rooms.hotel_id and gm.user_id = auth.uid()
  ));
