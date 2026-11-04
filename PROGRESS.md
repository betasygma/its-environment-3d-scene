# Progress

## Decisions
- Scope: Zoomlion excavator (hero), yellow road roller, blue drums; gravel, trees, building as backdrop.
- Excavator geometry: Meshy AI model (`*.glb`) imported by `tools/import_glb.py` (decimated 2.26M -> 450k tris,
  texture kept at 4096). Everything else: CadQuery -> `tools/export.py`.
- Articulation: **level 2** = excavator drives/turns as a whole, upper body slews on the tracks.
  Level 3 (boom/stick/bucket) is backlog card B9.
- Textures: Meshy colour map (4096 JPEG); procedural textures from `tools/build_textures.py`. All embedded as
  data URIs so the page works from file://.
- Lighting target: dusk (low warm sun + ambient), matching the reference photos.
- Model routing: strong model = architecture/engine/kinematics/review; mid = modelling, scenes, page; small = checks, tweaks.

## Done
- Phase 0: pipeline round trip (CadQuery -> export -> WebGL), checks proven to catch broken winding, missing
  triangles, shader errors, missing/blank textures.
- Excavator import: measured from the raw mesh — scale 3.92 m/unit (3.85 from track length, 4.00 from width),
  cut between tracks and upper body 0.93 m above ground, slew axis at the track centre. Ground = bottom of the tracks.
  Result: width 2.75 m (sheet 2.80), track length 4.25 m (sheet 4.18). Seam checked visually at 63° slew: clean.
- Movement: W/S drive, A/D turn, Q/E slew (src/world.js), proven by tests/excavator.test.js.
- Handoff package: AGENTS.md, BACKLOG.md, docs/BRIEF.md, SETUP.md, tools/check_all.py.
- Excavator re-import after the human's visual review (2026-11-04). The first import looked crumpled: (1) the shader
  flipped normals on back faces and the importer recomputed normals from winding, but ~15% of Meshy triangles face
  inward -> dark triangle patches; (2) 167k tris smeared the texture at UV seams. Fix: Meshy's own normals, no
  back-face flip, 450k tris, 4096 texture (model JS 22 MB, texture 4 MB). New guards: opposing-normals check
  (old model 1.1%/3.9%, new 0.00%, limit 0.2%) and tests/shading.test.js.
- Render check made reliable: it waited on Chrome's virtual clock, which can run out before textures decode
  (it failed every time once the roller and props were added). Now waits in real time.
- Encoding check added to check_all after an agent editor corrupted em dashes / box-drawing characters.

## Known limitations
- The Meshy bucket hangs ~5 cm below the tracks, so it sinks slightly into the ground (invisible from normal views).
- Tracks are part of the fused mesh: individual track links cannot animate (fine for level 2).
- Exporter: a CadQuery sphere showed 2 non-watertight seam edges; boxes and cylinders are fine. Watch for it in B3/B4.
- Ground colour looks brownish under the warm sun; the real site is near-white limestone (BACKLOG B11/B5).
- Building, roller and trees are low-fidelity compared with the photos (BACKLOG B11).
- Page load is a few seconds slower: the excavator data is ~26 MB of embedded JS (could be packed to ~15 MB later).

## Log (one line per finished card)
- B3 (Road roller): CadQuery builder with articulated yoke and rotating drum/wheels, placed in world.js, 17/17 Node tests passing, check_all 11/11 OK.
- B4 (Site props and backdrop): blue oil drums, gravel & dirt piles, 3 trees, and white building backdrop box with procedural facade texture; props total 2920 tris (well under 60k limit), check_all 13/13 OK.
- B7 (Excavator auto animation): looping work cycle (drive forward, pause, slew 90 deg, pause, slew back, drive back), auto/manual toggle on WASD/QE or Space, on-screen mode label, 19 tests passing, check_all 13/13 OK.
- B6 (Camera presets): ~~claimed done~~ REOPENED on review: presets exist only as config + docs, no code reads them; keys do nothing. See BACKLOG B6.
- B2 (Object relationship tree): tools/scene_tree.js generated docs/scene_tree.svg from live scene graph with joint classifications, 24 unit tests verifying all nodes present, check_all 14/14 OK.
