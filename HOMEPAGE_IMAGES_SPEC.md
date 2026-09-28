# Lighter homepage: lazy later heroes, no framer-motion (Speed audit SPD-11)

Status: **approved 2026-09-28 with changes (§0), implemented and tested locally, not yet committed** · branch `perf/spd-11-hero-images`

## 0. Decision (owner, 2026-09-28)

- **No design change.** The full-screen first hero and every section look
  exactly as now.
- **Nothing that costs money.** So no Vercel image optimization for hero or
  promo images (§2a below is dropped), and no change to
  `images.minimumCacheTTL`. `ContentSection` is untouched.
- In scope, then, only what is free and invisible:
  1. later heroes (and carousel slides 2+) load lazily instead of eagerly at
     high priority;
  2. `ScrollReveal` moves from framer-motion to a small IntersectionObserver
     component with the same look (§2b), and framer-motion is removed.
- Image weight is left to content. The two promo images are 1600×1600
  JPGs (359 KB and 228 KB). Re-exporting them at about 1000 px as WebP from
  the admin would cut most of that at no cost and without any code change.

The original proposal follows for the record.


## 1. What's there now (measured on production, 28 Σεπ)

Homepage sections with images, in page order:

| Section | Image(s) | Original | Loaded |
|---|---|---|---|
| Hero, first (LCP) | desktop `616c15cc.webp` / mobile `550a132e.webp` | 1672×941, 92 KB / 900×1200, 104 KB | eager, `fetchPriority="high"` |
| Hero «ΠΡΟΣΦΟΡΕΣ» (far below the fold) | `326a8628.jpg` | 1280×1920, 93 KB | **eager, `fetchPriority="high"`** |
| Promo tiles | `71b512da.jpg`, `6e084f5d.jpg` | 1600×1600, **359 KB** and **228 KB** | lazy |

- Every image is the uploaded original, straight from Supabase, with
  `Cache-Control: no-cache`, in whatever format was uploaded. Nothing is
  resized for the screen it's shown on.
- `HeroSlide` gives *every* hero slide the LCP treatment. So the second hero,
  a full screen or more below the fold, downloads at high priority on page
  load and competes with the real LCP image. The same applies to carousel
  slides 2+.
- The hero and promo code keep a comment saying `next/image` can't do art
  direction (a different image per breakpoint). That's out of date:
  `getImageProps()` does it, and the Next 16 docs show exactly this case
  (`image.md` → "Art Direction").
- framer-motion ships **41 KB gzipped** (126 KB raw) in a chunk loaded only
  by the homepage, used only by `ScrollReveal`'s fade-and-slide.

## 2. Proposal

### 2a. Images through the Next image optimizer, via `getImageProps()`

- **`HeroSlide`**: build the `<picture>`'s `<source>` srcsets and the
  `<img>` from `getImageProps({ src, fill: true, sizes: "100vw" })`, one
  call per device image. Same markup shape, same art-direction breakpoints
  (1024 px for the first hero, 768 px for later ones), but each device gets
  a resized AVIF/WebP at the width it needs instead of the original.
- **Only the first slide of the first hero is eager/high priority.** Every
  other hero, and carousel slides 2+, become `loading="lazy"` with normal
  priority. No `preload`: with art direction the LCP image differs by
  viewport, and the docs advise `fetchPriority` over `preload` in that case.
- **`DeviceImage`** (promo tiles): the same treatment, with a `sizes` prop
  each call site sets to its real layout width. The tile's aspect-ratio
  classes move to a wrapping `<div>` so the image can `fill` it.
  Lazy as now.
- **Longer optimizer cache:** set `images.minimumCacheTTL` to 31 days
  (default 4 h). Safe because every upload gets a new UUID filename, so a
  replaced image is always a new URL. This covers product images too, which
  use the same upload path. (SPD-07, long cache headers on the originals
  themselves, stays separate.)
- The inline `style` attributes `fill` uses are allowed by the CSP
  (`style-src 'self' 'unsafe-inline'` for attributes); product images
  already rely on them.

### 2b. Replace framer-motion with a small IntersectionObserver reveal

`ScrollReveal` keeps its exact look and behaviour: fade and slide up 20 px
over 500 ms once 20 % of the section is visible, fade back out when it leaves
(`once: false`, per the original spec), nothing under
`prefers-reduced-motion`. It becomes about 30 lines: a client component that
toggles a class, plus two CSS rules.

One change: **the server HTML is always visible.** The hidden state is added
only in the browser, and only to sections that are off-screen at that
moment. So nothing is ever parked at `opacity: 0` waiting on JavaScript,
which was PERF-001's root cause, and crawlers and no-JS visitors always see
the content. Then `framer-motion` is removed from `package.json`.

Alternative considered: pure-CSS scroll-driven animation
(`animation-timeline: view()`), with no JavaScript at all. Not recommended:
the fade becomes tied to scroll position instead of a timed 500 ms fade
(stopping mid-scroll leaves a section half-faded), and Firefox doesn't
support it.

## 3. Not changing

- Which image shows at which breakpoint, crops, the gradients and the carousel.
- `ContentSection`'s own `<picture>` (no published content section uses an
  image today). Same pattern, left for when one does.
- The admin upload flow. It still stores originals; resizing happens on
  request.

## 4. Expected result (to be measured, not promised)

- Homepage JS: −41 KB gzipped.
- First load on a phone: the second hero (93 KB) is no longer fetched until
  it's scrolled near. The hero and promo images arrive as AVIF/WebP at
  screen width. The promo tiles should shrink the most (359 + 228 KB
  originals at 1600 px).
- Images served same-origin from `/_next/image`, which saves a connection to
  Supabase on first load. Caveat: the first request for each size is
  transformed on the fly (cache miss) before it's cached.
- Vercel image-optimization usage: about 5 images × a few widths × 2 formats.
  That's far inside the plan's monthly allowance, but it's a new line on the
  bill.

## 5. Verification plan

- Local: every hero and promo still shows the right image at 375 / 768 /
  1024 / 1440 px (art direction intact); the second hero doesn't load until
  scrolled near; the fade still plays on the later sections, reverses on
  scroll-out, and is off under reduced motion; no `opacity:0` in the server
  HTML; no console errors.
- Build: framer-motion's chunk is gone; homepage JS size before/after.
- Production: image bytes per viewport, LCP image request, and a PageSpeed
  or Lighthouse mobile run (not possible in the hidden in-app browser).

## 6. Files

`components/home/Hero.tsx`, `components/home/DeviceImage.tsx`,
`components/home/EditorialBanner.tsx` (`sizes` per call site),
`components/home/ScrollReveal.tsx`, `app/globals.css` (reveal rules),
`next.config.ts` (`minimumCacheTTL`), `package.json` and lockfile (drop
framer-motion).
