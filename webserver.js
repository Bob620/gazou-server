#!/usr/bin/env node

//process.stdin.resume();

//let hasClosed = false;
//function exitHandler() {
//	if (!hasClosed) {
//		hasClosed = true;
//		console.log("Shutting down...");
//
//		process.exit();
//	}
//}

// do something when app is closing
//process.on('exit', exitHandler.bind(null));

// catches ctrl+c event
//process.on('SIGINT', exitHandler.bind(null));

// catches "kill pid"
//process.on('SIGUSR1', exitHandler.bind(null));
//process.on('SIGUSR2', exitHandler.bind(null));
//process.on('SIGTERM', exitHandler.bind(null));

// catches uncaught exceptions
//process.on('uncaughtException', exitHandler.bind(null));

let port = undefined;
for (let i = 0; i < process.argv.length; i++) {
	switch (process.argv[i]) {
		case '--port':
		case '-p':
			port = process.argv[++i];
			break;
	}
}

const app = require('./util/server');

port = port || '80';
//app.set('port', port);

app.listen(port);
module.export = app;