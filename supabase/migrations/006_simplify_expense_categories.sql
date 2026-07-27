-- Collapse the expense category taxonomy to General / Transportation / Meal /
-- Activity. Specifics like "Uber" now belong in the expense title instead of
-- being their own category. hotel/flight were dead values -- those costs
-- live in the separate hotels/flights tables, never in expenses.category.
update expenses set category = 'transportation' where category in ('uber', 'car_rental');
update expenses set category = 'general' where category in ('hotel', 'flight');

alter table expenses drop constraint expenses_category_check;
alter table expenses add constraint expenses_category_check
  check (category in ('general', 'transportation', 'meal', 'activity'));
