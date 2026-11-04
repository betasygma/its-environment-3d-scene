"""Run every check in the project and print one line per check plus a summary.

Usage: python3 tools/check_all.py   (on Windows: python tools/check_all.py)

Order: CadQuery models (export + geometry check), imported excavator (check only — no re-import),
Node tests, headless render check. Exit code 1 if anything fails.
"""
import glob
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = sys.executable


def run(label, cmd):
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    lines = [l for l in (r.stdout + "\n" + r.stderr).splitlines()
             if l.startswith(("OK", "FAIL", "FAILED", "RENDER", "EXPORTED", "TEXTURES"))]
    ok = r.returncode == 0
    if ok:
        print(f"OK   {label}: {lines[-1] if lines else 'passed'}")
    else:
        print(f"FAIL {label}")
        for l in (lines or (r.stdout + r.stderr).strip().splitlines()[-5:]):
            print("     " + l)
    return ok


def main():
    results = []
    for builder in sorted(glob.glob(os.path.join(ROOT, "builders", "*.py"))):
        name = os.path.splitext(os.path.basename(builder))[0]
        results.append(run(f"export {name}", [PY, "tools/export.py", f"builders/{name}.py"]))
        if results[-1]:
            results.append(run(f"geometry {name}", [PY, "tools/check_model.py", name]))
    if os.path.exists(os.path.join(ROOT, "assets", "models", "excavator.js")):
        results.append(run("import excavator", [PY, "tools/import_glb.py", "--check"]))
    for test in sorted(glob.glob(os.path.join(ROOT, "tests", "*.test.js"))):
        results.append(run(f"test {os.path.basename(test)}", ["node", os.path.relpath(test, ROOT)]))
    results.append(run("render", [PY, "tools/render_check.py"]))

    failed = results.count(False)
    print(f"{'ALL OK' if not failed else 'FAILED'}: {len(results) - failed}/{len(results)} checks passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
