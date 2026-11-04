// math.js — 3D vector and 4x4 matrix helpers, written from scratch (no libraries).
//
// Matrices are Float32Array(16) in COLUMN-MAJOR order, which is what
// gl.uniformMatrix4fv(loc, false, m) expects:
//
//   | m[0]  m[4]  m[8]   m[12] |      element (row r, col c) = m[c*4 + r]
//   | m[1]  m[5]  m[9]   m[13] |      translation is in m[12], m[13], m[14]
//   | m[2]  m[6]  m[10]  m[14] |
//   | m[3]  m[7]  m[11]  m[15] |
//
// Functions return NEW arrays so the code reads like the maths: world = mul(parent, local).

var Vec3 = {
  add: function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; },
  sub: function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; },
  scale: function (a, s) { return [a[0] * s, a[1] * s, a[2] * s]; },
  dot: function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
  cross: function (a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  },
  length: function (a) { return Math.sqrt(Vec3.dot(a, a)); },
  normalize: function (a) {
    var len = Vec3.length(a);
    return len > 1e-12 ? Vec3.scale(a, 1 / len) : [0, 0, 0];
  }
};

var Mat4 = {
  identity: function () {
    var m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  },

  // C = A * B  (apply B first, then A)
  mul: function (a, b) {
    var out = new Float32Array(16);
    for (var c = 0; c < 4; c++) {
      for (var r = 0; r < 4; r++) {
        out[c * 4 + r] =
          a[0 * 4 + r] * b[c * 4 + 0] +
          a[1 * 4 + r] * b[c * 4 + 1] +
          a[2 * 4 + r] * b[c * 4 + 2] +
          a[3 * 4 + r] * b[c * 4 + 3];
      }
    }
    return out;
  },

  translation: function (x, y, z) {
    var m = Mat4.identity();
    m[12] = x; m[13] = y; m[14] = z;
    return m;
  },

  scaling: function (x, y, z) {
    var m = Mat4.identity();
    m[0] = x; m[5] = y; m[10] = z;
    return m;
  },

  // Rotation by `angle` radians around a unit `axis` (Rodrigues' formula).
  rotation: function (axis, angle) {
    var n = Vec3.normalize(axis), x = n[0], y = n[1], z = n[2];
    var c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
    var m = Mat4.identity();
    m[0] = t * x * x + c;     m[4] = t * x * y - s * z; m[8] = t * x * z + s * y;
    m[1] = t * x * y + s * z; m[5] = t * y * y + c;     m[9] = t * y * z - s * x;
    m[2] = t * x * z - s * y; m[6] = t * y * z + s * x; m[10] = t * z * z + c;
    return m;
  },
  rotationX: function (a) { return Mat4.rotation([1, 0, 0], a); },
  rotationY: function (a) { return Mat4.rotation([0, 1, 0], a); },
  rotationZ: function (a) { return Mat4.rotation([0, 0, 1], a); },

  transpose: function (m) {
    var out = new Float32Array(16);
    for (var c = 0; c < 4; c++)
      for (var r = 0; r < 4; r++) out[c * 4 + r] = m[r * 4 + c];
    return out;
  },

  // General 4x4 inverse via cofactors. Returns null if the matrix is singular.
  invert: function (m) {
    var inv = new Float32Array(16);
    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
    var det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    if (Math.abs(det) < 1e-12) return null;
    for (var i = 0; i < 16; i++) inv[i] /= det;
    return inv;
  },

  // Normal matrix = transpose(inverse(upper-left 3x3 of model)), returned as a 3x3
  // (Float32Array(9), column-major) for gl.uniformMatrix3fv. Needed so normals stay
  // perpendicular to surfaces under non-uniform scaling.
  normalMatrix: function (model) {
    var inv = Mat4.invert(model);
    var t = Mat4.transpose(inv);
    return new Float32Array([t[0], t[1], t[2], t[4], t[5], t[6], t[8], t[9], t[10]]);
  },

  // Perspective projection (OpenGL convention: camera looks down -Z, clip z in [-1, 1]).
  perspective: function (fovY, aspect, near, far) {
    var f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
    var m = new Float32Array(16);
    m[0] = f / aspect;
    m[5] = f;
    m[10] = (far + near) * nf;
    m[11] = -1;
    m[14] = 2 * far * near * nf;
    return m;
  },

  // View matrix: camera at `eye` looking at `target`, with `up` roughly upward.
  lookAt: function (eye, target, up) {
    var zAxis = Vec3.normalize(Vec3.sub(eye, target));   // camera looks along -zAxis
    var xAxis = Vec3.normalize(Vec3.cross(up, zAxis));
    var yAxis = Vec3.cross(zAxis, xAxis);
    var m = Mat4.identity();
    m[0] = xAxis[0]; m[4] = xAxis[1]; m[8] = xAxis[2];
    m[1] = yAxis[0]; m[5] = yAxis[1]; m[9] = yAxis[2];
    m[2] = zAxis[0]; m[6] = zAxis[1]; m[10] = zAxis[2];
    m[12] = -Vec3.dot(xAxis, eye);
    m[13] = -Vec3.dot(yAxis, eye);
    m[14] = -Vec3.dot(zAxis, eye);
    return m;
  },

  // Transform a point (w = 1) by m.
  transformPoint: function (m, p) {
    var x = p[0], y = p[1], z = p[2];
    var w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [
      (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
      (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
      (m[2] * x + m[6] * y + m[10] * z + m[14]) / w
    ];
  }
};

if (typeof module !== 'undefined') module.exports = { Vec3: Vec3, Mat4: Mat4 };
