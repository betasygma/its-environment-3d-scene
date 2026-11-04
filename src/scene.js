// scene.js — hierarchical modelling (scene graph).
//
// Each Node has a LOCAL transform relative to its parent:
//     local = T(pivot) * R(axis, angle) * offset
// and its WORLD transform is computed top-down:
//     world = parent.world * local
// Rotating a node (e.g. the boom) therefore moves every child (stick, bucket) with it.

function SceneNode(name) {
  this.name = name;
  this.parent = null;
  this.children = [];

  this.pivot = [0, 0, 0];        // where this node's origin sits, in the parent's frame
  this.axis = null;              // joint axis (unit vector, parent frame) or null for fixed parts
  this.angle = 0;                // joint angle in radians
  this.limits = null;            // [min, max] radians, or null for unlimited
  this.offset = Mat4.identity(); // extra local transform (e.g. a scale), applied first

  this.mesh = null;              // GPU mesh from gl.js, or null for a pure grouping node
  this.color = [1, 1, 1];
  this.texture = null;           // texture name in window.TEXTURES, or null

  this.world = Mat4.identity();
}

SceneNode.prototype.add = function (child) {
  child.parent = this;
  this.children.push(child);
  return child;
};

// Set a joint angle, clamped to the joint's limits.
SceneNode.prototype.setAngle = function (a) {
  if (this.limits) a = Math.min(this.limits[1], Math.max(this.limits[0], a));
  this.angle = a;
};

SceneNode.prototype.localMatrix = function () {
  var m = Mat4.translation(this.pivot[0], this.pivot[1], this.pivot[2]);
  if (this.axis) m = Mat4.mul(m, Mat4.rotation(this.axis, this.angle));
  return Mat4.mul(m, this.offset);
};

// Recompute world matrices for this node and all descendants.
SceneNode.prototype.updateWorld = function (parentWorld) {
  var local = this.localMatrix();
  this.world = parentWorld ? Mat4.mul(parentWorld, local) : local;
  for (var i = 0; i < this.children.length; i++) this.children[i].updateWorld(this.world);
};

// Visit this node and all descendants (depth-first).
SceneNode.prototype.traverse = function (fn) {
  fn(this);
  for (var i = 0; i < this.children.length; i++) this.children[i].traverse(fn);
};

SceneNode.prototype.find = function (name) {
  var found = null;
  this.traverse(function (n) { if (!found && n.name === name) found = n; });
  return found;
};

// World-space position of this node's origin (useful for attaching cylinders, tests).
SceneNode.prototype.worldOrigin = function () {
  return [this.world[12], this.world[13], this.world[14]];
};

if (typeof module !== 'undefined') module.exports = { SceneNode: SceneNode };
