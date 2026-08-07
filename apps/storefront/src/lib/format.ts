import type { Money } from "./types";

const formatter = new Intl.NumberFormat("el-GR", {
  style: "currency",
  currency: "EUR",
});

export function formatPrice(money: Money): string {
  return formatter.format(money.amount);
}
