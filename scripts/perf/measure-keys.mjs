// Measures the performance budget on a TV: holds the remote's arrow keys over the DevTools protocol
// (20 presses/s, like a held key) per scenario and reports janky frames and key-to-paint times.
// The app must be running and signed in; the script starts from the Home section.
//
//   node scripts/perf/measure-keys.mjs <device> [runs]      e.g. node scripts/perf/measure-keys.mjs c2 3
// Experiments: ONLY=series runs only scenarios whose name contains "series"; CSS='…' injects styles first.
import { execFileSync, spawn } from 'node:child_process'

const [device = 'c2', runsArg = '3'] = process.argv.slice(2)
const runs = Number(runsArg)
const appId = 'nl.jellycast.webos'
const keyIntervalMs = 50
const settleMs = 800
const jankFrameMs = 25
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const metricsScript = `(() => {
    if (window.__perf) return true
    const state = { frames: [], events: [], longTasks: [], keys: 0, running: false, last: 0 }
    const onFrame = (now) => {
        if (!state.running) return
        if (state.last) state.frames.push(now - state.last)
        state.last = now
        requestAnimationFrame(onFrame)
    }
    document.addEventListener('keydown', () => state.running && state.keys++, true)
    new PerformanceObserver((list) => {
        if (state.running) for (const entry of list.getEntries()) if (entry.name === 'keydown') state.events.push(entry.duration)
    }).observe({ type: 'event', durationThreshold: 16 })
    new PerformanceObserver((list) => {
        if (state.running) for (const entry of list.getEntries()) state.longTasks.push(entry.duration)
    }).observe({ type: 'longtask' })
    window.__perf = {
        start() { Object.assign(state, { frames: [], events: [], longTasks: [], keys: 0, last: 0, running: true }); requestAnimationFrame(onFrame) },
        stop() {
            state.running = false
            const durations = [...state.events]
            while (durations.length < state.keys) durations.push(16)
            return { frames: state.frames, durations, longTasks: state.longTasks }
        },
    }
    return true
})()`

async function inspect() {
    const inspector = spawn('npx', ['ares-inspect', '--device', device, '--app', appId], { stdio: ['ignore', 'pipe', 'pipe'] })
    const port = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('inspector did not start')), 30000)
        inspector.stdout.on('data', (chunk) => {
            const match = /localhost:(\d+)/.exec(String(chunk))
            if (match) {
                clearTimeout(timer)
                resolve(match[1])
            }
        })
    })
    const targets = await (await fetch(`http://localhost:${port}/json`)).json()
    return { inspector, wsUrl: targets[0].webSocketDebuggerUrl }
}

function connect(wsUrl) {
    const socket = new WebSocket(wsUrl)
    let nextId = 1
    const pending = new Map()
    socket.onmessage = (message) => {
        const reply = JSON.parse(message.data)
        pending.get(reply.id)?.(reply)
        pending.delete(reply.id)
    }
    const send = (method, params = {}) =>
        new Promise((resolve) => {
            const id = nextId++
            pending.set(id, resolve)
            socket.send(JSON.stringify({ id, method, params }))
        })
    const evaluate = async (expression) =>
        (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value
    return new Promise((resolve) => (socket.onopen = () => resolve({ socket, send, evaluate })))
}

const keyCodes = { left: 37, up: 38, right: 39, down: 40, back: 461 }

async function press(send, name, times, hold = true) {
    const code = keyCodes[name]
    for (let index = 0; index < times; index++) {
        await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, autoRepeat: hold && index > 0 })
        await sleep(keyIntervalMs)
        if (!hold) await send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: code, nativeVirtualKeyCode: code })
    }
    if (hold) await send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: code, nativeVirtualKeyCode: code })
    await sleep(settleMs)
}

/** Each scenario starts on the section bar with the given tab and leaves the focus there again. */
const scenarios = [
    { name: 'home ←/→', tab: 0, run: (send) => press(send, 'right', 4).then(() => press(send, 'left', 4)) },
    { name: 'series ←/→', tab: 1, run: (send) => press(send, 'right', 15).then(() => press(send, 'left', 15)) },
    { name: 'series ↑/↓', tab: 1, run: (send) => press(send, 'down', 5).then(() => press(send, 'up', 5)) },
    { name: 'movies ←/→', tab: 2, run: (send) => press(send, 'right', 15).then(() => press(send, 'left', 15)) },
    { name: 'movies ↑/↓', tab: 2, run: (send) => press(send, 'down', 4).then(() => press(send, 'up', 4)) },
    { name: 'library grid', tab: 3, run: (send) => press(send, 'down', 1, false).then(() => press(send, 'right', 7)).then(() => press(send, 'down', 3)).then(() => press(send, 'up', 3)) },
]

function percentile(values, fraction) {
    if (!values.length) return 0
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))]
}

const round = (value) => Math.round(value * 10) / 10

execFileSync('npx', ['ares-launch', '--device', device, appId])
await sleep(6000)
const { inspector, wsUrl } = await inspect()
const { socket, send, evaluate } = await connect(wsUrl)
await evaluate(metricsScript)
if (process.env.CSS) {
    await evaluate(`(() => { const style = document.createElement('style'); style.textContent = ${JSON.stringify(process.env.CSS)}; document.head.appendChild(style); return true })()`)
}

for (const scenario of scenarios.filter((entry) => !process.env.ONLY || entry.name.includes(process.env.ONLY))) {
    const results = []
    for (let attempt = 0; attempt < runs; attempt++) {
        // To the section bar, then to the scenario's tab, then into the content.
        await press(send, 'back', 1, false)
        await press(send, 'back', 1, false)
        await press(send, 'left', 4, false)
        if (scenario.tab) await press(send, 'right', scenario.tab, false)
        await press(send, 'down', 1, false)
        await sleep(1500)
        await evaluate('window.__perf.start()')
        await scenario.run(send)
        const { frames, durations, longTasks } = await evaluate('window.__perf.stop()')
        results.push({
            jank: (100 * frames.filter((frame) => frame > jankFrameMs).length) / Math.max(1, frames.length),
            keyP50: percentile(durations, 0.5),
            keyP95: percentile(durations, 0.95),
            longTasks: longTasks.filter((duration) => duration > 100).length,
        })
    }
    const median = (field) => round(percentile(results.map((result) => result[field]), 0.5))
    console.log(
        `${scenario.name.padEnd(14)} jank ${median('jank')}% · key p50 ${median('keyP50')} ms · p95 ${median('keyP95')} ms · long tasks > 100 ms: ${median('longTasks')}`,
    )
}
socket.close()
inspector.kill()
process.exit(0)
