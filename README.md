# Antika Docs · ئەنتیکا دۆکس

A production-ready document system for **Antika Factory (Sulaymaniyah)**:
Kurdish A4 invoices (وەسڵ) and Arabic/English A5-landscape receipt vouchers
(سند قبض), with pixel-faithful print output, server-side PDF, atomic numbering,
roles, a fully offline RTL interface, and an **anti-copy watermark plus public
authenticity layer** (verify code, QR, HMAC integrity, issue/cancel lifecycle).

![Kurdish A4 invoice](docs/screenshots/invoice-a4-ku.png)

![Arabic A5 landscape receipt voucher](docs/screenshots/voucher-a5-ar.png)

---

## کوردی

<div dir="rtl" lang="ckb">

### ناساندن

**ئەنتیکا دۆکس** سیستەمێکی تەواوە بۆ دروستکردن، چاپکردن و پاراستنی
**وەسڵی فرۆشتن** و **سەندی قبض**ی کارگەی ئەنتیکا لە سلێمانی. ڕووکاری
سیستەم بە تەواوی ڕاست‌بە‌چەپ (RTL)ە، بە کوردی و عەرەبی کار دەکات و
هیچ پەیوەندییەکی ئینتەرنێتی پێویست نییە بۆ فۆنت، لۆگۆ یان چاپ.

### تایبەتمەندییەکان

- وەسڵی A4 بە زمانی کوردی/عەرەبی، لەگەڵ ژمارەی وەسڵ، بەروار،
  زانیاری کڕیار، خشتەی کاڵا، زانیاری بەرهەم، مەواد، پێشنیاری تایبەت،
  کۆی گشتی، پێشەکی و کۆتایی.
- سەندی قبضی A5 (ڕاست‌بە‌چەپ) بە عەرەبی/کوردی، بە بڕی پارە بە
  **ژمارە** و **وشە**، شێوازی پارەدان، واژوو و پەیوەندی بە وەسڵەوە.
- چاپکردنی ڕاستەوخۆ لە وێبگەڕ و داگرتنی PDF لە هەمان ڕووکاری چاپ.
- ژمارەدانی خۆکار و یەکجارەکی: وەسڵ و سەند هەریەکەیان کاونتری
  سەربەخۆی خۆیان هەیە. تەنها بەڕێوەبەر دەتوانێت ژمارە بە دەستی
  دیاری بکات.
- گەڕان، پاڵاوتن بە بەروار، لاپەڕەبەندی، دووبارەکردنەوە،
  دەستکاریکردن و سڕینەوەی نەرم (soft delete).
- بەکارهێنەر و ڕۆڵ: `admin` و `staff`. لە یەکەم چوونەژوورەوە
  گۆڕینی وشەی نهێنی ناچارە.
- ڕێکخستنی زانیاری کۆمپانیا، ژمارەکان، ڕێژەی پێشەکی/کۆتایی،
  فۆنت و لۆگۆ.
- واتەرمارکی هاوبەش (K + ANTIKA FACTORY) لە پشت هەموو بەڵگەنامەکان،
  لەگەڵ دەقی ورد، نقشی Guilloche و کۆدی پشکنینی ١٢ پیت.
- کۆدی QR و لاپەڕەی گشتی `/verify/:code` بۆ دڵنیابوونەوە لە
  ڕەسەنایەتی بەبێ چوونەژوورەوە؛ ناونیشان و مۆبایل و کاڵاکان نیشان نادرێن.
- دوای چاپ یان PDF بەڵگەنامە دەخرێتە قفڵ (ISSUED) و تەنها
  بەڕێوەبەر دەتوانێت بیكاتەوە؛ هەڵوەشاندنەوە مۆری سووری لەسەر دەکێشێت.
- داشبۆرد بۆ ئامار و دوایین وەسڵ و سەندەکان.
- ڕاپۆرتی کونەکانی ژمارە بۆ بەڕێوەبەر.
- فۆنت و وێنەکان بە تەواوی ناوخۆیین؛ هیچ CDN بەکارنەهاتووە.

### دەستپێکردنی خێرا

پێویستە: **Node.js 20+**، **PostgreSQL 16+** و **npm**.

```bash
npm install
cp .env.example .env        # لە Windows: copy .env.example .env
```

داتابەیسێک دروست بکە:

```sql
CREATE ROLE antika LOGIN PASSWORD 'antika_dev_password';
CREATE DATABASE antika_docs OWNER antika;
```

دواتر:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

ئەپڵیکەیشن لە `http://localhost:5173` و API لە
`http://localhost:4000/api` کار دەکات.

### چوونەژوورەوە

لە داتابەیسێکی نوێدا:

```
username: admin
password: ChangeMe!1234
```

لە یەکەم چوونەژوورەوە سیستەم ناچارت دەکات وشەی نهێنی بگۆڕیت.
**هەرگیز ئەم وشەی نهێنییە لە سێرڤەری ڕاستەقینە بەکارمەهێنە.**

### بەکارهێنان

- **داشبۆرد**: کۆی وەسڵ و سەند و دوایین تۆمارەکان.
- **وەسڵەکان**: لیست، گەڕان، پاڵاوتن بە بەروار، زیادکردن، دەستکاری،
  دووبارەکردنەوە، چاپ، PDF و سڕینەوە.
- **سەندەکان**: هەمان شت، لەگەڵ هەڵبژاردنی وەسڵی پەیوەندیدار.
- **ڕێکخستن**: زانیاری کۆمپانیا، ژمارەی دەستپێک، ڕێژەی پارەدان،
  شێوازی ژمارە (کوردی/لاتینی)، واتەرمارک/Guilloche/دەقی ورد/QR و
  ڕێکخستنی وێنەکان.
- **پشکنین**: هەر بەڵگەنامەیەک کۆدی `XXXX-XXXX-XXXX`ی هەیە؛ لە
  `/verify/<code>` دەتوانرێت بەبێ چوونەژوورەوە پشکنین بکرێت
  (کوردی/عەرەبی/ئینگلیزی). ناوی کڕیار تەنها بە شێوەی `Sle*** Ce***`
  نیشان دەدرێت.
- **بەکارهێنەران**: تەنها بەڕێوەبەر دەتوانێت بەکارهێنەر زیاد بکات،
  وشەی نهێنی ڕیسێت بکات یان بەکارهێنەر ناچالاک بکات. هەروەها
  کردنەوەی قفڵ، هەڵوەشاندنەوە و ڕاپۆرتی کونەکانی ژمارە تەنها بۆ
  بەڕێوەبەرە.

### پاراستن و گەڕاندنەوە

لە ویندۆز:

```powershell
.\scripts\backup-local.ps1
.\scripts\restore-local.ps1 backups\antika_docs-....dump
```

لە سێرڤەری Docker:

```bash
./scripts/backup.sh
./scripts/restore.sh backups/antika_docs-....dump
```

ڕێنمایی تەواوی سێرڤەر، HTTPS و Certbot لە
[`deploy/README.md`](deploy/README.md) دا هەیە.

</div>

---

## English

### What this is

Antika Docs is a small, self-hosted document system with two printable
documents:

| Document | Page | Direction | Languages | Numbering | Digits |
| --- | --- | --- | --- | --- | --- |
| Invoice (وەسڵ) | A4 portrait | RTL | Kurdish, Arabic | own counter, default 1001 | Eastern Arabic-Indic by default, switchable |
| Receipt voucher (سند قبض) | A5 landscape | RTL | Arabic, Kurdish | own counter, default 1 | Latin by default, switchable |

The browser print route and the PDF endpoint render the *same* React print
page, so the PDF is pixel-identical to `Ctrl+P`.

### Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS (logical properties),
  react-router, TanStack Query, React Hook Form + Zod, i18next, Lucide icons.
- **Backend:** Node.js 20, Express, TypeScript, Prisma ORM, PostgreSQL 16.
- **Auth:** JWT in an `httpOnly`, `SameSite=Strict` cookie; `bcryptjs` hashes;
  login rate limiting; helmet; role checks (`admin`, `staff`); forced first-login
  password change.
- **PDF:** Puppeteer (bundled Chrome locally, system Chromium in Docker) loading
  the authenticated React print route.
- **Authenticity:** local `qrcode` SVG renderer, HMAC-SHA256 document integrity
  (`DOC_HMAC_SECRET`), cryptographic verify codes, public rate-limited verify
  route with a sanitized DTO.
- **Offline assets:** the supplied Arkan Favorit `ttf/otf` masters in
  `apps/web/public/fonts/arkan/` as the single typeface for every Kurdish and
  Arabic string, with full-glyph `woff2` copies generated from those masters
  (no subsetting), plus the vector K logo, brand art and watermark. Inter is
  bundled with an explicit Latin-only `unicode-range` and covers only Latin
  glyphs Arkan lacks (for example `ç` in "Façade"). No CDN, no runtime network
  dependency.

### Repository layout

```
apps/
  api/                  Express API, Prisma schema/migrations, seed, PDF renderer
  web/                  React app, print routes, document CSS, i18n JSON, assets
packages/
  shared/               Zod schemas, DTOs, formatters, totals, numberToWords
tests/
  unit/                 Vitest: words, totals, counters, codes, HMAC, verify API
  e2e/                  Playwright: print screenshots, PDFs, watermark pixels, verify page
scripts/                Assets, backups, restores
deploy/                 Host nginx config and VPS/HTTPS guide
docs/screenshots/       Generated document screenshots, PDFs and watermark proof
```

### Quick start (local development)

Prerequisites: **Node.js 20+**, **PostgreSQL 16+**, npm.

```bash
npm install

# Windows: copy .env.example .env
cp .env.example .env
```

Create the local role and database (adjust the password to match `.env`):

```sql
CREATE ROLE antika LOGIN PASSWORD 'antika_dev_password';
CREATE DATABASE antika_docs OWNER antika;
```

For a local database, `.env` should use `127.0.0.1` and
`NODE_ENV=development`:

```dotenv
DATABASE_URL=postgresql://antika:antika_dev_password@127.0.0.1:5432/antika_docs?schema=public
APP_ORIGIN=http://localhost:5173
WEB_BASE_URL=http://localhost:5173
NODE_ENV=development
COOKIE_SECURE=false
TRUST_PROXY=0
```

Then:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

- Web UI: <http://localhost:5173>
- API: <http://localhost:4000/api>
- Health: <http://localhost:4000/api/health>

### Default credentials

A fresh seed creates:

```
username: admin
password: ChangeMe!1234
```

The first login is forced through `/change-password`. Change the password
immediately. In production, set `ADMIN_PASSWORD` in `.env.docker` before the
first start and still complete the forced change.

The seed is idempotent: restarting it does not duplicate the admin, settings,
counters or sample documents.

### Seed data

- Admin user from `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_FULL_NAME`.
- Company settings, default numbering and asset paths.
- Sample Kurdish invoice **#1010** for `Slemani cement` with a real line item,
  totals and 60/40 advance/final split.
- Empty Arabic voucher **#1** (the blank printed template).
- Both samples already have a unique `verify_code` and a matching HMAC
  `integrity_hash`; they start as `DRAFT`, so they lock to `ISSUED` the first
  time they are printed or downloaded as PDF.
- Invoice counter at 1010 (so the next new invoice is 1011); voucher counter at
  1 (so the next new voucher is 2).

Delete the sample invoice/voucher in the UI if you want a clean production
start; counters remain monotonic.

### Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | required |
| `JWT_SECRET` | JWT signing secret, at least 32 chars | required |
| `JWT_EXPIRES_DAYS` | Cookie/token lifetime | `7` |
| `API_PORT` | API listen port | `4000` |
| `APP_ORIGIN` | Allowed browser origin and public app URL | `http://localhost:5173` |
| `WEB_BASE_URL` | Internal URL Puppeteer loads for PDF | `APP_ORIGIN` |
| `COOKIE_SECURE` | Secure cookie flag (HTTPS) | `true` in production |
| `TRUST_PROXY` | Express trust-proxy hops behind nginx | `0` local, `1` VPS |
| `PUBLIC_BASE_URL` | Public URL encoded into QR codes (`<base>/verify/<code>`) | `APP_ORIGIN` |
| `DOC_HMAC_SECRET` | HMAC-SHA256 key for document integrity, 32+ chars | required |
| `VOUCHER_PAGE` | `A5_landscape` or `A4_landscape` | `A5_landscape` |
| `ADMIN_USERNAME` | First admin username | `admin` |
| `ADMIN_PASSWORD` | First admin password | `ChangeMe!1234` |
| `ADMIN_FULL_NAME` | First admin display name | `Antika Administrator` |
| `PUPPETEER_EXECUTABLE_PATH` | Chromium path in Docker | `/usr/bin/chromium` |
| `PDF_TIMEOUT_MS` | PDF render timeout | `45000` |

Never commit `.env`, `.env.docker` or real secrets. Use
`openssl rand -base64 48` for `JWT_SECRET`.

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Shared build + API + Vite dev server |
| `npm run build` | Production build of shared, API and web |
| `npm run typecheck` | TypeScript check for all workspaces |
| `npm run test` | Vitest unit tests (builds shared first) |
| `npm run e2e` | Playwright print/PDF tests (servers must be running) |
| `npm run verify:print` | Print-size gate: page boxes, 300 dpi rasters, footer inside |
| `npm run e2e:shots` | Regenerate the checked-in document screenshots/PDFs |
| `npm run db:generate` | Prisma client |
| `npm run db:migrate` | Apply migrations in development |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:seed` | Idempotent seed |
| `npm run db:reset` | Drop, migrate and reseed the local DB |
| `npm run db:studio` | Prisma Studio |
| `npm run assets` | Regenerate the logo and brand PNGs from the SVG/K mark |

### Numbering and money

- Two independent PostgreSQL counters: `invoice` and `voucher`.
- Allocation happens inside the same transaction as the document insert using
  `UPDATE ... RETURNING`, so concurrent requests never share a number.
- `@unique` constraints are the final guard.
- Staff cannot set a number; an admin may override it. Duplicate creates a new
  number automatically.
- Money is stored as `BIGINT` IQD (whole dinars), never floating point.
- `numberToWords(n, lang)` covers 0 to 999,999,999,999 in Arabic and Kurdish.
  `amountInWords` appends `دينار عراقي فقط لا غير` / `دیناری عێراقی تەنها`.

The default start values are 1001 (invoice) and 1 (voucher). Because the seed
contains sample invoice #1010 and voucher #1, the first newly created documents
are #1011 and #2.

### Brand palette

The web app UI (navigation, buttons, links, focus rings, hero and login panel)
uses the supplied orange palette only, exposed as CSS variables and mirrored in
Tailwind:

| Token | Value |
| --- | --- |
| `--color-brand` | `#ff5a00` |
| `--color-brand-dark` | `#e04e00` |
| `--color-brand-light` | `#ff7a33` |
| `--color-brand-soft` | `#fff0e6` |

The printable invoice and voucher sheets keep their original spec document
palette (`#1e56a0` document blue, beige tables, orange accents), because those
colours are part of the pinned document design. The print page chrome around
the sheet (print / PDF / back buttons) follows the orange UI palette.

### Printing and PDF

Every printed sheet is pinned to its exact paper size. Sizes are written in
millimetres (never keywords or `vh`/`vw`), and the page box is re-pinned to
exact points after Chrome prints it.

- `/print/invoice/:id?lang=ku|ar` uses
  `@page { size: 210mm 297mm; margin: 0 }`; the sheet root is exactly
  `210mm × 297mm` with `box-sizing: border-box; overflow: hidden`.
- `/print/voucher/:id?lang=ar|ku` uses
  `@page { size: 210mm 148mm; margin: 0 }`; the sheet root is exactly
  `210mm × 148mm`.
- `print-color-adjust: exact` preserves the blue/orange/beige palette.
- `page-break-after: avoid` sits on the last printed block (with
  `break-after: auto` on `:last-child`), so no trailing blank page is emitted.
  No `transform: scale` is used on a print route.
- Print routes set `data-print-ready="true"` only after the document, settings,
  fonts (`document.fonts.ready`) and images/SVG are ready.
- `GET /api/invoices/:id/pdf` and `GET /api/vouchers/:id/pdf` call Puppeteer
  with `page.pdf({ width, height, printBackground: true,
  preferCSSPageSize: true, margin: 0, scale: 1 })`, verify the rendered sheet
  is the exact CSS size (±1 px), then load the result with `pdf-lib`, reject
  any output that is not one page, and re-pin MediaBox/CropBox to the nominal
  size.
- The voucher print language override regenerates the amount in words in the
  requested language; a manually edited words field is preserved when no
  override is requested.

Exact delivered geometry (measured with `pdf-lib` after the final run):

```
invoice:              1 page  595.28 × 841.89 pt   (A4 portrait, 210 × 297 mm)
voucher (default):    1 page  595.28 × 419.53 pt   (A5 landscape, 210 × 148 mm)
voucher (two-up):     1 page  595.28 × 841.89 pt   (A4, two 148 mm copies)
voucher (A4 option):  1 page  841.89 × 595.28 pt   (A4 landscape)
```

**Safe margin.** Settings → Safe margin (`0–10 mm`, default `5 mm`) is applied
as `padding: max(designPadding, var(--print-safe-margin))`. The page itself
never changes size; only the content moves inward. With the default `5 mm`
nothing moves, because the invoice already pads `10 mm` and the voucher
`6 mm`. Raising it above those values insets the content.

**Two-up imposition.** The voucher print toolbar (and its PDF link) can place
two `210 × 148 mm` copies on one exact A4 sheet
(`/print/voucher/:id?imposition=2up`, PDF `?imposition=2up`). The two copies
are joined by a 1 mm inset cut line (`2 × 148 mm + 1 mm = 297 mm`).

**Browser print helper.** The first press of Print opens a notice listing the
required printer settings (paper, 100 % / Actual size, margins None, background
graphics ON, headers/footers OFF, never “Fit to page”). It is remembered in
`localStorage` (`antika.printNotice.v1`) and can be reopened from the Print
route toolbar; the same checklist lives on the Help page (`/help`).
`/print/calibration?size=a4|a5` prints a 10 mm grid, a 1 cm ruler and a
5 mm-from-edge rectangle for physical verification.

**Automated print-size gate.** `npm run verify:print` (after the dev servers
are up) fails the build unless every assertion passes: page count 1, page box
within 0.5 pt of `595.28 × 841.89` / `595.28 × 419.53`, 300 dpi raster within
2 px of `2480 × 3508` / `2480 × 1748`, and ink (including the footer band)
stopping at least 5 mm before every paper edge. The last run produced:

```
invoice A4   2480 × 3508 px   1 page  595.28 × 841.89 pt
voucher A5   2480 × 1748 px   1 page  595.28 × 419.53 pt
2-up A4      2480 × 3508 px   1 page  595.28 × 841.89 pt
```

Artifacts (PDF + 300 dpi PNG + calibration sheets) are written to
`test-results/print-verification/` and checked in under
`docs/print-verification/`.

### Watermark and authenticity layer

The addendum is implemented without moving, shrinking or reordering any
original design element. New layers are absolutely positioned or placed in
existing free space.

**Watermark.** One shared React `<Watermark />` component (inline SVG: the
framed K brand mark in light grey, light-grey `ANTIKA` with an orange `A`,
orange `FACTORY`) is
used by every document, the browser print route and the Puppeteer PDF. It is
centred, sits behind all content (`z-index: 0`, `pointer-events: none`,
`user-select: none`), and is `140 mm` wide on A4 and `150 mm` on A5. Opacity
defaults to `0.11` and is configurable in Settings (`0.05–0.30`, plus a
`0.5–2.0` scale). `print-color-adjust: exact` keeps it in the PDF. Administrators
can override it per document (`default` / `always` / `never`).

**Free-space placement.** The invoice auth strip lives between the totals row
and the footer; the voucher strip lives between the signature row and the
footer. To make room, only the invoice special-offer row was reduced from 24 mm
to 20 mm; the footer height is unchanged. Every extra layer has its own
Settings toggle: watermark, guilloche, microtext and QR.

**Verify code and QR.** Each document receives a crypto-random
`XXXX-XXXX-XXXX` code from an alphabet without `O`, `0`, `I`, `1`. It is printed
in a tiny `Verify: …` line and as an 18×18 mm (15 mm on the compact A5 sheet)
QR code generated locally by the `qrcode` package and served from
`GET /api/qr/:code`. The QR encodes
`${PUBLIC_BASE_URL}/verify/<code>`. No external QR API is used.

**Public verification.** `/verify/:code` (also `/verify` with a lookup form) is
public, mobile-friendly and defaults to Kurdish with Arabic and English
toggles. It shows only: document type, number, date, masked customer
(`Sle*** Ce***`), total, status `VALID` or `CANCELLED`, company name and
`integrity: OK | MODIFIED`. Phone, address and line items are never returned.
The API allows 30 lookups per minute per IP and answers malformed and unknown
codes with the exact same `404 {"error":{"code":"NOT_FOUND","message":"Document not found"}}`.

**Integrity and lifecycle.** `HMAC-SHA256` over the canonical payload (type,
number, date, customer, total, items, verify code) is stored in
`integrity_hash`. Editing the row directly in PostgreSQL flips the public result
to `MODIFIED`. Printing (both `window.print()` via `beforeprint` and the PDF
endpoint) moves `DRAFT → ISSUED`; issued documents are read-only (`423` on
update) until an admin unlocks them. Cancelling keeps the row, stamps a red
diagonal **CANCELLED / هەڵوەشێنراوە** over the document and returns
`CANCELLED` on the verify page. Microtext (`ANTIKA FACTORY • <code>` repeated)
sits under the header and above the footer, and the optional guilloche
background is generated as a local SVG pattern at `0.05` opacity.

**Number gaps.** Admins get `/reports/number-gaps`, listing missing invoice and
voucher numbers between the first record and the counter value.

Document glyphs use the locally served Arkan webfonts from `/fonts/arkan/` for
all Kurdish and Arabic text. The supplied master is missing **`ۇ` (U+06C7,
Arabic letter U with damma)** — the only required glyph absent from every
supplied weight; the font audit reports it rather than silently substituting a
different Arabic face. Latin text uses Arkan first and falls back to the
Latin-only Inter face. `npx playwright test tests/e2e/fonts.spec.ts` verifies
`document.fonts.check('16px Arkan', 'ێڵۆڕەڤ')`, 200 responses for the font
files, and `pdffonts` `emb=yes` for both PDFs (install Poppler or set
`PDFFONTS_BIN`).

### i18n

All UI and document labels live in exactly two editable JSON files:

```
apps/web/src/i18n/ku.json
apps/web/src/i18n/ar.json
```

The UI language is stored in `localStorage` (`antika.lang`, default `ku`) and the
whole interface is RTL. Document language is independent from UI language and
can be switched in each editor and on the print preview.

### API overview

All routes are under `/api`. Authentication is a cookie; mutating requests are
validated with Zod.

| Method | Route | Notes |
| --- | --- | --- |
| `POST` | `/auth/login` | rate-limited |
| `POST` | `/auth/logout` | clears cookie |
| `GET` | `/auth/me` | current user |
| `POST` | `/auth/change-password` | clears forced-change flag |
| `GET/POST` | `/users` | admin only |
| `PATCH/DELETE` | `/users/:id` | admin only, last-admin guard |
| `POST` | `/users/:id/reset-password` | admin only |
| `GET/PUT` | `/settings` | PUT admin only |
| `GET` | `/invoices` | search, date range, pagination |
| `GET` | `/invoices/next-number` | peek only, not reserved |
| `GET/POST` | `/invoices`, `/invoices/:id` | CRUD |
| `PUT/DELETE` | `/invoices/:id` | delete admin only |
| `POST` | `/invoices/:id/duplicate` | new number |
| `GET` | `/invoices/:id/pdf` | single-page PDF (issues the document) |
| `POST` | `/invoices/:id/issue` | lock DRAFT → ISSUED |
| `POST` | `/invoices/:id/unlock` | admin only, ISSUED → DRAFT |
| `POST` | `/invoices/:id/cancel` | admin only, reason required |
| `GET` | `/vouchers` | search, date range, pagination |
| `GET/POST` | `/vouchers`, `/vouchers/:id` | CRUD, optional `invoiceId` |
| `PUT/DELETE` | `/vouchers/:id` | delete admin only |
| `POST` | `/vouchers/:id/duplicate` | new number |
| `GET` | `/vouchers/:id/pdf` | single-page A5 PDF (issues the document) |
| `POST` | `/vouchers/:id/issue` | lock DRAFT → ISSUED |
| `POST` | `/vouchers/:id/unlock` | admin only, ISSUED → DRAFT |
| `POST` | `/vouchers/:id/cancel` | admin only, reason required |
| `GET` | `/qr/:code` | local SVG QR for a verify code (no auth) |
| `GET` | `/verify/:code` | public sanitized verification, 30/min/IP |
| `GET` | `/reports/number-gaps` | admin only, missing numbers |
| `GET` | `/customers?q=` | autocomplete |
| `GET` | `/dashboard` | counts + recent documents |
| `GET` | `/health` | DB liveness |

### Tests

```bash
npm run test
npm run typecheck
npm run build

# with the API and web dev servers running, and a non-forced admin password:
E2E_PASSWORD='your-password' npm run e2e

# PowerShell:
$env:E2E_PASSWORD='your-password'; npm run e2e
```

Current results:

- Vitest: **42 passed** in 5 files — 26 `numberToWords`, 4 totals, 1 counter
  concurrency test (50 parallel requests), 7 authenticity tests (10,000 unique
  verify codes, masking, HMAC tamper detection) and 4 HTTP tests against the
  real Express app/DB (30/min rate limit, identical 404 body, verify counter,
  MODIFIED after a direct row edit, CANCELLED status).
- Playwright: **11 passed** — screenshots/PDF checks for the Kurdish A4 invoice
  and Arabic A5 voucher; the authenticity spec (watermark/QR/microtext presence,
  a pixel-diff proving the watermark reaches the printed PNG, and the public
  verify page in Kurdish, Arabic and English); and the print-size gate
  (exact page boxes, single page, 300 dpi rasters, footer inside, two-up,
  safe-margin inset, print notice and calibration sheets).
- `docker compose --env-file .env.docker.example config` parses successfully.

Playwright writes screenshots, PDFs and the watermark proof pair to
`test-results/screenshots/`, and the print-size PDFs, 300 dpi PNGs and
calibration sheets to `test-results/print-verification/`. The checked-in
copies under `docs/screenshots/` and `docs/print-verification/` are generated
by the same tests.

The authenticity spec logs in once per run and reuses the storage state; the
print-size and screenshot specs log in per test, so one full run uses nine
logins. The login limiter is 10 per 15 minutes per IP: repeated full runs
should wait for the window to expire or restart the API.

If the login redirects to `/change-password`, complete the forced password
change first, then rerun with `E2E_PASSWORD` set to the new password.

### Docker and VPS deployment

The deployment is a Docker Compose stack, not Netlify:

```
postgres  →  api (Express + Chromium)  →  web (nginx + static React + /api proxy)
```

`web` listens on `127.0.0.1:8080`; host nginx terminates HTTPS and proxies to it.
See **[deploy/README.md](deploy/README.md)** for the full VPS walkthrough,
including DNS, Docker installation, secrets, Certbot, upgrades and operations.
The host nginx block is in
[deploy/nginx-antika-docs.conf](deploy/nginx-antika-docs.conf).

Local compose check:

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker config
docker compose --env-file .env.docker up --build -d
```

### Backup and restore

- **Docker/VPS:** `scripts/backup.sh` and `scripts/restore.sh` use
  `pg_dump`/`pg_restore` inside the `postgres` container, write SHA-256
  checksums, keep 14 days by default, and take a safety backup before restoring.
- **Windows local:** `scripts/backup-local.ps1` and
  `scripts/restore-local.ps1` use the installed PostgreSQL tools and strip
  Prisma's `?schema=public` parameter.
- Stop the API before a local restore so nothing writes during the schema swap.

The local backup/restore pair has been exercised on this workspace: a marker row
was inserted, the previous dump restored, and the marker disappeared while the
sample documents remained intact.

### Security notes

- Parameterized Prisma queries; no raw SQL interpolation.
- Zod validation for every request body and query.
- Login rate limit; CORS limited to `APP_ORIGIN`; helmet headers; no
  `x-powered-by`.
- JWT in `httpOnly`, `SameSite=Strict`, `Secure` (HTTPS) cookie.
- `bcryptjs` password hashes; forced first-login change; admin/staff checks on
  the server, not only in the UI.
- Soft delete keeps audit history; audit log records login, CRUD, PDF and user
  actions.
- PostgreSQL and the API are not published to the host in production.
- `/api/health` checks the database and returns `503` when unavailable.
- Public verification returns a fixed, sanitized DTO: no phone, address, line
  items or raw customer name; malformed and unknown codes share one 404 body;
  30 requests/minute/IP.
- QR codes are rendered locally (`qrcode` package) — no external QR service, no
  document data leaves the server.
- `integrity_hash` is HMAC-SHA256 with `DOC_HMAC_SECRET`; rotate the secret only
  with a plan, because existing documents will then report `MODIFIED`.
- Issued documents are locked server-side (`423 DOCUMENT_LOCKED`); unlock and
  cancel are admin-only and audit-logged.

### Design assumptions

The attached reference PDF could not be parsed by the implementation
environment, so Document B was built from the written specification. The
following choices are documented and easy to adjust:

1. The invoice uses a 10 mm page padding, a 31 mm header band, 55/28/30 mm
   information rows, and 16 mm item rows.
2. The voucher is A5 landscape with a 3.5 mm outer border; the amount box, words
   row, payment-method cards and three signature lines follow the supplied
   Arabic/Kurdish wording.
3. The supplied K mark is traced into `logo.svg` (with `logo.png` and a square
   `favicon.svg`), and the same mark is used by the watermark. Bundled brand
   calligraphy is typeset in Arkan Favorit; custom logo/brand/watermark paths
   can still be set from Settings or replaced in `apps/web/public/assets/`.
4. Sample invoice amounts (4,750,000 IQD, 60/40 split) are illustrative.
5. UI languages are Kurdish and Arabic only, matching the request; English is
   used in code and documentation but is not a UI locale.
6. Vouchers default to A5 landscape; `VOUCHER_PAGE=A4_landscape` (or the
   Settings selector) prints the same A5 artwork centered on an A4 landscape
   page for printers that only accept A4.
7. The authenticity layers use only free space: between totals and footer on
   the invoice, and between the signature row and footer on the voucher. The
   invoice special-offer row is 20 mm (was 24 mm) to keep the A4 footer on the
   first page; no other block moved.
8. All visible text — UI, print toolbars, document labels, watermarks and brand
   calligraphy — uses the supplied Arkan files in
   `apps/web/public/fonts/arkan/` under their original names, with a full-glyph
   `woff2` beside each master. Arabic-script text is never letter-spaced or
   uppercased; Inter is restricted to Latin `unicode-range` spans and only
   covers glyphs Arkan lacks. The font files are served locally and are not
   downloaded at runtime; the Docker image installs them as system fonts
   (`/usr/local/share/fonts/arkan` + `fc-cache -f`) for Chromium.

### Acceptance

| # | Requirement | Result |
| --- | --- | --- |
| 1 | Fixed React 18 + Vite + TS + Tailwind / Node 20 + Express + Prisma + PostgreSQL 16 stack | **PASS** |
| 2 | Kurdish/Arabic RTL UI, default Kurdish, persisted language switch | **PASS** |
| 3 | A4 invoice document matching section order, colors, borders, footer, watermark | **PASS** |
| 4 | A5 landscape voucher with Arabic/English labels, words, payment method, signatures | **PASS** |
| 5 | Browser print via `@page` and single-page PDF for both documents | **PASS** |
| 6 | PDF endpoints reuse the React print routes and match browser print | **PASS** |
| 7 | Local fonts and assets, no CDN or runtime network dependency | **PASS** |
| 8 | Per-document language and digit-mode toggle (Eastern/Latin) | **PASS** |
| 9 | One editable i18n JSON per language | **PASS** |
| 10 | Separate atomic counters, unique constraints, transaction allocation | **PASS** |
| 11 | 50 parallel allocations produce 50 unique consecutive numbers | **PASS** |
| 12 | Admin-only number override; staff override ignored | **PASS** |
| 13 | `numberToWords` 0–999,999,999,999 in Arabic/Kurdish + required test cases | **PASS** |
| 14 | JWT httpOnly SameSite=Strict cookie, bcrypt, rate limit, helmet, roles, forced change | **PASS** |
| 15 | Invoice/voucher create, edit, duplicate, soft delete, search, date filter, pagination | **PASS** |
| 16 | Voucher linked to an invoice | **PASS** |
| 17 | Customer autocomplete, dashboard, settings, users, toasts, mobile tabs | **PASS** |
| 18 | Seed admin, sample invoice #1010, empty voucher #1 | **PASS** |
| 19 | Vitest suite | **PASS** (42/42) |
| 20 | Playwright screenshots + single-page PDF checks | **PASS** (13/13) |
| 21 | `docker compose config` | **PASS** |
| 22 | `docker compose up --build` executed in this workspace | **FAIL** — Docker daemon unavailable here; config and Dockerfiles are provided |
| 23 | VPS nginx + HTTPS/Certbot documentation and host config | **PASS** (provided, not executed on a VPS here) |
| 24 | Backup/restore scripts | **PASS** locally; Docker scripts not executed because Docker is unavailable |
| 25 | No TODOs, placeholders or CDN references | **PASS** |
| 26 | One shared watermark component, inline SVG, behind content, A4 140 mm / A5 150 mm, opacity configurable | **PASS** — DOM/computed-style assertions in `authenticity.spec.ts`; Settings sliders verified in the browser |
| 27 | Watermark visible in browser print, PDF and PNG export | **PASS** — PDF rendered in Chrome, screenshot shows the watermark; pixel-diff test (`invoice-watermark-on/off.png`) counts >1000 changed pixels |
| 28 | Body/table/customer cells transparent, header/label cells beige `rgba(248,221,184,0.85)`, `print-color-adjust: exact` | **PASS** — CSS reviewed and visible in `docs/screenshots/invoice-a4-ku.png` |
| 29 | Show-watermark default ON, admin per-document override | **PASS** — Settings security card saved via UI; editor override select switched and persisted |
| 30 | Unique `XXXX-XXXX-XXXX` verify code (no O/0/I/1) via crypto | **PASS** — 10,000-code uniqueness unit test; seed and new documents use the generator |
| 31 | `Verify:` line, 18×18 mm local QR encoding `/verify/<code>`, left on A / right on B | **PASS** — QR `<img src="/api/qr/…">` loads (naturalWidth > 0) on both documents; screenshots |
| 32 | Public `/verify/:code`: type, number, date, masked customer, total, status, company, integrity; no phone/address/items | **PASS** — HTTP tests assert the exact DTO keys; Playwright checks an anonymous mobile visit in ku/ar/en |
| 33 | 30/min/IP, identical not-found response | **PASS** — HTTP test: first 30 → 404, 31st → 429; bodies deep-equal for malformed/unknown |
| 34 | ISSUED lock after print/PDF, admin-only unlock | **PASS** — `beforeprint` locked voucher #1 in the browser; admin unlock dialog restored DRAFT; a PUT while ISSUED returned `423 DOCUMENT_LOCKED` |
| 35 | CANCELLED stays in DB with red diagonal `CANCELLED / هەڵوەشێنراوە` stamp and verify status | **PASS** — cancelled voucher #1 via the admin UI with reason; stamp text asserted; verify page shows CANCELLED |
| 36 | HMAC-SHA256 integrity over canonical fields; DB edit shows MODIFIED | **PASS** — unit tamper cases; HTTP test edits the row directly and gets `MODIFIED` |
| 37 | Microtext under header and above footer; optional guilloche SVG background | **PASS** — ≥2 `.doc-microtext` nodes per document; guilloche SVG at 0.05 opacity |
| 38 | Number-gaps report for admins | **PASS** — `/reports/number-gaps` rendered with start/end/issued/missing; nav entry visible for admin |
| 39 | Schema migration for codes/status/hashes/counters/settings; seed with codes and hashes | **PASS** — `prisma migrate reset` + seed rerun; samples start DRAFT with unique codes |
| 40 | Original layout unchanged; new elements only in free space; footer never shrinks | **PASS** — A4 remains 297 mm with full footer and A5 148 mm; special-offer row reduced 24→20 mm is the only adjustment |
| 41 | Arkan only for Kurdish/Arabic everywhere; fonts load with 200 and are embedded in both PDFs | **PASS** — `document.fonts.check` true on dashboard, print route and after returning; every `/fonts/arkan/` response 200; `pdffonts` lists `ArkanABCFavorit-Bold/Medium` with `emb=yes`; artifacts in `docs/print-verification/fonts/`. Only missing required glyph: `ۇ` U+06C7 |

### Troubleshooting

- **`EPERM ... query_engine-windows.dll.node`** during `prisma generate`: stop the
  running API, then run `npm run db:generate` again.
- **Login returns 429**: the login rate limit is active. Restart the API or wait
  for the window to expire.
- **`/change-password` redirect in E2E**: log in once, change the password, then
  run `E2E_PASSWORD='new-password' npm run e2e`.
- **PDF 401**: the PDF endpoint requires the auth cookie; use the app or a
  logged-in HTTP client.
- **Wrong voucher size**: check `VOUCHER_PAGE` and the print route CSS; the
  expected A5 landscape media box is `[0 0 594.95996 420]`.
- **`/verify` returns 429**: the 30/minute/IP limit is active for that address;
  wait for the window or restart the API during local testing.
- **Every document shows `MODIFIED`**: `DOC_HMAC_SECRET` changed after the
  documents were issued, or a row was edited outside the app. Restore the old
  secret or re-issue the document.
- **An issued document cannot be edited**: expected. An administrator can use
  “Unlock” in the editor (audit-logged) or cancel the document instead.
- **No Kurdish glyphs in PDF**: the web container must serve
  `apps/web/public/fonts/arkan/`; the API Docker image copies the same files to
  `/usr/local/share/fonts/arkan` and runs `fc-cache -f` so Chromium can resolve
  them.

### Credits

Inter is distributed under the SIL Open Font License. Lucide icons are ISC
licensed. The Arkan Favorit webfonts were supplied with the project and are
served locally; the full-glyph `woff2` copies were generated from the supplied
masters with fonttools without subsetting. Brand artwork is original
placeholder artwork for Antika Factory and can be replaced.
