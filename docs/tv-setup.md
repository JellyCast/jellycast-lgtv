# Setting up a TV

One-time per TV. Both TVs follow the same steps; use the names `c2` and `cs` so the npm scripts find them.

## 1. Developer Mode on the TV

1. Create a free account on <https://webostv.developer.lge.com> (LG account).
2. On the TV: LG Content Store → search **Developer Mode** → install and open it.
3. Sign in with the LG developer account, switch **Dev Mode Status** on. The TV restarts.
4. Open Developer Mode again, switch **Key Server** on. Note the IP address and the passphrase shown there.

Developer Mode expires after a set number of hours (shown in the app). Press **Extend** in the Developer Mode app before it runs out, otherwise sideloaded apps are removed.

## 2. Connect the CLI

```bash
npx ares-setup-device --add c2 --info "{'host':'<tv-ip>','port':'9922','username':'prisoner'}"
npx ares-novacom --device c2 --getkey      # saves ~/.ssh/c2_webos; asks for the passphrase from the Developer Mode app
npx ares-setup-device --modify c2 --info "{'privatekey':'c2_webos','passphrase':'<passphrase>'}"
npx ares-device --device c2 --system-info  # check: shows the model and sdkVersion
```

`--getkey` saves the key but does not link it to the device: without the `--modify` step every command fails with "All configured authentication methods failed". The passphrase unlocks the key file; it changes when Developer Mode is reinstalled.

Repeat with `cs` for the other TV. A fixed IP (DHCP reservation in the router) saves redoing this.

## 3. Install and run

```bash
npm run package
npm run tv:install                 # TV=cs npm run tv:install for the other TV
npm run tv:launch
npm run tv:inspect                 # opens DevTools; the console shows every [playback-test] line
```

## Remote

The controls are those of the Android app (`../jellycast-android-tv/.claude/rules/design-navigation.md`): ↑ ↓ ← →, OK, Back; holding OK opens options where the "[OK] hold for more" hint shows. In the player, ⏪/⏩ seek and Play/Pause toggles. The Magic Remote pointer also works: hovering focuses, clicking selects.
