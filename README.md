# Nebula YouTube Extension

Browser extension that runs on YouTube watch and channel pages and adds a Nebula CTA when the current video or creator can be matched to public Nebula content.

This extension was developed with AI assistance and human oversight.

It is an independent project created by a Nebula subscriber with no affiliation to Nebula, built simply to make the platform easier to use alongside YouTube.

If **Nebula** has concerns about this project or would prefer changes to its presentation, please open an issue or contact the maintainer, would love to collaborate!

## Features

- `Watch on Nebula` when a strong Nebula video match is found on a watch page
- `View creator on Nebula` when the creator matches but the video match is ambiguous on a watch page
- `View creator on Nebula` on matching YouTube channel pages
- No auth, cookies, or private Nebula endpoints
- Shared WebExtension source with Chrome, Firefox, and Safari packaging paths
- Packaged as ready-to-load Chrome and Firefox extension directories, zip artifacts, and a Safari-compatible build artifact

## Development

Run the test suite:

```bash
npm test
```

Build browser artifacts:

```bash
npm run build
```

`npm run build` creates:

- `dist/nebula-youtube-extension/` for Chrome
- `dist/nebula-youtube-extension.zip` as a Chrome zip artifact
- `dist/nebula-youtube-extension-firefox/` for Firefox
- `dist/nebula-youtube-extension-firefox.zip` as a Firefox zip artifact
- `dist/nebula-youtube-extension-safari/` for Safari conversion

The Safari build output is derived from the same `src/extension/` source, but replaces the MV3 module background worker with a Safari-compatible bundled background script. The Firefox build output also comes from the same source tree, but swaps the Chrome MV3 service worker for a Firefox-compatible bundled background script declared via `background.scripts`.

## Developer Installation

### Chrome

Build the unpacked extension:

```bash
npm run build
```

Then load it in Chrome:

1. Open `chrome://extensions`.
2. Turn on Developer Mode.
3. Click `Load unpacked`.
4. Select `dist/nebula-youtube-extension/`.

### Firefox

Build the Firefox artifact:

```bash
npm run build:firefox
```

Then load it in Firefox:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click `Load Temporary Add-on...`.
3. Select `dist/nebula-youtube-extension-firefox/manifest.json`.

Notes:

- the generated Firefox build is intended for local development and temporary installation
- Firefox will prompt for the declared Nebula host permission on install
- AMO signing and `browser_specific_settings.gecko.id` are intentionally not part of this build path yet

### Safari

Safari development requires macOS with Xcode and Safari installed.

Create or refresh the Safari wrapper project:

```bash
npm run setup:safari
```

That command:

- rebuilds the shared Chrome, Firefox, and Safari extension artifacts
- converts `dist/nebula-youtube-extension-safari/` into an Xcode project when one does not already exist
- writes the generated wrapper app to `safari/Nebula Match for YouTube/`

If you already have a signed Safari Xcode project, `npm run setup:safari` preserves it by default. Use `npm run setup:safari -- --force` only when you intentionally want to recreate the project from scratch.

Install it for development:

1. Open `safari/Nebula Match for YouTube/Nebula Match for YouTube.xcodeproj` in Xcode.
2. Pick a development team for the macOS app target, iOS app target, and both extension targets.
3. If needed, replace the generated bundle identifiers with ones that belong to your Apple team.
4. Run the macOS or iOS app target from Xcode.
5. Enable the extension in Safari. On macOS use `Safari > Settings > Extensions`. On iPhone and iPad use `Settings > Apps > Safari > Extensions`.

Once the Xcode project has been signed once, you can rebuild the macOS Safari app without regenerating the project:

```bash
npm run build:safari
```

`npm run build:safari` rebuilds the shared extension artifacts, keeps your existing signed Xcode project, and builds the macOS wrapper app into `build/safari/Build/Products/Debug/`.

### Release Workflow

For App Store-capable builds, the generated Safari wrapper is only the starting point. You still need:

- an Apple Developer account with signing configured in Xcode
- app-specific bundle identifiers that belong to your team
- archive/signing validation for the app and extension targets
- store metadata, screenshots, privacy responses, and any App Review submission details

Typical release commands are:

```bash
npm run setup:safari
xcodebuild -project "safari/Nebula Match for YouTube/Nebula Match for YouTube.xcodeproj" -scheme "Nebula Match for YouTube (macOS)" -configuration Release archive
```

Build the iOS scheme separately if you plan to ship iPhone and iPad support.

### Safari Testing Checklist

- matching YouTube watch pages render `Watch on Nebula`
- ambiguous videos render `View creator on Nebula`
- matching YouTube channel pages render `View creator on Nebula` in the channel header action row
- non-matching YouTube channel pages render no CTA
- unmatched videos render no CTA
- YouTube SPA navigation updates the CTA without a full page reload
- Nebula links open correctly from Safari desktop and mobile contexts
- background-to-content messaging still succeeds after Safari lifecycle pauses/restarts

### Firefox Testing Checklist

- matching YouTube watch pages render `Watch on Nebula`
- ambiguous videos render `View creator on Nebula`
- matching YouTube channel pages render `View creator on Nebula` in the channel header action row
- non-matching YouTube channel pages render no CTA
- unmatched videos render no CTA
- YouTube SPA navigation updates the CTA without a full page reload
- Nebula links open correctly in a new tab
- background-to-content messaging still succeeds after temporary reloading the add-on from `about:debugging`

### Remote Debugging iPhone And iPad Safari

1. On the device, enable `Settings > Safari > Advanced > Web Inspector`.
2. On the Mac, enable `Safari > Settings > Advanced > Show Develop menu in menu bar`.
3. Connect the device to the Mac and trust it.
4. Open the target YouTube page in mobile Safari.
5. In macOS Safari, open `Develop > <device name> > <YouTube tab>` to attach Web Inspector.
6. Use the `Console` tab for content-script logs and the `Network` tab for Nebula API requests coming from the page.
7. Use Xcode's debug console for Safari Web Extension app/extension logs, especially background-side messaging logs.

## Notes

- The extension is intentionally conservative and prefers hiding the CTA over linking to the wrong Nebula video or creator page.
- Matching is powered by Nebula public JSON endpoints on `content.api.nebula.app`.
- The shared runtime abstraction lives in `src/extension/lib/runtime.js` and is used by both the content script and the background worker.
