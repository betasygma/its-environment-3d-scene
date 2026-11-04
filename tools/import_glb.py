#!/usr/bin/env python3
"""Import a Meshy GLB into an embedded JS model (textured, decimated, split into parts).

Usage:
  python3 tools/import_glb.py [spec/import_excavator.json] [--src PATH]   -> assets/models/<name>.js
                                                                             assets/textures_<name>.js
  python3 tools/import_glb.py [spec/import_excavator.json] --check         -> validates the output

Source frame: glTF Y-up, machine faces -X.  Output frame: metres, GL Y-up, machine faces +X
(180 degrees about Y, a proper rotation: winding is kept as is).  Parts: undercarriage, upper
(pivot at the slew ring; upper vertices are stored relative to the pivot).
"""
import argparse
import base64
import io
import json
import os
import struct
import sys
import time

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SPEC = os.path.join(ROOT, "spec", "import_excavator.json")
import tempfile
TMP_DIR = os.path.join(tempfile.gettempdir(), "tugas2_import_tmp")   # works on Windows and Linux
MIN_COMPONENT_FACES = 50
MAX_MODEL_BYTES = 12 * 1024 * 1024
MAX_TEXTURE_BYTES = 3 * 1024 * 1024


def log(msg):
    print(msg, file=sys.stderr, flush=True)


# --------------------------------------------------------------------------- decode
def decode_glb(path):
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    d = open(path, "rb").read()
    jl, _ = struct.unpack("<II", d[12:20])
    g = json.loads(d[20:20 + jl])
    boff = 20 + jl + 8
    B = d[boff:]

    def acc(i, dt, n):
        a = g["accessors"][i]
        bv = g["bufferViews"][a["bufferView"]]
        o = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        itm = np.dtype(dt).itemsize
        st = bv.get("byteStride", itm * n)
        raw = np.frombuffer(B, dtype=np.uint8, count=st * a["count"], offset=o).reshape(a["count"], st)
        return raw[:, :itm * n].copy().view(dt).reshape(a["count"], n)

    pr = g["meshes"][0]["primitives"][0]
    at = pr["attributes"]
    node = g["nodes"][0]
    pos = acc(at["POSITION"], "<f4", 3) * np.array(node["scale"]) + np.array(node["translation"])
    nrm = np.clip(acc(at["NORMAL"], "i1", 3).astype(np.float32) / 127, -1, 1)
    tt = g["materials"][0]["pbrMetallicRoughness"]["baseColorTexture"]["extensions"]["KHR_texture_transform"]
    uv = acc(at["TEXCOORD_0"], "<u2", 2).astype(np.float64) / 65535 * np.array(tt["scale"]) + np.array(tt["offset"])
    ia = g["accessors"][pr["indices"]]
    idx = np.frombuffer(B, dtype="<u4", count=ia["count"],
                        offset=g["bufferViews"][ia["bufferView"]].get("byteOffset", 0)).reshape(-1, 3)
    im = g["images"][0]
    bv = g["bufferViews"][im["bufferView"]]
    o = bv.get("byteOffset", 0)
    img = Image.open(io.BytesIO(B[o:o + bv["byteLength"]]))
    img.load()
    return pos.astype(np.float32), nrm, uv, idx.astype(np.int64), img


# --------------------------------------------------------------------------- helpers
def weld_ids(pos):
    """Id per vertex such that identical positions share an id."""
    _, inv = np.unique(np.ascontiguousarray(pos).view(np.dtype((np.void, pos.dtype.itemsize * 3))).ravel(),
                       return_inverse=True)
    return inv.ravel()


def drop_junk(pos, idx):
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    w = weld_ids(pos)
    n = int(w.max()) + 1
    f = w[idx]
    r = np.concatenate([f[:, 0], f[:, 1], f[:, 2]])
    c = np.concatenate([f[:, 1], f[:, 2], f[:, 0]])
    g = coo_matrix((np.ones(len(r), dtype=np.int8), (r, c)), shape=(n, n))
    ncomp, lab = connected_components(g, directed=False)
    fl = lab[f[:, 0]]
    counts = np.bincount(fl, minlength=ncomp)
    keep = counts[fl] >= MIN_COMPONENT_FACES
    return keep, ncomp, int((counts < MIN_COMPONENT_FACES).sum())


def face_normals(pos, tri):
    return np.cross(pos[tri[:, 1]] - pos[tri[:, 0]], pos[tri[:, 2]] - pos[tri[:, 0]])


def smooth_normals(pos, tri, fallback):
    """Area-weighted smooth vertex normals.

    Faces are welded by position for the averaging (so UV seams stay smooth), but a face only
    contributes to a vertex if it lies on the same side as that vertex's own faces. Where a vertex is
    shared by faces that point to opposite sides (thin sheets, patches whose winding follows the
    source normals), the vertex is split in two (one per side) so every face keeps a normal that
    agrees with its winding. Returns (new_tri, vmap, normals): vmap maps new vertices to old ones."""
    pos = pos.astype(np.float64)
    nv = len(pos)
    fn = face_normals(pos, tri)          # length = 2 * area -> area weighting
    nf = len(tri)
    seed = np.zeros((nv, 3))
    for k in range(3):
        np.add.at(seed, tri[:, k], fn)
    seed_u = seed / np.maximum(np.linalg.norm(seed, axis=1, keepdims=True), 1e-30)
    w = weld_ids(pos.astype(np.float32))
    cw = w[tri].reshape(-1)              # welded id per corner
    cf = np.repeat(np.arange(nf), 3)
    order = np.argsort(cw, kind="stable")
    cw_s, cf_s = cw[order], cf[order]
    ng = int(w.max()) + 1
    start = np.searchsorted(cw_s, np.arange(ng), side="left")
    end = np.searchsorted(cw_s, np.arange(ng), side="right")
    vs, ve = start[w], end[w]
    acc = np.zeros((nv, 2, 3))           # [:, 1] = same side as the seed, [:, 0] = opposite side
    for k in range(int((ve - vs).max())):
        j = vs + k
        m = j < ve
        f = cf_s[np.minimum(j, len(cf_s) - 1)]
        side = (np.einsum("ij,ij->i", fn[f], seed_u) > 0).astype(np.int64)
        idx = np.nonzero(m)[0]
        acc[idx, side[idx]] += fn[f[idx]]
    # new vertex id per corner = old * 2 + side of the corner's own face
    own = np.einsum("fkj,fj->fk", seed_u[tri], fn) > 0          # (nf, 3)
    new_id = tri * 2 + own.astype(np.int64)
    used, inv = np.unique(new_id.ravel(), return_inverse=True)
    new_tri = inv.reshape(-1, 3)
    vmap = used // 2
    n = acc.reshape(-1, 3)[used]
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    bad = ln[:, 0] < 1e-20
    n = n / np.maximum(ln, 1e-20)
    if bad.any():
        n[bad] = fallback[vmap[bad]]
    return new_tri, vmap, n


def decimate(pos, uv_out, tri, target, texpng, work):
    """Texture-preserving quadric decimation through pymeshlab. Returns (pos, uv, tri) per-UV-vertex."""
    import pymeshlab
    obj = os.path.join(work, "part.obj")
    mtl = os.path.join(work, "part.mtl")
    with open(mtl, "w") as f:
        f.write("newmtl m\nKd 1 1 1\nmap_Kd %s\n" % os.path.basename(texpng))
    with open(obj, "w") as f:
        f.write("mtllib part.mtl\nusemtl m\n")
        np.savetxt(f, pos, fmt="v %.7g %.7g %.7g")
        np.savetxt(f, uv_out, fmt="vt %.7g %.7g")
        np.savetxt(f, np.c_[tri + 1, tri + 1].reshape(-1, 2, 3).transpose(0, 2, 1).reshape(-1, 6),
                   fmt="f %d/%d %d/%d %d/%d")
    ms = pymeshlab.MeshSet()
    ms.load_new_mesh(obj)
    log("    loaded %d faces" % ms.current_mesh().face_number())
    passes = [(True, 0.5)] * 3 + [(False, 0.5)] * 4 + [(False, 0.3)] * 3
    for i, (pb, q) in enumerate(passes):
        cur = ms.current_mesh().face_number()
        if i > 0 and cur <= target * 1.10:
            break
        ms.meshing_decimation_quadric_edge_collapse_with_texture(
            targetfacenum=int(target), preserveboundary=pb, qualitythr=q)
        log("    pass %d (preserveboundary=%s): %d -> %d faces" % (i + 1, pb, cur, ms.current_mesh().face_number()))
    m = ms.current_mesh()
    V = m.vertex_matrix()
    F = m.face_matrix()
    W = m.wedge_tex_coord_matrix().reshape(-1, 3, 2)
    # one output vertex per (position vertex, uv) pair
    key = np.c_[F.reshape(-1), W.reshape(-1, 2)]
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.ravel()
    return V[uniq[:, 0].astype(np.int64)], uniq[:, 1:3], inv.reshape(-1, 3).astype(np.int64)


# --------------------------------------------------------------------------- import
def run_import(spec, src):
    from scipy.spatial import cKDTree
    from PIL import Image
    t0 = time.time()
    cfg = spec
    s = cfg["scale_m_per_unit"]
    cx, cz = cfg["slew_centre_src"]
    gy = cfg["ground_y_src"]
    cut = cfg["cut_y_src"]
    reg = cfg["undercarriage_region_src"]

    log("decoding %s" % src)
    pos, nrm, uv, idx, img = decode_glb(src)
    log("  %d verts, %d tris, image %s" % (len(pos), len(idx), img.size))

    keep, ncomp, njunk = drop_junk(pos, idx)
    log("  components: %d, junk components (<%d faces): %d, junk faces dropped: %d"
        % (ncomp, MIN_COMPONENT_FACES, njunk, int((~keep).sum())))
    idx = idx[keep]

    cen = pos[idx].mean(axis=1)
    is_u = ((cen[:, 1] < cut) & (cen[:, 0] >= reg["x_min"]) & (cen[:, 0] <= reg["x_max"])
            & (np.abs(cen[:, 2]) <= reg["z_abs_max"]))
    masks = {"undercarriage": is_u, "upper": ~is_u}
    log("  classified: undercarriage %d faces, upper %d faces (unclassified: 0, every face goes to one part)"
        % (int(is_u.sum()), int((~is_u).sum())))

    # transform to the output frame (metres, GL, +X forward)
    P = np.empty_like(pos, dtype=np.float64)
    P[:, 0] = -(pos[:, 0].astype(np.float64) - cx) * s
    P[:, 1] = (pos[:, 1].astype(np.float64) - gy) * s
    P[:, 2] = -(pos[:, 2].astype(np.float64) - cz) * s
    N = nrm.astype(np.float64).copy()
    N[:, 0] *= -1
    N[:, 2] *= -1
    uv_out_all = np.c_[uv[:, 0], 1.0 - uv[:, 1]]

    os.makedirs(TMP_DIR, exist_ok=True)
    texpng = os.path.join(TMP_DIR, "base.png")
    # pymeshlab only needs the file to exist for UV-based decimation; a small copy keeps loading fast
    img.convert("RGB").resize((256, 256), Image.BILINEAR).save(texpng)

    pivot_up = [0.0, (cut - gy) * s, 0.0]
    order = ["undercarriage", "upper"]
    buf = bytearray()
    meta = []
    summary = []
    for name in order:
        pc = cfg["parts"][name]
        log("part %s" % name)
        tri_src = idx[masks[name]]
        used, inv = np.unique(tri_src.ravel(), return_inverse=True)
        tri = inv.reshape(-1, 3).astype(np.int64)
        pp, pn, pu = P[used], N[used], uv_out_all[used]
        log("  source: %d verts, %d tris" % (len(pp), len(tri)))
        work = os.path.join(TMP_DIR, name)
        os.makedirs(work, exist_ok=True)
        wpng = os.path.join(work, "base.png")
        Image.open(texpng).save(wpng)

        dp, duv, dtri = decimate(pp, pu, tri, pc["target_tris"], wpng, work)
        log("  decimated: %d verts, %d tris (target %d)" % (len(dp), len(dtri), pc["target_tris"]))

        # drop degenerate (zero-area / repeated-index) faces
        a2 = np.linalg.norm(face_normals(dp, dtri), axis=1)
        ok = (a2 > 1e-16) & (dtri[:, 0] != dtri[:, 1]) & (dtri[:, 1] != dtri[:, 2]) & (dtri[:, 0] != dtri[:, 2])
        if not ok.all():
            log("  dropped %d degenerate faces" % int((~ok).sum()))
        dtri = dtri[ok]

        # reference normal per face: nearest source vertex to the face centroid
        tree = cKDTree(pp)
        cen_d = dp[dtri].mean(axis=1)
        _, nn = tree.query(cen_d)
        ref = pn[nn]
        gn = face_normals(dp, dtri)
        agree = np.einsum("ij,ij->i", gn, ref) > 0
        pct_before = 100.0 * agree.mean()
        dtri = np.where(agree[:, None], dtri, dtri[:, [0, 2, 1]])
        gn = face_normals(dp, dtri)
        pct_after = 100.0 * (np.einsum("ij,ij->i", gn, ref) > 0).mean()
        log("  winding agreement with source normals: %.2f%% before fix-up, %.2f%% after (%d faces flipped)"
            % (pct_before, pct_after, int((~agree).sum())))

        # smooth normals; fallback for degenerate welded sums = nearest source vertex normal
        _, nnv = tree.query(dp)
        dtri, vmap, vn = smooth_normals(dp, dtri, pn[nnv])
        dp, duv = dp[vmap], duv[vmap]
        vn /= np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)

        if name == "upper":
            dp = dp - np.array(pivot_up)
        pivot = [0.0, 0.0, 0.0] if name == "undercarriage" else pivot_up

        nv = len(dp)
        u32 = nv > 65535
        entry = {
            "name": name,
            "parent": pc["parent"],
            "pivot": [float(c) for c in pivot],
            "axis": [float(c) for c in pc["axis"]] if pc.get("axis") is not None else None,
            "limits": None,
            "color": "#ffffff",
            "texture": pc["texture"],
            "vertexCount": int(nv),
            "indexCount": int(dtri.size),
            "indexType": "u32" if u32 else "u16",
            "doubleSided": True,
            "source": "imported",
            "windingAgreement": round(pct_after, 3),
        }
        entry["position"] = len(buf)
        buf += dp.astype("<f4").tobytes()
        entry["normal"] = len(buf)
        buf += vn.astype("<f4").tobytes()
        entry["uv"] = len(buf)
        buf += duv.astype("<f4").tobytes()
        entry["index"] = len(buf)
        buf += dtri.astype("<u4" if u32 else "<u2").tobytes()
        while len(buf) % 4:
            buf += b"\0"
        meta.append(entry)
        lo, hi = dp.min(axis=0), dp.max(axis=0)
        line = "PART %s: %d verts, %d tris, bbox min/max (m) %s / %s" % (
            name, nv, len(dtri), np.round(lo, 3).tolist(), np.round(hi, 3).tolist())
        summary.append(line)
        print(line, flush=True)
        entry["_pct_before"] = pct_before

    pct_before_all = [m.pop("_pct_before") for m in meta]

    # texture
    tsz = cfg["texture"]["size"]
    tex = img.convert("RGB").resize((tsz, tsz), Image.LANCZOS)
    bio = io.BytesIO()
    tex.save(bio, format="JPEG", quality=cfg["texture"]["jpeg_quality"], optimize=True)
    uri = "data:image/jpeg;base64," + base64.b64encode(bio.getvalue()).decode("ascii")
    out_tex = os.path.join(ROOT, "assets", "textures_%s.js" % cfg["parts"]["upper"]["texture"].split("_")[0])
    with open(out_tex, "w") as f:
        f.write("window.TEXTURES = window.TEXTURES || {};\n")
        f.write('window.TEXTURES["%s"] = "%s";\n' % (cfg["parts"]["upper"]["texture"], uri))

    model = {"name": cfg["model_name"], "parts": meta, "data": base64.b64encode(bytes(buf)).decode("ascii")}
    out_dir = os.path.join(ROOT, "assets", "models")
    os.makedirs(out_dir, exist_ok=True)
    out_model = os.path.join(out_dir, cfg["model_name"] + ".js")
    with open(out_model, "w") as f:
        f.write("window.MODELS = window.MODELS || {};\n")
        f.write('window.MODELS["%s"] = %s;\n' % (cfg["model_name"], json.dumps(model, separators=(",", ":"))))

    import shutil
    shutil.rmtree(TMP_DIR, ignore_errors=True)
    tv = sum(m["vertexCount"] for m in meta)
    tt = sum(m["indexCount"] // 3 for m in meta)
    print("IMPORTED %s: %d parts, %d verts, %d tris, winding agreement before fix-up %s%%, model %.2f MB, texture %.2f MB, %.0fs"
          % (cfg["model_name"], len(meta), tv, tt, "/".join("%.1f" % p for p in pct_before_all),
             os.path.getsize(out_model) / 1048576, os.path.getsize(out_tex) / 1048576, time.time() - t0))


# --------------------------------------------------------------------------- check
def run_check(spec):
    name = spec["model_name"]
    mp = os.path.join(ROOT, "assets", "models", name + ".js")
    tp = os.path.join(ROOT, "assets", "textures_%s.js" % spec["parts"]["upper"]["texture"].split("_")[0])
    fails = []

    def fail(m):
        fails.append(m)
        print("FAIL " + m)

    if not os.path.exists(mp):
        fail("missing %s" % mp)
        print("FAILED (%d problems)" % len(fails))
        sys.exit(1)
    txt = open(mp).read()
    model = json.loads(txt[txt.index('= {') + 2:].rstrip().rstrip(";"))
    data = base64.b64decode(model["data"])
    parts = {p["name"]: p for p in model["parts"]}
    geo = {}
    for p in model["parts"]:
        nv, ni = p["vertexCount"], p["indexCount"]
        if p.get("indexType", "u16") == "u32" and nv <= 65535:
            fail("%s: u32 indices with only %d vertices" % (p["name"], nv))
        if p.get("indexType") == "u16" and nv > 65535:
            fail("%s: u16 indices with %d vertices" % (p["name"], nv))
        it = "<u4" if p.get("indexType") == "u32" else "<u2"
        pos = np.frombuffer(data, "<f4", nv * 3, p["position"]).reshape(-1, 3).astype(np.float64)
        nrm = np.frombuffer(data, "<f4", nv * 3, p["normal"]).reshape(-1, 3).astype(np.float64)
        uv = np.frombuffer(data, "<f4", nv * 2, p["uv"]).reshape(-1, 2).astype(np.float64)
        idx = np.frombuffer(data, it, ni, p["index"]).astype(np.int64).reshape(-1, 3)
        geo[p["name"]] = (pos, nrm, uv, idx)
        for k in ("position", "normal", "uv", "index"):
            if p[k] % 4:
                fail("%s: %s offset %d not 4-byte aligned" % (p["name"], k, p[k]))
        if idx.min() < 0 or idx.max() >= nv:
            fail("%s: indices out of range [%d, %d] for %d verts" % (p["name"], idx.min(), idx.max(), nv))
        ln = np.linalg.norm(nrm, axis=1)
        if not np.all(np.abs(ln - 1) < 1e-3):
            fail("%s: %d normals not unit length (min %.4f max %.4f)" % (
                p["name"], int((np.abs(ln - 1) >= 1e-3).sum()), ln.min(), ln.max()))
        if not np.isfinite(pos).all():
            fail("%s: non-finite positions" % p["name"])
        if not np.isfinite(uv).all() or uv.min() < -0.01 or uv.max() > 1.01:
            fail("%s: UVs not finite/within [-0.01,1.01] (min %.4f max %.4f)" % (p["name"], np.nanmin(uv), np.nanmax(uv)))
        tgt = spec["parts"][p["name"]]["target_tris"]
        tris = ni // 3
        if abs(tris - tgt) > 0.10 * tgt:
            fail("%s: %d tris outside +-10%% of target %d" % (p["name"], tris, tgt))
        # winding vs stored normals
        a, b, c = pos[idx[:, 0]], pos[idx[:, 1]], pos[idx[:, 2]]
        gn = np.cross(b - a, c - a)
        mn = nrm[idx].sum(axis=1)
        pct = 100.0 * (np.einsum("ij,ij->i", gn, mn) > 0).mean()
        ref = p.get("windingAgreement", 0.0)
        if pct < 98.0:
            fail("%s: winding/normal agreement %.2f%% < 98%%" % (p["name"], pct))
        if ref < 98.0:
            fail("%s: recorded source-normal agreement %.2f%% < 98%%" % (p["name"], ref))

    ex = spec["expect"]
    if "undercarriage" in geo and "upper" in geo:
        zs = np.r_[geo["undercarriage"][0][:, 2], geo["upper"][0][:, 2]]
        width = zs.max() - zs.min()
        if not ex["overall_width_m"][0] <= width <= ex["overall_width_m"][1]:
            fail("overall width %.3f m outside %s" % (width, ex["overall_width_m"]))
        xs = geo["undercarriage"][0][:, 0]
        tl = xs.max() - xs.min()
        if not ex["track_length_m"][0] <= tl <= ex["track_length_m"][1]:
            fail("track length %.3f m outside %s" % (tl, ex["track_length_m"]))
        ph = parts["upper"]["pivot"][1]
        if not ex["slew_pivot_height_m"][0] <= ph <= ex["slew_pivot_height_m"][1]:
            fail("slew pivot height %.3f m outside %s" % (ph, ex["slew_pivot_height_m"]))
        print("measured: width %.3f m, track length %.3f m, pivot height %.3f m" % (width, tl, ph))
    else:
        fail("missing parts")

    if os.path.getsize(mp) > MAX_MODEL_BYTES:
        fail("model JS %d bytes > 12 MB" % os.path.getsize(mp))
    if not os.path.exists(tp):
        fail("missing texture JS")
    elif os.path.getsize(tp) > MAX_TEXTURE_BYTES:
        fail("texture JS %d bytes > 3 MB" % os.path.getsize(tp))
    if fails:
        print("FAILED (%d problems)" % len(fails))
        sys.exit(1)
    print("OK import checks passed")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec", nargs="?", default=DEFAULT_SPEC)
    ap.add_argument("--src")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    spec = json.load(open(a.spec))
    if a.check:
        run_check(spec)
        return
    src = a.src or os.path.join(ROOT, spec["source"])
    run_import(spec, src)


if __name__ == "__main__":
    main()
