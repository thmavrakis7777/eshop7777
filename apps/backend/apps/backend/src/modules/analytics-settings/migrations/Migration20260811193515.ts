import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260811193515 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "analytics_setting" ("id" text not null, "ga4_measurement_id" text null, "gtm_container_id" text null, "meta_pixel_id" text null, "clarity_project_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "analytics_setting_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_setting_deleted_at" ON "analytics_setting" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "analytics_setting" cascade;`);
  }

}
