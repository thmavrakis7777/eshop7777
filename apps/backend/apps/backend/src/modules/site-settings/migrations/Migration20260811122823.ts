import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260811122823 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "site_setting" ("id" text not null, "footer_tagline" text null, "contact_phone" text null, "contact_email" text null, "contact_address" text null, "business_hours" text null, "facebook_url" text null, "instagram_url" text null, "tiktok_url" text null, "announcement_text" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "site_setting_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_site_setting_deleted_at" ON "site_setting" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "site_setting" cascade;`);
  }

}
