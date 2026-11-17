# The iOS app

The site wrapped as a native iOS app with [Capacitor](https://capacitorjs.com) 8. The website on GitHub Pages
is unchanged: the app bundles a copy of the served files and loads them from `capacitor://localhost/`.

- App name: **Ski Pre-Run** (on a Chinese phone the home screen shows 雪场预滑).
- Bundle id: **`com.skiprerun.app`**, a placeholder. Change it before the first upload if the owner wants
  another (`appId` in `capacitor.config.json` and `PRODUCT_BUNDLE_IDENTIFIER` in the Xcode project).
- iPhone only, portrait, iOS 15 or later.

## Layout

- `capacitor.config.json` — app id, name, `webDir: "www"`, background colour. No `server.url`: the site is
  bundled, so the app opens offline and isn't a thin wrapper of a website.
- `tools/app_sync.mjs` (`npm run app:sync`) — copies only what Pages serves into `www/` (gitignored): the
  four pages, `manifest.webmanifest`, `src/`, `assets/`, `data/`, `models/` (without the Blender sources)
  and `mountain/`. Never `tools/`, `tests/`, `docs/` or `node_modules/`. It bundles three.js 0.170 from
  `node_modules/three` into `www/vendor/three/` (only the addons the site imports, plus the Draco decoder)
  and points the copies' import maps and Draco path there, then runs `npx cap sync ios`. The pages in the
  repo keep loading three.js from the CDN.
- `ios/` — the generated Xcode project (committed). `ios/App/App/public/` is the synced copy (gitignored).
  - `ios/App/App/ViewController.swift` — Capacitor's view controller with one change: a folder's own
    `index.html` is served for `mountain/?resort=…`. Capacitor's default router answers every path
    without an extension with the root `index.html` (single-page apps), which loaded the shell inside
    its own frame on the resort page. `SceneDelegate.swift` uses it.
  - `Info.plist` — the permission prompts; `en.lproj` / `zh-Hans.lproj/InfoPlist.strings` translate them.

## Sync, build and run

```sh
npm install                 # Capacitor and three.js (devDependencies; the site itself needs none)
npm run app:sync            # www/ and ios/App/App/public/, then cap sync
npm run app:open            # opens the project in Xcode: pick a simulator or your phone, Run
```

From the command line, for the simulator (no signing needed):

```sh
cd ios/App
xcodebuild -project App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 15 Pro' -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
xcrun simctl boot "iPhone 15 Pro"; open -a Simulator
xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch --console-pty booted com.skiprerun.app   # the top page's console.log arrives here
```

Run `npm run app:sync` again after any change to the site; the app only sees what was synced. A Debug
build is inspectable from Safari (Develop › Simulator) when Safari's Develop menu is on.

## What differs inside the app

- **Origin.** Pages run at `capacitor://localhost/`. A link we share must open for a friend without the app,
  so `src/core/site.js` `siteBase` gives the public site (`https://jinqiudong.github.io/ski-prerun/`) when the
  page isn't on http(s); on the web it is the page's own folder, as before. The trip invite
  (`start.html?trip=…`, `trips.js` `link`) is the only link the site builds for someone else; `?with=`,
  `?find=`, `?sync=` / `?crew=` and the party's links are navigations inside the app, so they stay relative.
  Opening a shared link on a phone with the app installed still opens Safari (no Universal Links yet:
  that needs an `apple-app-site-association` file on a domain we control and the Associated Domains
  capability).
- **Supabase** works from that origin: the REST RPCs (CORS allows any origin) and the Realtime websocket
  (checked by reading only: `get_trip` for an unknown id, and joining a probe channel).
- **Microphone (对讲机).** Capacitor's web view grants `getUserMedia` to the page once iOS has the user's
  permission (the prompt text is `NSMicrophoneUsageDescription`); inline playback and audio without a tap
  are on (`allowsInlineMediaPlayback`, `mediaTypesRequiringUserActionForPlayback = []`).
- **Tilt steering.** `DeviceOrientationEvent.requestPermission()` is there as in Safari and still needs a tap
  (the pages ask from their ride buttons); Capacitor then grants it without a second web prompt. The
  simulator has no motion sensor: try tilt on a phone.
- **Location** (the ride's 定位, the trip's nearest airport) and **saving a group photo** through the share
  sheet ask with `NSLocationWhenInUseUsageDescription` / `NSPhotoLibraryAddUsageDescription`.
- **Safe areas.** `contentInset: "never"` keeps `env(safe-area-inset-*)` working, so the shell (`index.html`)
  keeps its frame out of the notch and the home indicator exactly as on the home-screen web app. The status
  bar is the default dark text on the shell's light background.
- **Offline.** Everything the pages ship is in the app, three.js included. Still online-only: the Google
  Fonts (the system fonts stand in), the weather (open-meteo) and shared trips / party / voice (Supabase).

## Size

The synced web folder is about 112 MB (assets 53, models 34, data 21, three.js 2) and the simulator build
about 118 MB (88 MB zipped, roughly the download). The models are the facilities' GLBs (35 MB) and the riders (11 MB). That is fine for the App
Store (no download-size limit applies over Wi-Fi; over 200 MB asks before a cellular download), but worth
watching: if it grows, ship one region's resorts and download the rest, or compress the GLBs' textures.

## What the owner must do

1. Join the Apple Developer Program (99 USD a year) with the Apple ID that will own the app.
2. In Xcode (`npm run app:open`): target App › Signing & Capabilities › Team: pick that team; keep
   "Automatically manage signing". Change the bundle id here if `com.skiprerun.app` isn't wanted.
3. App icon: put a 1024 × 1024 PNG (no transparency) in `ios/App/App/Assets.xcassets/AppIcon.appiconset`
   (the project still has Capacitor's placeholder icon). A splash in the same colours as the shell
   (`#e9edf2`) can replace the default `Splash.imageset`.
4. App Store Connect: create the app with the same bundle id, then in Xcode Product › Archive ›
   Distribute App › App Store Connect, and add testers in TestFlight. Internal testers need no review;
   external testers need a short beta review.

## App Store blockers still open

Not built here; each is needed before submitting for review:

- **Account and data deletion** (guideline 5.1.1(v)): there are no accounts, but a phone keeps a member id,
  a name and its trips on Supabase. The app needs a way to delete what it created: leave and delete my
  trips, my member rows and my name, from inside the app.
- **Report and block** (guideline 1.2, user-generated content): trips, names, notes, quick messages and
  voice are shared between people. Needs a way to report a person or content, block a person, and a
  published way to act on reports (an email address is enough to start).
- **Privacy policy**: a public URL (it can live on the Pages site), linked in App Store Connect and from the
  app: what is stored on Supabase, the voice being peer to peer and not recorded, location and the photo
  staying on the phone, open-meteo and Google Fonts requests.
- **Privacy labels** (App Store Connect › App Privacy): at least name and user id (the member id), user
  content (trips, messages), audio (voice chat, not collected or stored), coarse location used on the
  phone only; nothing used for tracking.
- Also check before review: the placeholder icon, and guideline 4.2 (minimum functionality): the bundled
  3D game, offline use and the microphone and motion features make it more than a website in a frame.
