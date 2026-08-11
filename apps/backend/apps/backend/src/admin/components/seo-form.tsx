import { Button, Container, Heading, Input, Label, Select, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

type SeoRecord = {
  id: string
  seo_title: string | null
  meta_description: string | null
  canonical_url: string | null
  og_title: string | null
  og_description: string | null
  social_image_url: string | null
  keywords: string | null
  robots: "index" | "noindex"
}

type SeoFormState = Omit<SeoRecord, "id">

const EMPTY_FORM: SeoFormState = {
  seo_title: "",
  meta_description: "",
  canonical_url: "",
  og_title: "",
  og_description: "",
  social_image_url: "",
  keywords: "",
  robots: "index",
}

// Shared form for the "seo" module (see src/modules/seo) — backs the
// product widget, category widget, and homepage route, all through the
// same /admin/seo endpoint, since the field set and CRUD shape are
// identical across resource types (only resourceType/resourceId differ).
export function SeoForm({
  resourceType,
  resourceId,
  heading = "SEO",
}: {
  resourceType: "product" | "category" | "homepage"
  resourceId: string
  heading?: string
}) {
  const [form, setForm] = useState<SeoFormState>(EMPTY_FORM)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    fetch(`/admin/seo?resource_type=${resourceType}&resource_id=${encodeURIComponent(resourceId)}`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data: { seo: SeoRecord | null }) => {
        if (cancelled) return
        if (data.seo) setForm({ ...EMPTY_FORM, ...data.seo })
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [resourceType, resourceId])

  function update<K extends keyof SeoFormState>(key: K, value: SeoFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch(`/admin/seo`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_type: resourceType, resource_id: resourceId, ...form }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success("Το SEO αποθηκεύτηκε")
    } catch {
      toast.error("Η αποθήκευση απέτυχε")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Container className="p-6">
        <Text size="small" className="text-ui-fg-subtle">
          Φόρτωση SEO…
        </Text>
      </Container>
    )
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">{heading}</Heading>
        <Button size="small" variant="secondary" onClick={handleSave} isLoading={isSaving}>
          Αποθήκευση
        </Button>
      </div>

      <div className="flex flex-col gap-4 px-6 py-4">
        <div className="flex flex-col gap-y-2">
          <Label size="small">SEO Title</Label>
          <Input
            value={form.seo_title ?? ""}
            onChange={(e) => update("seo_title", e.target.value)}
            placeholder="Χρησιμοποιείται ο προεπιλεγμένος τίτλος αν μείνει κενό"
          />
        </div>

        <div className="flex flex-col gap-y-2">
          <Label size="small">Meta Description</Label>
          <Textarea
            rows={3}
            value={form.meta_description ?? ""}
            onChange={(e) => update("meta_description", e.target.value)}
            placeholder="Χρησιμοποιείται η προεπιλεγμένη περιγραφή αν μείνει κενό"
          />
        </div>

        <div className="flex flex-col gap-y-2">
          <Label size="small">Canonical URL</Label>
          <Input
            value={form.canonical_url ?? ""}
            onChange={(e) => update("canonical_url", e.target.value)}
            placeholder="Αυτόματο αν μείνει κενό"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-y-2">
            <Label size="small">OG Title</Label>
            <Input value={form.og_title ?? ""} onChange={(e) => update("og_title", e.target.value)} />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label size="small">OG Description</Label>
            <Input value={form.og_description ?? ""} onChange={(e) => update("og_description", e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-y-2">
          <Label size="small">Social Image URL</Label>
          <Input
            value={form.social_image_url ?? ""}
            onChange={(e) => update("social_image_url", e.target.value)}
            placeholder="Ανέβασε εικόνα και επικόλλησε το URL της"
          />
        </div>

        <div className="flex flex-col gap-y-2">
          <Label size="small">Λέξεις-κλειδιά (προαιρετικό)</Label>
          <Input value={form.keywords ?? ""} onChange={(e) => update("keywords", e.target.value)} placeholder="χωρισμένες με κόμμα" />
        </div>

        <div className="flex flex-col gap-y-2">
          <Label size="small">Robots</Label>
          <Select value={form.robots} onValueChange={(value) => update("robots", value as "index" | "noindex")}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="index">Index — εμφανίζεται στη Google</Select.Item>
              <Select.Item value="noindex">Noindex — κρυφό από τη Google</Select.Item>
            </Select.Content>
          </Select>
        </div>
      </div>
    </Container>
  )
}
