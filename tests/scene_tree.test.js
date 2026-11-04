// Test for object relationship tree: ensures docs/scene_tree.svg is generated and contains all scene nodes.
var fs = require('fs'), path = require('path');
var ROOT = path.dirname(__dirname);
var M = require('../src/math.js'); global.Mat4 = M.Mat4; global.Vec3 = M.Vec3;
var SceneNode = require('../src/scene.js').SceneNode; global.SceneNode = SceneNode;
var WORLD = require('../src/world.js');

var failures = 0, total = 0;
function check(name, ok, detail) { total++; if (!ok) { failures++; console.log('FAIL ' + name + (detail ? ': ' + detail : '')); } }

// 1. Run tools/scene_tree.js to regenerate SVG
require('../tools/scene_tree.js');

var svgPath = path.join(ROOT, 'docs', 'scene_tree.svg');
check('scene_tree.svg exists', fs.existsSync(svgPath));
var svg = fs.readFileSync(svgPath, 'utf8');

// 2. Build live scene graph
global.window = { MODELS: {} };
['ground', 'excavator', 'roller', 'props'].forEach(function (m) {
  var p = path.join(ROOT, 'assets', 'models', m + '.js');
  if (fs.existsSync(p)) {
    var code = fs.readFileSync(p, 'utf8');
    eval(code);
  }
});

var models = {};
Object.keys(window.MODELS).forEach(function (name) {
  var m = window.MODELS[name];
  var root = new SceneNode(name), byName = {};
  var buf = Buffer.from(m.data, 'base64');
  var ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  m.parts.forEach(function (p) {
    var n = new SceneNode(p.name);
    n.pivot = p.pivot || [0, 0, 0];
    n.axis = p.axis || null;
    n.limits = p.limits || null;
    (p.parent ? byName[p.parent] : root).add(n);
    byName[p.name] = n;
  });
  models[name] = root;
});

var world = new SceneNode('world');
WORLD.build(world, models);

// 3. Verify every node in the scene is present in the SVG
var sceneNodeNames = [];
world.traverse(function (node) {
  sceneNodeNames.push(node.name);
});

check('scene contains expected nodes count', sceneNodeNames.length >= 15, 'found ' + sceneNodeNames.length);

sceneNodeNames.forEach(function (name) {
  var idMatch = svg.indexOf('id="node-' + name + '"') !== -1;
  check('SVG contains node ' + name, idMatch, 'missing node ' + name);
});

if (failures) { console.log('FAILED scene_tree: ' + failures + '/' + total); process.exit(1); }
console.log('OK scene_tree: ' + total + ' tests');
