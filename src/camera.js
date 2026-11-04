// camera.js  pure camera calculations for orbit presets and follow camera.
// No DOM or WebGL dependencies so it can be tested in Node.js.

var CAMERA = (function () {
  // Compute eye position for orbit camera
  function orbitEye(target, distance, yaw, pitch) {
    var cp = Math.cos(pitch);
    return [
      target[0] + distance * cp * Math.sin(yaw),
      target[1] + distance * Math.sin(pitch),
      target[2] + distance * cp * Math.cos(yaw)
    ];
  }

  // Look up preset by key (1-4)
  function getPreset(presets, key) {
    if (!presets) return null;
    return presets[key] || presets['' + key] || null;
  }

  // Extract heading (yaw angle about +Y) and position from excavator world matrix or node
  // In our scene graph, excavator faces +X at heading 0, so forward is (cos a, 0, -sin a).
  // Column 0 of world matrix is the transformed +X axis: [m[0], m[1], m[2]].
  // Column 3 is translation: [m[12], m[13], m[14]].
  function getExcavatorPose(excavatorNode) {
    if (!excavatorNode) return { pos: [0, 1.8, 0], heading: 0 };
    var m = excavatorNode.world;
    var pos = [m[12], m[13] + 1.8, m[14]];
    // Angle in the X-Z plane: forward vector is (m[0], m[2])
    // When angle = 0, forward is (1, 0)
    // When angle = PI/2, forward is (0, -1)
    var heading = Math.atan2(-m[2], m[0]);
    return { pos: pos, heading: heading };
  }

  // Calculate follow-camera eye and target behind the excavator
  // Camera stays behind the machine along its current heading:
  // Offset backward along heading: -cos(heading) * dist in X, +sin(heading) * dist in Z.
  function followPose(excavatorNode, dist, height) {
    dist = dist || 9.0;
    height = height || 3.5;
    var p = getExcavatorPose(excavatorNode);
    var eye = [
      p.pos[0] - Math.cos(p.heading) * dist,
      p.pos[1] + height,
      p.pos[2] + Math.sin(p.heading) * dist
    ];
    return { eye: eye, target: p.pos };
  }

  return {
    orbitEye: orbitEye,
    getPreset: getPreset,
    getExcavatorPose: getExcavatorPose,
    followPose: followPose
  };
})();

if (typeof module !== 'undefined') module.exports = CAMERA;
