import { listDiscounts } from "@/lib/admin/discounts";
import { DiscountManager } from "@/components/admin/DiscountManager";
import { PageHeader } from "@/components/admin/ui/primitives";

export const metadata = { title: "Εκπτώσεις" };

export default async function AdminDiscountsPage() {
  const discounts = await listDiscounts();
  const active = discounts.filter((d) => d.state === "active").length;

  return (
    <>
      <PageHeader
        title="Εκπτώσεις"
        description={
          discounts.length === 0
            ? "Κωδικοί που οι πελάτες εισάγουν στο καλάθι τους."
            : `${discounts.length} ${discounts.length === 1 ? "κωδικός" : "κωδικοί"}, ${active} ${active === 1 ? "ενεργός" : "ενεργοί"} αυτή τη στιγμή.`
        }
      />
      <DiscountManager discounts={discounts} />
    </>
  );
}
