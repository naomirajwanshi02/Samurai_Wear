# ⛩ Samurai Wear: a scan-to-wear WebAR samurai helmet

Point your phone at the printed **Samurai Wear card**. When the card is recognised the armour
room opens. Turn the camera round to yourself and put on the **Ō-yoroi** helmet of the first samurai,
with its iron face guard (happuri) and armour, then take a photo. Made for ages 8–14.

**Play:** https://naomirajwanshi02.github.io/Samurai_Wear/ · **Locally:** `http://localhost:8127/`
**Without the card:** https://naomirajwanshi02.github.io/Samurai_Wear/?demo=1 · **Without any camera:** https://naomirajwanshi02.github.io/Samurai_Wear/?preview=1
**The card to scan:** [`target.png`](target.png)

## How it works

1. **Camera permission.** A plain first screen asks for the camera. It is skipped if already allowed.
2. **Scan.** MindAR *image* tracking watches the back camera until it sees the card, then shuts down.
3. **Welcome.** A short card explains samurai armour. **Allow camera & start** starts the selfie camera.
4. **Wear.** MindAR *face* tracking (MediaPipe Face Landmarker, 468 landmarks) follows your face, and the
   helmet is worn the way a head-wear lens is:
   - **Pinned to the head.** The helmet rides the whole-face pose (MindAR's `faceMatrix`), so it sits on
     your head and turns with it.
   - **Steady.** A helmet magnifies tracking noise (its crown and horn tips are 15–25 cm from the middle of
     the face), so the pose is stabilised with a One Euro filter (`js/stabilise.js`): heavy smoothing when
     you are still, opening up as you move so it does not lag. Position, depth (the noisiest) and rotation
     each have their own filter, and the face guard's landmarks are smoothed too. MindAR's own filter is
     kept light (its units are milliseconds, so a large `filterBeta` switches its smoothing off). On a
     noisy test feed this made the crown about 3× steadier frame to frame, and on a moving face it trails
     the raw pose by about 1.5 mm.
   - **Wraps the head.** The bowl is sized for a head with hair (children's heads are large for their faces):
     its rim sits on the brows at the front and drops to the nape at the back. The neck guard hangs from the
     rim all the way round and its top lames come forward past the ears and temples; the flaps turn back from
     its front edge.
   - **Hides behind you.** Three depth-only occluders stand in for you: the **live face mesh** (reshaped
     every frame), a skull and a neck. Whatever is behind your real face or head (the far flap, the far side
     of the neck guard when you turn) is hidden exactly, so the helmet goes round your head instead of
     drawing across your face.
   - **Fits the face.** The iron happuri is *skinned* to the live landmarks so it follows your face shape;
     its cheek plates sit clear of a smiling cheek.
   - The armour hangs from your neck and turns only a quarter as far as your head, the way a body does.
   - The name card shrinks to its title after 5 seconds so it never hides the helmet; tap it to open it.
5. **Toggles.** **Face guard** puts the happuri on or off (it starts on; the red chin cord ties the helmet on either way).
   **Armour** shows or hides the cuirass, shoulder guards and skirt.
6. **Photo.** The round button saves the mirrored selfie with the armour and a small caption plate.

## The Ō-yoroi 大鎧

The "great armour" of the first samurai, the mounted archers of the Heian and Kamakura periods
(900s–1300s). It follows reference 2 (`assets/refs/oyoroi-ref.webp`) and was cross-checked part by part
against period descriptions, chiefly the National Treasure red-laced ō-yoroi of Kasuga Taisha
(赤絲威鎧, late Kamakura) and the blue-laced ō-yoroi of Ōyamazumi Shrine (紺絲威鎧). Sources are in
[SOURCES.md](SOURCES.md).

| Part | | What is built |
|---|---|---|
| **Hoshi kabuto** | 星兜 | black-lacquered iron bowl of 16 riveted plates, each plate standing proud of the next; rows of big raised rivets (厳星) growing toward the rim |
| **Shinodare** | 篠垂 | gilt strips with leaf-shaped arrow tips running down from the crown, three in front and three behind (六方白), riveted |
| **Tehen no za** | 天辺の座 | the open hole at the crown (for the topknot) with a stacked gilt chrysanthemum seat |
| **Koshimaki** | 腰巻 | the band round the rim, black with a gilt edge |
| **Mabizashi** | 眉庇 | the visor, its top faced with stencilled leather (egawa), dark underneath, gilt-edged |
| **Kuwagata-dai** | 鍬形台 | the horn stand **on the visor**, bearing a gilt lion's face (獅噛) with red jewelled eyes |
| **Kuwagata** | 鍬形 | two tall gilt horns rising from the stand, with an engraved line along each |
| **Shikoro** | 錣 | five red-laced lames hanging steeply in the cedar shape (杉形), each lapping over the next; red-and-white cross-knots (菱縫) on the bottom lame |
| **Fukigaeshi** | 吹返 | the front ends of the upper four lames turned back beside the face: the top one a big leather-faced flap with a gilt rim and rosettes, the three below as stepped laced ends |
| **Shinobi-no-o** | 忍緒 | the red chin cord, knotted under the chin |
| **Happuri** | 半首 | the face guard of the period: black-lacquered iron over the forehead and both cheeks, gilt-edged, leaving the eyes, nose and mouth open |
| **Dō** | 胴 | the boxy, red-laced cuirass, nearly as wide at the waist as the chest |
| **Munaita** | 胸板 | the leather-faced, gilt-edged breastplate across the top |
| **Tsurubashiri** | 弦走韋 | the stencilled leather down the front, so the bowstring cannot catch on the lacing |
| **Sendan-no-ita / Kyūbi-no-ita** | 栴檀板・鳩尾板 | the chest guards in front of the armpits: three laced lames on the right, one solid leather-faced plate on the left |
| **Watagami / Shōji-no-ita** | 肩上・障子の板 | the shoulder straps and the upright guards by the neck that stop the shoulder guards hitting the head |
| **Ō-sode** | 大袖 | the great shoulder guards: big, nearly flat panels of seven red-laced lames under a leather-faced top plate with gilt rosettes |
| **Kusazuri** | 草摺 | the box skirt of four panels of five lames (front, left, right; the back one is behind you) |

**Left out on purpose, because they are from later armour:** the wide, flat "umbrella" neck guard (笠錣,
Muromachi period) and the menpō face mask with a nose and moustache (from the mid-1400s). The big decorative
bow on the back (agemaki) is not built because it is never seen in a selfie.

The egawa leather is painted as the period's stencilled deer-skin: a buff ground of indigo "hail" dots
(霰地) with peony roundels. The lacing is aka-ito odoshi: black-lacquered scales laced with red silk.

No 3D model files are downloaded: the suit is built in the browser from code (`js/armour.js`), in
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
- The compiled target scores **3,358 detection points over 11 scales, with 43 tracking points**
  (Noh_Masks' card: 3,623 / 52).

## Files

| File | What it is |
|---|---|
| `index.html` | The screens: permission, viewfinder, welcome, armour room, photo. |
| `js/app.js` | The flow: scan → welcome → camera → tray and toggles, plus hints, facts and photo. |
| `js/scan.js` | Card recognition (MindAR image). |
| `js/stage.js` | Face AR (MindAR face): the helmet on the face pose, the armour on the neck, the no-camera preview on MindAR's canonical face, photos. |
| `js/armour.js` | The Ō-yoroi, part by part (see the table above), and the head/neck occluders. |
| `js/paint.js` | Canvas painters: red-laced lames (kebiki) with cross-knots, egawa stencilled leather, lacquer grain. |
| `js/data.js` | Names, kanji, eras, kid-friendly blurbs, parts and facts. |
| `js/face-fit.js` / `js/face-model.js` | MindAR's canonical face, the face shell the happuri is carved on, and the landmark skinning (shared with Noh_Masks). |
| `js/look.js` | Lighting, environment, tone mapping and room-light matching (shared with Noh_Masks). |
| `tools/suit-sheet.html` | Renders the suit on the canonical face. `?yaw=0.5&menpo=0&body=0&dist=80`. `?save=1` rewrites `assets/thumbs/oyoroi.png`. |
| `tools/make-target.html` | Redraws `target.png` from the thumbnails and compiles `targets.mind` (`?build=1`). |
| `tools/serve.ps1` | A local dev server (no Node or Python needed); localhost counts as secure for the camera. |

## Run locally

```bash
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```

Then open http://localhost:8127/.

**Testing face tracking without a camera:** `?demo=1&fakecam=<image url>` plays a photo (it must allow
cross-origin use, as Wikimedia Commons images do) as the selfie video, and real face tracking runs on it.
`&fakezoom=2` brings the face closer, `&fakemove=1` sways it and `&fakenoise=1` adds camera grain and shake (for testing the stabiliser). For example,
`?demo=1&fakezoom=2.4&fakecam=https%3A%2F%2Fthumb.wikimedia.org%2Fwikipedia%2Fcommons%2Fthumb%2F0%2F06%2FBoy_smiling.jpg%2F960px-Boy_smiling.jpg`
(“Boy smiling”, CC BY 2.0, Wikimedia Commons). On a phone the page must be served over HTTPS (for example GitHub Pages,
like the other repos), because phones only allow the camera on secure pages.

Version pins: `mind-ar@1.2.5` needs `three@0.160.0`, because three r162 removed `sRGBEncoding`.
