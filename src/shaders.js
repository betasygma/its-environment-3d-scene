// shaders.js - GLSL source for the main lit + textured shader (Blinn-Phong) and sky.
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
  'uniform float uAlphaCutoff;',   // 0 = opaque; 0.5 for cut-out leaves / tree panels
  'uniform float uUnlit;',         // 1 = texture colour as is (photo backdrops)
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
  '  if (uUseTexture > 0.5) {',
  '    vec4 tex = texture2D(uTexture, vUV);',
  '    if (tex.a < uAlphaCutoff) discard;',                          // alpha test: no blending, no sorting needed
  '    albedo *= tex.rgb;',
  '  }',
  '  if (uUnlit > 0.5) { gl_FragColor = vec4(albedo, 1.0); return; }',
  '  vec3 ambient = mix(uGroundColor, uSkyColor, N.y * 0.5 + 0.5) * albedo;',
  '  float diff = max(dot(N, L), 0.0);',
  '  float spec = diff > 0.0 ? pow(max(dot(N, H), 0.0), uShininess) * uSpecular : 0.0;',
  '  vec3 color = ambient + uSunColor * (albedo * diff + vec3(spec));',
  '  gl_FragColor = vec4(color, 1.0);',
  '}'
].join('\n');

SHADERS.skyVS = [
  'attribute vec2 aPos;',                 // clip-space corners (-1..1)
  'uniform mat4 uInvViewProj;',           // inverse(proj * view)
  'uniform vec3 uCameraPos;',
  'varying vec3 vDir;',
  'void main() {',
  '  vec4 p = uInvViewProj * vec4(aPos, 1.0, 1.0);',   // point on the far plane
  '  vDir = p.xyz / p.w - uCameraPos;',
  '  gl_Position = vec4(aPos, 0.999, 1.0);',
  '}'
].join('\n');

SHADERS.skyFS = [
  'precision mediump float;',
  'varying vec3 vDir;',
  'uniform vec3 uHorizon, uZenith, uSunDir, uSunColor;',
  'void main() {',
  '  vec3 d = normalize(vDir);',
  '  vec3 c = mix(uHorizon, uZenith, clamp(d.y * 1.6, 0.0, 1.0));',
  '  c += uSunColor * 0.35 * pow(max(dot(d, normalize(uSunDir)), 0.0), 48.0);',   // glow around the sun
  '  gl_FragColor = vec4(c, 1.0);',
  '}'
].join('\n');
