// gl.js - small WebGL 1 helpers: shaders, meshes, textures, model loading.

var GLX = {};

// Compile and link a shader program; throws with the driver's log so errors are readable.
GLX.createProgram = function (gl, vsSource, fsSource) {
  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      var kind = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
      throw new Error(kind + ' shader: ' + gl.getShaderInfoLog(sh));
    }
    return sh;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('program link: ' + gl.getProgramInfoLog(prog));
  }
  // Cache attribute and uniform locations by name.
  prog.attribs = {};
  prog.uniforms = {};
  var i, info;
  var nA = gl.getProgramParameter(prog, gl.ACTIVE_ATTRIBUTES);
  for (i = 0; i < nA; i++) { info = gl.getActiveAttrib(prog, i); prog.attribs[info.name] = gl.getAttribLocation(prog, info.name); }
  var nU = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (i = 0; i < nU; i++) { info = gl.getActiveUniform(prog, i); prog.uniforms[info.name] = gl.getUniformLocation(prog, info.name); }
  return prog;
};

// Decode the base64 buffer embedded in an exported model file.
GLX.decodeBase64 = function (b64) {
  var bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
};

// Call once after creating the context. Imported meshes can exceed 65535 vertices per part,
// which needs 32-bit indices (an extension in WebGL 1, supported by every current browser).
GLX.init = function (gl) {
  GLX.uintIndices = !!gl.getExtension('OES_element_index_uint');
};

// Upload one exported part to the GPU. Layout is documented in tools/export.py.
GLX.createMesh = function (gl, buffer, part) {
  function vbo(data) {
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return b;
  }
  var n = part.vertexCount;
  var mesh = {
    position: vbo(new Float32Array(buffer, part.position, n * 3)),
    normal: vbo(new Float32Array(buffer, part.normal, n * 3)),
    uv: vbo(new Float32Array(buffer, part.uv, n * 2)),
    index: gl.createBuffer(),
    indexCount: part.indexCount,
    indexType: gl.UNSIGNED_SHORT,
    doubleSided: !!part.doubleSided
  };
  var indices;
  if (part.indexType === 'u32') {
    if (!GLX.uintIndices) throw new Error('part ' + part.name + ' needs OES_element_index_uint');
    indices = new Uint32Array(buffer, part.index, part.indexCount);
    mesh.indexType = gl.UNSIGNED_INT;
  } else {
    indices = new Uint16Array(buffer, part.index, part.indexCount);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  return mesh;
};

// Bind a mesh's buffers to the program's attributes and draw it.
GLX.drawMesh = function (gl, prog, mesh) {
  function bind(buf, name, size) {
    var loc = prog.attribs[name];
    if (loc === undefined || loc < 0) return;   // attribute optimised away by the compiler
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }
  bind(mesh.position, 'aPosition', 3);
  bind(mesh.normal, 'aNormal', 3);
  bind(mesh.uv, 'aUV', 2);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
  gl.drawElements(gl.TRIANGLES, mesh.indexCount, mesh.indexType, 0);
};

// Textures: start as a 1x1 white pixel, replaced when the image (a data URI) finishes loading.
GLX.textures = {};
GLX.texturesPending = 0;
GLX.textureProblems = [];   // names of textures that are missing or failed to decode (read by the self-check)

GLX.getTexture = function (gl, name) {
  if (GLX.textures[name]) return GLX.textures[name];
  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  GLX.textures[name] = tex;

  var src = window.TEXTURES && window.TEXTURES[name];
  if (!src) { console.warn('missing texture: ' + name); GLX.textureProblems.push('missing:' + name); return tex; }
  GLX.texturesPending++;
  var img = new Image();
  img.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    var pot = (img.width & (img.width - 1)) === 0 && (img.height & (img.height - 1)) === 0;
    if (pot) {   // WebGL 1: mipmaps and REPEAT only work with power-of-two sizes
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    GLX.texturesPending--;
  };
  img.onerror = function () { console.warn('texture failed: ' + name); GLX.textureProblems.push('failed:' + name); GLX.texturesPending--; };
  img.src = src;
  return tex;
};

GLX.hexToRgb = function (hex) {
  var v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};

// Build scene nodes for every part of an exported model. Returns the model's root node.
// The model root is a plain grouping node; parts with parent === null hang under it.
GLX.loadModel = function (gl, model) {
  var buffer = GLX.decodeBase64(model.data);
  var root = new SceneNode(model.name);
  var byName = {};
  model.parts.forEach(function (p) {
    var node = new SceneNode(p.name);
    node.mesh = GLX.createMesh(gl, buffer, p);
    node.pivot = p.pivot || [0, 0, 0];
    node.axis = p.axis || null;
    node.limits = p.limits || null;
    node.color = GLX.hexToRgb(p.color || '#ffffff');
    node.texture = p.texture || null;
    if (node.texture) GLX.getTexture(gl, node.texture);
    node.alphaCutoff = p.alphaCutoff || 0;
    node.unlit = !!p.unlit;
    (p.parent ? byName[p.parent] : root).add(node);   // exporter guarantees parents come first
    byName[p.name] = node;
  });
  return root;
};

