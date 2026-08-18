-- 0007_phone_orders.sql
--
-- Optional "Phone Orders" line in the header.
--
-- `contact_phone` already exists on site_setting and is already shown in the
-- footer, so this deliberately does NOT add a second phone column — one
-- number, one place to change it. What's new is only the two things the
-- header needs and the footer doesn't: whether to show it up there at all,
-- and what to call it (the label is editable because "Τηλεφωνικές
-- παραγγελίες" is a marketing choice, not a fixed string).

ALTER TABLE shop.site_setting
  ADD COLUMN IF NOT EXISTS phone_orders_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_orders_label   text;
