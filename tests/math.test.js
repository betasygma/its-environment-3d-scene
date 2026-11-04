// Unit tests for src/math.js and src/scene.js. Run: node tests/math.test.js
// Prints one line per failure, then a summary line.

global.Mat4 = require('../src/math.js').Mat4;
global.Vec3 = require('../src/math.js').Vec3;
var SceneNode = require('../src/scene.js').SceneNode;

var failures = 0, total = 0;
function near(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-5); }
function vecNear(a, b, eps) { return a.length === b.length && a.every(function (v, i) { return near(v, b[i], eps); }); }
function check(name, ok, detail) {
  total++;
  if (!ok) { failures++; console.log('FAIL ' + name + (detail ? ': ' + detail : '')); }
}
function arr(m) { return Array.prototype.slice.call(m); }

// Column-major layout: translation in m[12..14]
var T = Mat4.translation(1, 2, 3);
check('translation layout', T[12] === 1 && T[13] === 2 && T[14] === 3 && T[3] === 0);
check('translate point', vecNear(Mat4.transformPoint(T, [0, 0, 0]), [1, 2, 3]));

// Multiplication order: mul(A, B) applies B first
var R = Mat4.rotationZ(Math.PI / 2);
check('mul order (T*R)', vecNear(Mat4.transformPoint(Mat4.mul(T, R), [1, 0, 0]), [1, 3, 3]));
check('mul order (R*T)', vecNear(Mat4.transformPoint(Mat4.mul(R, T), [0, 0, 0]), [-2, 1, 3]));
check('identity', vecNear(arr(Mat4.mul(Mat4.identity(), T)), arr(T)));

// Right-handed rotations
check('rotZ +90: X->Y', vecNear(Mat4.transformPoint(Mat4.rotationZ(Math.PI / 2), [1, 0, 0]), [0, 1, 0]));
check('rotY +90: X->-Z', vecNear(Mat4.transformPoint(Mat4.rotationY(Math.PI / 2), [1, 0, 0]), [0, 0, -1]));
check('rotX +90: Y->Z', vecNear(Mat4.transformPoint(Mat4.rotationX(Math.PI / 2), [0, 1, 0]), [0, 0, 1]));
check('axis-angle matches rotY', vecNear(arr(Mat4.rotation([0, 2, 0], 0.7)), arr(Mat4.rotationY(0.7))));

// Inverse
var M = Mat4.mul(Mat4.mul(Mat4.translation(3, -1, 2), Mat4.rotation([1, 1, 0], 0.9)), Mat4.scaling(2, 0.5, 3));
check('invert * M = I', vecNear(arr(Mat4.mul(Mat4.invert(M), M)), arr(Mat4.identity()), 1e-4));
check('singular -> null', Mat4.invert(Mat4.scaling(1, 0, 1)) === null);
check('transpose twice', vecNear(arr(Mat4.transpose(Mat4.transpose(M))), arr(M)));

// Normal matrix keeps normals perpendicular under non-uniform scale
var S = Mat4.scaling(4, 1, 1);
var N = Mat4.normalMatrix(S);
var n = Vec3.normalize([N[0] * 1 + N[3] * 1, N[1] * 1 + N[4] * 1, N[2] + N[5]]); // normal of plane x+y=0 tilted
var tangent = Mat4.transformPoint(S, [1, -1, 0]);                             // tangent of that plane, scaled
check('normal matrix perpendicular', near(Vec3.dot(n, tangent), 0, 1e-5), 'dot=' + Vec3.dot(n, tangent));

// lookAt: eye maps to origin, target maps onto -Z axis
var V = Mat4.lookAt([3, 4, 5], [0, 0, 0], [0, 1, 0]);
check('lookAt eye -> origin', vecNear(Mat4.transformPoint(V, [3, 4, 5]), [0, 0, 0], 1e-4));
var tv = Mat4.transformPoint(V, [0, 0, 0]);
check('lookAt target on -Z', near(tv[0], 0, 1e-4) && near(tv[1], 0, 1e-4) && tv[2] < 0);

// Perspective: near plane -> z=-1, far plane -> z=+1
var P = Mat4.perspective(Math.PI / 4, 1.5, 0.1, 100);
check('perspective near', near(Mat4.transformPoint(P, [0, 0, -0.1])[2], -1, 1e-4));
check('perspective far', near(Mat4.transformPoint(P, [0, 0, -100])[2], 1, 1e-3));

// Scene graph: child follows parent's rotation about the parent's pivot
var root = new SceneNode('root');
var arm = root.add(new SceneNode('arm'));
arm.pivot = [1, 0, 0]; arm.axis = [0, 0, 1];
var tip = arm.add(new SceneNode('tip'));
tip.pivot = [2, 0, 0];
arm.setAngle(Math.PI / 2);
root.updateWorld(null);
check('hierarchy: tip follows arm', vecNear(tip.worldOrigin(), [1, 2, 0], 1e-5), JSON.stringify(tip.worldOrigin()));
arm.limits = [-0.5, 0.5]; arm.setAngle(2);
check('joint limits clamp', near(arm.angle, 0.5));

if (failures) { console.log('FAILED math: ' + failures + '/' + total); process.exit(1); }
console.log('OK math: ' + total + ' tests');
