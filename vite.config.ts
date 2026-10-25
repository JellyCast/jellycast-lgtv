import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

// The C2 (webOS 24) runs Chrome 108, the CS (webOS 25) Chrome 120.
const webOsTarget = 'chrome108'

const appInfo = {
    id: 'nl.jellycast.webos',
    version: pkg.version,
    vendor: 'JellyCast',
    type: 'web',
    main: 'index.html',
    title: 'JellyCast',
    icon: 'icon.png',
    largeIcon: 'largeIcon.png',
    bgColor: '#0b0d10',
    resolution: '1920x1080',
    disableBackHistoryAPI: true,
    requiredACG: [],
}

function webOsApp(): Plugin {
    return {
        name: 'jellycast-webos-app',
        apply: 'build',
        generateBundle() {
            this.emitFile({
                type: 'asset',
                fileName: 'appinfo.json',
                source: `${JSON.stringify(appInfo, null, 2)}\n`,
            })
        },
        // The app is loaded from file://, where Chromium refuses module scripts.
        transformIndexHtml(html) {
            return html.replace(/<script type="module" crossorigin/g, '<script defer')
        },
    }
}

export default defineConfig({
    base: './',
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    plugins: [webOsApp()],
    oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
    build: {
        target: webOsTarget,
        cssTarget: webOsTarget,
        modulePreload: false,
        assetsInlineLimit: 0,
        rolldownOptions: {
            output: { format: 'iife', entryFileNames: 'app.js', assetFileNames: '[name][extname]' },
        },
    },
})
