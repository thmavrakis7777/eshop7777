import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Input, Label, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

type SettingsRecord = {
  ga4_measurement_id: string | null
  gtm_container_id: string | null
  meta_pixel_id: string | null
  clarity_project_id: string | null
}

const EMPTY_FORM: SettingsRecord = {
  ga4_measurement_id: "",
  gtm_container_id: "",
  meta_pixel_id: "",
  clarity_project_id: "",
}

// Four optional tracking-service IDs, none fabricated or pre-filled — the
// storefront's cookie-consent banner only appears at all once at least one
// of these is set, and no script for a service loads until the visitor
// explicitly accepts (see ConsentBanner/AnalyticsScripts on the
// storefront). Leaving a field blank means that service is simply never
// wired up.
const AnalyticsSettingsPage = () => {
  const [form, setForm] = useState<SettingsRecord>(EMPTY_FORM)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/admin/analytics-settings", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { settings: SettingsRecord | null }) => {
        if (cancelled) return
        if (data.settings) setForm({ ...EMPTY_FORM, ...data.settings })
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

  function update<K extends keyof SettingsRecord>(key: K, value: SettingsRecord[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch("/admin/analytics-settings", {
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

  return (
    <div className="flex flex-col gap-y-3">
      <div className="px-2">
        <Heading level="h1">Analytics &amp; Συναίνεση Cookies</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Στοιχεία σύνδεσης με υπηρεσίες παρακολούθησης. Το banner συναίνεσης cookies
          εμφανίζεται στο κατάστημα μόνο αν έχει συμπληρωθεί τουλάχιστον ένα από τα
          παρακάτω, και κανένα script δεν φορτώνει πριν ο επισκέπτης το αποδεχτεί ρητά.
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
            <Heading level="h2">Στοιχεία υπηρεσιών</Heading>
            <Button size="small" variant="secondary" onClick={handleSave} isLoading={isSaving}>
              Αποθήκευση
            </Button>
          </div>

          <div className="flex flex-col gap-4 px-6 py-4">
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="ga4-measurement-id" size="small">Google Analytics 4 — Measurement ID</Label>
              <Input
                id="ga4-measurement-id"
                value={form.ga4_measurement_id ?? ""}
                onChange={(e) => update("ga4_measurement_id", e.target.value)}
                placeholder="G-XXXXXXXXXX"
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label htmlFor="gtm-container-id" size="small">Google Tag Manager — Container ID</Label>
              <Input
                id="gtm-container-id"
                value={form.gtm_container_id ?? ""}
                onChange={(e) => update("gtm_container_id", e.target.value)}
                placeholder="GTM-XXXXXXX"
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label htmlFor="meta-pixel-id" size="small">Meta Pixel ID</Label>
              <Input
                id="meta-pixel-id"
                value={form.meta_pixel_id ?? ""}
                onChange={(e) => update("meta_pixel_id", e.target.value)}
                placeholder="123456789012345"
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label htmlFor="clarity-project-id" size="small">Microsoft Clarity — Project ID</Label>
              <Input
                id="clarity-project-id"
                value={form.clarity_project_id ?? ""}
                onChange={(e) => update("clarity_project_id", e.target.value)}
                placeholder="abcd1234ef"
              />
            </div>
          </div>
        </Container>
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Analytics",
})

export default AnalyticsSettingsPage
