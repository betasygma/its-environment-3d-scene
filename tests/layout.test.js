// Layout test: no excavator / roller / prop part may intersect another during the auto cycle.
// Run: node tests/layout.test.js   (no browser; loads the real models, world.js and scene graph)
var fs = require('fs'), path = require('path');
var M = require('../src/math.js'); global.Mat4 = M.Mat4; global.Vec3 = M.Vec3;
var SceneNode = require('../src/scene.js').SceneNode; global.SceneNode = SceneNode;
var WORLD = require('../src/world.js');

var MARGIN = 0.3;      // required clearance between part boxes, metres
var DT = 0.05;         // simulation step, seconds
var STRIDE = 5;        // use every 5th vertex for the boxes

// load a model like GLX.loadModel, but keep vertex positions instead of GPU buffers
global.window = {};
function loadModel(name) {
  eval(fs.readFileSync(path.join(__dirname, '..', 'assets', 'models', name + '.js'), 'utf8'));
  var model = window.MODELS[name];
  var buf = Buffer.from(model.data, 'base64');
  var ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  var root = new SceneNode(name), byName = {};
  model.parts.forEach(function (p) {
    var n = new SceneNode(p.name);
    n.pivot = p.pivot || [0, 0, 0]; n.axis = p.axis || null; n.limits = p.limits || null;
    n.positions = new Float32Array(ab, p.position, p.vertexCount * 3);
    (p.parent ? byName[p.parent] : root).add(n);
    byName[p.name] = n;
  });
  return root;
}

var models = {};
['excavator', 'roller', 'props', 'ground'].forEach(function (n) { models[n] = loadModel(n); });
var world = new SceneNode('world');
WORLD.build(world, models);

// every part with a mesh, tagged with its group
var parts = [];
['excavator', 'roller', 'props'].forEach(function (g) {
  models[g].traverse(function (n) { if (n.positions) parts.push({ group: g, node: n }); });
});

function worldBox(node) {
  var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], p = node.positions;
  var step = (p.length / 3 <= 60) ? 3 : 3 * STRIDE;   // tiny meshes (boxes): use every vertex
  for (var i = 0; i < p.length; i += step) {
    var w = Mat4.transformPoint(node.world, [p[i], p[i + 1], p[i + 2]]);
    for (var k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], w[k]); hi[k] = Math.max(hi[k], w[k]); }
  }
  return { lo: lo, hi: hi };
}
// smallest penetration depth of box a into box b once b is grown by the margin (<= 0 means clear)
function overlap(a, b) {
  var d = 1e9;
  for (var k = 0; k < 3; k++) {
    var o = Math.min(a.hi[k], b.hi[k] + MARGIN) - Math.max(a.lo[k], b.lo[k] - MARGIN);
    d = Math.min(d, o);
  }
  return d;
}

var pairs = [['excavator', 'roller'], ['excavator', 'props'], ['roller', 'props']];
var failures = 0, checks = 0, seen = {};
var steps = Math.ceil(2 * WORLD.CYCLE_PERIOD / DT);
for (var s = 0; s <= steps; s++) {
  var t = s * DT;
  if (s > 0) WORLD.update(DT, t, { keys: {} });
  world.updateWorld(null);
  var boxes = parts.map(function (p) { return worldBox(p.node); });
  pairs.forEach(function (pg) {
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].group !== pg[0]) continue;
      for (var j = 0; j < parts.length; j++) {
        if (parts[j].group !== pg[1]) continue;
        checks++;
        var d = overlap(boxes[i], boxes[j]);
        var key = parts[i].node.name + '|' + parts[j].node.name;
        if (d > 0 && !seen[key]) {
          seen[key] = true; failures++;
          console.log('FAIL ' + parts[i].group + '.' + parts[i].node.name + ' vs ' + parts[j].group + '.' +
            parts[j].node.name + ' at t=' + t.toFixed(2) + 's overlap ' + d.toFixed(2) + ' m (margin ' + MARGIN + ')');
        }
      }
    }
  });
}
console.log(failures ? 'FAILED layout: ' + failures + ' pair(s), ' + checks + ' checks' : 'OK layout: ' + checks + ' checks');
process.exit(failures ? 1 : 0);
