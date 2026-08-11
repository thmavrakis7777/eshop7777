import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260811134922 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "homepage_block" ("id" text not null, "kind" text check ("kind" in ('hero', 'promo')) not null, "eyebrow" text null, "heading" text null, "body" text null, "cta_label" text null, "cta_href" text null, "image_url" text null, "sort_order" integer not null default 0, "is_published" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "homepage_block_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_homepage_block_deleted_at" ON "homepage_block" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "homepage_block" cascade;`);
  }

}
