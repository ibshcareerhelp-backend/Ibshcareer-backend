# Africa: The Untold Story — production notes

A 5:00, 1920×1080, 30 fps documentary in five 60-second chapters, built with HyperFrames.

## How it is built

- `tools/film.mjs`: the source of truth. It holds every beat (shot, camera move, transition), the
  narration split into 38 phrases, and the on-screen cards (chapter titles, lower thirds, kingdom
  cards, stats and the end card).
- `node tools/build.mjs` regenerates `index.html`, `compositions/ch1…ch5.html`,
  `compositions/captions.html` and `narration.json` from it. Run it again after you change
  `film.mjs` or the voiceover.
- Timing: each phrase lasts as long as its real voiceover clip, read from
  `assets/voice/durations.json`. Until that file exists, the timing is an estimate of 0.43 s a word.
  Each chapter stays exactly 60 s; the beat marked `min: "fill"` absorbs the difference.

## Done (silent cut)

- All 12 supplied images placed as moving shots across the five chapters, plus crops of the
  thumbnail (the presenter, the savannah sunset). The Dahomey image is cropped to the line of
  warriors, without the figure holding a trophy.
- Chapter titles, lower thirds with dates, cards for Benin, Egypt and Great Zimbabwe,
  independence and demographic stats, and the requested end card.
- Burned-in subtitles timed to the narration.

## To do once HeyGen is reachable

The environment's network policy must allow `api.heygen.com`, plus the HeyGen asset/CDN hosts
(`*.heygen.com`, `*.heygen.ai`). Then sign in with `npx hyperframes auth login --api-key`.

1. **Voiceover.** Generate one clip per phrase in `narration.json` with a deep, mature African male
   voice. Save them as `assets/voice/<id>.mp3` and write each clip's length in seconds to
   `assets/voice/durations.json`, then run `node tools/build.mjs`. The `<audio>` tags are added
   automatically.
2. **Presenter.** Six on-camera beats (`ch1-host1`, `ch2-host2`, `ch3-host3`, `ch4-host4`,
   `ch5-host5`, `ch5-host6`). Generate a lip-synced avatar video of the same man for each one,
   using that beat's voiceover audio and the presenter from the thumbnail as the reference face.
   `ch5-host6` stands against an African sunset. Map them in `assets/voice/presenter.json` as
   `{ "ch1-host1": { "src": "assets/video/ch1-host1.mp4" } }`. The video is muted, and the voice
   comes from the phrase audio.
3. **Music.** A dramatic African instrumental bed, saved as `assets/music/bed.mp3`. It loops at
   -10 dB under the voice, and the build picks it up automatically.
4. **Generated shots** for the beats that have no supplied image: Benin, Egypt, Great Zimbabwe
   (currently type cards on a patterned ground), independence celebrations, festivals and fashion,
   tech hubs, students, and renewable energy.
5. Re-run `check` and the review snapshots, then render at `-q delivery`.

## Accuracy notes

- On-screen dates are standard approximate ranges: Kush c. 1070 BC – AD 350; Mansa Musa reigned
  c. 1312–1337; Benin c. 1180–1897; Egypt c. 3100–30 BC; Great Zimbabwe c. 1100–1450; Songhai
  c. 1464–1591; Berlin Conference 1884–85; Isandlwana 1879; Ghana's independence 1957; seventeen
  African nations became independent in 1960.
- The supplied artwork is illustrative and partly AI-generated, so add a "Dramatized
  reconstruction" note to the YouTube description.
- The man in the embroidered cap (`elder-cap.jpg`) appears to be a real person. He is shown only
  as a still and is never given a voice.
