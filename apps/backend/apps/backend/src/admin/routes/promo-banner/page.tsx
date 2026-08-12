import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Checkbox, Container, Heading, Input, Label, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

type BannerRecord = {
  headline: string | null
  body: string | null
  cta_label: string | null
  cta_href: string | null
  ends_at: string | null
  is_published: boolean
}

const EMPTY_FORM: BannerRecord = {
  headline: "",
  body: "",
  cta_label: "",
  cta_href: "",
  ends_at: "",
  is_published: false,
}

// <input type="datetime-local"> needs "YYYY-MM-DDTHH:mm" in the browser's
// local time, not the full ISO-8601-with-timezone string stored on the
// backend (e.g. "2026-08-15T10:00:00.000Z") — without this conversion the
// field silently shows blank for any real saved value.
function isoToLocalInputValue(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputValueToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// Marketing copy promoting a real discount — not a discount engine
// itself. Real promotions/discounts are Medusa's native Promotions
// module (with its own "Campaign" concept, hence this admin-first
// module being named "promo-banner" rather than "campaign" — see the
// model's own comment for the real GraphQL naming collision that forced
// this). Keep the "Λήγει στις" date in sync with the real promotion's
// own end date yourself — this field isn't connected to Medusa's
// Promotions data, same trust level as every other admin-entered fact in
// this project.
const PromoBannerPage = () => {
  const [form, setForm] = useState<BannerRecord>(EMPTY_FORM)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/admin/promo-banner", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { banner: BannerRecord | null }) => {
        if (cancelled) return
        if (data.banner) setForm({ ...EMPTY_FORM, ...data.banner })
      })
      .catch(() => {
        if (!cancelled) toast.error("Η φόρτωση απέτυχε")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function update<K extends keyof BannerRecord>(key: K, value: BannerRecord[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch("/admin/promo-banner", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success("Αποθηκεύτηκε")
    } catch {
      toast.error("Η αποθήκευση απέτυχε")
    } finally {
      setIsSaving(false)
    }
  }

  // Fail closed on a malformed ends_at (only reachable via a direct API
  // write, never via this datetime-local input) — treat it as expired
  // rather than silently reading as "still live indefinitely". Mirrors the
  // storefront's /store/promo-banner route.
  const endsAtMs = form.ends_at ? new Date(form.ends_at).getTime() : null
  const isExpired = endsAtMs === null ? false : Number.isNaN(endsAtMs) ? true : endsAtMs <= Date.now()

  return (
    <div className="flex flex-col gap-y-3">
      <div className="px-2">
        <Heading level="h1">Προωθητικό Banner</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Ένα banner με αντίστροφη μέτρηση για να προωθήσεις μια πραγματική προσφορά (π.χ. flash sale). Δεν
          δημιουργεί καμία έκπτωση από μόνο του — η πραγματική έκπτωση ρυθμίζεται στο{" "}
          <strong>Promotions</strong>, εδώ βάζεις μόνο το κείμενο και την ημερομηνία λήξης.
        </Text>
      </div>

      {isLoading ? (
        <Container className="p-6">
          <Text size="small" className="text-ui-fg-subtle">
            Φόρτωση…
          </Text>
        </Container>
      ) : (
        <Container className="divide-y p-0">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <Heading level="h2">Banner</Heading>
              <Badge color={form.is_published && !isExpired ? "green" : "grey"}>
                {isExpired ? "Έληξε" : form.is_published ? "Δημοσιευμένο" : "Πρόχειρο"}
              </Badge>
            </div>
            <Button size="small" variant="secondary" onClick={handleSave} isLoading={isSaving}>
              Αποθήκευση
            </Button>
          </div>

          <div className="flex flex-col gap-4 px-6 py-4">
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="promo-headline" size="small">Τίτλος</Label>
              <Input id="promo-headline" value={form.headline ?? ""} onChange={(e) => update("headline", e.target.value)} />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label htmlFor="promo-body" size="small">Κείμενο</Label>
              <Textarea id="promo-body" rows={2} value={form.body ?? ""} onChange={(e) => update("body", e.target.value)} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="promo-cta-label" size="small">Κείμενο κουμπιού</Label>
                <Input id="promo-cta-label" value={form.cta_label ?? ""} onChange={(e) => update("cta_label", e.target.value)} />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="promo-cta-href" size="small">Σύνδεσμος κουμπιού</Label>
                <Input
                  id="promo-cta-href"
                  value={form.cta_href ?? ""}
                  onChange={(e) => update("cta_href", e.target.value)}
                  placeholder="/kouzina"
                />
              </div>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label htmlFor="promo-ends-at" size="small">Λήγει στις</Label>
              <Input
                id="promo-ends-at"
                type="datetime-local"
                value={isoToLocalInputValue(form.ends_at)}
                onChange={(e) => update("ends_at", localInputValueToIso(e.target.value))}
              />
              <Text size="xsmall" className="text-ui-fg-subtle">
                Το banner εξαφανίζεται αυτόματα μετά από αυτή την ώρα, ακόμα κι αν παραμείνει δημοσιευμένο.
              </Text>
            </div>

            <div className="flex items-center gap-x-2">
              <Checkbox
                id="is_published"
                checked={form.is_published}
                onCheckedChange={(checked) => update("is_published", checked === true)}
              />
              <Label htmlFor="is_published" size="small">
                Δημοσιευμένο (ορατό στο κατάστημα)
              </Label>
            </div>
          </div>
        </Container>
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Προωθητικό Banner",
})

export default PromoBannerPage
