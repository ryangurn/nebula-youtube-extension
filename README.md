# Nebula YouTube Extension

Chrome extension that runs on desktop YouTube watch pages and adds a Nebula CTA when the current video can be matched to public Nebula content.

This extension was developed with AI assistance and human oversight.

It is an independent project created by a Nebula subscriber with no affiliation to Nebula, built simply to make the platform easier to use alongside YouTube.

If **Nebula** has concerns about this project or would prefer changes to its presentation, please open an issue or contact the maintainer, would love to collaborate!

## Features

- `Watch on Nebula` when a strong Nebula video match is found
- `View creator on Nebula` when the creator matches but the video match is ambiguous
- No auth, cookies, or private Nebula endpoints
- Packaged as a ready-to-load extension directory plus a zip artifact

## Development

```bash
npm test
npm run build
```

## Build Output

`npm run build` creates:

- `dist/nebula-youtube-extension/`
- `dist/nebula-youtube-extension.zip`

## Load In Chrome

1. Unzip `dist/nebula-youtube-extension.zip`.
2. Open `chrome://extensions`.
3. Turn on Developer Mode.
4. Click `Load unpacked`.
5. Select the unzipped `nebula-youtube-extension` folder.

## Notes

- The extension is intentionally conservative and prefers hiding the CTA over linking to the wrong Nebula video.
- Matching is powered by Nebula public JSON endpoints on `content.api.nebula.app`.
