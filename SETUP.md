# Setup (Windows)

Only needed to re-export models or run the checks. Viewing the project needs nothing: double-click `index.html`.

1. **Python 3.10–3.13** and **Node.js 18+** on PATH (`python --version`, `node --version`).
   On Windows, use `python` wherever the docs say `python3`.
2. Packages: `python -m pip install -r requirements.txt` (cadquery and pymeshlab are large; a few minutes).
3. **Chrome or Edge** installed in the default location. If installed elsewhere, set `CHROME` to the exe path.
4. Verify: `python tools/check_all.py` → every line `OK`.

Recommended: put the folder under git (`git init`, commit after every finished backlog card) so any agent
mistake can be rolled back instead of debugged.

Heavy steps (rarely needed — their outputs are already in `assets/`):
- `python tools/import_glb.py` — re-import the Meshy excavator (~1–2 min). Only if the .glb or
  `spec/import_excavator.json` changes.
