-- Groups auto-delete 30 days after their last day (a hangout's single day,
-- or a trip's end_date) -- cascades remove all their expenses/members/etc.
-- Runs daily as the job owner, which bypasses RLS same as any other
-- scheduled maintenance task. Groups with no end_date (legacy rows created
-- before hangouts captured a date) are left alone -- never auto-deleted.
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'delete-expired-groups',
  '0 3 * * *',
  $$ delete from groups where end_date is not null and end_date < (current_date - interval '30 days'); $$
);
