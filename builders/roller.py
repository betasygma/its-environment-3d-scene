"""Road roller model: yellow articulated single-drum roller (~6 m long, 2.3 m wide, 3 m tall).
Parts:
  rear_frame (root): chassis, engine hood, cab
  wheel_l: rear left wheel
  wheel_r: rear right wheel
  front_frame: front articulation yoke, rotates about vertical axis (CQ +Z -> GL +Y)
  drum: cylindrical steel drum rotating about horizontal axle (CQ +Y -> GL -Z)
"""
import cadquery as cq

DRUM_R = 0.75
DRUM_W = 2.13
WHEEL_R = 0.75
WHEEL_W = 0.55
WHEEL_TRACK = 1.65


def build():
    # 1. drum: cylinder along CQ Y axis, axle at local origin (0, 0, 0)
    drum = cq.Workplane("XZ").circle(DRUM_R).extrude(DRUM_W).translate((0, DRUM_W / 2, 0))

    # 2. front_frame: yoke connecting articulation pivot at origin (0,0,0) to drum axle at (1.65, 0, 0)
    arm_l = cq.Workplane("XY").box(1.75, 0.12, 0.35).translate((0.825, DRUM_W / 2 + 0.08, 0.0))
    arm_r = cq.Workplane("XY").box(1.75, 0.12, 0.35).translate((0.825, -(DRUM_W / 2 + 0.08), 0.0))
    cross = cq.Workplane("XY").box(0.35, DRUM_W + 0.28, 0.35).translate((0.15, 0, 0.0))
    hitch_f = cq.Workplane("XY").box(0.35, 0.35, 0.55).translate((0.0, 0, 0.0))
    front_frame = arm_l.union(arm_r).union(cross).union(hitch_f)

    # 3. rear_frame: root part, articulation hitch at origin (0,0,0)
    # Chassis extending rearward (-X)
    chassis = cq.Workplane("XY").box(3.2, 1.8, 0.45).translate((-1.6, 0, 0.1))
    # Engine hood at rear
    hood = cq.Workplane("XY").box(2.0, 1.5, 0.85).translate((-2.2, 0, 0.75))
    # Cab base and glass cabin
    cab_base = cq.Workplane("XY").box(1.3, 1.5, 0.2).translate((-0.75, 0, 0.425))
    cab_body = cq.Workplane("XY").box(1.2, 1.4, 1.35).translate((-0.75, 0, 1.2))
    cab_roof = cq.Workplane("XY").box(1.35, 1.55, 0.1).translate((-0.75, 0, 1.925))
    hitch_r = cq.Workplane("XY").box(0.35, 0.35, 0.55).translate((-0.05, 0, 0.0))
    rear_frame = chassis.union(hood).union(cab_base).union(cab_body).union(cab_roof).union(hitch_r)

    # 4. rear wheels: cylinder along CQ Y axis, axle at local origin (0, 0, 0)
    wheel_l = cq.Workplane("XZ").circle(WHEEL_R).extrude(WHEEL_W).translate((0, WHEEL_W / 2, 0))
    wheel_r = cq.Workplane("XZ").circle(WHEEL_R).extrude(WHEEL_W).translate((0, WHEEL_W / 2, 0))

    return [
        {
            "name": "rear_frame", "parent": None,
            "pivot": [0, 0, 0], "axis": None, "limits": None,
            "shape": rear_frame, "color": "#e5a912", "texture": None,
        },
        {
            "name": "wheel_l", "parent": "rear_frame",
            "pivot": [-2.2, WHEEL_TRACK / 2, 0.0], "axis": [0, 1, 0], "limits": None,
            "shape": wheel_l, "color": "#282828", "texture": None,
        },
        {
            "name": "wheel_r", "parent": "rear_frame",
            "pivot": [-2.2, -WHEEL_TRACK / 2, 0.0], "axis": [0, 1, 0], "limits": None,
            "shape": wheel_r, "color": "#282828", "texture": None,
        },
        {
            "name": "front_frame", "parent": "rear_frame",
            "pivot": [0, 0, 0], "axis": [0, 0, 1], "limits": [-0.65, 0.65],
            "shape": front_frame, "color": "#cca010", "texture": None,
        },
        {
            "name": "drum", "parent": "front_frame",
            "pivot": [1.65, 0, 0.0], "axis": [0, 1, 0], "limits": None,
            "shape": drum, "color": "#5b6065", "texture": None,
        },
    ]


EXPECT = {
    "drum": {"bbox_size": [DRUM_R * 2, DRUM_R * 2, DRUM_W], "tol": 0.01},
    "wheel_l": {"bbox_size": [WHEEL_R * 2, WHEEL_R * 2, WHEEL_W], "tol": 0.01},
    "wheel_r": {"bbox_size": [WHEEL_R * 2, WHEEL_R * 2, WHEEL_W], "tol": 0.01},
}
