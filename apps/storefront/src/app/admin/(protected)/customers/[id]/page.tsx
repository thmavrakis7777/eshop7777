import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerDetail } from "@/lib/admin/customers";
import { CustomerControls } from "@/components/admin/CustomerControls";
import {
  Badge,
  Card,
  PageHeader,
  SectionTitle,
  StatCard,
  StatusBadge,
  formatDate,
  formatDateTime,
  money,
} from "@/components/admin/ui/primitives";

export const metadata = { title: "Πελάτης" };

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomerDetail(id);
  if (!customer) notFound();

  return (
    <>
      <PageHeader
        title={customer.name || customer.email}
        description={customer.email}
        breadcrumb={[
          { label: "Πελάτες", href: "/admin/customers" },
          { label: customer.name || customer.email },
        ]}
        action={
          <div className="flex gap-2">
            {customer.hasAccount ? <Badge tone="info">Λογαριασμός</Badge> : <Badge>Επισκέπτης</Badge>}
            {!customer.isActive && <Badge tone="danger">Ανενεργός</Badge>}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Παραγγελίες" value={String(customer.orderCount)} />
        <StatCard label="Σύνολο αγορών" value={money(customer.totalSpentCents)} />
        <StatCard
          label="Μέση αξία"
          value={
            customer.orderCount > 0
              ? money(Math.round(customer.totalSpentCents / customer.orderCount))
              : "—"
          }
        />
        <StatCard
          label="Τελευταία παραγγελία"
          value={customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"}
          hint={`Πελάτης από ${formatDate(customer.createdAt)}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-5">
          <section>
            <SectionTitle>Παραγγελίες</SectionTitle>
            {customer.orders.length === 0 ? (
              <Card>
                <p className="text-sm text-ink-muted">Καμία παραγγελία ακόμα.</p>
              </Card>
            ) : (
              <Card className="p-0">
                <ul className="divide-y divide-border">
                  {customer.orders.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-surface"
                      >
                        <span className="font-medium tabular-nums text-ink">#{o.orderNumber}</span>
                        <StatusBadge value={o.status} kind="order" />
                        <span className="ml-auto text-sm tabular-nums text-ink">{money(o.totalCents)}</span>
                        <span className="w-full text-xs text-ink-muted sm:w-auto">
                          {formatDateTime(o.createdAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>

          <section>
            <SectionTitle>Διευθύνσεις</SectionTitle>
            {customer.addresses.length === 0 ? (
              <Card>
                <p className="text-sm text-ink-muted">Καμία αποθηκευμένη διεύθυνση.</p>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {customer.addresses.map((a) => (
                  <Card key={a.id}>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">{a.label || "Διεύθυνση"}</span>
                      {a.isDefaultShipping && <Badge tone="info">Προεπιλογή</Badge>}
                    </div>
                    <address className="text-sm not-italic text-ink-muted">
                      {a.name && <div>{a.name}</div>}
                      <div>{a.address1}</div>
                      {a.address2 && <div>{a.address2}</div>}
                      <div>
                        {a.postalCode} {a.city}
                      </div>
                      {a.phone && <div>{a.phone}</div>}
                    </address>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <SectionTitle>Στοιχεία</SectionTitle>
            <dl className="flex flex-col gap-2 text-sm">
              <div>
                <dt className="text-ink-muted">Email</dt>
                <dd className="text-ink">{customer.email}</dd>
              </div>
              {customer.phone && (
                <div>
                  <dt className="text-ink-muted">Τηλέφωνο</dt>
                  <dd className="text-ink">{customer.phone}</dd>
                </div>
              )}
              <div>
                <dt className="text-ink-muted">Marketing</dt>
                <dd className="text-ink">
                  {customer.marketingConsent ? "Έχει δώσει συγκατάθεση" : "Χωρίς συγκατάθεση"}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <SectionTitle>Ενέργειες</SectionTitle>
            <CustomerControls
              customerId={customer.id}
              isActive={customer.isActive}
              hasAccount={customer.hasAccount}
              marketingConsent={customer.marketingConsent}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
