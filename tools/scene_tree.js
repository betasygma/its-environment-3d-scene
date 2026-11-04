#!/usr/bin/env node
// tools/scene_tree.js  generates docs/scene_tree.svg from the live scene graph.
// Usage: node tools/scene_tree.js

var fs = require('fs');
var path = require('path');
var ROOT = path.dirname(__dirname);

var M = require(path.join(ROOT, 'src', 'math.js'));
global.Mat4 = M.Mat4;
global.Vec3 = M.Vec3;
var SceneNode = require(path.join(ROOT, 'src', 'scene.js')).SceneNode;
global.SceneNode = SceneNode;
var WORLD = require(path.join(ROOT, 'src', 'world.js'));

global.window = { MODELS: {} };
var modelNames = ['ground', 'excavator', 'roller', 'props'];
modelNames.forEach(function (m) {
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

// Classify joint type
function getJointType(node) {
  if (node.name === 'world') return 'root';
  if (node.name === 'excavator' || node.name === 'roller') return 'drive';
  if (node.name === 'upper') return 'slew (yaw)';
  if (node.name === 'front_frame') return 'articulation';
  if (node.name === 'drum' || node.name === 'wheel_l' || node.name === 'wheel_r') return 'rolling';
  return 'fixed';
}

// Layout tree nodes into a neat 2D diagram
// We compute hierarchical x and y positions
var BOX_W = 130, BOX_H = 46, H_GAP = 20, V_GAP = 55;

function assignLayout(node, depth) {
  var item = {
    node: node,
    name: node.name,
    joint: getJointType(node),
    depth: depth,
    children: [],
    x: 0,
    y: depth * (BOX_H + V_GAP) + 30
  };
  node.children.forEach(function (child) {
    item.children.push(assignLayout(child, depth + 1));
  });
  return item;
}

var treeLayout = assignLayout(world, 0);

// Compute widths and x positions
var currentX = 30;
function assignX(item) {
  if (item.children.length === 0) {
    item.x = currentX;
    currentX += BOX_W + H_GAP;
  } else {
    item.children.forEach(assignX);
    var first = item.children[0].x;
    var last = item.children[item.children.length - 1].x;
    item.x = (first + last) / 2;
  }
}
assignX(treeLayout);

var totalWidth = Math.max(currentX + 30, 1100);
var maxDepth = 0;
function findMaxDepth(item) {
  if (item.depth > maxDepth) maxDepth = item.depth;
  item.children.forEach(findMaxDepth);
}
findMaxDepth(treeLayout);
var totalHeight = (maxDepth + 1) * (BOX_H + V_GAP) + 50;

// Render SVG elements
var linesSvg = [];
var boxesSvg = [];

function getBoxColors(joint) {
  if (joint === 'root') return { fill: '#2d3748', stroke: '#4a5568', text: '#ffffff', sub: '#cbd5e0' };
  if (joint === 'drive') return { fill: '#744210', stroke: '#d69e2e', text: '#fffaf0', sub: '#fbd38d' };
  if (joint === 'slew (yaw)' || joint === 'articulation') return { fill: '#1a365d', stroke: '#3182ce', text: '#ebf8ff', sub: '#90cdf4' };
  if (joint === 'rolling') return { fill: '#22543d', stroke: '#38a169', text: '#f0fff4', sub: '#9ae6b4' };
  return { fill: '#1a202c', stroke: '#4a5568', text: '#e2e8f0', sub: '#a0aec0' };
}

function renderItem(item) {
  var x = item.x, y = item.y;
  var col = getBoxColors(item.joint);

  // Box
  boxesSvg.push(
    '<g id="node-' + item.name + '">\n' +
    '  <rect x="' + (x - BOX_W / 2) + '" y="' + (y - BOX_H / 2) + '" width="' + BOX_W + '" height="' + BOX_H + '" rx="6" fill="' + col.fill + '" stroke="' + col.stroke + '" stroke-width="1.5"/>\n' +
    '  <text x="' + x + '" y="' + (y - 4) + '" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="' + col.text + '">' + item.name + '</text>\n' +
    '  <text x="' + x + '" y="' + (y + 12) + '" text-anchor="middle" font-family="monospace" font-size="10" fill="' + col.sub + '">[' + item.joint + ']</text>\n' +
    '</g>'
  );

  // Lines to children
  item.children.forEach(function (child) {
    var x1 = item.x, y1 = item.y + BOX_H / 2;
    var x2 = child.x, y2 = child.y - BOX_H / 2;
    var midY = (y1 + y2) / 2;
    var path = 'M ' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + midY + ', ' + x2 + ' ' + midY + ', ' + x2 + ' ' + y2;
    linesSvg.push('<path d="' + path + '" fill="none" stroke="#718096" stroke-width="1.5"/>');
    renderItem(child);
  });
}
renderItem(treeLayout);

var svg = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + totalWidth + ' ' + totalHeight + '" width="' + totalWidth + '" height="' + totalHeight + '" style="background:#171923;">',
  '  <defs>',
  '    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">',
  '      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.5"/>',
  '    </filter>',
  '  </defs>',
  '  <!-- Connection Lines -->',
  '  <g id="connections">',
  '    ' + linesSvg.join('\n    '),
  '  </g>',
  '  <!-- Hierarchy Boxes -->',
  '  <g id="boxes">',
  '    ' + boxesSvg.join('\n    '),
  '  </g>',
  '</svg>'
].join('\n');

var outPath = path.join(ROOT, 'docs', 'scene_tree.svg');
fs.writeFileSync(outPath, svg, 'utf8');
console.log('OK scene_tree.svg generated (' + totalWidth + 'x' + totalHeight + ')');
