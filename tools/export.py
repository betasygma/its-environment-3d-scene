#!/usr/bin/env python3
"""Export a CadQuery builder to an embedded JS model.

Usage: python3 tools/export.py builders/<name>.py  ->  assets/models/<name>.js

This file is the ONLY place in the project that converts axes:
CadQuery is Z-up, WebGL is Y-up, and (x, y, z)_cq -> (x, z, -y)_gl.
That map is a pure rotation (determinant +1), so triangle winding is preserved.
"""
import base64
import importlib.util
import json
import os
import sys

import numpy as np
import cadquery as cq
from OCP.BRepMesh import BRepMesh_IncrementalMesh

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_TOL = 0.002      # linear tessellation tolerance, metres
DEFAULT_ANG = 0.2        # angular tessellation tolerance, radians
MAX_VERTS = 65535        # Uint16 index limit (WebGL 1)


def fail(msg):
    print("ERROR: " + msg, file=sys.stderr)
    sys.exit(1)


def to_gl(v):
    """The single CQ(Z-up) -> GL(Y-up) conversion."""
    return (v[0], v[2], -v[1])


def load_builder(path):
    spec = importlib.util.spec_from_file_location("builder_mod", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def as_shape(obj):
    """Workplane or Shape -> a single cq.Shape."""
    if isinstance(obj, cq.Workplane):
        objs = [o for o in obj.vals() if isinstance(o, cq.Shape)]
    else:
        objs = [obj]
    if not objs:
        raise ValueError("shape contains no solids")
    return objs[0] if len(objs) == 1 else cq.Compound.makeCompound(objs)


def tessellate_part(part):
    """Return (pos Nx3, nrm Nx3, uv Nx2, idx Mx3) in the GL frame."""
    tol = part.get("tol", DEFAULT_TOL)
    uv_scale = part.get("uv_scale", 1.0)
    uv_mode = part.get("uv_mode", "box")
    shape = as_shape(part["shape"])
    # Mesh the whole shape once so neighbouring faces share identical edge points
    # (meshing faces one by one leaves T-junction cracks on curved edges).
    BRepMesh_IncrementalMesh(shape.wrapped, tol, True, DEFAULT_ANG, True)

    P, N, T = [], [], []
    solid_indices = []
    base = 0

    solids = shape.Solids()
    if not solids:
        solids = [shape]

    for s_idx, solid in enumerate(solids):
        for face in solid.Faces():
            verts, tris = face.tessellate(tol, DEFAULT_ANG)
            if not verts or not tris:
                continue
            # Per-vertex exact surface normal (CQ's normalAt respects face orientation).
            cq_n = []
            for v in verts:
                try:
                    n = face.normalAt(cq.Vector(v.x, v.y, v.z))
                    n = (n.x, n.y, n.z)
                    ok = np.linalg.norm(n) > 1e-9 and all(np.isfinite(n))
                except Exception:
                    ok = False
                cq_n.append(n if ok else None)
            pos = np.array([to_gl((v.x, v.y, v.z)) for v in verts], dtype=np.float64)
            nrm = np.array([to_gl(n) if n is not None else (0, 0, 0) for n in cq_n], dtype=np.float64)
            have = np.array([n is not None for n in cq_n])
            tri = np.array(tris, dtype=np.int64)

            # Make winding agree with the outward normals; flip the whole face if not.
            if have.any():
                gn = np.cross(pos[tri[:, 1]] - pos[tri[:, 0]], pos[tri[:, 2]] - pos[tri[:, 0]])
                mean_n = nrm[tri].sum(axis=1)       # missing normals are zero, so they add nothing
                if np.einsum("ij,ij->i", gn, mean_n).sum() < 0:
                    tri = tri[:, [0, 2, 1]]

            # Fallback: average adjacent triangle normals (within this face).
            if not have.all():
                gn = np.cross(pos[tri[:, 1]] - pos[tri[:, 0]], pos[tri[:, 2]] - pos[tri[:, 0]])
                acc = np.zeros_like(pos)
                for k in range(3):
                    np.add.at(acc, tri[:, k], gn)
                nrm[~have] = acc[~have]
            length = np.linalg.norm(nrm, axis=1, keepdims=True)
            nrm = nrm / np.maximum(length, 1e-12)

            P.append(pos)
            N.append(nrm)
            T.append(tri + base)
            solid_indices.extend([s_idx] * len(pos))
            base += len(pos)

    if not P:
        raise ValueError("tessellation produced no geometry")
    pos = np.vstack(P)
    nrm = np.vstack(N)
    idx = np.vstack(T)
    if len(pos) > MAX_VERTS:
        raise ValueError("%d vertices exceeds the Uint16 limit of %d" % (len(pos), MAX_VERTS))

    if uv_mode == "fit":
        solid_arr = np.array(solid_indices)
        uv = np.empty((len(pos), 2))
        for s_idx in range(len(solids)):
            mask = (solid_arr == s_idx)
            if not mask.any():
                continue
            s_pos = pos[mask]
            lo = s_pos.min(axis=0)
            hi = s_pos.max(axis=0)
            sz = hi - lo
            thin = int(np.argmin(sz))
            if thin == 0:        # thin x -> (z, y)
                u_ax, v_ax = 2, 1
            elif thin == 2:      # thin z -> (x, y)
                u_ax, v_ax = 0, 1
            else:                # thin y -> (x, z)
                u_ax, v_ax = 0, 2
            u = (s_pos[:, u_ax] - lo[u_ax]) / max(sz[u_ax], 1e-6)
            v = (s_pos[:, v_ax] - lo[v_ax]) / max(sz[v_ax], 1e-6)
            uv[mask] = np.column_stack([u, v])
    else:
        # Box-projection UVs from the dominant axis of the GL-frame normal.
        a = np.abs(nrm)
        ax = (a[:, 0] >= a[:, 1]) & (a[:, 0] >= a[:, 2])
        ay = ~ax & (a[:, 1] >= a[:, 2])
        uv = np.empty((len(pos), 2))
        uv[:] = pos[:, [0, 1]]                       # |nz| largest -> (x, y)
        uv[ax] = pos[ax][:, [2, 1]]                  # |nx| largest -> (z, y)
        uv[ay] = pos[ay][:, [0, 2]]                  # |ny| largest -> (x, z)
        uv *= uv_scale

    return pos, nrm, uv, idx


def main():
    if len(sys.argv) != 2:
        fail("usage: python3 tools/export.py builders/<name>.py")
    path = sys.argv[1]
    name = os.path.splitext(os.path.basename(path))[0]
    mod = load_builder(path)
    parts = mod.build()

    # Parents must precede children: stable topological order, fail on unknown parent.
    names = [p["name"] for p in parts]
    if len(set(names)) != len(names):
        fail("duplicate part names")
    for p in parts:
        if p.get("parent") is not None and p["parent"] not in names:
            fail("part '%s' has unknown parent '%s'" % (p["name"], p["parent"]))
    ordered, placed = [], set()
    while len(ordered) < len(parts):
        progressed = False
        for p in parts:
            if p["name"] in placed:
                continue
            if p.get("parent") is None or p["parent"] in placed:
                ordered.append(p)
                placed.add(p["name"])
                progressed = True
        if not progressed:
            fail("parent cycle in parts")

    buf = bytearray()
    meta = []
    tot_v = tot_t = 0
    for p in ordered:
        try:
            pos, nrm, uv, idx = tessellate_part(p)
        except Exception as e:
            fail("part '%s': %s" % (p["name"], e))
        entry = {
            "name": p["name"],
            "parent": p.get("parent"),
            "pivot": [float(c) for c in to_gl(p["pivot"])],
            "axis": [float(c) for c in to_gl(p["axis"])] if p.get("axis") is not None else None,
            "limits": [float(c) for c in p["limits"]] if p.get("limits") is not None else None,
            "color": p["color"],
            "texture": p.get("texture"),
            "vertexCount": int(len(pos)),
            "indexCount": int(idx.size),
        }
        if p.get("alpha_cutoff") is not None:
            entry["alphaCutoff"] = float(p["alpha_cutoff"])
        if p.get("unlit"):
            entry["unlit"] = True

        entry["position"] = len(buf)
        buf += pos.astype("<f4").tobytes()
        entry["normal"] = len(buf)
        buf += nrm.astype("<f4").tobytes()
        entry["uv"] = len(buf)
        buf += uv.astype("<f4").tobytes()
        entry["index"] = len(buf)
        buf += idx.astype("<u2").tobytes()
        while len(buf) % 4:
            buf += b"\0"
        meta.append(entry)
        tot_v += len(pos)
        tot_t += len(idx)

    model = {"name": name, "parts": meta, "data": base64.b64encode(bytes(buf)).decode("ascii")}
    out_dir = os.path.join(ROOT, "assets", "models")
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, name + ".js"), "w") as f:
        f.write('window.MODELS = window.MODELS || {};\n')
        f.write('window.MODELS["%s"] = %s;\n' % (name, json.dumps(model, separators=(",", ":"))))
    print("EXPORTED %s: %d parts, %d verts, %d tris -> assets/models/%s.js"
          % (name, len(meta), tot_v, tot_t, name))


if __name__ == "__main__":
    main()
