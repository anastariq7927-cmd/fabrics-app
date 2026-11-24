# FabriCS — Design system

Direction: **engineering logbook**. A Metz engineers' association that builds
things (CShell, 3D fabrication) and works with industry partners. The site
should read like a well-kept technical journal: warm paper, ink-black type,
the FabriCS burgundy used sparingly for actions, mono labels for data.
Left-aligned, ruled with hairlines, almost no shadows.

Not based on reference sites (UXKIN not connected) — derived from the brand
color, the content and the audience (students, schools, industrial partners).

## Color

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#F6F4F0` | `#121011` | Page background (paper) |
| `--bg-alt` | `#EDEAE4` | `#1A1718` | Alternate sections, input fill |
| `--bg-elevated` | `#FFFFFF` | `#1F1B1C` | Cards, panels |
| `--bg-dark` | `#16120F` | `#0B0909` | Ink bands (showcase, footer) |
| `--text` | `#1A1714` | `#EDE8E2` | Body and headings |
| `--text-muted` | `#5C554E` | `#A69E96` | Secondary text (≥4.5:1 on bg) |
| `--text-faint` | `#7D756D` | `#857D76` | Meta, captions |
| `--border` | `#D9D3CA` | `#342F2C` | Inputs, rules |
| `--border-soft` | `#E5E0D8` | `#272322` | Hairlines between rows |
| `--brand` | `#610721` | `#8E1A3A` | Primary buttons, CTA band |
| `--brand-strong` | `#4A0519` | `#A3264A` | Primary hover |
| `--brand-bright` | `#8C1236` | `#E0899F` | Links, indices, focus ring |
| `--brand-soft` | `#F1E3E6` | `#2A1419` | Badges, icon wells |
| `--success` / `--warning` / `--danger` | `#1E6B3A` / `#8A5300` / `#A6261C` | `#6FCF8E` / `#E8B260` / `#F07A70` | Status text |

One color carries meaning (burgundy). No gradients, no gradient text.

## Typography

- **Display** — Newsreader (serif, 400–500): `h1`, `h2`, large numbers.
- **Text** — IBM Plex Sans (400/500/600): body, UI, buttons.
- **Mono** — IBM Plex Mono (500): eyebrows, indices (`01`), dates, meta.

| Name | Size | Line | Use |
|---|---|---|---|
| display | clamp(44–88px) | 1.02 | Page/hero titles |
| headline | clamp(32–56px) | 1.08 | Section titles |
| title | clamp(24–32px) | 1.15 | Row titles |
| lead | clamp(18–21px) | 1.5 | Intro paragraphs (max 60ch) |
| body | 17px | 1.6 | Text |
| small | 14px | 1.5 | Cards, nav |
| label | 12px mono, uppercase, +0.08em | 1 | Eyebrows, meta |

## Spacing & layout

4px base: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Section padding
`clamp(72px, 10vw, 128px)`. Content 1200px wide, reading width 680px.
Sections are left-aligned with a 12-column feel; a section head sits on a
top hairline with its mono label.

## Shape & depth

Radius: `--radius-sm` 4px (inputs, buttons), `--radius` 6px (cards),
`--radius-lg` 10px (media). Pills only for the language switch and badges.
Depth comes from 1px borders; one shadow (`--shadow-lg`) for the open
mobile menu and popovers only.

## Components

- **Buttons**: primary (burgundy fill, white text), secondary (1px ink
  border, transparent), quiet (text + arrow). 44px tall, 4px radius.
  Hover darkens; focus = 2px `--brand-bright` outline offset 3px;
  disabled 50% opacity.
- **Links**: `--brand-bright`, underline on hover with 2px offset.
- **Inputs**: white fill, 1px `--border`, 4px radius; focus border brand.
- **Cards**: white, 1px border, no shadow; hover moves the border to ink.
- **Index rows**: mono number · serif title · text · thumbnail, separated
  by hairlines (used for the four intentions).
- **Nav**: solid paper bar, hairline below, wordmark left, CTA right.
- **Footer**: ink background, columns, mono labels.

## Imagery & icons

Real photos of the association (campus, workshop, CShell) at 10px radius,
never under dark gradients except the hero caption scrim. Font Awesome
solid, used small and inline with labels — never as decoration in big
coloured circles.
