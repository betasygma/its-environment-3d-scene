// main.js  sets up WebGL, builds the scene from window.MODELS, runs the render loop.
// Modes (from the URL query string):
//   (none)  interactive: drag to orbit, wheel to zoom
//   ?test   headless self-check: renders from SCENE_CONFIG.testCamera, writes a one-line result
//   ?shot   still render for screenshots (no UI)

(function () {
  var cfg = window.SCENE_CONFIG;
  var mode = /[?&]test\b/.test(location.search) ? 'test' : /[?&]shot\b/.test(location.search) ? 'shot' : 'live';
  var canvas = document.getElementById('canvas');
  var statusEl = document.getElementById('status');
  var CLEAR = [0.78, 0.72, 0.68];   // hazy dusk sky (placeholder until the backdrop exists)

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
    document.title = text;
  }

  var gl, prog, world;
  try {
    if (mode === 'test') { canvas.width = 256; canvas.height = 256; }
    gl = canvas.getContext('webgl', { antialias: mode !== 'test', preserveDrawingBuffer: mode !== 'live' });
    if (!gl) throw new Error('WebGL not available');
    GLX.init(gl);
    prog = GLX.createProgram(gl, SHADERS.litVS, SHADERS.litFS);

    // The whole scene hangs under one root node; each model is a subtree.
    // src/world.js decides where each model goes and how things move.
    world = new SceneNode('world');
    var models = {};
    cfg.models.forEach(function (name) {
      if (!window.MODELS || !window.MODELS[name]) throw new Error('model not loaded: ' + name);
      models[name] = GLX.loadModel(gl, window.MODELS[name]);
    });
    WORLD.build(world, models);
  } catch (e) {
    setStatus('RENDER FAIL ' + e.message);
    return;
  }

  // ---- camera ----
  var cam = { target: cfg.camera.target.slice(), distance: cfg.camera.distance, yaw: cfg.camera.yaw, pitch: cfg.camera.pitch };
  var followCam = false;

  // Optional ?preset=N to jump straight to preset N
  var presetParam = /[?&]preset=([1-4])/.exec(location.search);
  if (presetParam && cfg.cameraPresets) {
    var pInit = CAMERA.getPreset(cfg.cameraPresets, presetParam[1]);
    if (pInit) {
      cam.target = pInit.target.slice();
      cam.distance = pInit.distance;
      cam.yaw = pInit.yaw;
      cam.pitch = pInit.pitch;
    }
  }

  // Optional ?cam=yaw,pitch,distance (radians, metres)  used for screenshots from a chosen angle.
  var camParam = /[?&]cam=([-\d.]+),([-\d.]+),([-\d.]+)/.exec(location.search);
  if (camParam) { cam.yaw = +camParam[1]; cam.pitch = +camParam[2]; cam.distance = +camParam[3]; }

  function getCameraPose() {
    if (followCam && world) {
      var exc = world.find('excavator');
      if (exc) return CAMERA.followPose(exc);
    }
    return {
      eye: CAMERA.orbitEye(cam.target, cam.distance, cam.yaw, cam.pitch),
      target: cam.target
    };
  }

  function cameraEye() {
    return getCameraPose().eye;
  }

  // Keyboard state for WORLD.update (e.g. input.keys['KeyQ'] === true while Q is held).
  var input = { keys: {} };
  if (mode === 'live') {
    window.addEventListener('keydown', function (e) {
      input.keys[e.code] = true;
      if (cfg.cameraPresets) {
        var num = e.key;
        if (e.code && e.code.indexOf('Digit') === 0) num = e.code.replace('Digit', '');
        var preset = CAMERA.getPreset(cfg.cameraPresets, num);
        if (preset) {
          followCam = false;
          cam.target = preset.target.slice();
          cam.distance = preset.distance;
          cam.yaw = preset.yaw;
          cam.pitch = preset.pitch;
          setStatus('Camera: ' + (preset.desc || ('Preset ' + num)));
        }
      }
      if (e.code === 'KeyF') {
        followCam = !followCam;
        setStatus('Camera: ' + (followCam ? 'Follow (excavator)' : 'Orbit'));
      }
    });
    window.addEventListener('keyup', function (e) { input.keys[e.code] = false; });
    var dragging = false, lastX = 0, lastY = 0;
    canvas.addEventListener('mousedown', function (e) { dragging = true; lastX = e.clientX; lastY = e.clientY; });
    window.addEventListener('mouseup', function () { dragging = false; });
    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      cam.yaw -= (e.clientX - lastX) * 0.01;
      cam.pitch = Math.max(-0.1, Math.min(1.5, cam.pitch + (e.clientY - lastY) * 0.01));
      lastX = e.clientX; lastY = e.clientY;
    });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      cam.distance = Math.max(2, Math.min(60, cam.distance * (e.deltaY > 0 ? 1.1 : 0.9)));
    }, { passive: false });
  }

  function resize() {
    if (mode === 'test') return;
    var dpr = window.devicePixelRatio || 1;
    var w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  // ---- lighting (dusk: low warm sun, cool sky ambient, warm ground bounce) ----
  var light = cfg.light;

  // noTextures = true is only used by the self-check, to prove textures change the image.
  function draw(noTextures) {
    resize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(CLEAR[0], CLEAR[1], CLEAR[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    var eye, view;
    if (mode === 'test') {
      eye = cfg.testCamera.eye;
      view = Mat4.lookAt(eye, cfg.testCamera.target, cfg.testCamera.up);
    } else {
      eye = cameraEye();
      view = Mat4.lookAt(eye, getCameraPose().target, [0, 1, 0]);
    }
    var proj = Mat4.perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 200);

    gl.useProgram(prog);
    var u = prog.uniforms;
    gl.uniformMatrix4fv(u.uView, false, view);
    gl.uniformMatrix4fv(u.uProj, false, proj);
    gl.uniform3fv(u.uSunDir, Vec3.normalize(light.sunDir));
    gl.uniform3fv(u.uSunColor, light.sunColor);
    gl.uniform3fv(u.uSkyColor, light.skyColor);
    gl.uniform3fv(u.uGroundColor, light.groundColor);
    gl.uniform3fv(u.uCameraPos, eye);
    gl.uniform1i(u.uTexture, 0);

    world.updateWorld(null);
    world.traverse(function (node) {
      if (!node.mesh) return;
      // CadQuery parts are closed and outward-facing, so back faces can be skipped.
      // Imported (Meshy) parts are double-sided: draw both sides.
      if (node.mesh.doubleSided) gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);
      gl.uniformMatrix4fv(u.uModel, false, node.world);
      gl.uniformMatrix3fv(u.uNormalMatrix, false, Mat4.normalMatrix(node.world));
      gl.uniform3fv(u.uBaseColor, node.color);
      gl.uniform1f(u.uShininess, 24.0);
      gl.uniform1f(u.uSpecular, 0.25);
      if (node.texture && !noTextures) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, GLX.getTexture(gl, node.texture));
        gl.uniform1f(u.uUseTexture, 1.0);
      } else {
        gl.uniform1f(u.uUseTexture, 0.0);
      }
      GLX.drawMesh(gl, prog, node.mesh);
    });
  }

  // ---- self-check used by tools/render_check.py ----
  // Renders the test view twice  with and without textures  and compares the pixels.
  function evaluate() {
    var w = canvas.width, h = canvas.height;
    function capture(noTextures) {
      draw(noTextures);
      var px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    }
    var withTex = capture(false), withoutTex = capture(true);
    var err = gl.getError();
    var bg = CLEAR.map(function (c) { return Math.round(c * 255); });
    var drawn = 0, changed = 0;
    for (var i = 0; i < withTex.length; i += 4) {
      if (Math.abs(withTex[i] - bg[0]) + Math.abs(withTex[i + 1] - bg[1]) + Math.abs(withTex[i + 2] - bg[2]) <= 3) continue;
      drawn++;
      var d = Math.abs(withTex[i] - withoutTex[i]) + Math.abs(withTex[i + 1] - withoutTex[i + 1]) + Math.abs(withTex[i + 2] - withoutTex[i + 2]);
      if (d > 24) changed++;   // texture visibly altered this pixel
    }
    var drawnFrac = drawn / (w * h);
    var texFrac = drawn ? changed / drawn : 0;
    var t = cfg.test, problems = [];
    if (err !== gl.NO_ERROR) problems.push('glError=' + err);
    if (GLX.textureProblems.length) problems.push('textures[' + GLX.textureProblems.join(',') + ']');
    if (drawnFrac < t.minDrawn) problems.push('drawn=' + drawnFrac.toFixed(3) + '<' + t.minDrawn);
    if (t.minTextureEffect && texFrac < t.minTextureEffect) problems.push('textureNotVisible=' + texFrac.toFixed(2) + '<' + t.minTextureEffect);
    setStatus((problems.length ? 'RENDER FAIL ' + problems.join(' ') : 'RENDER OK') +
      ' drawn=' + drawnFrac.toFixed(3) + ' textureEffect=' + texFrac.toFixed(2) + ' textures=' + Object.keys(GLX.textures).length);
  }

  var frames = 0, startTime = null, lastTime = null;
  function frame(now) {
    now = (now || 0) / 1000;
    if (startTime === null) { startTime = now; lastTime = now; }
    var dt = Math.min(0.1, now - lastTime); lastTime = now;
    // Animation runs only in live mode; test/shot renders the fixed initial pose.
    try {
      if (mode === 'live') WORLD.update(dt, now - startTime, input);
      draw();
    } catch (e) { setStatus('RENDER FAIL ' + e.message); return; }
    frames++;
    if (mode !== 'live' && GLX.texturesPending === 0 && frames >= 2) {
      if (mode === 'test') evaluate(); else setStatus('SHOT READY');
      return;   // stop the loop
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
