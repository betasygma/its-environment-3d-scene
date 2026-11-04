# Handoff: make the site look like the real place (cards B12a, B12b, B12c, B13)

Goal: the floor and surroundings should be recognisably the construction site in `scene/*.jpg`:
compacted white limestone road with tyre tracks, heaps of white limestone rubble, dry leaves and weeds
on the verges, a concrete drain with a puddle, a ring of large rain trees, and a pink-grey dusk sky.

Approach (chosen by the team after a feasibility check): textures cut from the team's OWN photos +
procedurally generated geometry (rocks, cards, panels). No photogrammetry, no new libraries, no external assets.

Read `AGENTS.md` and `CONVENTIONS.md` first. Do the cards **in order** — each depends on the previous one.
One card per session. Each card lists its files; touch nothing else. Plain ASCII in all source edits.

Already prepared for you (do not redo):
- `spec/photo_textures.json` — the crop boxes, checked by eye (no machines/people/litter inside), and the
  sky-removal formula, tested on both tree crops.
- `docs/previews/crops_verified.png` — what those crops look like (tree crops shown with sky -> magenta).

---
## B12a - Engine features for cut-outs, photo backdrops and sky · Sonnet with this exact spec · review: strong model

This is the only card that touches the engine. The code below is the design; implement it as written.

### 1. Exporter (`tools/export.py`): new optional part keys
| key in builder part dict | manifest field | meaning |
|---|---|---|
| `"alpha_cutoff": 0.5` | `"alphaCutoff": 0.5` | fragments with texture alpha below this are discarded (leaves, trees). Omit = 0 = opaque. |
| `"unlit": True` | `"unlit": true` | draw the texture colour as is, no lighting (photo backdrops already contain light). |
| `"uv_mode": "fit"` | (UVs only) | per SOLID in the part: find the solid's thinnest bbox axis, project its vertices onto the other two axes (GL frame: thin x -> (z, y), thin z -> (x, y), thin y -> (x, z)) and normalise each to [0, 1] over that solid's bbox. v = 0 at the bottom (lowest y) when y is used. Default `"box"` = current behaviour. |

`tessellate_part` currently loops `shape.Faces()`. For `"fit"`, loop `shape.Solids()` and their faces, remember
which solid each vertex came from, then compute UVs per solid. Keep `"box"` byte-identical (existing models must
export the same). Only write `alphaCutoff` / `unlit` to the manifest when set.

### 2. Loader (`src/gl.js`, inside `GLX.loadModel`)
```js
node.alphaCutoff = p.alphaCutoff || 0;
node.unlit = !!p.unlit;
```

### 3. Lit shader (`src/shaders.js`, `SHADERS.litFS`)
Add two uniforms and replace the albedo line:
```glsl
uniform float uAlphaCutoff;   // 0 = opaque; 0.5 for cut-out leaves / tree panels
uniform float uUnlit;         // 1 = texture colour as is (photo backdrops)
...
vec3 albedo = uBaseColor;
if (uUseTexture > 0.5) {
  vec4 tex = texture2D(uTexture, vUV);
  if (tex.a < uAlphaCutoff) discard;      // alpha test: no blending, no sorting needed
  albedo *= tex.rgb;
}
if (uUnlit > 0.5) { gl_FragColor = vec4(albedo, 1.0); return; }
```
Do NOT add any `gl_FrontFacing` normal flip (see CONVENTIONS; `tests/shading.test.js` enforces it).

### 4. Sky (`src/shaders.js` + `src/main.js`)
A second, tiny program drawn first each frame: one full-screen triangle pair in clip space, colour from the
world-space view direction, so the gradient moves correctly when the camera tilts.
```glsl
// SHADERS.skyVS
attribute vec2 aPos;                 // clip-space corners (-1..1)
uniform mat4 uInvViewProj;           // inverse(proj * view)
uniform vec3 uCameraPos;
varying vec3 vDir;
void main() {
  vec4 p = uInvViewProj * vec4(aPos, 1.0, 1.0);   // point on the far plane
  vDir = p.xyz / p.w - uCameraPos;
  gl_Position = vec4(aPos, 0.999, 1.0);
}
// SHADERS.skyFS
precision mediump float;
varying vec3 vDir;
uniform vec3 uHorizon, uZenith, uSunDir, uSunColor;
void main() {
  vec3 d = normalize(vDir);
  vec3 c = mix(uHorizon, uZenith, clamp(d.y * 1.6, 0.0, 1.0));
  c += uSunColor * 0.35 * pow(max(dot(d, normalize(uSunDir)), 0.0), 48.0);   // glow around the sun
  gl_FragColor = vec4(c, 1.0);
}
```
`main.js` draw(): after clear, if `mode !== 'test'`: `gl.disable(gl.DEPTH_TEST); gl.depthMask(false);` draw the sky,
then `gl.depthMask(true); gl.enable(gl.DEPTH_TEST);` and draw the scene as now. Per node also set
`gl.uniform1f(u.uAlphaCutoff, node.alphaCutoff || 0)` and `gl.uniform1f(u.uUnlit, node.unlit ? 1 : 0)`.
Colours in `SCENE_CONFIG.light`: `skyHorizon: [0.93, 0.80, 0.72]`, `skyZenith: [0.60, 0.66, 0.76]` (dusk, from the photos).
**The sky is skipped in `?test` mode on purpose**: the render self-check measures "drawn" pixels against the clear
colour, and a full-screen sky would make that metric meaningless.

### 5. Proof (all must exist and pass)
- `builders/probe_card.py`: one 2 m x 2 m card (thin box, 0.02 m), `uv_mode "fit"`, `alpha_cutoff 0.5`,
  texture `probe_half` (add to `tools/build_textures.py`: 64x64 RGBA, left half opaque white, right half alpha 0).
- `tests/alpha_probe.html`: loads the engine, `probe_card.js`, `textures.js`, a 3-line WORLD stub that adds the card,
  and a `SCENE_CONFIG` whose test camera looks straight at the card so it fills ~50% of the view. Add an optional
  `SCENE_CONFIG.test.drawnRange: [min, max]` check to `evaluate()` in main.js; set it so that half the card drawn
  passes and the whole card drawn (discard broken) FAILS. Disable `minTextureEffect` there.
- `tools/render_check.py`: add `--page PATH` (default `index.html`); `tools/check_all.py`: also run the probe page.
- `tests/shading.test.js`: add checks that `litFS` contains the `discard` guarded by `uAlphaCutoff`, the `uUnlit`
  early return, and that `SHADERS.skyVS/skyFS` exist. (Adding checks to this test is approved.)
- Negative proof for the report: temporarily remove the `discard` line, show the probe FAILS, restore it.
- Update `ENGINE_API.md` (new manifest fields, builder keys, sky config) and `CONVENTIONS.md` (sky skipped in test mode).
Done when: `check_all` ALL OK with the new probe render line; existing models export unchanged.

---
## B12b - Photo texture tool · Sonnet · needs B12a

New `tools/photo_textures.py` that reads `spec/photo_textures.json` and writes `assets/textures_site.js`
(`window.TEXTURES = window.TEXTURES || {}; window.TEXTURES["site_road"] = "data:...";` ...). Steps per texture:
1. Crop the box (fractions of the photo size), resize to `size` x `size` (power of two; LANCZOS).
2. If `"tile": true`:
   a. **De-light**: divide each channel by a heavy Gaussian blur of itself (sigma = size / 6) and multiply by the
      channel mean. Removes the light gradient so repeats are not obvious. Clamp to [0, 1].
   b. **Make seamless**: `out = I * m + roll(I, size/2, size/2) * (1 - m)` with `m = clip(d / (0.25 * size), 0, 1)`,
      `d` = distance to the nearest image edge. Edges then come from the image centre and wrap continuously.
   c. Save JPEG quality 85.
3. If `"alpha": "sky"`: compute alpha with the formula in the json, save as RGBA PNG (no tiling, no de-light).
4. Write `docs/previews/site_textures.png`: every tiling texture shown 2x2-tiled (so seams are visible) and every
   alpha texture over magenta. This is for the human; do not read it in a loop yourself.
`--check` mode (and add it to `check_all.py`): all sizes power of two; for tiling textures the wrap seam is no worse
than the interior (mean |col0 - col_last| <= 1.5 x the mean difference of neighbouring interior columns; same for
rows); tree textures 15-70% opaque; `textures_site.js` <= 4 MB; running the tool twice produces identical bytes.
Files: `tools/photo_textures.py` (new), `tools/check_all.py` (one line), `index.html` (one script tag).
Done when: `check_all` ALL OK; the preview sheet is ready for the human.

---
## B12c - Ground, drain and rubble · Sonnet · needs B12b

Layout (GL frame, metres; excavator works around the origin, road runs along X):
- **Ground** (`builders/ground.py`, keep the model name `ground` so other code keeps working; replace its one slab):
  `ground_road` x -50..50, z -4..4, texture `site_road`, uv_scale 0.25 · `ground_verge_n` z -50..-4, texture
  `site_leaves`, uv_scale 0.4 · `ground_verge_s1` z 4..8.0 and `ground_verge_s2` z 9.4..50 (the gap is the drain),
  texture `site_rubble`, uv_scale 0.35. Update the builder's `EXPECT` sizes.
  All slab tops at y = 0, **non-overlapping** (no z-fighting). The world grows from 40 m to 100 m because the
  backdrop (B13) stands at radius 45 m.
- **Drain** (same builder, parts `drain_wall_n`, `drain_wall_s`, `drain_floor`, `drain_water`): a concrete U-channel along
  X at z 8.0..9.4 (inner width 1.2 m, walls 0.12 m, depth 0.5 m), colour `#b9b6ae`, no texture; water plane at
  y = -0.30 inside it, texture `site_water`, uv_scale 0.5. The south verge has a gap exactly where the channel is.
- **Rubble** (`builders/rubble.py`, new model `rubble`): rocks = convex hulls of 14-24 random points
  (`scipy.spatial.ConvexHull`) in a squashed ellipsoid 0.12-0.55 m across, built as CadQuery solids
  (`cq.Face.makeFromWires(cq.Wire.makePolygon(tri, close=True))` per hull triangle -> `cq.Shell.makeShell` ->
  `cq.Solid.makeSolid`). **Orient every hull triangle outward first**: `ConvexHull.simplices` are not consistently
  wound; reverse a triangle if `dot(cross(b - a, c - a), centroid_of_triangle - centroid_of_rock) < 0`, otherwise the
  exporter's winding/volume checks fail. (Recipe verified: gives a valid closed solid.) Group rocks into parts (one compound per heap) so draw calls stay low:
  `heap_1` (~250 rocks, 4 m wide, 1.6 m high, cone-shaped stacking) beyond the drain at about (-6, 0, 12.5),
  `heap_2` (~150 rocks) at about (9, 0, 12.5), `loose_s` (~120 rocks) in the strip z 6.9..7.8 between the roller lane
  and the drain, `loose_n` (~120 rocks) along the north road edge z -4..-6 but NOT in x -4..9 (the excavator's arm
  swings over -Z there). Known lanes to keep clear: roller z 4.35..6.65 over x -11..7 (its pivot travels x -8..4); drain z 8.0..9.4.
  Texture `site_rubble`, colour `#ffffff`, uv_scale 1.0. Fixed random seed (deterministic). Each part <= 65535 vertices.
- **Props**: remove `props.gravel_pile` (the white cone) from `builders/props.py` and `src/world.js` - the rubble heaps
  replace it. Keep the dirt pile.
- Extend `tests/layout.test.js` to include the `rubble` model and the drain parts (approved): nothing may intersect
  the excavator's work cycle or the roller's lane. Move heaps rather than shrinking the margin.
- New `tests/site.test.js`: rock count per part within +-10% of the numbers above; every rock part inside the world
  (|x|, |z| < 48); total triangles of ground + rubble + vegetation + backdrop models <= 150k (read the model files).
Files: `builders/ground.py`, `builders/rubble.py` (new), `builders/props.py`, `src/world.js` (placement only),
`index.html` (model + script tags), `tests/layout.test.js`, `tests/site.test.js` (new).
Done when: exports + geometry checks OK (rocks are closed solids, so the watertight check must pass), all tests,
`check_all` ALL OK, one wide screenshot for the human.

---
## B13 - Weeds, tree-line backdrop and sky colours · Sonnet · needs B12a-c

- **Weed / leaf sprites** (`tools/build_textures.py`, new functions only): `weed_sprite` 256x256 RGBA: 25-40 tapered
  blades + a few broad leaves in greens and dry browns from the photos, transparent background. `dry_grass_sprite`
  similar, straw colours. Power of two, PNG.
- **Vegetation** (`builders/vegetation.py`, new model `vegetation`): a clump = 2 crossed cards (thin boxes 0.01 m,
  0.4-0.9 m wide, 0.3-0.8 m tall, random rotation), `uv_mode "fit"`, `alpha_cutoff 0.5`, texture alternating per part.
  About 60 clumps along the drain banks and the verge edges, merged into <= 6 parts (one compound per cluster).
  Keep clumps off the road and out of the excavator / roller areas (layout test).
- **Backdrop** (`builders/backdrop.py`, new model `backdrop`): 12 panels, each a 13 m wide x 11 m tall thin box,
  `uv_mode "fit"`, `alpha_cutoff 0.5`, `unlit True`, textures alternating `site_trees_a` / `site_trees_b`.
  Model each panel at its own origin, bottom edge 0.5 m below ground, face pointing to +X in its local frame.
  In `src/world.js` place panel i at radius 45 m, angle i * 30 deg, rotated (axis +Y) to face the scene centre.
  Hierarchy: `world -> backdrop -> panel_00..11` (shows up in the tree diagram; good to explain in the demo).
- **Sky colours** in `SCENE_CONFIG.light` (from B12a); tune only if the human asks.
- Extend `tests/site.test.js`: each backdrop panel's front normal in world space points at the origin within 10 deg;
  radius 40-50 m; all panels `unlit` with `alphaCutoff > 0`; vegetation parts all have `alphaCutoff > 0`.
- Regenerate `docs/scene_tree.svg` (`node tools/scene_tree.js`) so deliverable (f) shows the new nodes.
Files: `tools/build_textures.py`, `builders/vegetation.py`, `builders/backdrop.py` (new), `src/world.js`, `index.html`,
`tests/site.test.js`, `tests/layout.test.js` (add the vegetation model).
Done when: `check_all` ALL OK; screenshots from the four photo angles (yaw/pitch/distance from
`SCENE_CONFIG.cameraPresets`, via `render_check.py --shot ... --cam`) each placed beside its photo in ONE sheet
`docs/previews/compare_site.png` for the human, who decides when it looks right.

---
## Budgets and traps (all cards)
- Totals added by B12-B13: <= 150k triangles, <= 60 parts, `textures_site.js` <= 4 MB, new model files <= 6 MB.
  The page already carries ~26 MB of excavator data; do not make loading noticeably slower.
- Photo textures carry their own dusk lighting. If the ground looks too dark or too orange under the sun, adjust
  `SCENE_CONFIG.light.groundColor` / `skyColor` (ambient), not the photos.
- Alpha-tested cards with mipmaps thin out in the distance; that is expected. Do not switch to alpha blending
  (it needs depth sorting).
- WebGL 1: no `texture()` - use `texture2D()`; `discard` and an early `return` in `main()` are fine.
- Keep everything deterministic (fixed seeds): the tests and the tree diagram must not change between runs.
- Never read `assets/*.js`. Never edit `spec/import_excavator.json` or the excavator import.
- Previews go in `docs/previews/`, not the project root.
