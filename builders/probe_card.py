"""Alpha probe card: 2 x 2 m thin card (0.02 m thick) with fit UVs and alpha_cutoff = 0.5."""
import cadquery as cq


def build():
    # In CadQuery Z-up: 2m wide along X, 0.02m thin along Y, 2m tall along Z
    # GL frame: (x, z, -y) -> 2m along X, 2m along Y, 0.02m thin along Z
    # Centered at origin, front face facing +Z / -Z
    card = cq.Workplane("XY").box(2.0, 0.02, 2.0)
    return [{
        "name": "probe_card", "parent": None, "pivot": [0, 0, 0], "axis": None, "limits": None,
        "shape": card, "color": "#ffffff", "texture": "probe_half", "uv_mode": "fit", "alpha_cutoff": 0.5
    }]


EXPECT = {"probe_card": {"bbox_size": [2.0, 2.0, 0.02], "tol": 0.005}}
