"""Ground slab: 40 x 40 m, top surface at height 0 (GL y = 0), gravel texture repeating every 4 m."""
import cadquery as cq

SIZE = 40.0
THICK = 0.2


def build():
    slab = cq.Workplane("XY").box(SIZE, SIZE, THICK).translate((0, 0, -THICK / 2))
    return [{
        "name": "ground_slab", "parent": None, "pivot": [0, 0, 0], "axis": None, "limits": None,
        "shape": slab, "color": "#d9d6cf", "texture": "gravel", "uv_scale": 0.25,
    }]


EXPECT = {"ground_slab": {"bbox_size": [SIZE, THICK, SIZE], "tol": 0.001}}
