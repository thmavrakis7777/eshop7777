import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, Heading, Input, Label, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

type AssetRecord = { id: string; label: string; url: string }

// A labeled list of externally-hosted image URLs, not real upload/storage
// — see the media_asset model's own comment for why. Same client-side
// list pattern (no nested [id] route) as homepage-blocks/search-synonyms.
function AssetRow({
  asset,
  onSaved,
  onDeleted,
}: {
  asset: AssetRecord
  onSaved: (a: AssetRecord) => void
  onDeleted: (id: string) => void
}) {
  const [label, setLabel] = useState(asset.label)
  const [url, setUrl] = useState(asset.url)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch(`/admin/media-assets/${asset.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, url }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data: { asset: AssetRecord } = await res.json()
      onSaved(data.asset)
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
      const res = await fetch(`/admin/media-assets/${asset.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error(await res.text())
      onDeleted(asset.id)
      toast.success("Διαγράφηκε")
    } catch {
      toast.error("Η διαγραφή απέτυχε")
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-ui-border-base px-4 py-3 last:border-b-0 md:flex-row md:items-center">
      <div className="flex flex-col gap-y-1 md:w-48">
        <Label htmlFor={`label-${asset.id}`} size="small" className="sr-only">
          Ετικέτα
        </Label>
        <Input id={`label-${asset.id}`} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ετικέτα" />
      </div>
      <div className="flex flex-col gap-y-1 flex-1">
        <Label htmlFor={`url-${asset.id}`} size="small" className="sr-only">
          URL
        </Label>
        <Input id={`url-${asset.id}`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
      </div>
      <div className="flex gap-2">
        <Button size="small" variant="secondary" onClick={handleSave} isLoading={isSaving}>
          Αποθήκευση
        </Button>
        <Button size="small" variant="danger" onClick={handleDelete} isLoading={isDeleting}>
          Διαγραφή
        </Button>
      </div>
    </div>
  )
}

const MediaPage = () => {
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/admin/media-assets", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { assets: AssetRecord[] }) => {
        if (!cancelled) setAssets(data.assets)
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

  async function handleAdd() {
    setIsAdding(true)
    try {
      const res = await fetch("/admin/media-assets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "", url: "" }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data: { asset: AssetRecord } = await res.json()
      setAssets((prev) => [...prev, data.asset])
    } catch {
      toast.error("Η δημιουργία απέτυχε")
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-3">
      <div className="px-2">
        <Heading level="h1">Βιβλιοθήκη Μέσων</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Μια λίστα με ετικέτες για εικόνες που φιλοξενούνται ήδη αλλού (π.χ. σε ένα CDN ή image host) — για να τις
          ξαναβρίσκεις εύκολα όταν χρειάζεται ένα σύνδεσμος εικόνας κάπου στο κατάστημα (Αρχική Σελίδα, SEO, κ.λπ.).
          Δεν ανεβάζεις αρχεία εδώ, μόνο καταγράφεις συνδέσμους που ήδη έχεις.
        </Text>
      </div>

      <div className="rounded-lg border border-ui-border-base bg-ui-bg-base">
        {isLoading ? (
          <div className="p-6">
            <Text size="small" className="text-ui-fg-subtle">
              Φόρτωση…
            </Text>
          </div>
        ) : assets.length === 0 ? (
          <div className="p-6">
            <Text size="small" className="text-ui-fg-subtle">
              Δεν έχουν προστεθεί εικόνες ακόμα.
            </Text>
          </div>
        ) : (
          assets.map((a) => (
            <AssetRow
              key={a.id}
              asset={a}
              onSaved={(updated) => setAssets((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
              onDeleted={(id) => setAssets((prev) => prev.filter((x) => x.id !== id))}
            />
          ))
        )}
      </div>

      <Button size="small" variant="secondary" onClick={handleAdd} isLoading={isAdding} className="self-start">
        + Νέα εικόνα
      </Button>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Βιβλιοθήκη Μέσων",
})

export default MediaPage
