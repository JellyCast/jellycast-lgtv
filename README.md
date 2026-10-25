# JellyCast for LG webOS

A Jellyfin client for LG TVs (webOS 22 and later), sibling of [JellyCast for Android TV](../jellycast-android-tv) and [JellyCast for iOS](../jellycast-ios).

**Status:** the interface of the Android app, ported: sign in with Quick Connect, Home with Home, Series, Movies and Library, the series page, the movie detail and a player with audio and subtitle menus, skip intro and the next episode. Everything the TV decodes plays directly, including HDR10, HDR10+, HLG and Dolby Vision; the app picks the audio track itself, because the TV cannot play TrueHD or DTS.

## Run it

Requirements: Node 20+, an LG TV in Developer Mode (see [docs/tv-setup.md](docs/tv-setup.md)).

```bash
npm install
npm run package
npm run tv:install
npm run tv:launch
```

## Contributing or forking

Ideas and improvements are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Forking is fine too: make your own version for your own TV. A small mention of where it came from is appreciated.

## Content

JellyCast is a client for your own Jellyfin server. It does not provide, host or index any content. You are responsible for the content on your server and for having the rights to play it.

## License

[MIT](LICENSE). Open source: do whatever you want with it, as long as the copyright notice and license stay with the code. The libraries and fonts the app includes, and their licenses, are in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

JellyCast is not an official Jellyfin project.
