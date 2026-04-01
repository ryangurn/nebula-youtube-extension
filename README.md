# Nebula YouTube Extension

Browser extension that runs on YouTube watch pages and adds a Nebula CTA when the current video can be matched to public Nebula content.

This extension was developed with AI assistance and human oversight.

It is an independent project created by a Nebula subscriber with no affiliation to Nebula, built simply to make the platform easier to use alongside YouTube.

If **Nebula** has concerns about this project or would prefer changes to its presentation, please open an issue or contact the maintainer, would love to collaborate!

## Features

- `Watch on Nebula` when a strong Nebula video match is found
- `View creator on Nebula` when the creator matches but the video match is ambiguous
- No auth, cookies, or private Nebula endpoints
- Shared WebExtension source with Chrome and Safari packaging paths
- Packaged as a ready-to-load Chrome extension directory, zip artifact, and a Safari-compatible build artifact

## Development

```bash
npm test
npm run build
```

## Build Output

`npm run build` creates:

- `dist/nebula-youtube-extension/`
- `dist/nebula-youtube-extension.zip`
- `dist/nebula-youtube-extension-safari/`

The Safari build output is derived from the same `src/extension/` source, but replaces the MV3 module background worker with a Safari-compatible bundled background script. That keeps the matching logic shared while avoiding Safari's `background.type = "module"` limitation during conversion.

## Load In Chrome

1. Unzip `dist/nebula-youtube-extension.zip`.
2. Open `chrome://extensions`.
3. Turn on Developer Mode.
4. Click `Load unpacked`.
5. Select the unzipped `nebula-youtube-extension` folder.

## Set Up Safari

Run the Safari project generator:

```bash
npm run setup:safari
```

That command:

- rebuilds the shared Chrome and Safari extension artifacts
- converts `dist/nebula-youtube-extension-safari/` into an Xcode project when one does not already exist
- writes the generated wrapper app to `safari/Nebula Match for YouTube/`

If you already have a signed Safari Xcode project, `npm run setup:safari` now preserves it by default. Use `npm run setup:safari -- --force` only when you intentionally want to recreate the project from scratch.

### Local Developer Workflow

1. Run `npm run setup:safari`.
2. Open `safari/Nebula Match for YouTube/Nebula Match for YouTube.xcodeproj` in Xcode.
3. Pick a development team for the macOS app target, iOS app target, and both extension targets.
4. If you need unique identifiers for your account, update the generated bundle identifiers before building.
5. Run the macOS or iOS app target from Xcode.
6. Enable the extension in Safari:
   - macOS: Safari > Settings > Extensions
   - iPhone/iPad: Settings > Apps > Safari > Extensions

### Rebuild Safari After Signing

Once you have signed the generated Xcode project once, you can use:

```bash
npm run build:safari
```

That command:

- rebuilds the shared Chrome and Safari extension artifacts
- keeps your existing signed Xcode project instead of regenerating it
- builds the macOS Safari wrapper app into `build/safari/Build/Products/Debug/`

After it finishes, launch the built app bundle and enable the extension in Safari Settings if it is not already enabled.

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
- unmatched videos render no CTA
- YouTube SPA navigation updates the CTA without a full page reload
- Nebula links open correctly from Safari desktop and mobile contexts
- background-to-content messaging still succeeds after Safari lifecycle pauses/restarts

## Notes

- The extension is intentionally conservative and prefers hiding the CTA over linking to the wrong Nebula video.
- Matching is powered by Nebula public JSON endpoints on `content.api.nebula.app`.
- The shared runtime abstraction lives in `src/extension/lib/runtime.js` and is used by both the content script and the background worker.
