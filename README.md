<div align="center">

# Student Art Museum

**Turn a folder of student artwork into a 3D gallery they can walk through.**

Drop in the scans, write the wall labels, hand out a six-character code —
the whole class explores the same exhibition from their own devices.

<sub>
No build step · No install · No account required<br>
Plain HTML, CSS and JavaScript · three.js r128
</sub>

</div>

---

## Try it in thirty seconds

Double-click **`student-art-museum.html`**. Drop in a few images, click **Enter museum**, and walk around with `W A S D`.

That's the whole thing. To share a museum with a class you'll need it on the web — see **[SETUP.md](SETUP.md)**.

> Keep the `css` and `js` folders next to the HTML file. On its own the page opens blank.

---

## How a class session runs

| | |
|---|---|
| **1. Collect** | Drag in **PNG, JPG, MP3, MP4 or MOV** — one at a time or the whole class at once. Images are resized to 1200 px; a track gets generated cover art, a video gets a poster frame lifted from it. |
| **2. Label** | Each work gets an artwork name, the student's name, and the story behind it. Star one piece to hang it on the feature wall. |
| **3. Curate** | Optional. Drag the cards into the order you want. The **Main Exhibition** is the rotunda you arrive in and holds 13. Add rooms — rename one straight in the list, then click it to tick what hangs there, up to 18 each. The room keeps its number whatever you call it, so ② stays ② when it becomes Sculpture. One work is always on the feature wall; the first uploaded takes it unless you choose another. |
| **4. Walk** | Left alone the floorplan builds itself. The Main Exhibition fills first — the feature wall and 12 around the rotunda — and until a direction is needed it holds a piece of sculpture rather than a door, so the room you arrive in is finished from the first upload. Past 13, rooms open **north, south, east, west**, five works each, and those four fill to ten each before a corner is opened at all; then **north-east, south-east, south-west, north-west** on the same ladder. Eight directions is the limit, and only once every one of them holds ten does a section reach further out — another room beyond the first, under the same name, with a doorway through. |
| **5. Share** | **Share museum** issues a code like `ABC-234`. Students type it in and they're standing in the same rooms. |

Codes skip `I`, `L`, `O`, `0` and `1` — nothing a student can misread aloud.

**How much it holds — 153 works.** Eight sections of 18, the feature wall, and the
eight rotunda facets still walled once all eight doorways are open. Fill it and the
museum says so and takes no more, rather than accepting artwork it has nowhere to
hang. Presentation slides are counted separately and never come out of this.

---

## Inside the museum

A domed rotunda with eight doorways, a glazed oculus, brass-trimmed walls and an LED title ring spelling out your exhibition name. Every section carries a numbered, lit sign above its doorway — ① Photography — and reaches outward as far as it needs to, one room opening into the next. A facet with no room behind it stays a wall and hangs work, and the four that have not been opened yet each hold a piece of sculpture. Daylight drifts across the floor. Other visitors wander the galleries and pause in front of the work.

The fit-out is cut from one palette — cream limestone, speckled travertine, terracotta, olive, charcoal and pale oak. Plinths carry pierced rings, faceted stones, balanced pebbles and thrown pots; a glass case and a brass rope barrier fill out the middle of the room. Deliberately sparse, and everything on the floor of a side room stands on its centre line, leaving 4.7 m of clear floor between it and either hanging wall. Nothing to sit on, nothing to edge around, nothing blocking a doorway: the walls are the exhibition.

Works hang 4.6 m apart, which is wider than it sounds and is measured in whole works rather than in frames — a picture carries a column of reactions either side of it and a patch of wall you can click, and two works whose reactions touch are two works you cannot react to separately. Four to a side wall, two to an end wall, and the widest picture the museum will hang still clears its neighbour.

The feature wall carries two washes down the stone and two soft, warm-neutral lamps on the work itself, set by measuring a colour chart hung there against the same chart hung in the rotunda: the work reads a third brighter than an ordinary hung piece and a little brighter than the wall behind it, and keeps 91% of its saturation with nothing clipped.

**Controls**

| Key | Does |
|---|---|
| `W A S D` / arrows | Walk |
| Mouse | Look around — click once to take control, or just hold and drag |
| `Q` `E` | Turn, keyboard only |
| `Shift` | Sprint |
| `Z` / scroll | Zoom in on detail |
| `V` | First person ↔ follow your avatar |
| Click a work | Read its name, artist and story — large, with the label underneath |
| Click a visitor | Ask somebody in your way to step aside |
| Play button on a work | Start or pause a video or track. Videos also get a sound toggle |
| `1` `2` `3` `4` | Pick a sticker, then click beside a frame |
| `5` / `0` | Eraser / put stickers away |
| `P` | Selfie mode — take a photograph of yourself in the gallery |
| Presentation screen | Arrows step the slides; click a slide to look closer, or with a sticker chosen, to react to it |
| `M` `H` | Map · Controls |

On a tablet: drag the left circle to walk, drag anywhere else to look, tap a work to open it. The camera chip in the left rail opens selfie mode.

**Stickers** — award <kbd>1</kbd> Wonderful work · <kbd>2</kbd> Amazing effort · <kbd>3</kbd> Excellent standard · <kbd>4</kbd> Standout achievement.

**Audio and video** — nothing plays until someone presses play. Sound is local: loudest beside a work, fading to silence about 14 m away, and only the nearest three are ever audible at once. Three videos play at a time; starting a fourth stands down whichever is furthest off. A clip loops once started; pausing it leaves it paused.

**Music** — a track does not hang in a frame. It gets a strip of wall above a work: title, one button, and a waveform that fills as it plays and settles when paused. Give it a cover and it hangs as a picture with the strip above that instead.

**Presentation** — export your slides as PNG or JPG (in PowerPoint, **File ‣ Export ‣ PNG**) and add them on the setup screen. They hang on the back of the feature wall in the order you add them: one slide at a time, arrows either side, and the position in the deck. Nothing advances on its own and nothing can be edited from inside. Click a slide and it opens at about four fifths of the window with the gallery still visible, softened, behind it. Each slide takes stickers of its own, kept against that slide and no other.

Reading `.pptx` in the browser was tried and withdrawn — text overlapped where layouts were inherited, and several large pictures at once could take the museum down. A picture of a slide is what PowerPoint puts on a projector anyway, and nothing about it can go wrong. `js/pptx.js` is still in the repository, unloaded, if it is ever worth another attempt.

**Selfies** — press <kbd>P</kbd> in front of a work and you turn to face the camera with the artwork behind you, phone raised. Drag to reframe, scroll for how far away it is held, then press the shutter: the photograph is the gallery itself, with no map, chips or controls in it. Save it, take another, or press <kbd>P</kbd> to carry on walking from exactly where you stopped.

**Cover art** — an MP3 or MP4 can be given its own PNG or JPG from the setup screen. It becomes the picture on the wall and the poster before playback; the clip itself is untouched, and it stays optional.

Stickers you place before publishing travel with the museum. Anything a student adds while exploring stays on their own device.

---

## Saving and sharing

**Save** downloads the whole museum as a single `.json` file — artwork, labels and stickers — that **Open saved museum** restores later.

For join codes, pick one home for your sessions in **`js/config.js`**:

| Option | Trade-off |
|---|---|
| **Supabase** | Free, codes work instantly. Artwork sits on a third-party service. |
| **Your own endpoint** | Full control. Needs a Worker or similar — one is written for you in SETUP.md. |
| **This repository** | No accounts, student work never leaves your GitHub. Costs one commit per session. |

Leave all three blank and it uses the repository option automatically.

> Treat a code like a classroom password, not a lock — anyone with the link and the code can view that museum.

Full walkthrough: **[SETUP.md](SETUP.md)**.

---

## Project structure

```
index.html                markup and the load order — nothing else
css/                      base · upload · share · museum · responsive
js/
  config.js               ← the only file most people edit
  state, codes, sessions        artwork list, join codes, session files
  media                         audio and video artworks, playback, cover art
  deck                          the slide images on the back of the feature wall
  music-panel                   the wall strip a track gets instead of a frame
  geometry, rooms, floorplan    room shape and curation, shared by the plan and the build
  upload, join, publish         the setup screen
  runtime                       variables the 3D files share
  textures … overlays           surfaces, architecture, people, cards
  selfie                        photo mode: the camera, the pose, the print
  renderer                      the frame loop
  input, hud, main              controls and the door between screens
```

**Editing it:** change a file, refresh the browser. There is nothing to install and nothing to compile.

The `<script>` tags are ordinary ones rather than ES modules, because modules refuse to run from a `file://` page and this has to keep working when it's simply double-clicked. They share one scope, so **the order in the HTML matters** — each file may only rely on the ones above it.

---

## If something misbehaves

| | |
|---|---|
| **Mouse won't turn the camera** | Some browsers refuse to hand it over. Hold the left button and drag instead — that always works. `Q` and `E` turn from the keyboard. |
| **"THREE is not defined"** | A school filter is blocking the 3D library. The page tries three mirrors; to remove the dependency entirely, see SETUP.md. |
| **Page opens blank** | The `css` and `js` folders aren't beside the HTML file. |
| **Session feels slow to load** | Check the size in the share panel. Around 25 works lands near 3 MB; video is far heavier, so trim clips before adding them. Files over 200 MB are refused. |
| **A .pptx won't upload** | It isn't meant to. Export the slides as images — **File ‣ Export ‣ PNG** in PowerPoint, **File ‣ Download ‣ PNG** in Google Slides — and add those. |
| **A .mov won't play** | Chrome often cannot decode QuickTime. It still hangs and takes stickers, but shows a placeholder — re-export as MP4 (H.264). |

---

<div align="center">
<sub>Designed by Mr Wang · V1.2</sub>
</div>
