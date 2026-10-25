// A web app cannot send UDP, so Jellyfin's network discovery runs in this Node service.
// Plain ES2015 CommonJS: the TVs run an older Node.

var Service = require('webos-service')
var dgram = require('dgram')
var pkgInfo = require('./package.json')

var discoveryPort = 7359
var discoveryMessage = 'who is JellyfinServer?'
var listenMs = 2000

var service = new Service(pkgInfo.name)

function parseReply(message) {
    try {
        var reply = JSON.parse(message.toString('utf8'))
        if (typeof reply.Id !== 'string' || typeof reply.Address !== 'string') return null
        return { id: reply.Id, name: typeof reply.Name === 'string' ? reply.Name : '', address: reply.Address }
    } catch (error) {
        return null
    }
}

// Answers once, after listening for replies, with every server that answered.
service.register('discover', function (message) {
    var servers = {}
    var socket = dgram.createSocket('udp4')
    var done = false

    function finish(error) {
        if (done) return
        done = true
        try {
            socket.close()
        } catch (ignored) {}
        if (error) {
            message.respond({ returnValue: false, errorText: String(error) })
            return
        }
        var list = Object.keys(servers).map(function (id) {
            return servers[id]
        })
        message.respond({ returnValue: true, servers: list })
    }

    socket.on('error', finish)
    socket.on('message', function (data) {
        var server = parseReply(data)
        if (server) servers[server.id] = server
    })
    socket.bind(0, function () {
        socket.setBroadcast(true)
        var payload = Buffer.from(discoveryMessage)
        socket.send(payload, 0, payload.length, discoveryPort, '255.255.255.255', function (error) {
            if (error) finish(error)
        })
        setTimeout(function () {
            finish(null)
        }, listenMs)
    })
})
