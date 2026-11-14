# ⛩ Samurai Wear: a scan-to-wear WebAR samurai helmet

Point your phone at the printed **Samurai Wear card**. When the card is recognised the armour
room opens. Turn the camera round to yourself and put on the **kabuto** helmet of a real samurai armour
from about 1650 in the Metropolitan Museum of Art, with its iron face mask (menpō) and armour, then take a photo. Made for ages 8–14.

**Play:** https://naomirajwanshi02.github.io/Samurai_Wear/ · **Locally:** `http://localhost:8127/`
**Without the card:** https://naomirajwanshi02.github.io/Samurai_Wear/?demo=1 · **Without any camera:** https://naomirajwanshi02.github.io/Samurai_Wear/?preview=1
**The card to scan:** [`target.png`](target.png), the reference illustration of the armour on the Anatomy card

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
   - **Fits the face.** The iron menpō is *skinned* to the live landmarks so it follows your face shape;
     its mouth stays shut when you talk.
   - The armour hangs from your neck and turns only a quarter as far as your head, the way a body does.
   - **Covers the whole head.** The bowl is sized for a head with hair, its brim sits on the eyebrows, and a dark
     lining wraps the sides and back of the head from the rim to below the jaw, so no hair or ears show between
     the mask and the neck guard (in the drawing, the space round the face inside the helmet is dark).
   - The screen stays clear for the AR: the name card shows just the name (it shrinks after 5 seconds; tap to
     open it), and there is no pop-up facts button. The Face guard and Armour toggles show the helmet thumbnail
     and go dim when off.
5. **Toggles.** **Face guard** puts the menpō and its throat guard on or off (it starts on; the orange chin cords tie the helmet on either way).
   **Armour** shows or hides the cuirass, shoulder guards and skirt.
6. **Photo.** The round button saves the mirrored selfie with the armour and a small caption plate.

## The gusoku 具足, about 1650

The suit is the **Armor (Gusoku)** of about 1650 in the Metropolitan Museum of Art, New York
(accession 36.25.41a–q, Bequest of George C. Stone, 1935; helmet signed by the armourer Saotome Ietada;
materials listed as iron, leather, lacquer, silk, textile, hair and copper alloy). The museum's online record
has no photograph or description, so every part follows the reference drawing of the armour
(`assets/refs/gusoku-1650-ref.jpg`).

| Part | | What is built |
|---|---|---|
| **Kabuto** | 兜 | black-lacquered ridged bowl (suji-bachi) of 62 plates, typical of the Saotome school; gilt ring round the crown hole, gilt-edged rim band |
| **Kuwagata** | 鍬形 | a wide pale-gold crescent across the front, its arms rising to flared fish-tail tips, with three gilt rivets |
| **Crest stand and ornament** | 前立 | a tall dark-brown rounded stand behind the crescent, with a gilt ring above a gilt bell-shaped ornament with incised bands |
| **Mabizashi** | 眉庇 | black visor with silver scrollwork, gilt edge, dark underside |
| **Fukigaeshi** | 吹返 | big black side flaps facing forward, with fine silver scrollwork, two columns of gilt studs and a gilt rim |
| **Shikoro** | 錣 | a wide umbrella-shaped neck guard (kasa-jikoro) of five black lames with rows of orange studs; the lowest lame red-brown |
| **Shinobi-no-o** | 忍緒 | peach-orange silk cords down the cheeks, crossing over the chin and knotted under it |
| **Menpō** | 面頬 | dark iron half mask with a hooked nose, silver-lined cheek folds, an open mouth with gilt teeth, a round chin with a small hole, and a big white horsehair moustache (the museum lists hair among the materials) |
| **Yodare-kake** | 垂 | the throat guard under the mask: black lames laced in gold |
| **Dō** | 胴 | the cuirass: black lames laced in gold rows with stud rows between |
| **Chest panel** | | brown, with a silver dragon coiling through clouds, edged in silver |
| **Tassels** | | two big gold tassels hanging from gilt fittings at the top of the chest |
| **Belt** | 上帯 | an orange silk cord round the waist, knotted at the front |
| **Shoulder pieces and Sode** | 袖 | gold-laced lames over the shoulders, and curved shoulder guards of seven gold-laced lames |
| **Kusazuri** | 草摺 | the skirt: six panels of gold-laced lames with a row of gilt studs along the bottom |
| **Haidate** | 佩楯 | the thigh guard under the skirt: small black scales laced in grey, with an olive knee plate of tortoise-shell hexagons |

**Not built:** the arm guards (kote), shin guards (suneate) and shoes in the drawing. Face AR tracks your head,
not your arms and legs, so armour on them would not move with you.
## The Anatomy look

The interface uses the [Anatomy](https://github.com/wheresryan22/anatomy) skill (MIT) in the same sepia
theme as Noh_Masks, Ramen_Builder, Bonsai and Pagoda: Anatomy plates with a mono `Fig. 0n` label top-left,
a title top-right, corner readouts, a lifted shadow and an ink hairline. [`css/anatomy-sepia.css`](css/anatomy-sepia.css)
holds the token set; the kit is in [`vendor/anatomy/`](vendor/anatomy); the skill is installed for this workspace at
`../.claude/skills/anatomy`.

## Printing the card

- Print `target.png` about **18 cm wide** (3:2, about 18 × 12 cm) on **matte** paper.
- Hold the phone 20–40 cm away, in even light. The card also works on a laptop or tablet screen.
- The compiled target scores **3,407 detection points over 11 scales, with 46 tracking points**
  (Noh_Masks' card: 3,623 / 52).

## Files

| File | What it is |
|---|---|
| `index.html` | The screens: permission, viewfinder, welcome, armour room, photo. |
| `js/app.js` | The flow: scan → welcome → camera → tray and toggles, plus hints, facts and photo. |
| `js/scan.js` | Card recognition (MindAR image). |
| `js/stage.js` | Face AR (MindAR face): the helmet on the face pose, the armour on the neck, the no-camera preview on MindAR's canonical face, photos. |
| `js/armour.js` | The 1650 gusoku, part by part (see the table above), and the head/neck occluders. |
| `js/paint.js` | Canvas painters: gold-laced lames (kebiki) with stud rows, silver scrollwork, the dragon panel, thigh-guard scales, lacquer grain. |
| `js/data.js` | Names, kanji, eras, kid-friendly blurbs, parts and facts. |
| `js/face-fit.js` / `js/face-model.js` | MindAR's canonical face, the face shell the menpō is carved on, and the landmark skinning (shared with Noh_Masks). |
| `js/look.js` | Lighting, environment, tone mapping and room-light matching (shared with Noh_Masks). |
| `tools/cutout.html` | Cuts the reference drawing out of its white paper into `assets/gusoku-illustration.png` (used on the welcome card and the scan card). |
| `tools/suit-sheet.html` | Renders the suit on the canonical face. `?yaw=0.5&menpo=0&body=0&dist=80`. `?save=1` rewrites `assets/thumbs/oyoroi.png`. |
| `tools/make-target.html` | Redraws `target.png` with the cut-out illustration and compiles `targets.mind` (`?build=1`). |
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
