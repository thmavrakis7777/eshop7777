-- 0012_legal_identity.sql
--
-- The legal/compliance pages (Terms, Privacy, Returns, …) need the shop's
-- actual registered identity — legal company name, ΑΦΜ, ΓΕΜΗ number — to
-- interpolate into their text. None of that existed anywhere in the schema:
-- site_setting.store_name is a *trading* name for display ("MAVRAKIS HOME"),
-- not necessarily the registered legal entity name, and there is no column
-- for a VAT/tax registration number or a Commercial Registry (ΓΕΜΗ) number
-- at all. contact_address/contact_email/contact_phone already exist and are
-- reused as-is for the registered address and legal contact details — no
-- need for a second address field when the shop has one real address.
--
-- All three are nullable: until the owner fills them in from Settings, the
-- legal pages render a bracketed placeholder ([ΑΦΜ], [ΓΕΜΗ]) rather than a
-- fabricated value — see lib/legal-content.ts.

ALTER TABLE shop.site_setting
  ADD COLUMN IF NOT EXISTS legal_company_name text,
  ADD COLUMN IF NOT EXISTS vat_number          text,
  ADD COLUMN IF NOT EXISTS gemi_number         text;
