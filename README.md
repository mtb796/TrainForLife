# The Strong Academy — Homepage

Marketing homepage for **The Strong Academy** (thestrongacademy.com), a functional-conditioning / longevity coaching business in the DMV (Arlington, VA) founded by Venus Davis.

Zero-dependency static site — no build step, deployable to any static host (GitHub Pages, Netlify, Vercel, S3).

## Run it

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Structure

| Path | What it is |
|---|---|
| `index.html` | The full single-page site |
| `css/styles.css` | Brand tokens + motion system |
| `js/main.js` | Quiz, calendar, scheduling, newsletter, motion controllers |
| **`content/site.json`** | **All editable content — events, testimonials, booking links** |
| **`admin/index.html`** | **Browser-based editor for that file (no build, no backend)** |
| `assets/` | Photography (see *Pending assets*) |

---

## ✏️ Editing content without touching code

Events, testimonials, and every integration link live in **`content/site.json`**.
The site fetches it at runtime and falls back to built-in defaults if it's ever
missing, so a bad edit can't take the page down.

**The easy way — visit `/admin` on the live site** (e.g. `thestrongacademy.com/admin`):

1. Edit events (including the sold-out toggle), quotes, and booking links in a form.
2. Click **Copy JSON**.
3. Click **Open site.json on GitHub** → pencil icon → paste over everything → **Commit changes**.
4. Vercel redeploys automatically. Live in ~30 seconds.

`/admin` is a static page — no login, no database, no server. It never writes
anything by itself; committing on GitHub is what publishes. It's `noindex`, but
because it's public, don't put anything sensitive in it.

**The direct way:** edit `content/site.json` on GitHub and commit. Same result.

Dates are `YYYY-MM-DD`. `soldOut: true` swaps "Save spot" for a SOLD OUT tag and a
"Notify me" button.

---

## ⚙️ Going live — paste these three things into `js/main.js`

Everything is scaffolded and degrades gracefully while these are empty. All three
live in the clearly-marked **INTEGRATION CONFIG** block at the top of the file.

### 1. Calendly (`CALENDLY`)
One scheduling link per service:

```js
var CALENDLY = {
  discovery: 'https://calendly.com/…/discovery-call',
  single:    'https://calendly.com/…/1-1-session',
  team:      'https://calendly.com/…/teamstrong-class',
  workforce: 'https://calendly.com/…/workforce-consult'
};
```

The embedded widget is auto-branded to the site palette (black background, blush
text, Vurple accents) via Calendly's own URL parameters.

**Google Calendar sync** (`Iamcoachve@gmail.com`, `Hello@thestrongacademy.com`) is
configured **inside Calendly**, under *Account → Calendar Connections* — connect
both accounts there and availability flows through automatically. No code change.

### 2. Eventbrite (`EVENTBRITE`)
```js
var EVENTBRITE = {
  organizer: 'https://www.eventbrite.com/o/…',
  events: { 'Strong Camp L1': 'https://www.eventbrite.com/e/…' }
};
```
Until `organizer` is set, the seeded schedule in `eventList()` is displayed.

### 3. Package checkout (`PACKAGES`)
Add a Stripe / Square / Calendly paid-event link per package. While
`checkoutUrl` is empty the button routes to the scheduler instead of a checkout.

---

## Pending assets

- **EverSTRONG + TeamSTRONG photography** — the two current images are flyer crops
  and are marked `TODO(client)` in `index.html`. Workforce Strong has a branded
  placeholder tile awaiting its first photo.
- **Venus Davis headshot** — placeholder tile in the About section.
- **Testimonials** — the three quotes are placeholders; real ones to come from the
  previous site.
- **Image optimization** — current PNGs total ~2.7 MB. When the new photography
  arrives, export as WebP at 2× display size; `width`/`height` are already set on
  every `<img>` to prevent layout shift.

## Brand tokens

| Token | Hex | Role |
|---|---|---|
| Vurple | `#8400C8` | **Fills only** — buttons, marquee, selected states |
| Blush | `#EFE7E2` | Primary text + warm accent (serif italics) |
| Light Gray | `#B7B6BA` | Muted body copy, eyebrows |
| Mid Gray | `#616161` | **Borders/dividers only** |
| Dark Gray | `#222223` | Card + tinted-section surfaces |
| Black | `#000000` | Page background |

> **Accessibility note:** Vurple on black is 2.82:1 and Mid Gray on black is 3.39:1 —
> both below the 4.5:1 WCAG AA minimum. That's why Vurple is reserved for fills
> (white on Vurple is 7.46:1) and Blush carries the accent-text role (17.2:1).
> Don't move purple onto small text without adding a lighter tint.

**Type:** Bebas Neue (display) · Cormorant Garamond italic (serif accent) · DM Sans (body).
Bebas Neue ships a single weight, so heading hierarchy comes from size, tracking
and color — never `font-weight`.

## Motion system

All motion is disabled under `prefers-reduced-motion`, with a `noscript` fallback
so content is never invisible without JS.

- **Hero** — masked line-rise choreography, 1.08→1 photo zoom, scroll parallax, copy fades out on scroll.
- **Kinetic headings** — section H2s split into per-word masks at runtime, 55 ms stagger.
- **Decorative parallax** — giant outlined background words and card imagery drift at differing speeds. Decorative layers only, never body copy.
- **Micro-interactions** — magnetic primary CTAs (desktop pointers, clamped pull), duotone→color image hover, card lift, arrow slides, focus rings.
- **Ambient** — marquee (pauses on hover), scroll progress bar, nav hides down / returns up, film grain, active-section nav highlight.

Buttons animate an inner `.btn-label` rather than the button element itself, so a
magnetic inline transform can never clobber hover-lift or press feedback.
