# Pigment Well — Watercolour Palette App

## Concept
An app that digitizes a physical watercolour paint box, then helps suggest paint mixes from a reference photo using an eyedropper tool.

## Core workflow
1. **Build the digital palette**
   - User paints flat swatches of each pigment on white paper (not photos of wet paint in the pans — flat swatches give cleaner, more consistent colour sampling).
   - User photographs the sheet of swatches.
   - Around 24 colours total in the palette.
   - Each swatch is **manually clicked and named** by the user — no automatic colour detection/clustering. This is a deliberate choice; don't auto-suggest names or auto-segment colours.

2. **Reference photo → mix suggestion**
   - User uploads/imports a reference photo (e.g. a photo they want to paint from).
   - User uses an eyedropper tool to pick a colour from that photo.
   - App suggests a mix using colours from the user's own digitized palette that would approximate the picked colour.
   - Mix suggestions display **colour names + ratios** (e.g. "Prussian Blue 2 parts : Yellow Ochre 1 part") plus a visual swatch preview of the predicted result.
   - User can **save favourite mixes** for later reference (e.g. mixes they've tested and liked).

3. **Opacity**
   - Opacity/transparency of pigments is **not calculated by the app** — left entirely to the user's own judgement. Don't build automatic opacity estimation.

## Open / not yet decided
- Exact mixing algorithm (e.g. simple RGB/Lab blending vs. weighted pigment mixing model)
- Platform: **browser-based web app, hosted via GitHub Pages** from the user's GitHub repo. No backend — all state stored client-side (localStorage or IndexedDB).
- Data storage format for the palette (local file, database, etc.)
- UI/UX for swatch naming and organizing 48 colours

## Notes for implementation
- Prioritize accurate colour capture from swatch photos (lighting/white balance handling may matter).
- Keep the manual-naming, manual-swatch-picking philosophy — this app is meant to reflect the user's own palette and judgement, not to automate colour science decisions the user wants control over.
