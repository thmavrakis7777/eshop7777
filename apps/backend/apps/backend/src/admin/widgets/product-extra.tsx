import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Input, Label, Select, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

// Local, minimal shape — see product-seo.tsx for why this isn't imported
// from @medusajs/types.
type WidgetProductData = { id: string }

type ExtraRecord = {
  badge_label: string | null
  badge_tone: "accent" | "success" | "neutral"
  warranty_text: string | null
  downloads_url: string | null
}

const EMPTY_FORM: ExtraRecord = {
  badge_label: "",
  badge_tone: "neutral",
  warranty_text: "",
  downloads_url: "",
}

// A second, independent widget in the same product.details.side.after
// zone as product-seo.tsx's SEO widget — Medusa stacks multiple widgets
// in one zone without conflict, so this stays its own module/route rather
// than folding merchandising fields into the unrelated seo module.
const ProductExtraWidget = ({ data }: { data: WidgetProductData }) => {
  const [form, setForm] = useState<ExtraRecord>(EMPTY_FORM)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/admin/product-extras?product_id=${data.id}`, { credentials: "include" })
      .then((res) => res.json())
      .then((res: { extra: ExtraRecord | null }) => {
        if (cancelled) return
        if (res.extra) setForm({ ...EMPTY_FORM, ...res.extra })
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [data.id])

  function update<K extends keyof ExtraRecord>(key: K, value: ExtraRecord[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch("/admin/product-extras", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: data.id, ...form }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success("Αποθηκεύτηκε")
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
          Φόρτωση…
        </Text>
      </Container>
    )
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Merchandising</Heading>
        <Button size="small" variant="secondary" onClick={handleSave} isLoading={isSaving}>
          Αποθήκευση
        </Button>
      </div>

      <div className="flex flex-col gap-4 px-6 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-y-2">
            <Label size="small">Ετικέτα (badge)</Label>
            <Input
              value={form.badge_label ?? ""}
              onChange={(e) => update("badge_label", e.target.value)}
              placeholder="π.χ. Χειροποίητο, Best Seller"
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label size="small">Χρώμα ετικέτας</Label>
            <Select value={form.badge_tone} onValueChange={(v) => update("badge_tone", v as ExtraRecord["badge_tone"])}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="neutral">Ουδέτερο</Select.Item>
                <Select.Item value="accent">Έμφαση</Select.Item>
                <Select.Item value="success">Πράσινο</Select.Item>
              </Select.Content>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-y-2">
          <Label size="small">Κείμενο εγγύησης</Label>
          <Textarea
            rows={3}
            value={form.warranty_text ?? ""}
            onChange={(e) => update("warranty_text", e.target.value)}
            placeholder="π.χ. 2 χρόνια εγγύηση κατασκευαστή"
          />
        </div>

        <div className="flex flex-col gap-y-2">
          <Label size="small">Σύνδεσμος Downloads (π.χ. εγχειρίδιο PDF)</Label>
          <Input value={form.downloads_url ?? ""} onChange={(e) => update("downloads_url", e.target.value)} />
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.side.after",
})

export default ProductExtraWidget
