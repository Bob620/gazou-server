/*
#!/usr/bin/env node

process.stdin.resume();

let hasClosed = false;
function exitHandler() {
	if (!hasClosed) {
		hasClosed = true;
		console.log("Shutting down...");

		process.exit();
	}
}

// do something when app is closing
process.on('exit', exitHandler.bind(null));

// catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null));

// catches "kill pid"
process.on('SIGUSR1', exitHandler.bind(null));
process.on('SIGUSR2', exitHandler.bind(null));
process.on('SIGTERM', exitHandler.bind(null));

// catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null));
*/
const Random = require('random-js');
const random = new Random(Random.engines.mt19937().autoSeed());
const WS = require('ws');

const Auth = require('./util/auth');
const Sockets = require('./sockets');

const config = require('./config/config');

const fs = require('fs');
const http = config.websocket.certLocation && config.websocket.keyLocation ? require('https') : require('http');
let socketOptions = config.websocket;

if (config.websocket.certLocation && config.websocket.keyLocation) {
	socketOptions.key = fs.readFileSync(config.websocket.keyLocation);
	socketOptions.cert = fs.readFileSync(config.websocket.certLocation);
}

// Default Ports
let port = 80;
let webSocketPort = 8080;

for (let i = 0; i < process.argv.length; i++) {
	switch (process.argv[i]) {
		case '--httpport':
		case '-p':
			port = process.argv[++i];
			break;
		case '--websocketport':
		case '-s':
			webSocketPort = process.argv[++i];
			break;
	}
}

// Initialize services
const auth = new Auth(random);
const server = require('./util/server');
const webSocketServer = new http.createServer(socketOptions);

// Create wss
const wss = new WS.Server({server: webSocketServer});

// Set up websocket handler
const sockets = new Sockets(wss, auth, random);

server.listen(port);
webSocketServer.listen(webSocketPort);
