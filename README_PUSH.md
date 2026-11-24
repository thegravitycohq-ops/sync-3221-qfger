# Medieval Prostitute — push bundle README

Production: **Why It Sucked to Be a Medieval Prostitute | Sleep History**
(slug: medieval-prostitute) for Dreamopia. 19 chapters (Introduction +
18), 91 scenes, 20,838 spoken words, ≈2 h 58 at the measured house
rate. Full plan: `production-plan.md` in the production folder; QA:
`qa/QA-RESULTS.md` (ALL CHECKS PASSED with this pack's prep.py).
Source pinned and verified: Sleepless Historian (@SleeplessHistorian,
UCy3Hgwj12x3fDQUcutNm2DA), "A Day in the Life of a Medieval Prostitute
and more" (**QeMn5MiBny4**, **251,105 views at pull, 2026-11-24** —
6.1x the channel median per the 2026-11-24 outlier research). Only the
source's first segment (the prostitute life, ~5,950 words) is the
research base; the rest of that compilation (perfume, Kievan Rus) was
excluded. Narration fully original, cross-checked against the standard
accounts (Karras, *Common Women*; Rossiaud, *Medieval Prostitution*;
Otis, *Prostitution in Medieval Society*). Story set in the fourteen
thirties, before the great pox — the pox is never mentioned.

Playlist: **Women's Daily Life in History — for Sleep** — this is the
playlist's second production (after Geisha); add it in YouTube Studio
if not already created for Geisha.

## Plates — NO ACTION NEEDED

Per your standing note of 2026-11-24, all 130 + 21 plates are already
in the repo. art.tsx imports 28 existing catalogue plates, every one
verified against brand/plate-catalogue.md and confirmed used by the
script (full list in `plates/PLATES-NEEDED.txt`, kept for the record
only). There is NO plate-copy step. The bundle ships no plate binaries.

## Files in this bundle → where they go

| File here | Destination in the repo | Notes |
|---|---|---|
| `art.tsx` | `src/r/art.tsx` | NEW for this production (plate imports + BG_PLATES map only; engine identical to Geisha's) |
| `prep.py` | `src/prep.py` | overwrite — byte-identical to the shipped pack (MD5 c50d42fa…) |
| `Video.tsx` | `src/r/Video.tsx` | overwrite — byte-identical to the brand patch (MD5 f5bc89e2…): captions v3 (cream, no outline, Montserrat, soft shadow), wordmark A, intro + cards |
| `vocab.json` | `src/r/vocab.json` | overwrite — shipped vocab + one new land: porttown |
| `medieval-prostitute-smoke-test.json` | run through the dashboard as a test script | Introduction + chapter 1 + first scene of chapter 2 |

The **main script** (`medieval-prostitute-script.json`) is NOT in this
bundle — it goes through the dashboard separately, as always.

## What is new in this pack

Nothing in the engine. art.tsx differs from Geisha's only in the plate
imports and the BG_PLATES map (44 settings mapped; the script uses 40
of them, all 28 imported plates are used). vocab.json adds one land,
porttown (bg_port_town_day, for the daytime bank-side street scenes).
Foregrounds OFF, no prop plates, no drawn things by exception.

## Your steps

1. Push the pack files above to the repo (art.tsx, prep.py, Video.tsx,
   vocab.json).
2. Run the smoke test through the dashboard; check the intro, the
   first chapter card and the captions.
3. Run the main script (medieval-prostitute-script.json) through the
   dashboard — single full run.
4. Publish: title, description, tags and hashtags are paste-ready in
   `youtube-upload-title-and-description.txt`; thumbnail
   `dreamopia-medieval-prostitute-thumbnail.jpg` (1920×1080); add the
   video to the **Women's Daily Life in History — for Sleep** playlist
   in Studio.
5. Spotify: upload the render's audio MP3 as the episode, with
   `dreamopia-medieval-prostitute-spotify.jpg` (3000×3000) as the
   episode artwork.

## The intro and the chapter cards (how they work)

- Chapter 1, "Introduction", is the standard Dreamopia welcome,
  verbatim, ending "…a river town in England, in the fourteen
  thirties, to spend one long life on the bank side of Southwark, in
  the licensed stews across the water from the city." The branded intro
  plays over it (channel name types in, tagline fades up; wordmark and
  captions suppressed in the window).
- Every content chapter opens with a silent on-screen chapter card
  (7.2 seconds, gold serif, numbered 1–18) generated from the chapter
  titles. The narrator never speaks a title; the spoken text contains
  no chapter or part labels at all (QA-verified).

## Audience nudges in this script (Bruce, 2026-11-21 standing rule)

- ONE Spotify mention, early, in chapter 1 (The Village She Came
  From), framed as information: Dreamopia keeps all of its stories on
  Spotify as well; a follow there helps a great deal. Exactly one in
  the whole script.
- Gentle subscribe nudges at the quarter, half and three-quarter
  chapters: ch. 5 (The Ordinances), ch. 9 (The Men Who Came), ch. 14
  (The Women of the House) — plus the canonical subscribe sentence
  inside the locked outro, unchanged.
