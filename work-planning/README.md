# Work Planning prototype

1. `cd work-planning`
2. `node test.js` (all tests should print "all passed")
3. `node build.js` then open `work-planning.html` in a browser. Commit the rebuilt `work-planning.html`: Vercel serves it as is at `/work-planning/`.

Edit files in `src/`, rebuild, reload. To continue with Claude Code, open this folder and say:

> Read CLAUDE.md. Then read the Claude Code build guide (Steps 0 to 12) and the requirements doc, and tell me what is built, what is stubbed with made-up data, and what is missing for a real pilot. Do not change anything yet.

Next real-world steps (see the requirements doc, "Data required"): replace generateData with a loader for the weekly snapshots, persist priorities and approvals in a database, add sign-in by role, and send the TA's plan by SMS or app.
