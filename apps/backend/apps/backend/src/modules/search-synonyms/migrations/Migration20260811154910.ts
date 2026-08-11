import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260811154910 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "search_synonym" ("id" text not null, "terms" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "search_synonym_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_search_synonym_deleted_at" ON "search_synonym" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "search_synonym" cascade;`);
  }

}
