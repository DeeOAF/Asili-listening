# Tupande Farm Planner — Updated MVP

> **Change log**
> - 2 November 2026: field mapping redesigned for TAs — Walk the corners (default, works without data), Tap corners on the map, and Step out the sides as the fallback (sections 4.1–4.2, 14).
> - 2 November 2026: access changed from a restricted three-person pilot to public, no sign-in (section 2). Live application moved to the Vercel deployment of this repository (section 1).

## 1. Purpose

Build a simple, mobile-first web application that helps a farmer and a Tupande agent see their land as a productive asset, protect household food security, and explore affordable ways to generate income now and in the future.

The application is a guided planning conversation, not an order-placement system or a guaranteed financial forecast.

The MVP should:

- Work on smartphones and tablets.
- Make the field and its proportional land allocations central to the experience.
- Protect household maize needs before unlocking additional enterprises.
- Constrain choices by available land, the farmer’s cash and eligible credit.
- Show immediate changes in annual benefit, cash needed to start and acres available.
- Let the farmer review alternatives without ranking one objective as universally best.
- Produce a picture and short written summary suitable for WhatsApp.

**Pilot zone:** Kakamega.  
**Language:** English, using clear British English.  
**Brand:** Tupande.  
**Live application:** the Vercel deployment of this repository. The landing page is served at `/` and the planner at `/planner/`. The earlier ChatGPT prototype (https://tupande-farm-planner.oneacrefund-1514.chatgpt.site/) is superseded.

This document consolidates the agreed product requirements, financial assumptions and current prototype conventions. Where an implementation convention was not explicitly set by the product owner, it is identified below.

## 2. Users and access

### Primary users

- A farmer considering how to use their land and available investment.
- A Tupande agent guiding that discussion.

### Access

*Changed on 2 November 2026 at the instruction of Doreen Sasaka (pilot team). Previously the site was restricted to the three pilot team accounts and could not become public without an explicit change in instruction; this is that change.*

- The landing page and the planner are public. Anyone with the link can use them without signing in.
- Pages ask search engines not to list them (`noindex, nofollow`). The link is shared by the pilot team and Tupande agents rather than advertised.
- The pilot team (Richard Bell, Doreen Sasaka and Victor Kirubi) remains responsible for the content and for any decision to restrict access again.
- Because anyone can open it, every figure stays labelled as an estimate, credit stays "subject to agent confirmation", and the planner must not be presented as an offer, order or credit approval.
- Public use of the Tupande logo and brandbook photography should be confirmed with the brand team.

No farmer name or telephone number is required for this MVP. Plans are saved locally in the browser on the current device. There is no shared farmer database or cross-device synchronisation.

## 3. Core decision hierarchy

1. Establish available resources: field size, cash available now and customer year.
2. Identify household annual maize requirements and existing fruit trees.
3. Reserve sufficient land and long-rains funding for household maize.
4. Stop if either the land or funding is insufficient.
5. Let the farmer select optional enterprises.
6. Keep every choice within remaining land and cash limits.
7. Show current-year benefits and future tree values separately.
8. Offer up to three feasible alternatives only after the farmer selects **Review my plan**.
9. Let the farmer accept an alternative or select **I’m happy with this plan**.
10. Generate the field picture and written summary.

The MVP does not require a full current-state assessment of farm earnings or cropping patterns. Existing fruit trees are captured because they already occupy land and can generate income.

## 4. Step one — Your assets

### 4.1 Map and confirm the field

*Changed on 2 November 2026 to make mapping easier for Tupande agents (TAs) in the field.*

Offer two GPS methods. **Walk the corners** is the recommended, default method because GPS works without mobile data; only the satellite picture needs data.

**Walk the corners**

- The TA stands at each corner of the field and taps **Mark corner N**.
- The planner averages GPS fixes for about 10 seconds while the TA holds still, weighting more accurate fixes more heavily.
- A corner is saved only when at least three fixes are accurate to **10 m or better**. If that cannot be reached within about 25 seconds, the corner is not saved and the TA is told to move into the open and try again.
- A live GPS indicator shows the current accuracy and the distance from the last corner.
- A corner less than 3 m from the previous one is rejected.
- The phone vibrates when a corner is saved or rejected, and the planner asks the phone to keep the screen on while walking.
- **Undo last corner** removes the most recent corner. **Finish field** is available from four corners; six is the maximum.
- A sketch of the corners and the TA's position is always shown, so the method works without the satellite picture. When imagery is available, the finished corners appear on the map and can be dragged to fine-tune them.
- The size is shown as an estimate with a margin, for example "about 0.48 acres, give or take 0.06". The margin is about 95% confidence, calculated from each corner's GPS accuracy.

**Tap corners on the map**

- The map centres on the device's location, with a "you are here" dot.
- The TA taps each corner in order, four to six corners, and can drag corners afterwards. **Undo last corner** and **Start again** are available.
- **Lock map** stops the map moving by accident while corners are adjusted.
- If satellite imagery does not load, the planner says so and points the TA to Walk the corners or stepping out the sides.

**For both methods**

- Corner handles are large and numbered.
- Estimated acreage and perimeter update as corners change.
- Reject self-crossing or effectively zero-area shapes.
- The user must confirm the field. Moving, adding or removing a corner removes the confirmation.
- Switching method asks before clearing corners already marked.

GPS locates the device; it does not detect the real field boundary or establish ownership.

### 4.2 Step out the sides (fallback)

Do not display the fallback all the time. Reveal it only when:

- The user selects **I cannot access my GPS**; or
- Location permission is refused or the device cannot share its location.

The fallback offers three units:

- **Steps** (default): the TA walks one long side and one short side, counting normal steps. One step is taken as **0.75 m** and can be changed. The field is treated as a rectangle: acres = length × width ÷ 4,046.86 m², perimeter = 2 × (length + width).
- **Metres**: the same rectangle with lengths in metres.
- **Acres**: the size typed directly. A square field is assumed to estimate the perimeter.

The rectangle or square assumption is shown next to the result.

### 4.3 Cash available

Ask:

> How much cash can you invest now? (KES)

This becomes a hard limit on the farmer’s immediate own-cash requirement.

Cash committed to one enterprise is no longer available for another. Unticking an enterprise releases its associated cash and land.

### 4.4 Tupande customer year

Ask:

> Which year are you with Tupande?

Use the following illustrative long-rains staple-credit ceilings:

| Customer year | Credit ceiling |
|---|---:|
| Year 1 | KES 10,000 |
| Year 2 | KES 15,000 |
| Year 3 | KES 20,000 |
| Year 4 | KES 25,000 |
| Year 5 and later | KES 30,000 |

Rules:

- Credit applies only to long-rains maize inputs.
- Borrow only the amount required for those inputs, up to the ceiling.
- Assume full repayment.
- Add no separate financing charge to the agreed input prices.
- Do not count credit as income.
- Groundnut input financing is separate.
- Trees and chicks are paid from the farmer’s own cash.
- Eligibility remains subject to agent confirmation.

### 4.5 Numeric input behaviour

All numeric entry boxes must allow the user to:

- Select the existing number.
- Delete it completely while editing.
- Type a replacement without a zero or minimum value being forced back into the box.
- Enter decimal acreage.
- Apply validation when leaving the field or pressing Enter.

If a field is left blank, restore its previous valid value. Clamp out-of-range entries on completion, not on every keystroke.

## 5. Step two — Family food and existing trees

### 5.1 Annual household maize requirement

Ask:

> How many 90 kg bags of maize does your family need for the year?

Use **20 bags per acre per harvest** as the agreed MVP yield assumption.

Ask:

> Will you plant maize in the short rains too?

If no:

- Model one long-rains harvest.
- Minimum maize acres = annual bags needed ÷ 20.

If yes:

- Model one long-rains and one short-rains harvest.
- Use the same maize area in both seasons.
- Minimum maize acres = annual bags needed ÷ 40.
- Assume short-rains inputs can be funded later from long-rains proceeds.
- Do not reserve short-rains input cash upfront.
- Still include short-rains input costs in the annual financial result.

The MVP does not model household food stocks between harvests or prove that long-rains proceeds will be sufficient when short-rains inputs are needed. The later-funding assumption must be explicit.

### 5.2 Existing fruit trees

First ask:

> Do you already have mango or avocado trees?

Only reveal the detailed questions if the answer is yes.

Collect separately for avocado and mango:

- Number of existing trees.
- Average age in years.

Do not ask for exact tree positions.

Reserve mature planting space for existing trees, then estimate harvest using their current age. Do not apply the new-seedling survival discount to trees that already exist.

### 5.3 Food-security hard stops

Before optional enterprises unlock, check both:

**Land**

Minimum family-maize area + existing fruit-tree area must fit inside the field.

**Funding**

The farmer’s cash plus eligible long-rains staple credit must cover the minimum family-maize long-rains inputs.

If either check fails:

- Clearly show the land and/or funding shortfall.
- Do not allow the farmer to proceed to additional enterprises.
- Let the user correct assets, tree counts or household requirements.
- Do not automatically reduce the family’s food requirement.

Once protected, the minimum family-maize area cannot be reduced through enterprise controls.

## 6. Step three — Select optional enterprises

Keep **Family maize** permanently selected and visibly locked.

Offer five optional enterprise tiles:

1. Extra maize.
2. Groundnuts.
3. Fruit trees.
4. Timber trees.
5. Chickens.

### Tile interactions

- Each tile has a clear selected/not-selected state.
- Selecting a tile opens its controls.
- Selected tiles show a tick and a stronger visual border.
- A separate arrow collapses or expands details without removing the enterprise.
- Unticking the tile removes its allocation and releases land and cash.
- Keep unselected tiles compact.
- Do not show every enterprise’s detailed controls in a long initial scroll.

Groundnuts must be especially unambiguous: display **Groundnut package selected** when active.

### Resource-constrained controls

Sliders must stop at the largest feasible quantity under the current plan.

Show the limiting resource, such as:

- **Cash limit reached**
- **Land limit reached**
- **Boundary limit reached**

Do not allow the farmer to create an unaffordable plan and only discover the problem at the end.

Where a prototype operational cap applies, label it separately from a land or cash limit.

## 7. Enterprise assumptions

### 7.1 Maize

| Input per acre per season | Quantity | Unit cost | Total |
|---|---:|---:|---:|
| Seed bags | 5 | KES 850 | KES 4,250 |
| DAP bag | 1 | KES 6,000 | KES 6,000 |
| CAN, 50 kg bag | 1 | KES 3,000 | KES 3,000 |
| **Total** | | | **KES 13,250** |

- Yield: 20 bags per acre per season.
- Bag weight: 90 kg.
- Maize value: KES 3,000 per bag.
- Household-required maize is retained for food.
- Additional maize is assumed sold at the same indicative price.
- If short rains are selected, apply the same area, yield and input cost again.
- Keep maize land separate from the groundnut package.

### 7.2 Groundnuts

One supported quarter-acre package in the long rains only.

| Assumption | Value |
|---|---:|
| Area | 0.25 acre |
| Inputs and financing | KES 6,500 |
| Expected harvest | 150 kg |
| Estimated purchase price | KES 145/kg |
| Gross proceeds | KES 21,750 |
| Payment after input deduction | KES 15,250 |

Inputs cover seed, fertiliser, agricultural gypsum and Aflasafe, including financing.

- Deduct the input value from aggregation proceeds.
- No immediate own-cash payment for the package is modelled.
- Do not allow additional supported groundnut acreage.
- Do not offer a short-rains package.
- Labour and other farmer-paid costs are excluded.

### 7.3 Avocado

- Seedling price: **KES 75**.
- Purchase price: **KES 30/kg**.
- No harvest in years one and two.
- Year three: **40 kg per surviving tree**.
- Year four: **50 kg**.
- Year five onwards: **60 kg annually**.
- Mature gross annual proceeds: **KES 1,800 per surviving tree**.

### 7.4 Mango

- Seedling price: **KES 20**.
- Purchase price: **KES 20/kg**.
- No harvest in years one and two.
- Year three: **75 kg per surviving tree**.
- Year four: **90 kg**.
- Year five onwards: **100 kg annually**.
- Mature gross annual proceeds: **KES 2,000 per surviving tree**.

### 7.5 Fruit-tree survival and land allowances

Apply **70% survival to newly planted fruit trees**.

Reserve land for all seedlings planted, rather than using expected mortality to create additional available planting space.

Agreed simplified mature-space allowances:

| Species | Area per tree |
|---|---:|
| Avocado | 64.8 m² |
| Mango | 80 m² |

These are 80% of the researched area allowances of 81 m² and 100 m² respectively. The reduction applies to area, not to each planting-distance dimension.

These are MVP planning assumptions, not final agronomic spacing recommendations.

### 7.6 Grevillea timber

Offer:

- Boundary planting; or
- A dedicated woodlot.

Assumptions:

- First **50 seedlings free each year**, subject to available space.
- Additional seedlings: **KES 5 each**.
- New-tree survival: **70%**.
- Boundary spacing: **5 metres**.
- Woodlot spacing: **3 × 3 metres**, or 9 m² per planted seedling.

Model only this year’s planting cohort. Do not automatically add future annual free allocations.

For boundary trees, the current simplified prototype limits numbers using perimeter but does not deduct crop area or model shading and root competition. This is an explicit simplification requiring agent judgement.

#### Timber sale value

Use the owner-agreed illustrative values below, per surviving tree:

| Age | Potential one-off sale value |
|---|---:|
| Year 5 | KES 1,500 |
| Year 6 | KES 2,200 |
| Year 7 | KES 2,900 |
| Year 8 | KES 3,600 |
| Year 9 | KES 4,300 |
| Year 10 | KES 5,000 |

This is a straight-line increase of KES 700 annually from year five.

- Show how retaining the trees could increase their sale value.
- Explain the trade-off: a longer wait for cash.
- Treat the values as alternative one-off harvest outcomes.
- Never add the year-five and year-ten values together.
- After harvesting, that cohort has no further standing-tree value.
- These owner-set values supersede the lower historical research estimates; they are not verified buyer quotations.

Example: 50 planted seedlings × 70% survival = 35 expected surviving trees, worth an illustrative KES 52,500 at year five or KES 175,000 at year ten.

### 7.7 Chickens

- Buy chicks at six weeks old.
- Purchase price: **KES 150 per chick**.
- Sell from three months of age.
- Sale price: **KES 550–600 per surviving bird**.
- Mortality: **10%**.
- No additional rearing costs are included.

Let the farmer choose the number of chicks and number of batches.

The current prototype allows up to 100 chicks per batch and one to six sequential batches per year. These are implementation caps, not validated farm carrying-capacity recommendations.

- Reserve cash for the first batch.
- Assume subsequent batches are funded from previous sales.
- Include the purchase cost of every batch in annual returns.
- Do not assume that scavenging capacity has been assessed.

Example: 10 chicks cost KES 1,500. Nine expected survivors generate KES 4,950–5,400, leaving KES 3,450–3,900 after chick purchase costs.

## 8. Calculation rules

### Definitions

- One acre = 4,046.8564224 m².
- S = 1 maize season, or 2 if short rains are selected.
- B = annual household maize bags.
- M = total maize acres, including extra maize.
- E = extra maize acres above the household minimum.
- C = cash available now.
- L = eligible long-rains staple-credit ceiling.
- A and G = new avocado and mango seedling counts.
- T = new Grevillea seedling count.
- N = chicks per batch.
- K = chicken batches per year.

### Land

Minimum family-maize area = B ÷ (20 × S).

Existing fruit area = (existing avocado count × 64.8 + existing mango count × 80) ÷ 4,046.8564224.

New fruit area = (A × 64.8 + G × 80) ÷ 4,046.8564224.

Woodlot area = T × 9 ÷ 4,046.8564224.

Available acres = field acres − maize acres − existing fruit area − new fruit area − woodlot area − selected groundnut area.

Boundary-tree maximum = floor(field perimeter ÷ 5).

### Funding

Long-rains maize input cost = M × KES 13,250.

Staple borrowing = minimum(long-rains maize input cost, L).

Tree establishment purchase cost = A × 75 + G × 20 + maximum(T − 50, 0) × 5.

Cash needed to start = long-rains maize inputs − staple borrowing + tree purchase cost + N × 150.

Hard cash constraint: cash needed to start must not exceed C.

Short-rains input cost = M × KES 13,250 if selected. Show it as later funding assumed to come from long-rains proceeds, rather than an upfront cash reservation.

### Annual returns

Retained food value = B × KES 3,000.

Extra maize sales = E × 20 × S × KES 3,000.

Chicken sales range = N × 90% × K × KES 550–600.

Annual listed costs include:

- All selected maize-season inputs.
- Groundnut inputs and financing.
- Purchases for all chicken batches.
- This year’s new fruit and timber seedling purchases.

Cash return after listed costs = cash sales − annual listed costs.

Annual benefit after listed costs = cash return after listed costs + retained food value.

Credit must not be counted as income, nor its principal deducted a second time after the financed input cost is already included.

### Future trees

New-fruit proceeds = planted seedlings × 70% × age-based yield × price.

Existing-fruit proceeds = existing living trees × yield at their projected age × price.

Timber value = planted Grevillea seedlings × 70% × selected age-specific sale value.

Future fruit proceeds are annual gross sales. Timber values are alternative one-off asset-sale values. Do not combine them into a misleading recurring-income figure.

## 9. Visual results

### Field allocation

Keep the field outline and coloured proportional sections prominent.

Show:

- Maize.
- Existing fruit trees.
- New fruit trees.
- Timber woodlot.
- Groundnuts.
- Remaining available land.

Indicate boundary timber separately around the outline.

Sections represent allocation proportions, not exact planting positions. No drag-and-drop crop placement or orchard positioning is required.

### Rolling totals

Keep a persistent bottom strip visible while choosing and reviewing:

1. **Annual benefit**
2. **Cash needed to start**
3. **Acres available**

Clarify that annual benefit includes retained food value. Keep actual cash return available in the result details.

### Current year and future

Use simple **This year** and **Future** views.

Keep detailed costs and assumptions collapsible rather than permanently expanded.

## 10. Review and alternatives

Do not interrupt the initial choices with suggestions.

After **Review my plan**:

- Present up to three feasible alternatives.
- Show the change in current annual benefit.
- Show the change in cash needed to start.
- Show the change in future annual fruit proceeds.
- Show any change in future one-off timber value.
- Preserve food-security land and funding.
- Respect land, boundary and cash limits.
- Do not force three alternatives when fewer are feasible.

Possible alternatives include:

- Swapping some newly planned trees for extra maize.
- Adding the quarter-acre groundnut package if space permits.
- Adding affordable chicks.
- Swapping some extra maize for fruit trees.
- Keeping more cash uncommitted.

Do not suggest removing existing trees as though they were unplanted seedlings.

Applying an alternative updates the field and rolling totals. The farmer can return to choices or select **I’m happy with this plan**.

## 11. WhatsApp picture and summary

Generate one shareable PNG picture containing:

- Tupande branding.
- Zone and field size.
- Coloured field-allocation diagram and legend.
- Selected enterprises and quantities.
- Household maize requirement.
- Annual benefit and retained-food value.
- Cash return after listed costs.
- Cash needed to start.
- Credit and groundnut deductions.
- Future fruit proceeds and alternative timber values.
- Concise assumptions and exclusions.

Prepare a short accompanying text summary.

### Sharing behaviour

- On supported devices, use native sharing to send the picture and text together; the farmer selects WhatsApp.
- If file sharing is unsupported, download the picture and provide a WhatsApp link with the prepared text.
- Explain that the downloaded picture must then be attached manually.
- Also provide a direct picture-download action.
- Do not silently fall back to text-only sharing while claiming that an image was attached.
- Exclude exact GPS coordinates from the shared report.
- Do not automatically send messages or select recipients.

## 12. Tupande branding

Use the supplied Tupande brandbook and official logo assets.

Primary brand colours:

- Kakamega Green: #2B7F68
- Binzari Yellow: #E8B757
- Rondo Teal: #2F6067

Typography:

- Georama for headings.
- Source Sans Pro for digital body text.

Use friendly, plain language, large touch targets and readable labels. Do not recreate or distort the logo.

Brand reference: https://drive.google.com/file/d/1_HR-VC9dRPCs-DK2X1nnKr8rSszv7qLO/view

## 13. Explicit exclusions and limitations

The MVP does not include:

- Automated field-boundary detection.
- Land ownership verification or survey-grade measurement.
- Exact crop or tree positioning.
- A complete current-state farm income assessment.
- Labour, transport, harvesting, maintenance or other unlisted farmer-paid costs.
- Detailed cash-flow timing or food stocks between harvests.
- Guaranteed future short-rains funding.
- Poultry housing, feed sufficiency or carrying-capacity assessment.
- Repeated annual tree-planting cohorts.
- Tree–crop competition modelling.
- Inflation, discounting or a full net-present-value model.
- Live commodity prices or formal buyer quotations.
- Order placement, credit approval, payment collection or actual loan processing.
- Multi-zone product catalogues.
- A central farmer database.

Use **estimated return after listed costs**, not an unqualified claim of net profit.

## 14. Acceptance criteria

### Entry and editing

- GPS is the primary field entry route; Walk the corners is the default method.
- A walked corner is saved only at 10 m GPS accuracy or better, and the size is shown with a margin.
- Stepping out the sides is hidden until requested or location is unavailable.
- Cash and customer year are collected on the first page.
- Numeric fields can be cleared and replaced without minimum values being reinserted while typing.
- Field confirmation persists into the planning flow.

### Financial and land controls

- Customer credit increases correctly to a maximum of KES 30,000.
- Staple credit cannot finance trees or chickens.
- Groundnut financing remains separate.
- Family food has both land and funding hard stops.
- Short-rains costs affect annual returns but are excluded from the upfront cash cap.
- Optional sliders cannot exceed available land or cash.
- Unticking an enterprise releases its resources.
- Credit and input costs are counted once.

### Simplicity and review

- Existing-tree questions are hidden behind a yes/no question.
- Optional enterprise details are collapsed until selected.
- Groundnuts have an unmistakable selected state.
- Minimum family maize stays locked.
- Rolling totals remain visible.
- Suggestions appear only after review.
- Every suggested alternative passes the same resource constraints.
- The farmer can keep their plan without accepting any suggestion.

### Sharing

- The generated picture includes the actual proportional field layout and current plan values.
- Native sharing includes the image where supported.
- The fallback clearly explains manual image attachment.
- Exact coordinates are excluded.
- Shared reports label estimates and cost exclusions.

## 15. Reference sources

These sources informed the planning assumptions; they do not validate every owner-set commercial figure:

- KALRO avocado guidance: https://navcdp.kalro.org/docs/avocado/Climate%20Smart%20Agronomic%20Practices%20for%20Avocado.pdf
- AFA mango guidance: https://www.afa.go.ke/download/3006/?tmstv=1744263838
- World Agroforestry Grevillea guidance: https://apps.worldagroforestry.org/treedb/AFTPDFS/Grevillea_robusta.PDF
- One Acre Fund tree-programme evaluation, Laterite, 2021: https://www.laterite.com/wp-content/uploads/2022/06/One-Acre-Fund-grevillea-project-Endline-findings-report-October-2021.pdf

The agreed seedling prices, crop purchase prices, yields, credit ceilings, survival assumptions and revised timber valuation are product-owner inputs for this MVP.

