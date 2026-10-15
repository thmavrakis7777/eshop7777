"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  resetCategoryProductOrderAction,
  saveCategoryProductOrderAction,
} from "@/lib/admin/taxonomy-actions";
import { buttonStyles } from "@/components/admin/ui/primitives";

export type OrderableProduct = {
  id: string;
  title: string;
  code: string | null;
  imageUrl: string | null;
  price: string;
  isAvailable: boolean;
  isPlaced: boolean;
};

/**
 * One category page's product order, arranged by dragging the ⠿ handle or
 * with ↑/↓/«Πρώτο» — the buttons work everywhere drag is awkward (keyboard,
 * a small phone screen, a long list).
 *
 * Changes stay local until «Αποθήκευση», which sends the whole list in one
 * request: a failed save can't leave half a reorder stored, and dragging ten
 * items doesn't fire ten writes. Only the ⠿ handle starts a drag, so the rest
 * of each row still scrolls the page normally on a touch screen.
 */
export function CategoryProductOrder({
  categoryId,
  products,
  hasSavedOrder,
}: {
  categoryId: string;
  products: OrderableProduct[];
  hasSavedOrder: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(products);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const dirty = items.some((p, i) => p.id !== products[i]?.id);

  // Leaving with an unsaved arrangement asks first — the work is easy to
  // lose with one tap on a sidebar link otherwise.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const sensors = useSensors(
    // A few pixels of movement before a drag starts, so a tap on the handle
    // isn't mistaken for one.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    setItems((prev) => arrayMove(prev, from, to));
    setMsg(null);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((p) => p.id === active.id);
    const to = items.findIndex((p) => p.id === over.id);
    move(from, to);
  }

  function run(fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setMsg({ ok: true, text: result.message ?? "Αποθηκεύτηκε." });
        setConfirmReset(false);
        router.refresh();
      } else {
        setMsg({ ok: false, text: result.error });
      }
    });
  }

  const titleOf = (id: string | number) => items.find((p) => p.id === id)?.title ?? "";
  const positionOf = (id: string | number) => items.findIndex((p) => p.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Μετακίνηση: ${titleOf(active.id)}, θέση ${positionOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${titleOf(active.id)}: πάνω από τη θέση ${positionOf(over.id)}.` : `${titleOf(active.id)}: εκτός λίστας.`,
    onDragEnd: ({ active, over }) =>
      over ? `${titleOf(active.id)}: θέση ${positionOf(over.id)}.` : `${titleOf(active.id)}: χωρίς αλλαγή.`,
    onDragCancel: ({ active }) => `Ακύρωση. ${titleOf(active.id)}: χωρίς αλλαγή.`,
  };

  return (
    <div className="pb-24">
      {msg && (
        <div
          role="status"
          className={`mb-4 rounded-md border px-4 py-2.5 text-sm ${
            msg.ok ? "border-success/30 bg-success/5 text-success" : "border-danger/30 bg-danger/5 text-danger"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm text-ink-muted">
          {hasSavedOrder
            ? "Ισχύει χειροκίνητη σειρά. Προϊόντα που θα προστεθούν αργότερα εμφανίζονται μετά από αυτά, νεότερα πρώτα."
            : "Ισχύει η αυτόματη σειρά (νεότερα πρώτα). Σύρε ή χρησιμοποίησε τα βέλη και πάτησε «Αποθήκευση»."}{" "}
          Τα εξαντλημένα εμφανίζονται στο κατάστημα στο τέλος, μέχρι να ξαναμπούν σε απόθεμα.
        </p>
        {hasSavedOrder && !confirmReset && (
          <button
            type="button"
            className={`${buttonStyles.ghost} shrink-0`}
            disabled={pending}
            onClick={() => setConfirmReset(true)}
          >
            Επαναφορά αυτόματης σειράς
          </button>
        )}
        {confirmReset && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <span>Να διαγραφεί η χειροκίνητη σειρά;</span>
            <button
              type="button"
              className={buttonStyles.danger}
              disabled={pending}
              onClick={() => run(() => resetCategoryProductOrderAction(categoryId))}
            >
              Επαναφορά
            </button>
            <button type="button" className={buttonStyles.secondary} onClick={() => setConfirmReset(false)}>
              Άκυρο
            </button>
          </div>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "Πάτησε Space ή Enter για να πιάσεις το προϊόν, τα βέλη για να το μετακινήσεις, Space ή Enter για να το αφήσεις, Escape για ακύρωση.",
          },
        }}
      >
        <SortableContext items={items.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <ol className="overflow-hidden rounded-lg border border-border">
            {items.map((p, index) => (
              <SortableRow
                key={p.id}
                product={p}
                index={index}
                last={index === items.length - 1}
                showUnplaced={hasSavedOrder}
                disabled={pending}
                onMove={(to) => move(index, to)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      {/* Sticky so «Αποθήκευση» stays reachable at the end of a long drag
          on a phone, without scrolling back up. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur md:sticky md:mt-4 md:rounded-lg md:border">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-2">
          <span className="mr-auto text-sm text-ink-muted">
            {dirty ? "Μη αποθηκευμένες αλλαγές" : `${items.length} ${items.length === 1 ? "προϊόν" : "προϊόντα"}`}
          </span>
          {dirty && (
            <button
              type="button"
              className={buttonStyles.secondary}
              disabled={pending}
              onClick={() => {
                setItems(products);
                setMsg(null);
              }}
            >
              Αναίρεση
            </button>
          )}
          <button
            type="button"
            className={buttonStyles.primary}
            disabled={pending || (!dirty && hasSavedOrder)}
            onClick={() => run(() => saveCategoryProductOrderAction(categoryId, items.map((p) => p.id)))}
          >
            {pending ? "Αποθήκευση…" : "Αποθήκευση σειράς"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableRow({
  product: p,
  index,
  last,
  showUnplaced,
  disabled,
  onMove,
}: {
  product: OrderableProduct;
  index: number;
  last: boolean;
  showUnplaced: boolean;
  disabled: boolean;
  onMove: (to: number) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: p.id, disabled });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative flex items-center gap-2 border-b border-border bg-bg px-2 py-2 last:border-b-0 sm:gap-3 sm:px-3 ${
        isDragging ? "z-10 shadow-lg ring-1 ring-accent" : ""
      }`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Σύρε για μετακίνηση: ${p.title}`}
        title="Σύρε για μετακίνηση"
        // touch-none on the handle only: dragging it doesn't scroll the
        // page, while the rest of the row still does.
        className="flex h-10 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-lg text-ink-muted hover:bg-surface hover:text-ink active:cursor-grabbing"
      >
        ⠿
      </button>

      <span className="w-6 shrink-0 text-right text-sm tabular-nums text-ink-muted">{index + 1}</span>

      {p.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-only thumbnail, same as ProductImageManager
        <img
          src={p.imageUrl}
          alt=""
          loading="lazy"
          className="h-12 w-12 shrink-0 rounded-md border border-border object-cover"
        />
      ) : (
        <div aria-hidden className="h-12 w-12 shrink-0 rounded-md border border-border bg-surface" />
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-ink">{p.title}</div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
          {p.code && <span className="tabular-nums">{p.code}</span>}
          <span>{p.price}</span>
          {!p.isAvailable && (
            <span className="rounded-sm bg-surface px-1.5 py-0.5" title="Εμφανίζεται στο τέλος μέχρι να ξαναμπεί σε απόθεμα">
              Εξαντλημένο
            </span>
          )}
          {showUnplaced && !p.isPlaced && (
            <span className="rounded-sm bg-surface px-1.5 py-0.5" title="Νέο προϊόν χωρίς αποθηκευμένη θέση">
              Χωρίς θέση
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <RowButton label={`Πρώτο: ${p.title}`} disabled={disabled || index === 0} onClick={() => onMove(0)}>
          ⤒
        </RowButton>
        <RowButton label={`Πάνω: ${p.title}`} disabled={disabled || index === 0} onClick={() => onMove(index - 1)}>
          ↑
        </RowButton>
        <RowButton label={`Κάτω: ${p.title}`} disabled={disabled || last} onClick={() => onMove(index + 1)}>
          ↓
        </RowButton>
      </div>
    </li>
  );
}

function RowButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      // 40px tap targets: these are the main controls on a phone.
      className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-sm text-ink-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
