# The Strong Academy — Homepage

Marketing homepage for **The Strong Academy** (thestrongacademy.com), a functional-conditioning / longevity coaching business in the DMV (Arlington, VA) founded by Venus Davis.

Built from the Claude Design handoff (`design_handoff_strong_academy_homepage`) as a zero-dependency static site — no build step, deployable to any static host (GitHub Pages, Netlify, Vercel, S3).

## Run it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Structure

| Path | What it is |
|---|---|
| `index.html` | The full single-page site (nav, hero, marquee, pillars, programs, quiz, events calendar, pricing, booking flow, about, footer) |
| `css/styles.css` | Design tokens from the handoff + the motion system |
| `js/main.js` | Quiz funnel, events calendar, booking flow, newsletter, scroll-reveal / parallax controllers |
| `assets/` | Placeholder photography (crops from client flyers — to be replaced with real class photos) |

## Motion system

Animation follows a "motion conveys state" budget (reduced-motion users get a fully static page via `prefers-reduced-motion`):

- **Hero entrance** — choreographed masked line-rise on the H1, staggered rise for eyebrow/subhead/CTAs, slow 1.08→1 zoom on the photo, plus a scroll-linked parallax drift.
- **Section headings** — masked line reveals (clip-path rise) triggered by IntersectionObserver.
- **Grids** — staggered rise reveals (`--i` custom property, 90 ms per item, once-only, unobserved after firing).
- **Micro-interactions** — image hover-zoom on program cards, card lift + border glow, arrow-link slides, button press states, input focus rings, error shake, confirmation ✦ pop.
- **Ambient** — tagline marquee (pauses on hover), scroll progress bar, scroll cue, active-section nav highlight.

## Production TODOs (from the handoff)

- Booking + newsletter are front-end prototypes — wire to Calendly/Cal.com or a bookings API and an email marketing provider.
- Events are placeholder data generated relative to today — move to a CMS or booking API.
- Replace flyer-crop photography, add the real logo asset and Venus's headshot.
- Social URLs and phone number are placeholders.
