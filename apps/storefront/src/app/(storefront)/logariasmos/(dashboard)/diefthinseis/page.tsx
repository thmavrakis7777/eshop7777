import type { Metadata } from "next";
import { getCustomerAddresses } from "@/lib/data/customer";
import { AddressBook } from "@/components/account/AddressBook";

export const metadata: Metadata = {
  title: "Διευθύνσεις",
  robots: { index: false, follow: true },
  alternates: { canonical: "/logariasmos/diefthinseis" },
};

export default async function AddressesPage() {
  const addresses = await getCustomerAddresses();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl text-ink">Διευθύνσεις</h1>
      <AddressBook addresses={addresses} />
    </div>
  );
}
