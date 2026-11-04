// shaders.js — GLSL source for the main lit + textured shader (Blinn-Phong).
// Kept as JS strings so index.html works from file:// (no fetch).

var SHADERS = {};

SHADERS.litVS = [
  'attribute vec3 aPosition;',
  'attribute vec3 aNormal;',
  'attribute vec2 aUV;',
  'uniform mat4 uModel;',         // object -> world (from the scene graph)
  'uniform mat4 uView;',          // world -> camera
  'uniform mat4 uProj;',          // camera -> clip space
  'uniform mat3 uNormalMatrix;',  // transpose(inverse(model)) for normals
  'varying vec3 vWorldPos;',
  'varying vec3 vNormal;',
  'varying vec2 vUV;',
  'void main() {',
  '  vec4 world = uModel * vec4(aPosition, 1.0);',
  '  vWorldPos = world.xyz;',
  '  vNormal = uNormalMatrix * aNormal;',
  '  vUV = aUV;',
  '  gl_Position = uProj * uView * world;',
  '}'
].join('\n');

SHADERS.litFS = [
  'precision mediump float;',
  'varying vec3 vWorldPos;',
  'varying vec3 vNormal;',
  'varying vec2 vUV;',
  'uniform vec3 uBaseColor;',
  'uniform sampler2D uTexture;',
  'uniform float uUseTexture;',    // 1.0 = multiply base colour by the texture
  'uniform vec3 uSunDir;',         // unit vector pointing TOWARD the sun (world space)
  'uniform vec3 uSunColor;',
  'uniform vec3 uSkyColor;',       // hemisphere ambient: colour from above...
  'uniform vec3 uGroundColor;',    // ...and from below
  'uniform vec3 uCameraPos;',
  'uniform float uShininess;',
  'uniform float uSpecular;',
  'void main() {',
  '  vec3 N = normalize(vNormal);',
  '  vec3 L = normalize(uSunDir);',
  '  vec3 V = normalize(uCameraPos - vWorldPos);',
  '  vec3 H = normalize(L + V);',                                   // Blinn-Phong half vector
  '  vec3 albedo = uBaseColor;',
  '  if (uUseTexture > 0.5) albedo *= texture2D(uTexture, vUV).rgb;',
  '  vec3 ambient = mix(uGroundColor, uSkyColor, N.y * 0.5 + 0.5) * albedo;',
  '  float diff = max(dot(N, L), 0.0);',
  '  float spec = diff > 0.0 ? pow(max(dot(N, H), 0.0), uShininess) * uSpecular : 0.0;',
  '  vec3 color = ambient + uSunColor * (albedo * diff + vec3(spec));',
  '  gl_FragColor = vec4(color, 1.0);',
  '}'
].join('\n');
