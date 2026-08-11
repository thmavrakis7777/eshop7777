import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, Heading, Input, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

type SynonymRecord = { id: string; terms: string }

// One route, client-side add/edit/delete — same reasoning as the
// homepage-blocks route (Phase E) for avoiding a nested [id] admin route
// (medusajs/medusa#9794). Hidden/boosted flags for search live on each
// product's own Merchandising widget (Phase F/H), not here — this route
// is only for the site-wide synonym list.
function SynonymRow({
  synonym,
  onSaved,
  onDeleted,
}: {
  synonym: SynonymRecord
  onSaved: (s: SynonymRecord) => void
  onDeleted: (id: string) => void
}) {
  const [terms, setTerms] = useState(synonym.terms)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch(`/admin/search-synonyms/${synonym.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data: { synonym: SynonymRecord } = await res.json()
      onSaved(data.synonym)
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
      const res = await fetch(`/admin/search-synonyms/${synonym.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error(await res.text())
      onDeleted(synonym.id)
      toast.success("Διαγράφηκε")
    } catch {
      toast.error("Η διαγραφή απέτυχε")
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-2 border-b border-ui-border-base px-4 py-3 last:border-b-0">
      <Input value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="π.χ. τηγάνι, tigani, pan" />
      <Button size="small" variant="secondary" onClick={handleSave} isLoading={isSaving}>
        Αποθήκευση
      </Button>
      <Button size="small" variant="danger" onClick={handleDelete} isLoading={isDeleting}>
        Διαγραφή
      </Button>
    </div>
  )
}

const SearchPage = () => {
  const [synonyms, setSynonyms] = useState<SynonymRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/admin/search-synonyms", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { synonyms: SynonymRecord[] }) => {
        if (!cancelled) setSynonyms(data.synonyms)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleAdd() {
    setIsAdding(true)
    try {
      const res = await fetch("/admin/search-synonyms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms: "" }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data: { synonym: SynonymRecord } = await res.json()
      setSynonyms((prev) => [...prev, data.synonym])
    } catch {
      toast.error("Η δημιουργία απέτυχε")
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-3">
      <div className="px-2">
        <Heading level="h1">Αναζήτηση</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Συνώνυμα όρων αναζήτησης — π.χ. αν κάποιος γράψει &quot;pan&quot;, να ταιριάζουν και τα προϊόντα που
          περιέχουν &quot;τηγάνι&quot;. Χωρισμένα με κόμμα, όλοι οι όροι θεωρούνται ισοδύναμοι. Η απόκρυψη
          προϊόντων και η προτεραιότητα στα αποτελέσματα ρυθμίζονται στη σελίδα κάθε προϊόντος
          (&quot;Merchandising&quot;).
        </Text>
      </div>

      <div className="rounded-lg border border-ui-border-base bg-ui-bg-base">
        {isLoading ? (
          <div className="p-6">
            <Text size="small" className="text-ui-fg-subtle">
              Φόρτωση…
            </Text>
          </div>
        ) : synonyms.length === 0 ? (
          <div className="p-6">
            <Text size="small" className="text-ui-fg-subtle">
              Δεν έχουν οριστεί συνώνυμα ακόμα.
            </Text>
          </div>
        ) : (
          synonyms.map((s) => (
            <SynonymRow
              key={s.id}
              synonym={s}
              onSaved={(updated) => setSynonyms((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
              onDeleted={(id) => setSynonyms((prev) => prev.filter((x) => x.id !== id))}
            />
          ))
        )}
      </div>

      <Button size="small" variant="secondary" onClick={handleAdd} isLoading={isAdding} className="self-start">
        + Νέα ομάδα συνωνύμων
      </Button>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Αναζήτηση",
})

export default SearchPage
