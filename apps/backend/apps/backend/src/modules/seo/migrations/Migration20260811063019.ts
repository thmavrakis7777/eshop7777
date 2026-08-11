import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260811063019 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seo" drop constraint if exists "seo_resource_type_resource_id_unique";`);
    this.addSql(`create table if not exists "seo" ("id" text not null, "resource_type" text check ("resource_type" in ('product', 'category', 'homepage')) not null, "resource_id" text not null, "seo_title" text null, "meta_description" text null, "canonical_url" text null, "og_title" text null, "og_description" text null, "social_image_url" text null, "keywords" text null, "robots" text check ("robots" in ('index', 'noindex')) not null default 'index', "structured_data_override" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "seo_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seo_deleted_at" ON "seo" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_seo_resource_type_resource_id_unique" ON "seo" ("resource_type", "resource_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "seo" cascade;`);
  }

}
