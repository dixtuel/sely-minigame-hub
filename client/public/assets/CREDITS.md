# Asset Credits

All third-party assets used in the Yankı (Echo) 3D game are **CC0 (public domain)** —
no attribution is legally required, but sources are logged here for traceability
(this repo is AGPL-3.0 and public, so every embedded asset's license was verified
before inclusion).

## Audio (`audio/`)

Source: [Kenney.nl](https://kenney.nl) — Creative Commons CC0.

| File | Origin pack | Original filename |
| --- | --- | --- |
| `footstep-00.ogg` … `footstep-03.ogg` | [RPG Audio](https://kenney.nl/assets/rpg-audio) | `footstep00.ogg`, `footstep01.ogg`, `footstep02.ogg`, `footstep04.ogg` |
| `gate-open.ogg` | [RPG Audio](https://kenney.nl/assets/rpg-audio) | `doorOpen_1.ogg` |
| `echo-pulse.ogg` | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `glass_002.ogg` |
| `mark-collect.ogg` | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `confirmation_002.ogg` |
| `listener-caught.ogg` | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `error_004.ogg` |

The low ambient drone heard in the background is synthesized at runtime via the
Web Audio API (`client/src/game/audio.ts`) — no sample file, no licensing surface.

## Textures (`textures/`)

Source: [ambientCG](https://ambientcg.com) — Creative Commons CC0 1.0 Universal
(confirmed site-wide at [ambientCG License](https://docs.ambientcg.com/license/)).
Downloaded at 1K resolution, then resized to 512×512 and re-compressed as JPEG for
web delivery — pixel data only, license terms are unaffected by the resize.

| File | Origin asset | Map |
| --- | --- | --- |
| `stone-wall-color.jpg` / `stone-wall-normal.jpg` | [Rock030](https://ambientcg.com/a/Rock030) | Color / NormalDX |
| `floor-basalt-color.jpg` / `floor-basalt-normal.jpg` | [Ground068](https://ambientcg.com/a/Ground068) | Color / NormalDX |
