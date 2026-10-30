---
name: tupande-design
description: Tupande look and feel for any page, screen or component in this repo (Farm Planner, landing pages, reports, WhatsApp pictures). Use before building or restyling UI here.
---

# Tupande design

Sources: *Tupande Brandbook Master_Final.pdf* (Drive id `1_HR-VC9dRPCs-DK2X1nnKr8rSszv7qLO`) and
*Tupande_Brandbook_Staff_1.14.22_small.pdf* (staff edition).
The brandbook always wins over anything below. The user's own instructions win over both.

## Direction: "market poster × agent's notebook"

Two registers, used deliberately:

- **Poster** for moments that sell an idea: hero, section openers, calls to action.
  Full-width bands of Kakamega Green or Rondo Teal, very large Georama headlines,
  a yellow **arc** under one key phrase, round icon badges, line illustrations.
- **Notebook** for anything the farmer and agent read together: steps, figures, ledgers, plans.
  White or Malindi Sand pages with faint ruled lines, a thin Red Ochre margin rule,
  large tabular figures, plain labels. Calm, legible in sunlight.

Never let the whole page be one register. Never use flat identical cards everywhere.

## Colour

| Role | Name | Hex |
|---|---|---|
| Primary | Kakamega Green | `#2B7F68` |
| Primary | Binzari Yellow | `#E8B757` |
| Primary | Rondo Teal | `#2F6067` |
| Secondary | Sagana Brown | `#754C3D` |
| Secondary | Kunde | `#67724D` |
| Secondary | Zaituni | `#8F9A36` |
| Secondary | Malindi Sand | `#DED6C0` |
| Secondary | Sangalo Rock | `#D8B39D` |
| Accent, sparingly | Red Ochre | `#CF482B` |
| Accent, sparingly | Mlango Blue | `#00B3B6` |
| Accent, sparingly | Plum | `#6F285B` |
| Accent, sparingly | Mtama Purple | `#BF549F` |

- Primary colours pair with each other or with white.
- Tints are named by strength: *Kakamega Green 20* is the lightest (20%), then 40, 60, 80.
- Secondary colours support the primaries. Note: the staff edition prints Sagana Brown as
  `#62F6067` / RGB 50, 97, 103 (a typo copied from Rondo Teal); the master edition's `#754C3D`
  (RGB 117, 76, 61) is correct.
- Accent colours are small highlights only. **Never** use them as solid backgrounds.
- Open question: Binzari Yellow's RGB (243, 188, 72) differs from its hex. Use the hex.

## Type

- **Georama** (Google Fonts): display and headings. Bold for headings. Its condensed,
  angular shape echoes the logo, so use it big.
- **Source Sans 3** (Google Fonts, formerly Source Sans Pro): the digital body face.
- **Whitney** is the print/shared One Acre Fund face. It is licensed, not on Google Fonts;
  do not load it on the web.
- Hierarchy: heading Georama Bold, subhead semibold, body regular. Keep it consistent.

## Logo

- Use only the locked logo files (EPS, PDF, PNG) from the brand guidelines folder.
  Web copies live in `tupande-farm-planner/assets/`. `tupande-by-oaf-horizontal.png` is the
  co-branded horizontal logo cropped unaltered from the staff brandbook (page 18); replace it with
  the locked file from the brand folder when available. There is no inverted (white) web copy yet,
  so do not place the logo on dark bands.
- Coloured logo on light backgrounds; inverted logo on dark backgrounds.
- Clear space on every side = height of the "T" in the word mark.
- Never recreate, stretch, recolour, outline, add effects to, or rotate it (only 0° or 90°).
- Farmer-facing items: use the co-branded **Tupande by One Acre Fund** files while farmers
  are getting familiar with the brand. Never build the co-branded lock-up yourself.
- If the file is missing, show the plain text "Tupande" and say the logo is pending.
  Do not draw a substitute mark.

## Graphic devices

- **Leaf**: derived from the large leaf in the logo; may repeat as a pattern.
  Without the official vector, use a simple generic leaf, quietly, and never as a logo.
- **The Arc**: a curved highlight for emphasis. Use sparingly, once or twice a page.
- **The Button**: a round badge on the top right or left of a photo.
- **The Bow**: a curve underneath a photo.
- **Line illustrations** (duka, people, solar…): single line weight, round caps,
  standing on a curved baseline. The library may be extended in that style.
- **Icons**: inside a circle or on their own.
- Customer-facing pieces should mix photos, icons and illustrations.

## Voice

Key ideas: we are here for **farmers**, known for **quality**, speak in a **friendly** way,
and will grow **together**. Plainspoken, like a trusted friend giving advice.
Taglines: "Let us plant, let us rise." · "Together, we rise." · "We rise by lifting others."
Clear British English. Estimates are labelled as estimates.

## Build rules

- Mobile-first; at least 16px side gutters; touch targets at least 44px.
- Tabular figures (`font-variant-numeric: tabular-nums`) wherever numbers line up.
- Visible keyboard focus (Binzari Yellow outline); respect `prefers-reduced-motion`.
- Charts and field diagrams drawn to scale.
- Photos: real Tupande photography only, from approved brand sources. `assets/hero.jpg` is the
  farmer and field officer in sorghum from the staff brandbook (page 3); pages 1, 5, 9, 16, 24
  and 28 hold other usable photos. Never stock photos
  presented as Tupande farmers, and never AI-generated people presented as real.
