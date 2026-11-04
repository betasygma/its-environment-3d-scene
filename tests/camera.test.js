// Camera tests: verifies presets and follow-camera math in src/camera.js
// Also verifies that src/main.js actually integrates CAMERA. Run: node tests/camera.test.js
var fs = require('fs'), path = require('path');
var M = require('../src/math.js'); global.Mat4 = M.Mat4; global.Vec3 = M.Vec3;
var SceneNode = require('../src/scene.js').SceneNode; global.SceneNode = SceneNode;
var CAMERA = require('../src/camera.js');

var failures = 0, total = 0;
function check(name, ok, detail) { total++; if (!ok) { failures++; console.log('FAIL ' + name + (detail ? ': ' + detail : '')); } }
function near(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-4); }

// 1. Preset lookup test: keys 1-4 yield preset's yaw/pitch/distance/target
var presets = {
  1: { target: [1.0, 1.8, 0.0], distance: 14.0, yaw: 1.57, pitch: 0.15 },
  2: { target: [0.0, 1.8, 0.0], distance: 16.0, yaw: -2.35, pitch: 0.22 },
  3: { target: [0.5, 1.8, 0.0], distance: 15.0, yaw: 0.0, pitch: 0.12 },
  4: { target: [1.0, 1.8, 0.0], distance: 16.0, yaw: 0.78, pitch: 0.20 }
};

for (var k = 1; k <= 4; k++) {
  var p = CAMERA.getPreset(presets, k);
  check('preset ' + k + ' lookup works', !!p);
  check('preset ' + k + ' has correct target', p && near(p.target[0], presets[k].target[0]) && near(p.target[1], presets[k].target[1]));
  check('preset ' + k + ' has correct distance/yaw/pitch', p && near(p.distance, presets[k].distance) && near(p.yaw, presets[k].yaw) && near(p.pitch, presets[k].pitch));
  var eye = CAMERA.orbitEye(p.target, p.distance, p.yaw, p.pitch);
  check('orbitEye produces valid numbers for preset ' + k, eye.length === 3 && eye.every(Number.isFinite));
}

// 2. Follow camera test: stays behind the excavator when heading is 0 and 90 deg (PI/2)
var dummyExcavator = new SceneNode('excavator');
dummyExcavator.pivot = [10.0, 0.0, 5.0];
dummyExcavator.axis = [0, 1, 0];
dummyExcavator.angle = 0; // heading 0 (facing +X)
dummyExcavator.updateWorld(null);

var f0 = CAMERA.followPose(dummyExcavator, 9.0, 3.5);
// At heading 0 (facing +X), camera should be behind (-X), so eye.x = 10 - 9 = 1.0, eye.z = 5.0
check('follow camera at heading 0: eye behind excavator', near(f0.eye[0], 1.0) && near(f0.eye[2], 5.0),
  'got eye=[' + f0.eye.map(x => x.toFixed(2)).join(',') + ']');
check('follow camera at heading 0: target at excavator pos', near(f0.target[0], 10.0) && near(f0.target[2], 5.0));
check('follow camera eye height above ground', near(f0.eye[1], 1.8 + 3.5));

// Now rotate excavator to heading PI/2 (+90 deg, facing -Z)
dummyExcavator.angle = Math.PI / 2;
dummyExcavator.updateWorld(null);

var f90 = CAMERA.followPose(dummyExcavator, 9.0, 3.5);
// At heading PI/2 (facing -Z), behind is +Z, so eye.x = 10.0, eye.z = 5.0 + 9.0 = 14.0
check('follow camera at heading 90 deg: eye behind excavator in +Z', near(f90.eye[0], 10.0) && near(f90.eye[2], 14.0),
  'got eye=[' + f90.eye.map(x => x.toFixed(2)).join(',') + ']');
check('follow camera at heading 90 deg: target tracks excavator', near(f90.target[0], 10.0) && near(f90.target[2], 5.0));

// 3. Fails if main.js does not call CAMERA
var mainSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
check('main.js calls CAMERA.getPreset', mainSrc.indexOf('CAMERA.getPreset') !== -1);
check('main.js calls CAMERA.followPose', mainSrc.indexOf('CAMERA.followPose') !== -1);
check('main.js calls CAMERA.orbitEye', mainSrc.indexOf('CAMERA.orbitEye') !== -1);
check('main.js supports ?preset= URL param', mainSrc.indexOf('presetParam') !== -1);

if (failures) { console.log('FAILED camera: ' + failures + '/' + total); process.exit(1); }
console.log('OK camera: ' + total + ' tests');
