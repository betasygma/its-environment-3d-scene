"""Headless render check: opens index.html?test from file:// in headless Chrome and prints
the page's one-line self-check result (RENDER OK / RENDER FAIL ...).

Usage:
  python3 tools/render_check.py                 # self-check
  python3 tools/render_check.py --shot out.png  # also save a screenshot of the normal view
  python3 tools/render_check.py --shot out.png --cam 0,0.15,14   # screenshot from yaw,pitch,distance

Chrome is found via $CHROME or the usual names. Software rendering (SwiftShader) is used so it
works without a GPU.
"""
import html
import os
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
FLAGS = ["--headless=new", "--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--allow-file-access-from-files", "--virtual-time-budget=8000", "--hide-scrollbars"]


WINDOWS_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def find_chrome():
    for c in [os.environ.get("CHROME"), "google-chrome", "chromium", "chromium-browser", "chrome", "msedge"]:
        if c and shutil.which(c):
            return shutil.which(c)
    for p in WINDOWS_PATHS:
        if os.path.isfile(p):
            return p
    print("FAIL render: no Chrome/Edge found (set the CHROME environment variable to its path)")
    sys.exit(2)


def main():
    chrome = find_chrome()
    page = (ROOT / "index.html").as_uri()
    out = subprocess.run([chrome, *FLAGS, "--dump-dom", page + "?test"],
                         capture_output=True, text=True, timeout=120).stdout
    m = re.search(r'<pre id="status">([^<]*)</pre>', out)
    line = html.unescape(m.group(1).strip()) if m else "RENDER FAIL no status (page did not finish)"
    print(line)

    if "--shot" in sys.argv:
        dest = pathlib.Path(sys.argv[sys.argv.index("--shot") + 1]).resolve()
        cam = "&cam=" + sys.argv[sys.argv.index("--cam") + 1] if "--cam" in sys.argv else ""
        subprocess.run([chrome, *FLAGS, "--window-size=1280,800", f"--screenshot={dest}", page + "?shot" + cam],
                       capture_output=True, timeout=120)
        print(f"SHOT {'OK' if dest.exists() else 'FAIL'} {dest}")

    sys.exit(0 if line.startswith("RENDER OK") else 1)


if __name__ == "__main__":
    main()
