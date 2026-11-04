// Guards against the 'camouflage' shading bug. Run: node tests/shading.test.js
// Meshy's triangles are wound inconsistently (~15% face inward). If the fragment shader flips the
// normal on back faces (gl_FrontFacing), neighbouring triangles get opposite lighting and the
// excavator turns into a patchwork of dark triangles. Imported parts must be lit by their stored
// smooth normals only. (Normal data itself is checked by tools/import_glb.py --check.)
var fs = require('fs'), path = require('path');
var src = fs.readFileSync(path.join(__dirname, '..', 'src', 'shaders.js'), 'utf8');
global.window = {};
eval(src + '; global.SHADERS = SHADERS;');

var failures = 0, total = 0;
function check(name, ok, detail) { total++; if (!ok) { failures++; console.log('FAIL ' + name + (detail ? ': ' + detail : '')); } }

check('fragment shader does not flip normals with gl_FrontFacing', SHADERS.litFS.indexOf('gl_FrontFacing') < 0,
  'remove the back-face normal flip; imported meshes have inconsistent winding');
check('fragment shader normalises the interpolated normal', /normalize\(vNormal\)/.test(SHADERS.litFS));

// B12a checks
check('fragment shader contains discard guarded by uAlphaCutoff', /uAlphaCutoff.*discard|discard.*uAlphaCutoff/.test(SHADERS.litFS));
check('fragment shader contains uUnlit early return', /uUnlit.*gl_FragColor.*return/.test(SHADERS.litFS));
check('SHADERS.skyVS exists', typeof SHADERS.skyVS === 'string' && SHADERS.skyVS.length > 0);
check('SHADERS.skyFS exists', typeof SHADERS.skyFS === 'string' && SHADERS.skyFS.length > 0);

if (failures) { console.log('FAILED shading: ' + failures + '/' + total); process.exit(1); }
console.log('OK shading: ' + total + ' tests');
