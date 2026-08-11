import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260811184342 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "promo_banner" ("id" text not null, "headline" text null, "body" text null, "cta_label" text null, "cta_href" text null, "ends_at" text null, "is_published" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "promo_banner_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_promo_banner_deleted_at" ON "promo_banner" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "promo_banner" cascade;`);
  }

}
