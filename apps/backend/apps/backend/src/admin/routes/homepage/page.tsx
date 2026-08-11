import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Checkbox, Heading, Input, Label, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

type Kind = "hero" | "promo"

type BlockRecord = {
  id: string
  kind: Kind
  eyebrow: string | null
  heading: string | null
  body: string | null
  cta_label: string | null
  cta_href: string | null
  image_url: string | null
  sort_order: number
  is_published: boolean
}

type BlockForm = Omit<BlockRecord, "id" | "kind">

const EMPTY_FORM: BlockForm = {
  eyebrow: "",
  heading: "",
  body: "",
  cta_label: "",
  cta_href: "",
  image_url: "",
  sort_order: 0,
  is_published: false,
}

// One route, two sections (Hero slides / Promo blocks), all client-side —
// same reasoning as the content-pages route for avoiding a nested [id]
// admin route (medusajs/medusa#9794), extended here to a genuinely
// open-ended list: add/edit/delete all happen via this one screen's own
// state, never a per-item URL. Ordering is a plain numeric "sort_order"
// field the admin types in, not drag-and-drop — simpler to build, and
// entirely sufficient for a handful of blocks.
function BlockCard({
  block,
  onSaved,
  onDeleted,
}: {
  block: BlockRecord
  onSaved: (b: BlockRecord) => void
  onDeleted: (id: string) => void
}) {
  const [form, setForm] = useState<BlockForm>({ ...EMPTY_FORM, ...block })
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  function update<K extends keyof BlockForm>(key: K, value: BlockForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch(`/admin/homepage-blocks/${block.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(await res.text())
      const data: { block: BlockRecord } = await res.json()
      onSaved(data.block)
      toast.success("Αποθηκεύτηκε")
    } catch {
      toast.error("Η αποθήκευση απέτυχε")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const res = await fetch(`/admin/homepage-blocks/${block.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error(await res.text())
      onDeleted(block.id)
      toast.success("Διαγράφηκε")
    } catch {
      toast.error("Η διαγραφή απέτυχε")
      setIsDeleting(false)
    }
  }

  return (
    <div className="rounded-lg border border-ui-border-base bg-ui-bg-base">
      <div className="flex items-center justify-between border-b border-ui-border-base px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge color={form.is_published ? "green" : "grey"}>
            {form.is_published ? "Δημοσιευμένο" : "Πρόχειρο"}
          </Badge>
          <Text size="small" className="text-ui-fg-subtle">
            {form.heading || "(χωρίς τίτλο)"}
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Button size="small" variant="secondary" onClick={handleSave} isLoading={isSaving}>
            Αποθήκευση
          </Button>
          <Button size="small" variant="danger" onClick={handleDelete} isLoading={isDeleting}>
            Διαγραφή
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-y-1">
            <Label size="small">Eyebrow (μικρός τίτλος πάνω)</Label>
            <Input value={form.eyebrow ?? ""} onChange={(e) => update("eyebrow", e.target.value)} />
          </div>
          <div className="flex flex-col gap-y-1">
            <Label size="small">Σειρά εμφάνισης</Label>
            <Input
              type="number"
              value={form.sort_order}
              onChange={(e) => update("sort_order", Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-y-1">
          <Label size="small">Τίτλος</Label>
          <Input value={form.heading ?? ""} onChange={(e) => update("heading", e.target.value)} />
        </div>

        <div className="flex flex-col gap-y-1">
          <Label size="small">Κείμενο</Label>
          <Textarea rows={2} value={form.body ?? ""} onChange={(e) => update("body", e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-y-1">
            <Label size="small">Κείμενο κουμπιού</Label>
            <Input value={form.cta_label ?? ""} onChange={(e) => update("cta_label", e.target.value)} />
          </div>
          <div className="flex flex-col gap-y-1">
            <Label size="small">Σύνδεσμος κουμπιού</Label>
            <Input
              value={form.cta_href ?? ""}
              onChange={(e) => update("cta_href", e.target.value)}
              placeholder="/kouzina"
            />
          </div>
        </div>

        <div className="flex flex-col gap-y-1">
          <Label size="small">Εικόνα (URL)</Label>
          <Input
            value={form.image_url ?? ""}
            onChange={(e) => update("image_url", e.target.value)}
            placeholder="Άδειο = εμφανίζεται το προεπιλεγμένο γραφικό"
          />
        </div>

        <div className="flex items-center gap-x-2">
          <Checkbox
            id={`published-${block.id}`}
            checked={form.is_published}
            onCheckedChange={(checked) => update("is_published", checked === true)}
          />
          <Label htmlFor={`published-${block.id}`} size="small">
            Δημοσιευμένο (ορατό στο κατάστημα)
          </Label>
        </div>
      </div>
    </div>
  )
}

function BlockSection({ kind, title, hint }: { kind: Kind; title: string; hint: string }) {
  const [blocks, setBlocks] = useState<BlockRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/admin/homepage-blocks?kind=${kind}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data: { blocks: BlockRecord[] }) => {
        if (!cancelled) setBlocks(data.blocks)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [kind])

  async function handleAdd() {
    setIsAdding(true)
    try {
      const nextOrder = blocks.reduce((max, b) => Math.max(max, b.sort_order), -1) + 1
      const res = await fetch("/admin/homepage-blocks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, sort_order: nextOrder }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data: { block: BlockRecord } = await res.json()
      setBlocks((prev) => [...prev, data.block])
    } catch {
      toast.error("Η δημιουργία απέτυχε")
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-3">
      <div>
        <Heading level="h2">{title}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {hint}
        </Text>
      </div>

      {isLoading ? (
        <Text size="small" className="text-ui-fg-subtle">
          Φόρτωση…
        </Text>
      ) : (
        <>
          {blocks
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((block) => (
              <BlockCard
                key={block.id}
                block={block}
                onSaved={(updated) => setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))}
                onDeleted={(id) => setBlocks((prev) => prev.filter((b) => b.id !== id))}
              />
            ))}
          <Button size="small" variant="secondary" onClick={handleAdd} isLoading={isAdding} className="self-start">
            + Νέο
          </Button>
        </>
      )}
    </div>
  )
}

const HomepagePage = () => {
  return (
    <div className="flex flex-col gap-y-8">
      <div className="px-2">
        <Heading level="h1">Αρχική Σελίδα</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Διαχείριση του κεντρικού banner (Hero) και των διαφημιστικών ενοτήτων της αρχικής σελίδας. Χωρίς
          δημοσιευμένα στοιχεία, εμφανίζεται το προεπιλεγμένο περιεχόμενο του καταστήματος.
        </Text>
      </div>

      <BlockSection
        kind="hero"
        title="Hero (κεντρικό banner)"
        hint="Ένα στοιχείο = στατικό banner. Δύο ή περισσότερα = εναλλασσόμενο. Χωρίς δημοσιευμένο στοιχείο, εμφανίζεται το προεπιλεγμένο."
      />

      <BlockSection
        kind="promo"
        title="Διαφημιστικές Ενότητες"
        hint="Εμφανίζονται κάτω από τις κατηγορίες, με τη σειρά που ορίζεις."
      />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Αρχική Σελίδα",
})

export default HomepagePage
