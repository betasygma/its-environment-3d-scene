#!/usr/bin/env python3
"""Geometry checks for an exported model.

Usage: python3 tools/check_model.py <name> [--verbose]
Prints one FAIL line per failure, then OK / FAILED summary. Exit code 1 on failure.
"""
import base64
import importlib.util
import json
import os
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_VERTS = 65535
NORMAL_TOL = 1e-3        # |n| must be 1 within this
WINDING_FRAC = 0.99      # fraction of non-degenerate tris that must agree with normals
WELD = 1e-5              # metres, position rounding for the watertight check
DEGENERATE_AREA = 1e-12  # twice-area below this is ignored for winding


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    verbose = "--verbose" in sys.argv[1:]
    if len(args) != 1:
        print("usage: python3 tools/check_model.py <name> [--verbose]")
        sys.exit(2)
    name = args[0]
    path = os.path.join(ROOT, "assets", "models", name + ".js")
    try:
        text = open(path).read()
    except OSError as e:
        print("FAILED %s: cannot read %s" % (name, path))
        sys.exit(1)
    body = text.split('"] = ', 1)[1].strip()
    if body.endswith(";"):
        body = body[:-1]
    model = json.loads(body)
    data = base64.b64decode(model["data"])

    expect = {}
    bpath = os.path.join(ROOT, "builders", name + ".py")
    if os.path.exists(bpath):
        spec = importlib.util.spec_from_file_location("builder_mod", bpath)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        expect = getattr(mod, "EXPECT", {}) or {}

    failures = []
    tot_v = tot_t = 0

    def bad(part, check, detail):
        failures.append("FAIL %s %s: %s" % (part, check, detail))

    for p in model["parts"]:
        n, vc, ic = p["name"], p["vertexCount"], p["indexCount"]
        pos = np.frombuffer(data, "<f4", vc * 3, p["position"]).reshape(vc, 3).astype(np.float64)
        nrm = np.frombuffer(data, "<f4", vc * 3, p["normal"]).reshape(vc, 3).astype(np.float64)
        uv = np.frombuffer(data, "<f4", vc * 2, p["uv"]).reshape(vc, 2)
        idx = np.frombuffer(data, "<u2", ic, p["index"]).astype(np.int64).reshape(-1, 3)
        tot_v += vc
        tot_t += len(idx)

        # 1. index range / vertex limit
        if vc > MAX_VERTS:
            bad(n, "indices", "vertexCount %d > %d" % (vc, MAX_VERTS))
        if len(idx) and idx.max() >= vc:
            bad(n, "indices", "max index %d >= vertexCount %d" % (idx.max(), vc))
            continue  # remaining checks would index out of range

        # 2. unit normals
        err = np.abs(np.linalg.norm(nrm, axis=1) - 1.0)
        if err.max() > NORMAL_TOL:
            bad(n, "normals", "%d non-unit, worst error %.2e" % ((err > NORMAL_TOL).sum(), err.max()))

        # 3. winding agrees with normals
        v0, v1, v2 = pos[idx[:, 0]], pos[idx[:, 1]], pos[idx[:, 2]]
        gn = np.cross(v1 - v0, v2 - v0)
        area2 = np.linalg.norm(gn, axis=1)
        ok = area2 > DEGENERATE_AREA
        mean_n = nrm[idx].mean(axis=1)
        agree = np.einsum("ij,ij->i", gn, mean_n) > 0
        if ok.any():
            frac = agree[ok].mean()
            if frac < WINDING_FRAC:
                bad(n, "winding", "only %.1f%% of %d triangles agree with normals" % (100 * frac, ok.sum()))

        # 4. watertight: every undirected edge used by exactly 2 triangles
        key = np.round(pos / WELD).astype(np.int64)
        _, wid = np.unique(key, axis=0, return_inverse=True)
        wid = wid.reshape(-1)
        w = wid[idx]
        e = np.concatenate([w[:, [0, 1]], w[:, [1, 2]], w[:, [2, 0]]])
        e = e[e[:, 0] != e[:, 1]]
        e.sort(axis=1)
        _, counts = np.unique(e, axis=0, return_counts=True)
        nbad = int((counts != 2).sum())
        if nbad:
            bad(n, "watertight", "%d of %d edges not shared by exactly 2 triangles" % (nbad, len(counts)))

        # 5. signed volume > 0
        vol = np.einsum("ij,ij->i", v0, np.cross(v1, v2)).sum() / 6.0
        if not vol > 0:
            bad(n, "volume", "signed volume %.6g <= 0" % vol)

        # 6. finite UVs
        if not np.isfinite(uv).all():
            bad(n, "uv", "%d non-finite values" % (~np.isfinite(uv)).sum())

        # 7. expected bbox size (GL frame)
        lo, hi = pos.min(axis=0), pos.max(axis=0)
        if n in expect:
            want = np.array(expect[n]["bbox_size"], dtype=float)
            tol = expect[n].get("tol", 0.005)
            got = hi - lo
            if (np.abs(got - want) > tol).any():
                bad(n, "bbox", "size %s expected %s tol %g" % (np.round(got, 4).tolist(), want.tolist(), tol))

        if verbose:
            print("PART %s: %d verts, %d tris, bbox min %s max %s"
                  % (n, vc, len(idx), np.round(lo, 4).tolist(), np.round(hi, 4).tolist()))

    for f in failures:
        print(f)
    if failures:
        print("FAILED %s: %d failures" % (name, len(failures)))
        sys.exit(1)
    print("OK %s: %d parts, %d verts, %d tris" % (name, len(model["parts"]), tot_v, tot_t))


if __name__ == "__main__":
    main()
