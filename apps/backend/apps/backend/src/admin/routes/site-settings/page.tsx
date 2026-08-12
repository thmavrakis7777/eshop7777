import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Input, Label, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

type SiteSettingsRecord = {
  footer_tagline: string | null
  contact_phone: string | null
  contact_email: string | null
  contact_address: string | null
  business_hours: string | null
  facebook_url: string | null
  instagram_url: string | null
  tiktok_url: string | null
  announcement_text: string | null
  cart_message: string | null
}

const EMPTY_FORM: SiteSettingsRecord = {
  footer_tagline: "",
  contact_phone: "",
  contact_email: "",
  contact_address: "",
  business_hours: "",
  facebook_url: "",
  instagram_url: "",
  tiktok_url: "",
  announcement_text: "",
  cart_message: "",
}

// Standalone route, not a widget — site settings aren't attached to any
// one Medusa entity (product/order/etc.), same reasoning as the homepage
// SEO route in Phase B.
const SiteSettingsPage = () => {
  const [form, setForm] = useState<SiteSettingsRecord>(EMPTY_FORM)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/admin/site-settings", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { settings: SiteSettingsRecord | null }) => {
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

  function update<K extends keyof SiteSettingsRecord>(key: K, value: SiteSettingsRecord[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch("/admin/site-settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success("Οι ρυθμίσεις αποθηκεύτηκαν")
    } catch {
      toast.error("Η αποθήκευση απέτυχε")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-3">
      <div className="px-2">
        <Heading level="h1">Ρυθμίσεις Καταστήματος</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Στοιχεία επικοινωνίας, ωράριο, κοινωνικά δίκτυα και η μπάρα ανακοινώσεων στην κορυφή του καταστήματος.
        </Text>
      </div>

      {isLoading ? (
        <Container className="p-6">
          <Text size="small" className="text-ui-fg-subtle">
            Φόρτωση…
          </Text>
        </Container>
      ) : (
        <>
          <Container className="divide-y p-0">
            <div className="flex items-center justify-between px-6 py-4">
              <Heading level="h2">Μπάρα Ανακοινώσεων</Heading>
            </div>
            <div className="flex flex-col gap-4 px-6 py-4">
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="announcement-text" size="small">Κείμενο</Label>
                <Input
                  id="announcement-text"
                  value={form.announcement_text ?? ""}
                  onChange={(e) => update("announcement_text", e.target.value)}
                  placeholder="Άδειο = η μπάρα δεν εμφανίζεται καθόλου"
                />
              </div>
            </div>
          </Container>

          <Container className="divide-y p-0">
            <div className="flex items-center justify-between px-6 py-4">
              <Heading level="h2">Footer</Heading>
            </div>
            <div className="flex flex-col gap-4 px-6 py-4">
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="footer-tagline" size="small">Σύντομη περιγραφή καταστήματος</Label>
                <Textarea
                  id="footer-tagline"
                  rows={2}
                  value={form.footer_tagline ?? ""}
                  onChange={(e) => update("footer_tagline", e.target.value)}
                  placeholder="Άδειο = χρησιμοποιείται η προεπιλεγμένη περιγραφή"
                />
              </div>
            </div>
          </Container>

          <Container className="divide-y p-0">
            <div className="flex items-center justify-between px-6 py-4">
              <Heading level="h2">Στοιχεία Επικοινωνίας</Heading>
            </div>
            <div className="flex flex-col gap-4 px-6 py-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="contact-phone" size="small">Τηλέφωνο</Label>
                  <Input id="contact-phone" value={form.contact_phone ?? ""} onChange={(e) => update("contact_phone", e.target.value)} />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="contact-email" size="small">Email</Label>
                  <Input id="contact-email" value={form.contact_email ?? ""} onChange={(e) => update("contact_email", e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="contact-address" size="small">Διεύθυνση</Label>
                <Textarea
                  id="contact-address"
                  rows={2}
                  value={form.contact_address ?? ""}
                  onChange={(e) => update("contact_address", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="business-hours" size="small">Ωράριο</Label>
                <Textarea
                  id="business-hours"
                  rows={3}
                  value={form.business_hours ?? ""}
                  onChange={(e) => update("business_hours", e.target.value)}
                  placeholder={"π.χ. Δευ-Παρ 09:00-17:00\nΣάββατο 09:00-14:00"}
                />
              </div>
            </div>
          </Container>

          <Container className="divide-y p-0">
            <div className="flex items-center justify-between px-6 py-4">
              <Heading level="h2">Κοινωνικά Δίκτυα</Heading>
            </div>
            <div className="flex flex-col gap-4 px-6 py-4">
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="facebook-url" size="small">Facebook URL</Label>
                <Input id="facebook-url" value={form.facebook_url ?? ""} onChange={(e) => update("facebook_url", e.target.value)} />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="instagram-url" size="small">Instagram URL</Label>
                <Input id="instagram-url" value={form.instagram_url ?? ""} onChange={(e) => update("instagram_url", e.target.value)} />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="tiktok-url" size="small">TikTok URL</Label>
                <Input id="tiktok-url" value={form.tiktok_url ?? ""} onChange={(e) => update("tiktok_url", e.target.value)} />
              </div>
            </div>
          </Container>

          <Container className="divide-y p-0">
            <div className="flex items-center justify-between px-6 py-4">
              <Heading level="h2">Καλάθι</Heading>
            </div>
            <div className="flex flex-col gap-4 px-6 py-4">
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="cart-message" size="small">Μήνυμα καλαθιού</Label>
                <Input
                  id="cart-message"
                  value={form.cart_message ?? ""}
                  onChange={(e) => update("cart_message", e.target.value)}
                  placeholder="Άδειο = δεν εμφανίζεται τίποτα. Εμφανίζεται στο συρτάρι και τη σελίδα καλαθιού, όχι στο ταμείο."
                />
              </div>
            </div>
          </Container>

          <div className="flex justify-end px-2">
            <Button size="small" variant="secondary" onClick={handleSave} isLoading={isSaving}>
              Αποθήκευση
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Ρυθμίσεις Καταστήματος",
})

export default SiteSettingsPage
