// Movement / hierarchy tests for the road roller model. Run: node tests/roller.test.js
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
eval(fs.readFileSync(path.join(__dirname, '..', 'assets', 'models', 'roller.js'), 'utf8'));
var model = window.MODELS.roller;
var buf = Buffer.from(model.data, 'base64');
var ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

// build nodes like GLX.loadModel, but keep vertex positions instead of GPU buffers
var root = new SceneNode('roller'), byName = {};
model.parts.forEach(function (p) {
  var n = new SceneNode(p.name);
  n.pivot = p.pivot || [0, 0, 0]; n.axis = p.axis || null; n.limits = p.limits || null;
  n.positions = new Float32Array(ab, p.position, p.vertexCount * 3);
  (p.parent ? byName[p.parent] : root).add(n);
  byName[p.name] = n;
});

var rear = byName.rear_frame;
var front = byName.front_frame;
var drum = byName.drum;
var wheelL = byName.wheel_l;
var wheelR = byName.wheel_r;

check('all parts exist', !!rear && !!front && !!drum && !!wheelL && !!wheelR);
if (!rear || !front || !drum || !wheelL || !wheelR) {
  console.log('FAILED roller: ' + failures + '/' + total);
  process.exit(1);
}

// Check hierarchy
check('rear_frame is child of roller root', rear.parent === root);
check('wheel_l is child of rear_frame', wheelL.parent === rear);
check('wheel_r is child of rear_frame', wheelR.parent === rear);
check('front_frame is child of rear_frame', front.parent === rear);
check('drum is child of front_frame', drum.parent === front);

// Check joint axes
check('front_frame has vertical articulation axis', front.axis && near(front.axis[0], 0, 1e-6) && near(front.axis[1], 1, 1e-6) && near(front.axis[2], 0, 1e-6));
check('drum has horizontal rotation axis', drum.axis && near(drum.axis[0], 0, 1e-6) && near(drum.axis[1], 0, 1e-6) && near(drum.axis[2], -1, 1e-6));
check('wheel_l has horizontal rotation axis', wheelL.axis && near(wheelL.axis[0], 0, 1e-6) && near(wheelL.axis[1], 0, 1e-6) && near(wheelL.axis[2], -1, 1e-6));
check('wheel_r has horizontal rotation axis', wheelR.axis && near(wheelR.axis[0], 0, 1e-6) && near(wheelR.axis[1], 0, 1e-6) && near(wheelR.axis[2], -1, 1e-6));

// Check rest pose world positions and ground contact
var world = new SceneNode('world');
WORLD.build(world, { roller: root });
world.updateWorld(null);

var drumOrigin0 = drum.worldOrigin();
var rearOrigin0 = rear.worldOrigin();
var drumLowestY = drumOrigin0[1] - 0.75; // radius 0.75
var wheelLowestY = wheelL.worldOrigin()[1] - 0.75; // radius 0.75
check('drum and wheels touch ground at y=0', near(drumLowestY, 0, 0.05) && near(wheelLowestY, 0, 0.05),
  'drum y=' + drumLowestY.toFixed(3) + ', wheel y=' + wheelLowestY.toFixed(3));

// Check movement update: simulate driving for 1 second
var DRUM_RADIUS = 0.75;
var startDist = drum.worldOrigin()[0];
var startAngle = drum.angle;

WORLD.update(1.0, 1.0, { keys: {} });
world.updateWorld(null);

var endDist = drum.worldOrigin()[0];
var endAngle = drum.angle;
var movedDist = Math.abs(endDist - startDist);
var rotAngle = Math.abs(endAngle - startAngle);

check('drum angle = distance / radius', near(rotAngle, movedDist / DRUM_RADIUS, 1e-3),
  'rotAngle=' + rotAngle.toFixed(4) + ', expected=' + (movedDist / DRUM_RADIUS).toFixed(4));

check('wheel_l angle = distance / radius', near(Math.abs(wheelL.angle), movedDist / DRUM_RADIUS, 1e-3));
check('wheel_r angle = distance / radius', near(Math.abs(wheelR.angle), movedDist / DRUM_RADIUS, 1e-3));

// Check that children follow the frame when the roller moves
var rearOrigin1 = rear.worldOrigin();
check('rear_frame moved with the roller', !near(rearOrigin1[0], rearOrigin0[0], 1e-3));
check('drum followed rear frame movement', near(endDist - startDist, rearOrigin1[0] - rearOrigin0[0], 1e-3));

// Articulation angle limit check
if (front.limits) {
  front.setAngle(10.0);
  check('front articulation respects limits', front.angle <= front.limits[1] + 1e-6 && front.angle >= front.limits[0] - 1e-6);
  front.setAngle(0);
}

if (failures) { console.log('FAILED roller: ' + failures + '/' + total); process.exit(1); }
console.log('OK roller: ' + total + ' tests');
