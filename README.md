# ⛩ Samurai Wear: a scan-to-wear WebAR samurai helmet

Point your phone at the printed **Samurai Wear card**. When the card is recognised the armour
room opens. Turn the camera round to yourself, pick one of two samurai helmets from the bottom
row and wear it, with its iron face guard and armour if you like, then take a photo. Made for ages 8–14.

**Play:** https://naomirajwanshi02.github.io/Samurai_Wear/ · **Locally:** `http://localhost:8127/`
**Without the card:** https://naomirajwanshi02.github.io/Samurai_Wear/?demo=1 · **Without any camera:** https://naomirajwanshi02.github.io/Samurai_Wear/?preview=1 · **Start with a suit:** `?suit=oyoroi`
**The card to scan:** [`target.png`](target.png)

## How it works

1. **Camera permission.** A plain first screen asks for the camera. It is skipped if already allowed.
2. **Scan.** MindAR *image* tracking watches the back camera until it sees the card, then shuts down.
3. **Welcome.** A short card explains samurai armour. **Allow camera & start** starts the selfie camera.
4. **Wear.** MindAR *face* tracking (MediaPipe Face Landmarker, 468 landmarks) follows your face, and the
   helmet is worn the way a head-wear lens is:
   - **Pinned to the head.** The helmet rides the whole-face pose (MindAR's `faceMatrix`), so it sits on
     your head and turns with it.
   - **Wraps the head.** The bowl is sized for a head with hair (children's heads are large for their faces):
     its rim sits on the brows at the front and drops to the nape at the back. The neck guard hangs from the
     rim all the way round and its top lames come forward past the ears and temples; the flaps turn back from
     its front edge.
   - **Hides behind you.** Three depth-only occluders stand in for you: the **live face mesh** (reshaped
     every frame), a skull and a neck. Whatever is behind your real face or head (the far flap, the far side
     of the neck guard when you turn) is hidden exactly, so the helmet goes round your head instead of
     drawing across your face.
   - **Fits the face.** The iron face guard is *skinned* to the live landmarks so it follows your face shape;
     its mouth stays shut when you talk.
   - The armour hangs from your neck and turns only a quarter as far as your head, the way a body does.
   - The name card shrinks to its title after 5 seconds so it never hides the helmet; tap it to open it.
5. **Toggles.** **Face guard** puts the menpō on or off (off, a red silk chin cord ties the helmet on).
   **Armour** shows or hides the cuirass, shoulder guards and skirt.
6. **Photo.** The round button saves the mirrored selfie with the armour and a small caption plate.

| # | Suit | | Era | Following | Built with |
|---|---|---|---|---|---|
| 01 | **Tōsei Gusoku** | 当世具足 | 1500s–1800s | reference 1 (`assets/refs/tosei-ref.png`) | a russet-iron bowl of 32 riveted plates (hoshi-bachi) with a gilt tehen ring; a wide umbrella neck guard (kasa-jikoro) of five dark lames with spaced blue lacing (sugake); black lacquered flaps with gilt crests; a russet-iron **menpō** with a hooked nose, cheek folds, moustache and red lacquered lips over white teeth; a throat guard with a row of beads and a tan cord; a cuirass of dark plate rows laced in blue with gilt studs, a gilt ring and lacquered scrolls; blue-laced shoulder guards |
| 02 | **Ō-yoroi** | 大鎧 | 900s–1300s | reference 2 (`assets/refs/oyoroi-ref.webp`) | a black lacquered bowl of 24 plates with big rivets; two tall **gilt kuwagata** horns on a gilt base plate with a sword-shaped crest between them; large flaps of stencilled leather (egawa) with gilt rosettes; a neck guard of five lames in dense red lacing (kebiki) with white-and-red cross-knots (hishinui); a red-laced cuirass with a stencilled leather chest panel (tsurubashiri); big red shoulder guards |

No 3D model files are downloaded: both suits are built in the browser from code (`js/armour.js`), in
MindAR's canonical face units (centimetres), and painted with canvas textures (`js/paint.js`): every laced
lame has a colour map and a matching bump map so the silk cords stand up from the lacquered plates.

## The Anatomy look

The interface uses the [Anatomy](https://github.com/wheresryan22/anatomy) skill (MIT) in the same sepia
theme as Noh_Masks, Ramen_Builder, Bonsai and Pagoda: Anatomy plates with a mono `Fig. 0n` label top-left,
a title top-right, corner readouts, a lifted shadow and an ink hairline. [`css/anatomy-sepia.css`](css/anatomy-sepia.css)
holds the token set; the kit is in [`vendor/anatomy/`](vendor/anatomy); the skill is installed for this workspace at
`../.claude/skills/anatomy`.

## Printing the card

- Print `target.png` about **18 cm wide** (3:2, about 18 × 12 cm) on **matte** paper.
- Hold the phone 20–40 cm away, in even light. The card also works on a laptop or tablet screen.
- The compiled target scores **3,391 detection points over 11 scales, with 46 tracking points**
  (Noh_Masks' card: 3,623 / 52).

## Files

| File | What it is |
|---|---|
| `index.html` | The screens: permission, viewfinder, welcome, armour room, photo. |
| `js/app.js` | The flow: scan → welcome → camera → tray and toggles, plus hints, facts and photo. |
| `js/scan.js` | Card recognition (MindAR image). |
| `js/stage.js` | Face AR (MindAR face): the helmet on the face pose, the armour on the neck, suit swaps, the no-camera head-form preview, photos. |
| `js/armour.js` | The two suits: bowl, rivets, visor, neck guard, flaps, horns, menpō, throat guard, chin cord, cuirass, sode, kusazuri, and the head/neck occluders. |
| `js/paint.js` | Canvas painters: laced lames (kebiki and sugake), stencilled leather, iron grain, crest. |
| `js/data.js` | Names, kanji, eras, kid-friendly blurbs, parts and facts. |
| `js/face-fit.js` / `js/face-model.js` | MindAR's canonical face, the face shell the menpō is carved on, and the landmark skinning (shared with Noh_Masks). |
| `js/look.js` | Lighting, environment, tone mapping and room-light matching (shared with Noh_Masks). |
| `tools/suit-sheet.html` | Renders both suits on a head-form. `?id=tosei&yaw=0.5&menpo=0&body=0`. `?save=1` rewrites `assets/thumbs/`. |
| `tools/make-target.html` | Redraws `target.png` from the thumbnails and compiles `targets.mind` (`?build=1`). |
| `tools/serve.ps1` | A local dev server (no Node or Python needed); localhost counts as secure for the camera. |

## Run locally

```bash
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```

Then open http://localhost:8127/.

**Testing face tracking without a camera:** `?demo=1&fakecam=<image url>` plays a photo (it must allow
cross-origin use, as Wikimedia Commons images do) as the selfie video, and real face tracking runs on it.
`&fakezoom=2` brings the face closer and `&fakemove=1` sways it. For example,
`?demo=1&suit=tosei&fakezoom=2.4&fakecam=https%3A%2F%2Fthumb.wikimedia.org%2Fwikipedia%2Fcommons%2Fthumb%2F0%2F06%2FBoy_smiling.jpg%2F960px-Boy_smiling.jpg`
(“Boy smiling”, CC BY 2.0, Wikimedia Commons). On a phone the page must be served over HTTPS (for example GitHub Pages,
like the other repos), because phones only allow the camera on secure pages.

Version pins: `mind-ar@1.2.5` needs `three@0.160.0`, because three r162 removed `sRGBEncoding`.
