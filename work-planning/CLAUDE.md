# Work Planning prototype (Asili field cascade)

Single-file HTML prototype. `node build.js` stitches src/template.html + style.css + engine.js + app.js into work-planning.html. `node test.js` runs the engine tests. No dependencies.

## Rules that must hold
- All data is generated (engine.js generateData, hashRng for deterministic history). Never present it as real. Keep the "made-up data" label.
- Hierarchy is always Region > Area > Zone > Territory. Each TA holds one territory; screens name the territory first and the TA second.
- DRMs are treated as RMs. YFOs are excluded. Duka Assistants (DAs, 2 per zone) are a separate branch under the ZS, beside the territories.
- Order of work in the engine: (1) per TA and priority: requirement, delivered, pace line, distance (calcTA); (2) share a zone gap among TAs who are behind for season targets (allocateZone); (3) areas and zones are sums of TA numbers (aggregate); (4) only then turn each TA's ask into hours (planTA): weights over unmet priorities, spare hours to ageing check-ins.
- Score = per TA min(1, delivered / pace-line expectation), weighted by the RM's weights over the priorities that unit is accountable for. Bands: on track >= 95, slipping >= 82, behind >= 60, critical < 60.
- Duka pillar priorities are owned by Duka Assistants. Every region has one by default. A DA gets a score and a week plan from the duka priorities only. A territory's score and plan exclude them; zone, area and region include them at the RM's weight.
- "Met target" for areas, zones and territories = 95% of the pace line on every priority the unit is accountable for.
- AC (area) and ZS (zone) may change weights only: +/-20 points, total 100, reason required, approved one level up. Scores stay on the RM's weights.
- Roles: Viewing as RM / AC / ZS / TA / DA scopes every view; priorities are read-only below the RM.
- Keep it simple: each role has one home (RM/AC/ZS: their unit with priorities and the units below it, lowest first; TA/DA: My week). Main nav is Home, Priorities, Plans to approve; everything else sits under More. Answer first in plain words, reasons inside "How is this worked out?".

## Files
- src/engine.js: window.WP (METRICS, PILLARS, generateData, calcTA, computeRegion, aggregate, planTA, focusOf, reviewUnit, history, histUnit, weekCheck).
- src/app.js: state S, scope helpers (sreg, sres, scopeIds), simple views (viewHome, unitCard, prioList, childList, territoryHome, daHome, viewPrioMerged), detailed views under More, approval workflows (browser state only).
- src/style.css: tokens (light and dark), components.
