// Movement / hierarchy tests for the imported excavator. Run: node tests/excavator.test.js
// No browser needed: decodes assets/models/excavator.js and runs the real scene graph + world.js.
var fs = require('fs'), path = require('path');
var M = require('../src/math.js'); global.Mat4 = M.Mat4; global.Vec3 = M.Vec3;
var SceneNode = require('../src/scene.js').SceneNode; global.SceneNode = SceneNode;
var WORLD = require('../src/world.js');

var failures = 0, total = 0;
function check(name, ok, detail) { total++; if (!ok) { failures++; console.log('FAIL ' + name + (detail ? ': ' + detail : '')); } }
function near(a, b, eps) { return Math.abs(a - b) <= eps; }
function fmt(v) { return '[' + v.map(function (x) { return x.toFixed(2); }).join(', ') + ']'; }

// --- load the model file the same way the browser does ---
global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'assets', 'models', 'excavator.js'), 'utf8'));
var model = window.MODELS.excavator;
var buf = Buffer.from(model.data, 'base64');
var ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

// build nodes like GLX.loadModel, but keep vertex positions instead of GPU buffers
var root = new SceneNode('excavator'), byName = {};
model.parts.forEach(function (p) {
  var n = new SceneNode(p.name);
  n.pivot = p.pivot || [0, 0, 0]; n.axis = p.axis || null; n.limits = p.limits || null;
  n.positions = new Float32Array(ab, p.position, p.vertexCount * 3);
  (p.parent ? byName[p.parent] : root).add(n);
  byName[p.name] = n;
});
var under = byName.undercarriage, upper = byName.upper;
check('parts exist', !!under && !!upper);
if (!under || !upper) { console.log('FAILED excavator: ' + failures + '/' + total); process.exit(1); }
check('upper is child of undercarriage', upper.parent === under);
check('slew axis is vertical', upper.axis && near(upper.axis[0], 0, 1e-6) && near(upper.axis[1], 1, 1e-6) && near(upper.axis[2], 0, 1e-6));

// world-space bounding box of a part's vertices (sampled for speed)
function worldBox(node) {
  var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], p = node.positions;
  for (var i = 0; i < p.length; i += 3 * 7) {
    var w = Mat4.transformPoint(node.world, [p[i], p[i + 1], p[i + 2]]);
    for (var k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], w[k]); hi[k] = Math.max(hi[k], w[k]); }
  }
  return { lo: lo, hi: hi };
}
// the vertex of `node` farthest along +X at the current pose, in local coordinates
function extremeX(node) {
  var p = node.positions, best = -1e9, bi = 0;
  for (var i = 0; i < p.length; i += 3) if (p[i] > best) { best = p[i]; bi = i; }
  return [p[bi], p[bi + 1], p[bi + 2]];
}

// --- rest pose sanity ---
WORLD.build(new SceneNode('world'), { excavator: root });
root.updateWorld(null);
var ub = worldBox(under), xb = worldBox(upper);
check('undercarriage sits on ground', near(ub.lo[1], 0, 0.05), 'min y ' + ub.lo[1].toFixed(3));
check('slew axis near track centre', near((ub.lo[0] + ub.hi[0]) / 2, 0, 0.3) && near((ub.lo[2] + ub.hi[2]) / 2, 0, 0.15), fmt([(ub.lo[0] + ub.hi[0]) / 2, (ub.lo[2] + ub.hi[2]) / 2]));
check('upper sits above slew pivot', xb.hi[1] > upper.pivot[1] + 1.5, 'upper top ' + xb.hi[1].toFixed(2));
// arm reaches far forward (+X); counterweight stays within the 2.84 m tail slew radius behind
check('arm points forward (+X)', xb.hi[0] > 4 && xb.lo[0] > -3.2, 'upper x ' + fmt([xb.lo[0], xb.hi[0]]));

// --- slew: rotating the upper by +90 deg about +Y maps +X to -Z; tracks do not move ---
var tip = extremeX(upper);
var tipWorld0 = Mat4.transformPoint(upper.world, tip);
var underBefore = worldBox(under);
upper.setAngle(Math.PI / 2);
root.updateWorld(null);
var tipWorld1 = Mat4.transformPoint(upper.world, tip);
var r0 = [tipWorld0[0] - 0, tipWorld0[2] - 0];   // offset from the slew axis (x, z)
// rotation by +90 deg about +Y: (x, z) -> (z, -x)
check('slew rotates about the axis', near(tipWorld1[0], r0[1], 1e-3) && near(tipWorld1[2], -r0[0], 1e-3),
  'expected x=' + r0[1].toFixed(3) + ' z=' + (-r0[0]).toFixed(3) + ' got ' + fmt([tipWorld1[0], tipWorld1[2]]));
check('slew keeps height', near(tipWorld1[1], tipWorld0[1], 1e-4));
var underAfter = worldBox(under);
check('tracks unaffected by slew', near(underAfter.lo[0], underBefore.lo[0], 1e-6) && near(underAfter.hi[2], underBefore.hi[2], 1e-6));
upper.setAngle(0);

// --- driving: W for 1 s at heading 0 moves the whole machine +2 m in X (children follow) ---
var keys = { KeyW: true };
root.updateWorld(null);
var upperOrigin0 = upper.worldOrigin();
for (var i = 0; i < 10; i++) WORLD.update(0.1, i * 0.1, { keys: keys });
root.updateWorld(null);
var upperOrigin1 = upper.worldOrigin();
check('drive moves machine forward', near(upperOrigin1[0] - upperOrigin0[0], 2.0, 1e-3) && near(upperOrigin1[2], upperOrigin0[2], 1e-6),
  'moved ' + fmt([upperOrigin1[0] - upperOrigin0[0], upperOrigin1[2] - upperOrigin0[2]]));

// --- turning: heading +90 deg, then W drives toward -Z ---
root.angle = Math.PI / 2;
root.updateWorld(null);
var o0 = upper.worldOrigin();
for (i = 0; i < 10; i++) WORLD.update(0.1, i * 0.1, { keys: keys });
root.updateWorld(null);
var o1 = upper.worldOrigin();
check('drive follows heading', near(o1[2] - o0[2], -2.0, 1e-3) && near(o1[0] - o0[0], 0, 1e-3), 'moved ' + fmt([o1[0] - o0[0], o1[2] - o0[2]]));


// --- B7: auto cycle tests ---
var period = WORLD.CYCLE_PERIOD;
var p0 = WORLD.getAutoPose(0);
var pMid = WORLD.getAutoPose(5.0);
var pSlewMax = WORLD.getAutoPose(6.5);
var pLoop = WORLD.getAutoPose(period);

check('auto-cycle: start position at X=0, slew=0', near(p0.x, 0, 1e-4) && near(p0.slew, 0, 1e-4));
check('auto-cycle: drive forward reached X=3 at pause', near(WORLD.getAutoPose(3.5).x, 3.0, 1e-4));
check('auto-cycle: slew 90 deg at t=6.5', near(pSlewMax.slew, Math.PI / 2, 1e-4));
check('auto-cycle: seamless loop (t=period equals t=0)', near(pLoop.x, p0.x, 1e-4) && near(pLoop.slew, p0.slew, 1e-4));

// Test mode switching: default is auto, key switches to manual, Space toggles
WORLD.setMode('auto');
check('default mode is auto', WORLD.getMode() === 'auto');
WORLD.update(0.1, 0.1, { keys: { KeyW: true } });
check('W key switches mode to manual', WORLD.getMode() === 'manual');
WORLD.update(0.1, 0.2, { keys: { Space: true } });
check('Space toggles mode back to auto', WORLD.getMode() === 'auto');

if (failures) { console.log('FAILED excavator: ' + failures + '/' + total); process.exit(1); }
console.log('OK excavator: ' + total + ' tests');

