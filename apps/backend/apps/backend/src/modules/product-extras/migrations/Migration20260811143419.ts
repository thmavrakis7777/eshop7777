import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260811143419 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "product_extra" drop constraint if exists "product_extra_product_id_unique";`);
    this.addSql(`create table if not exists "product_extra" ("id" text not null, "product_id" text not null, "badge_label" text null, "badge_tone" text check ("badge_tone" in ('accent', 'success', 'neutral')) not null default 'neutral', "warranty_text" text null, "downloads_url" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_extra_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_extra_deleted_at" ON "product_extra" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_extra_product_id_unique" ON "product_extra" ("product_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_extra" cascade;`);
  }

}
