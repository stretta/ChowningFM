# Chowning FM

This repo is now tuned as a focused RNBO web demo for a compact FM patch. The RNBO export remains replaceable, but the default experience is aimed at showing off the `ChowingFM` example cleanly in a browser.

The intended workflow is:

1. RNBO exports DSP into `export/`.
2. The web app loads the current export through `export/export-manifest.json`.
3. You keep iterating on the UI, layout, and interaction code in this repo.

## Template architecture

The project is split into two layers:

- `export/`: disposable RNBO output
- `index.html`, `js/`, `style/`: your hand-authored web app

Key files:

| Location | Purpose |
| --- | --- |
| `js/app.js` | Generic RNBO bootstrapping, device creation, dependency loading, and `rnbo-ready` event dispatch |
| `js/template-config.js` | Project-level template settings such as app name, default UI skin, keyboard range, and grouping |
| `js/custom-ui.js` | Generic UI engine that mounts controls, presets, MIDI, and keyboard behavior |
| `js/skins/default.js` | Neutral starter skin for new projects |
| `js/skins/juno.js` | Preserved instrument-specific example skin from the copied Juno workflow |
| `style/style.css` | Base template styling plus skin-specific theme overrides |
| `STYLE_GUIDE.md` | Repo-level visual rules for typography, color usage, and review criteria |
| `scripts/sync-rnbo-export.mjs` | Refreshes `export/export-manifest.json` to point at the latest `.export.json` file |

The browser exposes `window.rnboApp` for inspection and emits a `rnbo-ready` event once the RNBO device is available.

## Running locally

Install Node.js, then from the repository root run:

```sh
npm run dev
```

This starts a local server with caching disabled so repeated RNBO re-exports are easy to verify.

## RNBO iteration loop

Use this loop while working:

1. Edit the RNBO patch in Max.
2. Export again into `export/`.
3. Run `npm run sync-export` if the export filename changed.
4. Keep building the web interface here.
5. Refresh the page and test.

The `export/` directory is intentionally disposable. You should feel free to re-export over it as often as you want.

## Switching skins

The template now supports interchangeable UI skins. Change the active skin in `js/template-config.js`:

```js
uiSkin: "default"
```

Available starting options:

- `"default"`: neutral template layout for any RNBO patch
- `"juno"`: preserved example skin showing how to build an instrument-specific panel
- `"chowningfm"`: the current project-specific FM interface with paired control/readout groups

This is the main generalization seam for future projects: keep the RNBO runtime stable, and swap or extend the skin layer per instrument.

## Style system

The repo now treats visual preferences as an explicit contract rather than implicit taste:

- `STYLE_GUIDE.md` captures the non-negotiable design rules.
- `style/style.css` exposes semantic tokens for text, surfaces, borders, and primary actions.
- New UI work should prefer semantic tokens over hard-coded palette values.

When in doubt, default to the guide's core rules: monochrome-first hierarchy, sans-dominant typography, and rare accent usage.

## Current UI Contract

The current `chowningfm` skin is intentionally much narrower than the generic template. It is not a full synth dashboard. It is a focused FM relationship view.

The page should contain only:

- Three primary control groups
- The on-screen keyboard

The three primary groups are:

1. `Carrier`
2. `Modulator`
3. `Modulation Index`

Each group contains exactly two items:

- One editable value
- One derived readout

Current pairings:

| Group | Editable label | Derived label |
| --- | --- | --- |
| `Carrier` | `Ratio` | `Freq` |
| `Modulator` | `Ratio` | `Freq` |
| `Modulation Index` | `AMOUNT` | `Deviation` |

## UI Presentation Rules

The current interface intentionally avoids most of the old template chrome.

- Remove generic header, subtitle, patch metadata, preset UI, and MIDI selector from the main layout.
- Remove inner cards inside the three primary groups.
- Remove boxed styling around editable numeric values.
- Keep each primary group color-coded with its own accent.
- Treat the keyboard as the only persistent secondary section.

## Type Rules For This UI

The Chowning FM interface uses a role reversal relative to the earlier template:

- Labels and section titles use the broader primary typeface with heavier weight.
- Numeric values use the condensed typeface.
- Numeric alignment should be baseline-driven, not box-driven.
- Editable values and derived display values should use the same apparent size.

## Implementation Notes

The current grouped UI is encoded in these places:

- [js/skins/chowningfm.js](/Users/mdavidson/Documents/Repos/ChowningFM/js/skins/chowningfm.js): group titles, accents, visible controls, and label overrides
- [js/custom-ui.js](/Users/mdavidson/Documents/Repos/ChowningFM/js/custom-ui.js): paired derived readouts and explicit outport label mapping
- [style/style.css](/Users/mdavidson/Documents/Repos/ChowningFM/style/style.css): flattened layout, typography roles, accent treatment, and keyboard styling

## Creating a new project-specific UI

You can evolve this template in two directions:

1. Adjust `js/template-config.js` for a lightweight project-specific setup.
2. Add a new skin file under `js/skins/` when you want a stronger custom layout or branding.

For a new skin, define:

- `theme`: CSS theme name
- `description`: header copy
- `createGroups(parameters, config)`: parameter grouping strategy
- `accent`: optional group accent key when a skin uses color-coded sections
- `derivedTags`: optional outport tags to render alongside controls in the same group
- `labelOverrides`: optional short labels
- `graphicSelectorParamIds`: optional enum-style button controls
- `keyboard`: optional note range override

## Working with RNBO exports

Export your patch into the `export/` folder. The directory usually looks like:

```text
export/
├─ MyPatch.export.json
├─ dependencies.json
├─ export-manifest.json
└─ README.md
```

If RNBO writes a different export filename, run:

```sh
npm run sync-export
```

That script updates `export/export-manifest.json`, which the web app reads at startup.

## Troubleshooting

### Nothing loads

Open the browser developer console and check for setup errors. The included `js/guardrails.js` also shows common local setup problems, especially when the page is opened via `file://` instead of a web server.

### The patch is stale

Hard refresh the page after re-exporting. The dev server disables caching, but a browser refresh can still help after repeated export cycles.

### Samples fail to decode

Check the console for audio decoding errors. Some browsers reject certain formats such as `.aif`, so re-exporting with `.wav` assets is often the fix.

## Why a local server?

RNBO web exports rely on browser features that do not work correctly from `file://` URLs, including WebAssembly and AudioWorklets. Running `npm run dev` makes the browser treat the project like a real website and keeps the setup aligned with eventual deployment.
