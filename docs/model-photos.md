# Photo-real artwork for the models

| Model | Status |
|---|---|
| Hi-Fi Deck, Walnut Turntable | Photo (original assets) |
| Pocket Stereo | Photo: `pocket-stereo.png`, calibrated |
| Boombox | Photo: `boombox.png`, calibrated |
| Suitcase Player | Photo: `suitcase-rest.png`, calibrated. **No "playing" image is needed**: the tonearm is lifted out of the photo and animated. |
| DJ Deck | Still drawn (SVG). Needs `dj-rest.png` only (see section 4) |

Save new images in `apps/web/art/models/` (the PNG sources, which are not shipped) under the exact file names given. After that:

1. Measure every key, reel, platter, and knob in pixels. These go in `apps/web/src/components/machines/photo.tsx`.
2. Regenerate the derived layers with `apps/web/scripts/derive-model-layers.ps1 -Dir .\art\models`. These are the copies with keys cleared, the knob removed, or the tonearm lifted out.
3. Run `npm run images` in `apps/web` to write the WebP files the app ships to `public/assets/`, and list any new file in `src/components/machines/assets.ts`.

Ask Claude Code to "calibrate the new model photos".

## Rules every image must follow

These match the two existing photos so the room looks consistent:

- **Canvas:** 1536 × 1024 px, landscape (3:2), PNG with a fully transparent background (real alpha, not a checkerboard). If your tool can't export transparency, ask for a plain mid-grey backdrop and remove it afterwards.
- **Framing:** the product is centred and fills about 85% of the width, with a little space above it for the album sleeve.
- **Light and lens:** warm tungsten studio key light from the upper left, a soft rim light, a gentle contact shadow under the product, and a 50–85 mm product lens with no wide-angle distortion.
- **Branding:** no real brands, logos, or trademarks (no Sony, Walkman, Technics, JVC, and so on). Where a nameplate makes sense, use "retroplay".
- **Turntables:** one image, with an empty platter and the tonearm on its rest. The record and the moving arm are added in code. Keep the arm clear of other parts if you can, so it lifts out cleanly.
- **What must be visible:** the moving parts (cassette reels, the record surface) must not be covered by reflections or other objects. They get animated on top of the photo.

## 1. Pocket Stereo (portable cassette player)

`pocket-stereo.png`

> Photorealistic studio product photograph of a 1981-style portable personal cassette stereo, brushed aluminium body in champagne silver, shown standing upright in a straight front view, slightly elevated camera. A smoked-glass cassette door fills the upper half and shows a clear-shell compact cassette inside, both tape reels clearly visible with brown tape wound on the left reel. Four chunky metal piano keys (stop, rewind, play, fast-forward) protrude from the top edge, a knurled volume wheel sits on the right edge, a 3.5 mm headphone jack is on the top, and the nameplate reads "retroplay". Lying beside it on the right: lightweight vintage headphones with a thin steel headband and bright orange foam ear pads, cable plugged into the jack. Warm tungsten key light from the upper left, soft rim light, soft contact shadow, transparent background, 1536×1024, ultra-detailed, 85 mm lens.

## 2. Boombox

`boombox.png`

> Photorealistic studio product photograph of a mid-1980s stereo radio-cassette boombox, straight front view, slightly elevated. Black textured plastic body with brushed-silver front panels, two large round woofers behind perforated metal grilles with small tweeters above them, a chrome carrying handle across the top, and a telescopic chrome antenna raised at the right. In the centre: a backlit amber FM tuning dial, and below it a cassette door with a clear window showing a clear-shell cassette with both reels visible. Six piano keys (record, play, rewind, fast-forward, stop/eject, pause) sit along the top edge, a horizontal volume slider is below the door, and the nameplate reads "retroplay". Warm tungsten key light from the upper left, soft rim light, contact shadow, transparent background, 1536×1024, ultra-detailed.

## 3. Suitcase Player (done)

`suitcase-rest.png`

> Photorealistic studio product photograph of a 1960s portable suitcase record player, elevated three-quarter view from the front (the same angle as a hi-fi turntable product shot), lid open behind it showing a woven fabric speaker grille with a chrome "retroplay" badge. Teal tolex-covered case with cream piping and brass corner caps, a cream deck plate, a turntable platter with a black ribbed rubber mat and **no record on it**, a slim chrome tonearm **resting on its arm rest** at the right, and chrome volume and speed knobs. Warm tungsten key light from the upper left, soft rim light, contact shadow, transparent background, 1536×1024, ultra-detailed.

## 4. DJ Deck (still needed)

`dj-rest.png`

> Photorealistic studio product photograph of a professional direct-drive DJ turntable, elevated three-quarter view from the front. Matte black plinth, a heavy silver platter whose rim carries four rows of stroboscopic dots, a black felt slipmat and **no record**, a silver S-shaped tonearm with counterweight **resting on its arm rest**, a large rectangular start/stop button at the front left, 33/45 speed buttons beside it, a long pitch fader on the right, a small pop-up target light, and a "retroplay" nameplate. Warm tungsten key light from the upper left, soft rim light, contact shadow, transparent background, 1536×1024, ultra-detailed.

## Tips

- Generate 4–8 candidates per model and pick the one with the cleanest, most front-facing controls. Keys and knobs that face the camera are easiest to animate realistically.
- Upscale if your tool renders smaller than 1536 × 1024, but never stretch the image to a different aspect ratio.
- Only use generated images, or photos you have the rights to. Product photos found on the web are usually copyrighted.
