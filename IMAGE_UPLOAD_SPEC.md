# Automatic image optimization on upload

Status: **approved 08 Οκτ 2026 — D1 yes (convert existing images; ones already optimal keep their bytes and gain an AVIF), D2 yes, D3 yes, D4 keep framing** · implemented and tested locally, not yet committed

Result (08 Οκτ 2026): all 29 images in use converted (7 category, 7
mega-menu, 3 homepage, 2 journal, 9 product) and the rows switched; old
files kept, rows backed up in `backups/2026-10-08-image-pipeline/`
(`before.json`, `after.json`). Examples: «ΠΡΟΣΦΟΡΕΣ» Hero 93 KB JPEG →
WebP 37 KB / AVIF 26 KB at the same 1280×1920; opening Hero (phone) keeps
its 104 KB WebP and gains a 62 KB AVIF; every product photo kept as-is plus
a JPEG copy for Meta. Local build: page height, section positions and image
sizes identical to production at 412 and 1440 px; browsers pick the AVIF.
A first conversion run (before the keep-as-is rule was tightened, §2.3)
left 58 unused files in Storage — harmless, never referenced.

Goal: every photo uploaded in the dashboard is stored at the right size, in
the right format, at the right file size — without the owner having to
resize or convert anything first. Free (no new service), and nothing on the
site looks different.

## 1. Today (measured 08 Οκτ 2026)

| Upload | What happens now | What visitors download |
|---|---|---|
| Product photos | Shrunk **in the browser** to 1600 px WebP (`prepare-photo.ts`) | Resized AVIF/WebP via `next/image`, 9–40 KB — already good |
| Every other image (homepage, categories, pages, journal, branding) | **Stored exactly as picked** — size, format and weight are up to the uploader (`ImageUploadField` → `uploadMediaAction`) | Mostly the original file, as-is |

The second row is how the homepage carried a 1600 px, 360 KB JPEG banner for
a month: the admin only shows a size *hint* (`lib/admin/image-size-hints.ts`),
and nothing enforces it.

## 2. Proposal

### 2.1 One path for every image field

1. **Browser (only to fit the upload limit).** Uploads go through a Server
   Action capped at 4.5 MB. A phone photo (4–12 MB) is first shrunk in the
   browser to at most 2560 px and high quality — the same idea as today's
   `preparePhoto`, applied to every field. Small files are sent untouched.
2. **Server (the real work), with `sharp`.** `sharp` already ships with
   Next.js (it is what Next's own image optimizer uses); it only needs adding
   to the storefront's dependencies. In the upload action it:
   - applies the phone's rotation, converts colours to sRGB, and **strips
     EXIF/GPS** (no location data from the owner's phone ends up public);
   - shrinks it to the slot's size (§2.2) — **only as far as it still
     covers the slot's box, never cropped, never enlarged**, so the
     composition stays the owner's and the site keeps cropping with CSS
     exactly as now. (Changed during build from "fit inside": a portrait
     photo shown as a wide strip — the live «ΠΡΟΣΦΟΡΕΣ» Hero, 1280×1920 in a
     1425×512 box — would have been cut to 720 px wide and shown soft.
     Longest side capped at 2560 px.);
   - writes the slot's formats (§2.3), each within its file-size budget.
3. The admin shows the result under the field, e.g.
   `Αποθηκεύτηκε: 1200×900 · WebP 84 KB · AVIF 58 KB (από 2,3 MB JPEG)`.

Pasted URLs (an image hosted elsewhere) keep working exactly as now — not
processed. Animated GIFs are stored as they are.

### 2.2 Per-slot targets

Taken from the measurements behind `image-size-hints.ts` (28 Σεπ), so the
hints and the processing can never disagree again — both read one table.

| Slot | Box it must cover | Stored as | Budget |
|---|---|---|---|
| Hero — desktop | 1920×1080 | WebP + AVIF | 250 KB |
| Hero — mobile | 1200×1800 | WebP + AVIF | 200 KB |
| Promo banners (desktop / tablet / mobile) | 1200×1200 | WebP + AVIF | 120 KB |
| Content section | 1200×900 | WebP + AVIF | 150 KB |
| Newsletter background | 1920×640 | WebP + AVIF | 200 KB |
| Category image | 1000×1000 | WebP + AVIF | 120 KB |
| Mega-menu tile | 800×1000 | WebP + AVIF | 150 KB |
| Content page header | 1600×900 | WebP + AVIF | 150 KB |
| Journal hero | 1800×1200 | WebP + AVIF | 200 KB |
| Journal social preview | 1200×630 | **JPEG** | 300 KB |
| Product photos | 1600×1600 | WebP, as today (+ JPEG copy, see D3) | 500 KB |

Why JPEG for social previews: Facebook, WhatsApp and Viber previews are
only reliable with JPEG/PNG. The logo, favicon, site-wide share image and
homepage share image are path/URL fields with no upload button today, so
they are not part of this (their hints keep the full spec).

### 2.3 Formats and quality

- **WebP** (every browser) at quality 82, and **AVIF** (modern browsers) at
  quality 58. Measured on this store's own photos: AVIF comes out **~30%
  smaller** than WebP at the same visual quality
  (banner 1200×1200: WebP 54 KB / AVIF 39 KB; old 360 KB promo JPEG:
  WebP 99 KB / AVIF 70 KB).
- **Budget:** if a file is over its slot's budget, quality steps down
  (at most twice, to a floor of WebP 70 / AVIF 46). If it is *still* over —
  a very detailed photo — it keeps the floor quality and the admin shows a
  gentle note. Quality never drops below the floor to hit a number.
- If the uploaded file is already in the slot's main format, at the size it
  would be stored at, free of metadata and within budget, its bytes are kept
  as-is — even when a re-encode would be a few KB smaller, because a second
  round of compression only loses detail (tightened during build, after the
  first conversion run re-compressed the opening Hero for 11 KB). Only the
  AVIF / JPEG copy is added.
- Time: measured ~0.3 s for WebP and ~1–1.5 s for AVIF per image. An upload
  takes a couple of seconds longer; nothing else changes.

### 2.4 File names that help search

Today: `homepage/550a132e-3d47-4242-bd29-906aba4438b9.webp`.
Proposed: `homepage/eidi-ygraeriou.k3j9x2m1qz.webp` (+ `.avif` beside it) —
the alt text (or heading, or original file name) in Latin letters, then a
random part so names never collide or get overwritten (the year-long
`immutable` cache depends on that). Google Images reads file names as a
small signal; a UUID says nothing.

### 2.5 Serving AVIF without changing the look

Images shown as plain `<img>` today (Hero, promo banners, content section,
newsletter, category tiles on category pages and the Landing banner, content
page header, journal hero and cards) get one extra line in their
`<picture>`: `<source type="image/avif">` before the WebP. Browsers that
read AVIF take it; the rest take the WebP. Same image, same box, same crop.

Only files made by the new pipeline have an AVIF beside them, and their
names say so (§2.4), so an old image or a pasted URL never points at a
missing file. Images that already go through `next/image` (homepage
category grid, mega menu, product photos) need nothing — Next already
serves AVIF there.

### 2.6 What this means for SEO / GEO / AEO

Helps: page speed on phones (a Core Web Vitals ranking signal), descriptive
file names, correctly sized social previews (JPEG 1200×630), no EXIF/GPS
leak. Does **not** replace **alt text**, which is still the main way search
engines and AI answer engines understand an image — every image field
already has (or sits next to) an alt-text field; the admin will show a
reminder when it is empty. Nothing here changes structured data.

## 3. Existing images (decision D1)

About 20 images in use today would stay as uploaded unless converted once:
7 category images, 7 mega-menu tiles, 3 homepage images (opening Hero,
«ΠΡΟΣΦΟΡΕΣ» Hero — a 94 KB JPEG — and the Υγραερίου banner), 2 journal
heroes. A one-off script would run them through the same pipeline, upload
the new files and update the rows (old files stay in Storage; row backups
in `backups/` first, as with the banner on 07 Οκτ).

## 4. Cost

None new. `sharp` runs inside the existing Vercel function, only when the
owner uploads (a few seconds of CPU, a handful of times a month). Storage
gains one small AVIF per image (tens of KB). Visitors download less, so
Supabase egress goes down. No change to Vercel image-optimization usage.

## 5. Not changing

The look of any page; the crop of any image (CSS still decides); the upload
buttons and fields themselves; pasted URLs; product-photo display.

## 6. Verification

Unit tests for slot targets, the quality steps and the file-name rules;
upload one image per slot locally and check size, format, metadata
stripped and the admin message; pixel-compare each changed page before/after
at 390 / 768 / 1440 px; check the AVIF/WebP choice in Chrome, Firefox and
Safari; after deploy, PageSpeed on the homepage again.

## 7. Decisions for the owner

- **D1 — Convert the ~20 existing images once?** Recommended: yes. It is
  what makes the current site lighter today, not only future uploads.
- **D2 — SEO file names (§2.4)?** Recommended: yes.
- **D3 — Also save a JPEG copy of each product photo?** Meta's catalog
  (Facebook/Instagram Shop) accepts only JPEG/PNG — this is the blocker
  noted when the Meta feed was postponed. Small, and it removes that
  blocker for whenever you connect it. Recommended: yes.
- **D4 — Social preview images: keep your framing, or crop to exactly
  1200×630?** Recommended: keep your framing (fit inside); Facebook crops
  the edges itself if the shape differs.

## 8. Files (expected)

`lib/admin/image-size-hints.ts` → one slot table (targets + hint text);
new `lib/storage/optimize-image.ts` (sharp pipeline) and its tests;
`lib/storage/upload.ts`, `lib/admin/media-actions.ts`,
`lib/admin/catalog-actions.ts` (product JPEG copy);
`components/admin/ImageUploadField.tsx` (slot prop, browser pre-shrink,
result line); `lib/admin/prepare-photo.ts` (shared pre-shrink);
the plain-image components listed in §2.5; `package.json` (`sharp`);
a one-off backfill script under `scripts/`.
