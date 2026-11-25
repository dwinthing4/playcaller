// ============================================================
//  REPLAY MARKERS (src/match/20_replay.js draws with these): a ring under a player (the flagged man, the key player),
//  bands on the grass (the line to gain, the goal line, the sideline on a review) and a spot marker where the ball was.
//  Plain unlit meshes drawn over the field (no depth test), added through R3D.addObj and all cleared together.
// ============================================================
const RPV = (() => {
  const objs = []; let ringM = null, ringT = 0;
  const mat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
  const add = (m, ro) => { m.renderOrder = ro || 30; m.frustumCulled = false; objs.push(m); R3D.addObj(m); return m; };
  // a flat quad on the grass from (x0, z0) to (x1, z1), w metres wide
  function band(x0, z0, x1, z1, w, color, op) {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1, nx = -dz / L * w / 2, nz = dx / L * w / 2, y = 0.04, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([x0 + nx, y, z0 + nz, x0 - nx, y, z0 - nz, x1 + nx, y, z1 + nz, x1 - nx, y, z1 - nz], 3)); g.setIndex([0, 1, 2, 2, 1, 3]);
    return add(new THREE.Mesh(g, mat(color, op == null ? 0.95 : op)), 31);
  }
  // where the ball was: a short post and a disc (the review angle's "here")
  function spot(x, z, y, color) {
    const c = color || 0xff7a1a, post = add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 8), mat(c, 0.95)), 32); post.position.set(x, (y || 0) + 0.55, z);
    const d = add(new THREE.Mesh(new THREE.RingGeometry(0.1, 0.24, 28), mat(c, 0.95)), 32); d.rotation.x = -Math.PI / 2; d.position.set(x, 0.045, z);
  }
  // the ring under one player (moved every frame); pulses a little so it reads on a busy field
  function ring(x, z, color, dt) {
    if (!ringM) { ringM = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.95, 48), mat(0xffd21a, 0.95)); ringM.rotation.x = -Math.PI / 2; ringM.renderOrder = 33; ringM.frustumCulled = false; }
    if (!ringM.parent) R3D.addObj(ringM);
    ringT += dt || 0; const s = 1 + 0.08 * Math.sin(ringT * 7); ringM.scale.set(s, s, 1); ringM.material.color.set(color || 0xffd21a); ringM.position.set(x, 0.045, z); ringM.visible = true;
  }
  function noRing() { if (ringM) { ringM.visible = false; if (ringM.parent) R3D.delObj(ringM); } }
  function clear() { for (const m of objs) { R3D.delObj(m); if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); } objs.length = 0; noRing(); }
  return { band, spot, ring, noRing, clear };
})();
