# Work Planning prototype (Asili field cascade)

Single-file HTML prototype. `node build.js` stitches src/template.html + style.css + engine.js + app.js into work-planning.html. `node test.js` runs the engine tests. No dependencies.

## Rules that must hold
- All data is generated (engine.js generateData, hashRng for deterministic history). Never present it as real. Keep the "made-up data" label.
- DRMs are treated as RMs. YFOs are excluded. DAs are a separate branch under the ZS. Duka Officers (2 per zone) are a separate branch under the ZS.
- Order of work in the engine: (1) per TA and priority: requirement, delivered, pace line, distance (calcTA); (2) share a zone gap among TAs who are behind for season targets (allocateZone); (3) areas and zones are sums of TA numbers (aggregate); (4) only then turn each TA's ask into hours (planTA): weights over unmet priorities, spare hours to ageing check-ins.
- Score = per TA min(1, delivered / pace-line expectation), weighted by the RM's weights over the priorities that unit is accountable for. Bands: on track >= 95, slipping >= 82, behind >= 60, critical < 60.
- Duka compliance is owned by Duka Officers. A TA's score, plan and scorecards exclude it; zone, area and region include it at the RM's weight.
- "Met target" for areas, zones and territories = 95% of the pace line on every priority the unit is accountable for.
- AC (area) and ZS (zone) may change weights only: +/-20 points, total 100, reason required, approved one level up. Scores stay on the RM's weights.
- Roles: View as RM / AC / ZS / TA scopes every tab; priorities are read-only below the RM.

## Files
- src/engine.js: window.WP (METRICS, PILLARS, generateData, calcTA, computeRegion, aggregate, planTA, focusOf, reviewUnit, history, histUnit, weekCheck).
- src/app.js: state S, scope helpers (sreg, sres, scopeIds), views, approval workflows (browser state only).
- src/style.css: tokens (light and dark), components.
