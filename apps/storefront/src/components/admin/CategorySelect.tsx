"use client";

import { useState } from "react";
import type { CategoryOption } from "@/lib/admin/products";

/**
 * Category then Subcategory, as two dropdowns.
 *
 * Replaces a single indented list, which made the hierarchy something you had
 * to read out of leading dashes. Only ONE value is submitted (`categoryId`) —
 * the subcategory when one is chosen, otherwise the parent — because a
 * product belongs to exactly one category and the parent relationship is
 * already in the database. Storing both would be a second source of truth.
 *
 * Deeper than two levels still works: anything below the chosen top level is
 * offered in the second dropdown, indented. The UI stays two controls no
 * matter how deep the tree goes.
 */
export function CategorySelect({
  categories,
  defaultValue,
  name = "categoryId",
  required = false,
}: {
  categories: CategoryOption[];
  defaultValue?: string | null;
  name?: string;
  required?: boolean;
}) {
  const byId = new Map(categories.map((c) => [c.id, c]));

  // Walk up to the top-level ancestor so editing a product filed under a
  // subcategory opens with both dropdowns already correct.
  function topLevelOf(id: string | null | undefined): string {
    let cur = id ? byId.get(id) : undefined;
    while (cur?.parentId) cur = byId.get(cur.parentId);
    return cur?.id ?? "";
  }

  const [parentId, setParentId] = useState(() => topLevelOf(defaultValue));
  const [childId, setChildId] = useState(() =>
    defaultValue && topLevelOf(defaultValue) !== defaultValue ? defaultValue : ""
  );

  const topLevel = categories.filter((c) => !c.parentId);

  // Every descendant of the selected top-level category, in tree order.
  const descendants: CategoryOption[] = [];
  if (parentId) {
    const walk = (pid: string) => {
      for (const c of categories) {
        if (c.parentId === pid) {
          descendants.push(c);
          walk(c.id);
        }
      }
    };
    walk(parentId);
  }

  const submitted = childId || parentId;
  const cls =
    "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={submitted} />

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor={`${name}-parent`}>
          Κατηγορία
        </label>
        <select
          id={`${name}-parent`}
          value={parentId}
          required={required}
          onChange={(e) => {
            setParentId(e.target.value);
            // The old subcategory belongs to a different parent now.
            setChildId("");
          }}
          className={cls}
        >
          <option value="">— Καμία —</option>
          {topLevel.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor={`${name}-child`}>
          Υποκατηγορία
        </label>
        <select
          id={`${name}-child`}
          value={childId}
          disabled={descendants.length === 0}
          onChange={(e) => setChildId(e.target.value)}
          className={`${cls} disabled:opacity-50`}
        >
          <option value="">
            {descendants.length === 0 ? "— Δεν υπάρχουν υποκατηγορίες —" : "— Καμία —"}
          </option>
          {descendants.map((c) => (
            <option key={c.id} value={c.id}>
              {"— ".repeat(Math.max(0, c.depth - 1))}
              {c.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-muted">
          Το προϊόν μπαίνει στην υποκατηγορία αν διαλέξεις μία — αλλιώς στην κατηγορία. Και στις δύο
          περιπτώσεις εμφανίζεται και στη σελίδα της κύριας κατηγορίας.
        </p>
      </div>
    </div>
  );
}
