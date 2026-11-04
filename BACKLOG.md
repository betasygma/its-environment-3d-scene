# Backlog

Pick the first card whose status is `todo` and whose "needs" are done. One card per session.
When finished: run `python3 tools/check_all.py`, set the status to `done`, add one line to PROGRESS.md.
Cards marked **[human]** need the team; do not invent their content (names, task split, video).

**"Done" means proven.** Every behaviour a card claims (a key, a movement, a placement) needs a test that FAILS
without it. Config values and docs alone are not an implementation. Before marking done, re-read the card's
"Done when" and check each item exists in code, not only in config or docs. (B6 was once marked done with no code.)
Write source files as plain UTF-8; prefer ASCII (`-` not `—`, `+--` not `├──`): some editors here corrupt other characters.

Suggested order: B6 → B12a → B12b → B12c → B13 → B11 → B5 → B1 → B10, then optional B8 / B9. (B2, B3, B4, B7 done.)

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

### B6 — Camera presets · Sonnet · todo (reopened 2026-11-04)
**Reopened:** it was marked done, but only the preset values (`SCENE_CONFIG.cameraPresets` in index.html) and
`docs/CAMERA.md` exist — no code reads them, so keys 1–4 and F do nothing. The `shot_preset*.png` files were made with
`render_check.py --cam`, not by the feature. Keep the existing preset values and docs; implement the behaviour.
Goal: number keys 1–4 jump to views matching the four reference photos (front, rear-quarter, side, three-quarter);
`F` toggles a follow camera behind the moving excavator; orbit remains the default.
Files: `src/camera.js` (new: pure functions — preset lookup, follow-camera pose from the excavator's world matrix;
no DOM/GL so Node can test it), `src/main.js` (camera section only: wire Digit1–4 / KeyF to camera.js),
`index.html` (add the script tag), `tests/camera.test.js` (new).
Done when: `tests/camera.test.js` proves (a) each preset key yields that preset's yaw/pitch/distance/target,
(b) the follow camera stays behind the excavator when it turns (heading 0 and 90°), (c) it fails if main.js does not
call camera.js (grep the source); `check_all` green; screenshots of presets 1–4 taken WITH the keys (add a
`?preset=N` URL option in main.js for this), for the human to compare with the photos.

### B5 — Lighting polish (dusk) · Opus or Sonnet · todo
Goal: match the photos' late-afternoon light (the sky gradient itself is done in B12a): sun
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

### B12a / B12b / B12c / B13 — Make the site look like the real place · Sonnet · todo
Full spec in **`docs/HANDOFF_SITE.md`** (read it before starting any of these). Summary:
- **B12a** engine features: alpha cut-outs, unlit photo panels, "fit" UVs, dusk sky; proven by an alpha probe page.
- **B12b** `tools/photo_textures.py`: tileable textures cut from the team's photos (crops pre-verified in
  `spec/photo_textures.json`), tree-line textures with the sky removed.
- **B12c** ground zones (limestone road, leaf/rubble verges), concrete drain with a puddle, rubble heaps of
  random rocks (replaces the white cone pile).
- **B13** weed/leaf cut-out cards, a ring of 12 photo tree-line panels at 45 m, sky colours; photo comparison sheet.
Do them in that order, one per session; each has its own "Done when".

### B11 — Likeness pass on the CadQuery objects · Sonnet · todo · needs: none
The human compared the scene with the photos (`scene/*.jpg`): the excavator now matches, the rest does not yet.
- **Building:** it is a tall peach tower; the real one is a low (2-storey) white building with a flat roof and dark
  windows, far behind the site. Rebuild at realistic scale (about 7 m tall) and white facade colour.
- **Road roller:** currently stacked boxes. Real one: yellow body, open cab with a canopy roof on posts, dark steel drum
  inside a yellow frame, black rear tyres. Add the canopy, frame and tyre detail; keep the hierarchy and tests.
- **Trees:** stacked hexagons look like toys. The site trees are large rain trees with wide, flat-topped spreading
  canopies on thin trunks (several canopy lobes per tree, 8-15 m wide).
- **Ground:** handled by B12c (photo textures). Not part of this card any more.
- Trees here means the 2-3 NEAR trees; the far tree line is the B13 backdrop.
Files: `builders/props.py`, `builders/roller.py`, `tools/build_textures.py` (texture functions), `src/world.js` (positions only).
Done when: exports + geometry checks OK, roller/layout tests still pass, `check_all` green, and one screenshot per
reference photo angle beside that photo for the human (who decides when it is done).

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
