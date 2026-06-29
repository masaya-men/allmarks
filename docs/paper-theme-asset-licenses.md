# Paper Theme — Third-Party Asset Licenses

Raster assets under `public/themes/paper-atelier/` come from two origins:

1. **User-generated** (ChatGPT image exports the user owns) — no attribution required.
2. **Figma Community packs** — all three below are **CC BY 4.0**, verified 2026-06-26
   from the creators' Community pages (user-provided screenshots). CC BY 4.0 permits
   commercial use and embedding/redistribution **with attribution**. Because we cut,
   resize, and color-adjust the source art, attribution must note the work is *modified*.

License text: https://creativecommons.org/licenses/by/4.0/

## Figma Community packs (CC BY 4.0)

| Pack | Creator | Source URL | License | Used for |
|------|---------|-----------|---------|----------|
| Scrapbook Diary Elements | Yuliia Vorobiova (Юлія Воробйова) | https://www.figma.com/community/file/1480489265216655984 | CC BY 4.0 (modified) | scrapbook decorations |
| 60+ Free Vintage Paper Textures | Joou Designs & Samuel Adekunle | https://www.figma.com/community/file/1586421100990963980 | CC BY 4.0 (modified) | card mats / backgrounds |
| Paper & Packaging Mockup Kit — 90+ Elements for Content Creators | Yunusova Eleonora | https://www.figma.com/community/file/1640396618315218729 | CC BY 4.0 (modified) | transparent washi/tape |

## Required attribution block

Surface this somewhere user-visible (footer / `/about` / `/credits`) before launch:

```
Third-party assets (Figma Community, CC BY 4.0, modified):
- "Scrapbook Diary Elements" by Yuliia Vorobiova
  https://www.figma.com/community/file/1480489265216655984
- "60+ Free Vintage Paper Textures" by Joou Designs & Samuel Adekunle
  https://www.figma.com/community/file/1586421100990963980
- "Paper & Packaging Mockup Kit — 90+ Elements for Content Creators" by Yunusova Eleonora
  https://www.figma.com/community/file/1640396618315218729
License: https://creativecommons.org/licenses/by/4.0/
```

## Notes

- The `/credits` (or `ATTRIBUTIONS.md`) surface is not built yet; tracked as a launch-blocker
  task. This file is the single source of truth for the attribution wording until then.
- Pre-existing ChatGPT-derived assets in `public/themes/paper-atelier/` are user-owned and
  need no attribution (see `reference_paper_asset_sources` memory for which sheet each came from).
