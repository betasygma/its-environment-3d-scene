"""Smoke-test builder: a single 2 x 1 x 0.5 m box (CadQuery Z-up frame)."""
import cadquery as cq


def build():
    return [{
        "name": "box", "parent": None,
        "pivot": [0, 0, 0], "axis": None, "limits": None,
        "shape": cq.Workplane("XY").box(2.0, 1.0, 0.5),   # centred at origin
        "color": "#8c8f91", "texture": "checker",
    }]


# Expected sizes in the GL (Y-up) frame: CQ (2, 1, 0.5) -> GL (2, 0.5, 1)
EXPECT = {"box": {"bbox_size": [2.0, 0.5, 1.0], "tol": 0.001}}
