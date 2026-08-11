import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260811150457 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "site_setting" add column if not exists "cart_message" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "site_setting" drop column if exists "cart_message";`);
  }

}
