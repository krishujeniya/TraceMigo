# TraceMigo identity assets

The development shell uses deterministic SVG identity assets, semantic colour tokens and self-hosted Manrope. Professional name/logo clearance and production acceptance remain pending.

## Assets and use

Public assets live in `apps/web/public/brand/`. Use `lockup-primary.svg` on Paper/White, `lockup-reverse.svg` on Ink, and the ink or reversed outlined wordmark for single-colour use. `mark-teal.svg`, `mark-ink.svg`, `mark-mint.svg` and `mark-white.svg` provide symbol variants. SVG wordmarks contain outlines; consumers do not need the font to render them.

Keep the mirrored paths equal, retain the centre gap, and preserve aspect ratio. Minimum symbol size is 16 px. Keep clear space of at least one quarter of the visible symbol width (19 units for the supplied 128-unit canvas); the lockup canvas already includes outer spacing. Do not rotate, stretch, round, add eyes or independently recolour the halves.

`favicon.ico` contains native 16/32/48 px frames. PNG equivalents and `favicon-96.png` support browser/search metadata. Apple uses 180 px; app icons use 192/512 px. Use the separate `maskable-icon-512.png` for maskable contexts: essential geometry fits within the central safe circle. `social-avatar-512.png` is square; `social-preview.svg` and `.png` are 1200 × 630 templates. Change template text in the generator and regenerate the outlines.

## Tokens and typography

Import the public `@tracemigo/ui/tokens.css` export and `BrandMark` / `BrandLockup` from `@tracemigo/ui`. `tools/brand/identity.json` owns the palette and semantic light/dark mappings. An explicit `data-theme="light"` or `data-theme="dark"` sets a subtree; otherwise the root follows the device preference.

| Primitive | Hex |
|---|---|
| Ink | #142D34 |
| Teal | #087F75 |
| Mint | #B8F2DF |
| Paper | #F6F8F5 |
| Coral | #C64F34 |
| White | #FFFFFF |

Use semantic foreground/background pairs together, including hover, active, disabled and focus states. Mint on Paper is decorative only. Coral is an accent or labelled boundary, not body text on Paper. Meaning needs text or another cue alongside colour. The checker verifies 32 selected theme pairs; this does not certify arbitrary future compositions or universal accessibility.

Manrope body weights are 400/500; headings use 650/700 and the outlined wordmark uses 700 throughout. Code uses the system monospace stack. The original variable TTF (200–800 axis), complete SIL OFL 1.1 notice, metadata and immutable upstream revision/hash record are in `apps/web/public/brand/fonts/`. Preserve `OFL.txt` when distributing the font. Logo assets are project identity material; the font license does not establish trademark clearance.

## Rebuild and review

Use the repository Node/pnpm pins and Python with the exact dependencies in `tools/brand/requirements.txt`. Install workspace dependencies with `pnpm install --frozen-lockfile`, then run:

```bash
pnpm brand:generate
pnpm brand:check
pnpm brand:verify
pnpm build
node tools/brand/browser-check.mjs
```

Generation uses FontTools for outlines, Sharp for raster exports and Pillow for contact-sheet/ICO assembly. No remote service is used during generation. The asset manifest records public file hashes; reproducibility is verified on the pinned local toolchain, not claimed across every operating system or rasterizer version.

Open `preview.html` through a loopback server rooted at this repository to review both themes and control samples. `asset-review.png` contains native-size, grayscale and crop checks. The browser checker starts temporary loopback servers and an isolated headless Chrome profile, checks real app widths 320/375/1280 in both themes, then the gallery at 375/1280, fonts/images, keyboard focus, metadata and rendered contrast. It requires Google Chrome at `/usr/bin/google-chrome`; failure is explicit. Working screenshots and validation evidence are private under `planning/evidence/P03.01/` and require the approved handoff.

`pnpm brand:verify` regenerates into a disposable temporary tree, validates those exports, and compares every public brand/font file, review render/contact sheet and generated UI file against the workspace. Changed, missing or extra outputs fail without overwriting workspace files. It uses installed dependencies and local Python tools; no download occurs. After an intentional identity change, review the inputs and run `pnpm brand:generate`, then verify again. This checks agreement with the generator on the current toolchain; it does not establish cross-platform determinism or legal clearance.
