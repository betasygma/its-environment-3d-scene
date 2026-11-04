# Conventions (frozen — change only with Ibra's approval)

These rules exist because breaking any of them causes silent, compounding bugs.

## Coordinates and units
- **Units: metres** everywhere — CadQuery builders, spec, scene, shaders.
- **WebGL scene: right-handed, Y-up.** The excavator faces **+X** at rest (slew angle 0). +Z is the machine's right side.
- **CadQuery is Z-up.** Builders model in CadQuery's native frame (X forward, Y left, Z up).
  The conversion to Y-up happens in exactly ONE place: `tools/export.py`
  (`(x, y, z)_cq -> (x, z, -y)_gl`). Nothing else converts axes.
- **Angles: radians** in code and in the manifest. The spec may state degrees only in keys ending `_deg`.

## Matrices
- `Float32Array(16)`, **column-major** (what `gl.uniformMatrix4fv(loc, false, m)` expects).
  Element (row r, col c) is `m[c*4 + r]`. Translation lives in `m[12], m[13], m[14]`.
- Multiplication order: `world = parentWorld * local`; `local = T * R * S`.

## Parts and hierarchy
- Every exported part is modelled in its **own local frame with its joint pivot at the origin**.
  The parent places the child by translating to the pivot position (given in the parent's frame).
- The hierarchy lives in the WebGL scene graph (`src/scene.js`), never baked into vertex data.
- Joint axes are unit vectors in the parent frame; limits are `[min, max]` radians.

## Runtime
- **`index.html` must work by double-clicking (file://).** No `fetch`, no ES modules, no external URLs.
  Models and textures are embedded as `<script>`-loaded JS files (`assets/models/*.js`, `assets/textures.js`)
  that assign onto `window.MODELS` / `window.TEXTURES`. Textures are data URIs (file:// images would
  taint WebGL).
- **WebGL 1**, no libraries. CadQuery parts use `Uint16` indices (exporter fails above 65535 vertices).
  Imported (Meshy) parts may use `Uint32` (`indexType: "u32"`, via `OES_element_index_uint`).
- Imported parts are `doubleSided`: drawn without back-face culling and lit ONLY by their stored smooth normals
  (Meshy's own). Never flip normals with `gl_FrontFacing` and never recompute them from triangle winding: ~15% of
  Meshy's triangles are wound inward, and either of those turns the excavator into dark/light triangle patches.
  Guarded by `tests/shading.test.js` and the opposing-normals check in `tools/import_glb.py --check`.
  CadQuery parts are closed and outward-facing (culled).

## Two geometry sources
- **CadQuery** (`builders/*.py` → `tools/export.py`): everything new — road roller, props, pins, cylinders.
- **Meshy import** (`*.glb` → `tools/import_glb.py`, settings in `spec/import_excavator.json`): the excavator only.
  Its cut into parts was measured by hand; re-measure before changing it.

## Files agents must not edit without approval
`CONVENTIONS.md`, `spec/*.json`, `src/math.js`, `src/scene.js`, existing tests in `tests/` (adding new tests is fine),
thresholds in `tools/check_*.py`, `tools/import_glb.py` and in `SCENE_CONFIG.test`.
