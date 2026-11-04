# Assignment brief and checklist

## Original (Tugas 2: Animasi, Object 3D, Lighting, Texture)
**Membuat Scene Area disekitar ITS (diluar teknik informatika)**
Tujuan: mahasiswa mampu menerapkan transformasi, camera, lighting, texture pada objek-objek 3D,
hierarchical modelling dengan WebGL.

Ketentuan: kelompok maks. 2 orang · implementasi dengan WebGL · 3 minggu · 1 mahasiswa mengumpulkan.

Deskripsi:
1. Buat animasi dari beberapa objek yang ada di lingkungan ITS.
2. Yang dikumpulkan: code + halaman utama berisi: (a) nama kelompok, (c) foto objek asli,
   (d) video objek asli, (e) halaman canvas aplikasi — canvas di dekat gambar agar tingkat
   kemiripan kelihatan, (f) desain tree hubungan antar objek, dan pembagian tugas.
3. Penilaian: kompleksitas · kemiripan dengan real · pembagian · lighting, texture ·
   kemampuan menjelaskan · kemampuan menyelesaikan challenge.

## Checklist (requirement -> how it is met -> status)
| # | Requirement | How | Status |
|---|---|---|---|
| T1 | Transformations | scene graph T·R·S, drive/turn/slew | done (excavator) |
| T2 | Camera | perspective + lookAt, orbit camera | done; preset/follow views = BACKLOG B6 |
| T3 | Lighting | Blinn-Phong, dusk sun + hemisphere ambient | basic done; polish = B5 |
| T4 | Texture | Meshy colour map, gravel, procedural textures | done (excavator, ground); more in B3/B4 |
| T5 | Hierarchical modelling | excavator → undercarriage → upper; roller → drum/wheels | excavator done; roller = B3; arm = B9 |
| D1 | Animation of several objects | excavator drives/slews; roller drives, drum rolls | excavator manual done; auto + roller = B3, B7 |
| D2a | Group name on page | main page | B1 (needs human input) |
| D2c | Real photos | `scene/*.jpg` on the page | B1 |
| D2d | Real video | human films it; page embeds it | **human** + B1 |
| D2e | Canvas beside the photos | main page layout | B1 |
| D2f | Object relationship tree | generated from the live scene graph | B2 |
| D2g | Division of tasks | page section | B1 (needs human input) |
| G5 | Explain the code | `docs/EXPLAIN.md` walkthrough + challenge drills | B10 |
