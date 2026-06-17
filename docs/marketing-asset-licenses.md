# Marketing Demo Asset Licenses

All assets in `public/marketing/collage/` are either CC0 (Creative Commons Zero) or US public domain.
They are safe for commercial use with no attribution required (attribution is included as courtesy).

## Still Images — Art Institute of Chicago (CC0)

Source API: `https://api.artic.edu/api/v1/artworks/search?query[term][is_public_domain]=true`
Image URL pattern: `https://www.artic.edu/iiif/2/<image_id>/full/843,/0/default.jpg`
License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)

| Filename | Title | Artist | Source URL | License |
|----------|-------|--------|-----------|---------|
| art-aic-hokusai-wave.webp | Under the Wave off Kanagawa (The Great Wave) | Katsushika Hokusai | https://www.artic.edu/artworks/24645 | CC0 |
| art-aic-hiroshige-tokaido.webp | Mishima: Morning Mist, from Fifty-three Stations of the Tokaido | Utagawa Hiroshige | https://www.artic.edu/artworks/21307 | CC0 |
| art-aic-van-gogh-bedroom.webp | The Bedroom | Vincent van Gogh | https://www.artic.edu/artworks/28560 | CC0 |
| art-aic-van-gogh-selfportrait.webp | Self-Portrait | Vincent van Gogh | https://www.artic.edu/artworks/80607 | CC0 |
| art-aic-monet-waterlilies.webp | Water Lilies | Claude Monet | https://www.artic.edu/artworks/16568 | CC0 |
| art-aic-monet-stacks.webp | Stacks of Wheat (End of Summer) | Claude Monet | https://www.artic.edu/artworks/64818 | CC0 |
| art-aic-renoir-sisters.webp | Two Sisters (On the Terrace) | Pierre-Auguste Renoir | https://www.artic.edu/artworks/14655 | CC0 |
| art-aic-seurat-grande-jatte.webp | A Sunday on La Grande Jatte — 1884 | Georges Seurat | https://www.artic.edu/artworks/27992 | CC0 |
| art-aic-toulouse-moulinrouge.webp | At the Moulin Rouge | Henri de Toulouse-Lautrec | https://www.artic.edu/artworks/49218 | CC0 |
| art-aic-caillebotte-paris.webp | Paris Street; Rainy Day | Gustave Caillebotte | https://www.artic.edu/artworks/20684 | CC0 |
| art-aic-redon-flowers.webp | Still Life with Flowers | Odilon Redon | https://www.artic.edu/artworks/34234 | CC0 |
| art-aic-fantin-flowers.webp | Still Life with Flowers | Henri Fantin-Latour | https://www.artic.edu/artworks/16166 | CC0 |
| art-aic-tiffany-lilies.webp | Lilies (Corey Memorial Window) | Louis Comfort Tiffany | https://www.artic.edu/artworks/148428 | CC0 |
| art-aic-degas-ballet.webp | Ballet at the Paris Opéra | Edgar Degas | https://www.artic.edu/artworks/23995 | CC0 |
| art-aic-cezanne-apples.webp | The Basket of Apples | Paul Cézanne | https://www.artic.edu/artworks/16776 | CC0 |
| art-aic-degas-millinery.webp | The Millinery Shop | Edgar Degas | https://www.artic.edu/artworks/119695 | CC0 |

## Videos — NASA Image and Video Library (Public Domain)

Source API: `https://images-api.nasa.gov/search?media_type=video`
Asset API: `https://images-api.nasa.gov/asset/<nasa_id>`
License: US Government work — public domain (equivalent to CC0). See [NASA Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).

| Filename | Title | NASA ID | Source URL | License |
|----------|-------|---------|-----------|---------|
| vid-nasa-aurora-01.mp4 | STEVE Aurora Phenomenon | GSFC_20180314_Aurora_m12865_Steve | https://images.nasa.gov/details/GSFC_20180314_Aurora_m12865_Steve | Public Domain |
| vid-nasa-aurora-01.webp | STEVE Aurora Phenomenon (poster frame) | GSFC_20180314_Aurora_m12865_Steve | https://images.nasa.gov/details/GSFC_20180314_Aurora_m12865_Steve | Public Domain |
| vid-nasa-earth-from-space-02.mp4 | Earth Views from the International Space Station | Earth Views from the International Space Station | https://images.nasa.gov/details/Earth%20Views%20from%20the%20International%20Space%20Station | Public Domain |
| vid-nasa-earth-from-space-02.webp | Earth Views from the ISS (poster frame) | Earth Views from the International Space Station | https://images.nasa.gov/details/Earth%20Views%20from%20the%20International%20Space%20Station | Public Domain |
| vid-nasa-nebula-03.mp4 | T-Nebula | ksc_061404_t-nebula | https://images.nasa.gov/details/ksc_061404_t-nebula | Public Domain |
| vid-nasa-nebula-03.webp | T-Nebula (poster frame) | ksc_061404_t-nebula | https://images.nasa.gov/details/ksc_061404_t-nebula | Public Domain |

## Notes

- All images were converted from JPEG to WebP (max 800 px edge, quality 72) for web performance.
- Videos were transcoded to H.264/mp4 (≤720p, CRF 28, no audio, trimmed to 10 s, faststart).
- Total image size: ~557 KB. Total video + poster size: ~593 KB. Grand total: ~1.15 MB.
- `DEMO_YOUTUBE` is empty in this task; YouTube IDs will be validated and added in Task 8.
