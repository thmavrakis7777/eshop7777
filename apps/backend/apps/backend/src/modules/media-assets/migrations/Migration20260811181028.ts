import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260811181028 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "media_asset" ("id" text not null, "label" text not null, "url" text not null, "alt_text" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "media_asset_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_media_asset_deleted_at" ON "media_asset" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "media_asset" cascade;`);
  }

}
