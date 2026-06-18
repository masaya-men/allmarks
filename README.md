# AllMarks

Save any link as a visual card and arrange it into a collage you can browse and share.
Bookmarks live in your browser (IndexedDB) — no account, no sign-in.

Live: [allmarks.app](https://allmarks.app)

## Tech

- Next.js (App Router, TypeScript, static export)
- Vanilla CSS + CSS Custom Properties
- IndexedDB via `idb` for local storage
- Hosted on Cloudflare Pages

## Development

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm test     # vitest
pnpm build    # static export to out/
```

## License

The source code is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0-only)**.
See [LICENSE](./LICENSE) for the full text.

The **"AllMarks" name and logo are not granted under this license** — they remain the
trademarks of the author and may not be used for derivative or competing services.
