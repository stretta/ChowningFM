# Chowning FM

Chowning FM is a browser-based RNBO instrument demo inspired by the foundational frequency modulation ideas associated with John Chowning. It presents a compact, playable interface that makes the relationship between carrier ratio, modulator ratio, and modulation index easy to see and hear in real time.

The project is designed as a focused musical experience rather than a full synth workstation. The interface centers on three core FM controls and an on-screen keyboard, making it well suited for quick exploration, teaching, and lightweight web presentation.

## What it does

- Loads an RNBO export in the browser
- Exposes a streamlined FM control surface
- Displays both editable values and derived readouts together
- Supports direct interaction through an on-screen keyboard

The current interface is organized around three paired control groups:

1. `Carrier`: ratio and resulting frequency
2. `Modulator`: ratio and resulting frequency
3. `Modulation Index`: amount and resulting deviation

## Project structure

The repository has two main parts:

- `export/`: generated RNBO export files
- `index.html`, `js/`, `style/`: the web app and interface layer

Key files:

| Location | Purpose |
| --- | --- |
| `js/app.js` | RNBO bootstrapping, device creation, dependency loading, and app readiness |
| `js/template-config.js` | Project-level configuration including skin selection |
| `js/custom-ui.js` | UI mounting and control/rendering behavior |
| `js/skins/chowningfm.js` | Chowning FM-specific grouping, labels, and visual treatment |
| `style/style.css` | Layout, typography, theming, and keyboard styling |
| `scripts/sync-rnbo-export.mjs` | Updates the export manifest when RNBO export filenames change |

## Running locally

Install Node.js, then run:

```sh
npm run dev
```

This starts a local development server for testing the instrument in the browser.

## Updating the RNBO export

When the RNBO patch changes:

1. Export the patch into `export/`
2. Run `npm run sync-export` if the exported filename changed
3. Refresh the browser

The app reads `export/export-manifest.json` at startup to determine which RNBO export to load.

## Skins

The project supports interchangeable UI skins through `js/template-config.js`.

Available options:

- `"default"`: a neutral RNBO template layout
- `"juno"`: a preserved example of a more instrument-specific panel
- `"chowningfm"`: the current FM-focused interface used by this project

## Notes for contributors

The current Chowning FM skin is intentionally narrow in scope. It is built around a clear FM relationship view, not a feature-dense synthesizer layout. New contributions should preserve that clarity and keep the main experience centered on the three primary control groups plus the keyboard.

## Troubleshooting

### Nothing loads

Open the browser developer console and look for setup errors. RNBO web exports should be served through a local server rather than opened directly from `file://`.

### The patch seems out of date

Refresh the page after re-exporting. If the export filename changed, run `npm run sync-export` first.

### Samples fail to decode

Check the console for audio decoding errors. Re-exporting assets in a browser-friendly format such as `.wav` often resolves the issue.
