"""Site props and backdrop:
- Blue oil drums (standing and lying down)
- Gravel/limestone piles and dirt pile
- Trees along edge of site
- White building backdrop box with window facade texture
All parts modelled with their local pivot at origin.
"""
import cadquery as cq

DRUM_R = 0.3
DRUM_H = 0.9


def build():
    # Standing oil drum: cylinder diameter 0.6m, height 0.9m along CQ Z (GL +Y)
    drum_up = cq.Workplane("XY").circle(DRUM_R).extrude(DRUM_H)

    # Lying oil drum: cylinder along CQ Y (GL -Z), resting on ground
    drum_lying = cq.Workplane("XZ").circle(DRUM_R).extrude(DRUM_H).translate((0, DRUM_H / 2, DRUM_R))

    # Gravel pile: mound lofted from base circle to smaller top circle
    gravel_pile = cq.Workplane("XY").circle(2.8).workplane(offset=1.1).circle(0.6).loft()

    # Dirt pile: slightly steeper cone/mound
    dirt_pile = cq.Workplane("XY").circle(2.2).workplane(offset=1.3).circle(0.4).loft()

    # Simple tree: cylindrical trunk + 2-tier octagonal foliage canopy
    trunk = cq.Workplane("XY").circle(0.22).extrude(2.2)
    canopy_lower = cq.Workplane("XY").polygon(8, 3.0).extrude(1.6).translate((0, 0, 2.0))
    canopy_upper = cq.Workplane("XY").polygon(8, 2.2).extrude(1.4).translate((0, 0, 3.2))
    tree_shape = trunk.union(canopy_lower).union(canopy_upper)

    # Building backdrop box: 24m wide (GL X), 8m deep (GL Z), 10m tall (GL Y)
    # CQ frame: 24m along X, 8m along Y, 10m along Z
    building_shape = cq.Workplane("XY").box(24.0, 8.0, 10.0).translate((0, 0, 5.0))

    return [
        {
            "name": "drum_stand_1", "parent": None,
            "pivot": [0, 0, 0], "axis": None, "limits": None,
            "shape": drum_up, "color": "#1858a8", "texture": None,
        },
        {
            "name": "drum_stand_2", "parent": None,
            "pivot": [0, 0, 0], "axis": None, "limits": None,
            "shape": drum_up, "color": "#1a5fab", "texture": None,
        },
        {
            "name": "drum_lying", "parent": None,
            "pivot": [0, 0, 0], "axis": None, "limits": None,
            "shape": drum_lying, "color": "#155099", "texture": None,
        },
        {
            "name": "gravel_pile", "parent": None,
            "pivot": [0, 0, 0], "axis": None, "limits": None,
            "shape": gravel_pile, "color": "#dcd8ce", "texture": "gravel", "uv_scale": 0.5,
        },
        {
            "name": "dirt_pile", "parent": None,
            "pivot": [0, 0, 0], "axis": None, "limits": None,
            "shape": dirt_pile, "color": "#7a583a", "texture": "gravel", "uv_scale": 0.5,
        },
        {
            "name": "tree_1", "parent": None,
            "pivot": [0, 0, 0], "axis": None, "limits": None,
            "shape": tree_shape, "color": "#386634", "texture": None,
        },
        {
            "name": "tree_2", "parent": None,
            "pivot": [0, 0, 0], "axis": None, "limits": None,
            "shape": tree_shape, "color": "#2e592a", "texture": None,
        },
        {
            "name": "tree_3", "parent": None,
            "pivot": [0, 0, 0], "axis": None, "limits": None,
            "shape": tree_shape, "color": "#3b6c37", "texture": None,
        },
        {
            "name": "building", "parent": None,
            "pivot": [0, 0, 0], "axis": None, "limits": None,
            "shape": building_shape, "color": "#f0f2f5", "texture": "facade", "uv_scale": 0.2,
        },
    ]


EXPECT = {
    "drum_stand_1": {"bbox_size": [DRUM_R * 2, DRUM_H, DRUM_R * 2], "tol": 0.01},
    "building": {"bbox_size": [24.0, 10.0, 8.0], "tol": 0.01},
}
