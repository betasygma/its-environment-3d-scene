# AGENTS.md — start here

Tugas 2 Grafkom (ITS): a WebGL scene of a real place near ITS — a Zoomlion excavator at a road
construction site, with a road roller, drums, gravel, trees and a building. Raw **WebGL 1, no
libraries**. Graded on complexity, likeness to the real photos, lighting, texture, and the team's
ability to explain the code and solve a live challenge — so keep code plain and commented.

## Read in this order, and only what your task needs
1. `CONVENTIONS.md` — frozen rules (units, axes, matrices, file:// constraint). Always.
2. `BACKLOG.md` — pick ONE card; it lists the files you may touch and the checks that define "done".
3. `ENGINE_API.md` — how to use the engine. Read this instead of `src/*.js`.
4. `docs/BRIEF.md` — the assignment and its checklist (only for page/deliverable work).
   `docs/HANDOFF_SITE.md` — full spec for cards B12a-B13 (site ground, rubble, vegetation, backdrop, sky).
5. `PROGRESS.md` — decisions so far. Append a line when you finish a card.

**Never read** generated files: `assets/models/*.js`, `assets/textures*.js`, the `.glb`, `node_modules/`.
They are megabytes of base64 and will burn your context.

## Directory map
```
index.html            the page (canvas + scene config); open by double-clicking
src/                  engine: math, scene graph, GL helpers, shaders, main loop  (frozen-ish)
src/world.js          scene layout + movement  <- most scene/animation work happens here
builders/*.py         CadQuery models (Z-up, metres, pivot at origin) -> tools/export.py
spec/                 machine dimensions, import settings (frozen)
tools/                export / import / texture / check scripts
tests/                Node tests (no browser)
assets/               GENERATED models and textures (embedded JS)
scene/                the team's reference photos of the real site (do not modify)
docs/                 assignment brief, handoff specs, previews for the human (docs/previews/)
*.glb                 Meshy source model of the excavator (input to tools/import_glb.py)
```

## One command to verify everything
`python3 tools/check_all.py` — runs every check and prints one line each plus a summary.
A card is done only when it passes. Re-export or re-import only the models your card changed.

## Rules
- Touch only the files your card lists. Do not edit frozen files (CONVENTIONS.md lists them) or
  loosen any tolerance/threshold — stop and ask the human instead.
- No libraries, no `fetch`, no ES modules, no external URLs: `index.html` must work from file://.
- New geometry: a CadQuery builder in `builders/` + `tools/export.py`. Never hand-write vertex data.
- New textures: a generator function in `tools/build_textures.py` (power-of-two sizes).
- Hierarchy lives in the scene graph (`SceneNode` pivots/axes), never baked into vertices.
- Report results as the check lines, not prose. Do not add features nobody asked for.
- Visual changes: render a screenshot (`python3 tools/render_check.py --shot out.png`) and let the
  human judge it; do not loop on screenshots yourself.

## Model routing (if you can delegate)
- Strong model: engine/math/shader changes, the excavator arm articulation (level 3), reviews.
- Mid model (Sonnet-class): new CadQuery models, world.js scenes and animation, the main page.
- Small model (Haiku-class): running checks, colour/position tweaks, renames, doc updates.
