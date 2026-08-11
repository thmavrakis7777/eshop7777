import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260811154757 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "product_extra" add column if not exists "hide_from_search" boolean not null default false, add column if not exists "is_search_boosted" boolean not null default false;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "product_extra" drop column if exists "hide_from_search", drop column if exists "is_search_boosted";`);
  }

}
