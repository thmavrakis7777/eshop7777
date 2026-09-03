-- Global stock quantity limit + direct inquiry feature: two new site-wide
-- settings on the existing shop.site_setting singleton, following the same
-- pattern as contact_phone/cart_message/etc — no new settings table. Both
-- are nullable text; a missing/empty value falls back to a hardcoded default
-- at the application layer (see lib/whatsapp.ts's resolveStockInquiryMessage),
-- same convention as phone_orders_label's "Τηλεφωνικές παραγγελίες" fallback.
--
-- whatsapp_phone is deliberately separate from the existing contact_phone:
-- contact_phone is a Greek landline/mobile in local display format (used for
-- tel: links), while a WhatsApp deep link needs full international format
-- (country code, no leading zero) — the two are not interchangeable values.
ALTER TABLE shop.site_setting
  ADD COLUMN IF NOT EXISTS stock_inquiry_message text,
  ADD COLUMN IF NOT EXISTS whatsapp_phone text;
