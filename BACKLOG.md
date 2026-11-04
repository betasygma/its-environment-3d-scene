# Backlog

Pick the first card whose status is `todo` and whose "needs" are done. One card per session.
When finished: run `python3 tools/check_all.py`, set the status to `done`, add one line to PROGRESS.md.
Cards marked **[human]** need the team; do not invent their content (names, task split, video).

Suggested order: B3 → B4 → B7 → B6 → B5 → B2 → B1 → B10, then optional B8 / B9.

---
### B3 — Road roller (CadQuery, articulated) · Sonnet · done
Goal: the yellow single-drum road roller from `scene/` photos, ~1:1 scale (about 6 m long, 2.3 m wide, 3 m to cab roof).
Parts and hierarchy: `roller` → `rear_frame` (cab, engine hood, rear wheels as children `wheel_l`, `wheel_r`)
→ `front_frame` (articulation joint, vertical axis) → `drum` (rotates about its axle).
Files: `builders/roller.py` (new), `src/world.js` (place it, animate it), `index.html` (add model + script tag).
Movement: drives back and forth along the gravel strip; drum and wheels rotate by `distance / radius` (no sliding).
Done when: export + `check_model roller` OK; a Node test `tests/roller.test.js` proves drum angle = distance / radius
and that children follow the frame; `check_all` green; screenshot for the human.

### B4 — Site props and backdrop · Sonnet (Haiku for placement tweaks) · done
Goal: blue oil drums (2–3, one lying down), gravel/limestone piles, a dirt pile, simple trees (trunk + canopy blobs)
along the edge, the white building as a backdrop box with a window texture. Match the photos' layout loosely.
Files: `builders/props.py` (new, one model with several root parts) and/or `builders/trees.py`, `tools/build_textures.py`
(new texture functions only), `src/world.js`, `index.html`.
Done when: exports OK, `check_all` green, total triangles for props ≤ 60k, screenshot for the human.

### B7 — Excavator auto animation · Sonnet · done · needs: none
Goal: a looping scripted work cycle (drive forward, stop, slew left 90°, pause, slew back, drive back) that plays by
default; any W/A/S/D/Q/E key switches to manual, `Space` toggles back to auto. Show the current mode in a small
on-screen label.
Files: `src/world.js` only.
Done when: `tests/excavator.test.js` still passes; add tests for the cycle (positions at given times, slew limits
respected, seamless loop: state at t = period equals t = 0).

### B6 — Camera presets · Sonnet · done
Goal: number keys 1–4 jump to views matching the four reference photos (front, rear-quarter, side, three-quarter);
`F` toggles a follow camera behind the moving excavator; orbit remains the default.
Files: `src/main.js` (camera section only), `index.html` (preset values in SCENE_CONFIG), `docs/` note of the keys.
Done when: `check_all` green; screenshots of presets 1–4 for the human to compare with the photos.

### B5 — Lighting polish (dusk) · Opus or Sonnet · todo
Goal: match the photos' late-afternoon light: sky gradient background (full-screen quad, not just clearColor), sun
low and warm from behind the trees, slightly hazy distance fog, ambient tuned so dark parts keep detail.
Optional stretch: shadow mapping (Opus — new shader pass + depth texture via WEBGL_depth_texture).
Files: `src/shaders.js`, `src/main.js` (draw section), `index.html` (light values).
Done when: `check_all` green (render check must still pass); before/after screenshots for the human.

### B2 — Object relationship tree (deliverable f) · Sonnet · done · needs: B3, B4
Goal: generate the tree from the live scene graph, never by hand: a Node script `tools/scene_tree.js` that loads the
models + `src/world.js` exactly like the tests do, walks `world`, and writes `docs/scene_tree.svg` (boxes + lines,
joint type under each node: fixed / slew / drive / rolling). The page embeds the SVG.
Done when: SVG regenerates deterministically; a test fails if a node in the scene is missing from the SVG.

### B1 — Main page (deliverables a, c, d, e, f, task split) · Sonnet · todo · needs: B2 · **[human] inputs**
Goal: `index.html` becomes the submission page: group name, the real photos from `scene/` next to the canvas (canvas
beside the photo it should resemble — the grading looks at likeness), the real video, the tree SVG, the task
division, and a short controls legend. Keep the canvas large; page must still work from file://.
Placeholders for human input: `<!-- HUMAN: group name -->`, `<!-- HUMAN: video file -->`, `<!-- HUMAN: task split -->`.
Files: `index.html`, a small `src/page.css` if needed. Do not touch the engine.
Done when: `check_all` green (render check now runs on the canvas inside the page), screenshot for the human.

### B10 — Demo explanation pack · Opus · todo · needs: most cards done
Goal: `docs/EXPLAIN.md` in Bahasa Indonesia: for each graded concept (transformasi, kamera, lighting, texture,
hierarchical modelling, animasi) — the idea in 3–5 sentences, the exact file/function that implements it, and how to
change it live. Plus 10 likely "challenge" requests (e.g. change light colour, add a light, make the drum spin
faster, add a child object, rotate the cab) with the minimal edit for each.
Done when: the human has walked through it once with the agent.

---
### B8 — Normal mapping for the excavator (optional) · Opus · todo
The Meshy GLB has a normal map (image index 2). Needs tangents (compute in `tools/import_glb.py`), a TBN in the
shader, and the map embedded like the colour texture. Improves the lighting/texture criterion. Check JS size limits.

### B9 — Level 3: articulated arm (optional) · Opus · todo
Cut the upper part further at the boom-foot, boom–stick and stick–bucket pins (measure pins in the source mesh like
`spec/import_excavator.json` was measured), replace the fused hydraulic cylinders with CadQuery barrel/rod pairs
that aim between their pins each frame. New hierarchy: upper → boom → stick → bucket. Extend `tests/excavator.test.js`
with forward-kinematics checks. Biggest risk item — do it on a branch / copy.

---
### H — Human-only
- H1 Film the real excavator (video for deliverable d) and put it in `scene/`.
- H2 Group name and task division (deliverables a, g).
- H3 Approve screenshots at the end of each card.
- H4 Check the course's AI-use policy and any disclosure it requires.
