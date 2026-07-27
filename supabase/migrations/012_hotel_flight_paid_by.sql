-- Hotel rooms and flights need to know who fronted the money, same as
-- expenses' multi-payer support, so their costs can be attributed and
-- surfaced correctly in the Expenses total.
alter table hotel_rooms add column paid_by uuid[] not null default '{}';
alter table flights add column paid_by uuid[] not null default '{}';
