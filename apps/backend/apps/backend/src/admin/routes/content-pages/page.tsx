import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Checkbox, Heading, Input, Label, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

// A fixed, known set — not admin-authorable — because the storefront has
// one literal route folder per slug (app/{slug}/page.tsx), not a dynamic
// [slug] route. Adding a 7th page here without also adding its storefront
// folder would create a page with nowhere to be visited, so the set stays
// in lockstep with the storefront's actual routes rather than being
// open-ended CRUD.
const PAGES = [
  { slug: "sxetika", label: "Σχετικά με εμάς" },
  { slug: "apostoles", label: "Αποστολές & Παράδοση" },
  { slug: "epistrofes", label: "Επιστροφές & Αλλαγές" },
  { slug: "aporrito", label: "Πολιτική Απορρήτου" },
  { slug: "oroi-xrisis", label: "Όροι Χρήσης" },
  { slug: "faq", label: "Συχνές Ερωτήσεις" },
] as const

type ContentPageRecord = {
  title: string
  body: string | null
  is_published: boolean
}

const EMPTY_FORM: ContentPageRecord = { title: "", body: "", is_published: false }

// Single route with client-side master/detail instead of a nested
// [slug]/page.tsx route — Medusa v2 admin dynamic route params
// (useParams from react-router-dom) have a documented open bug
// (medusajs/medusa#9794) where the parameter isn't reliably captured;
// avoiding the pattern entirely sidesteps that risk for a fixed set of
// only six pages, where a single-screen list+form is arguably better UX
// anyway.
const ContentPagesPage = () => {
  const [selectedSlug, setSelectedSlug] = useState<string>(PAGES[0].slug)
  const [form, setForm] = useState<ContentPageRecord>(EMPTY_FORM)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    fetch(`/admin/content-pages?slug=${selectedSlug}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data: { page: ContentPageRecord | null }) => {
        if (cancelled) return
        setForm(data.page ? { ...EMPTY_FORM, ...data.page } : EMPTY_FORM)
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
  }, [selectedSlug])

  function update<K extends keyof ContentPageRecord>(key: K, value: ContentPageRecord[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch("/admin/content-pages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: selectedSlug, ...form }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success("Η σελίδα αποθηκεύτηκε")
    } catch {
      toast.error("Η αποθήκευση απέτυχε")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
      <div className="flex flex-col gap-y-1 rounded-lg border border-ui-border-base bg-ui-bg-base p-2">
        {PAGES.map((p) => (
          <button
            key={p.slug}
            type="button"
            onClick={() => setSelectedSlug(p.slug)}
            className={`rounded-md px-3 py-2 text-left text-sm ${
              p.slug === selectedSlug ? "bg-ui-bg-base-pressed font-medium" : "hover:bg-ui-bg-base-hover"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-ui-border-base bg-ui-bg-base">
        <div className="flex items-center justify-between border-b border-ui-border-base px-6 py-4">
          <div className="flex items-center gap-3">
            <Heading level="h2">{PAGES.find((p) => p.slug === selectedSlug)?.label}</Heading>
            <Badge color={form.is_published ? "green" : "grey"}>
              {form.is_published ? "Δημοσιευμένη" : "Πρόχειρο"}
            </Badge>
          </div>
          <Button size="small" variant="secondary" onClick={handleSave} isLoading={isSaving} disabled={isLoading}>
            Αποθήκευση
          </Button>
        </div>

        {isLoading ? (
          <div className="p-6">
            <Text size="small" className="text-ui-fg-subtle">
              Φόρτωση…
            </Text>
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-6 py-4">
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="content-page-title" size="small">Τίτλος</Label>
              <Input id="content-page-title" value={form.title} onChange={(e) => update("title", e.target.value)} />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label htmlFor="content-page-body" size="small">Περιεχόμενο</Label>
              <Textarea
                id="content-page-body"
                rows={16}
                value={form.body ?? ""}
                onChange={(e) => update("body", e.target.value)}
                placeholder="Απλό κείμενο — κενή γραμμή = νέα παράγραφος"
              />
            </div>

            <div className="flex items-center gap-x-2">
              <Checkbox
                id="is_published"
                checked={form.is_published}
                onCheckedChange={(checked) => update("is_published", checked === true)}
              />
              <Label htmlFor="is_published" size="small">
                Δημοσιευμένη (ορατή στο κατάστημα)
              </Label>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Σελίδες Περιεχομένου",
})

export default ContentPagesPage
