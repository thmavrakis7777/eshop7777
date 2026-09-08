This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Building

```bash
pnpm build
```

**Stop the dev server first.** `next dev` regenerates its route types in
`.next/dev/types/`, and `next build` type-checks that same directory — with
both running, the build can read one of those files mid-write and fail with a
handful of `TS1005`/`TS1128` parse errors *inside the generated file*. They
look like real type errors in your code and are not: stop `next dev` and build
again. If a build still fails that way after the dev server is stopped, delete
the directory and retry:

```bash
rm -rf .next/dev
```

Only ever with the dev server stopped — a running `next dev` reads
`.next/dev/prerender-manifest.json`, and deleting the directory under it kills
the process with an `ENOENT`. That is also why the build script does not clear
it for you.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
