const Sockets = require('../sockets');
let totalTests = 16;
let passedTests = 0;
let completedTests = 0;

let testingFinished = false;

class EmitterEmulator {
	constructor() {
		this._onCallbacks = {}
	}

	emit(event, data) {
		const callbacks = this._onCallbacks[event];
		if (callbacks)
			callbacks.forEach(callback => {callback(JSON.stringify(data))});
	}

	emitRaw(event, data) {
		const callbacks = this._onCallbacks[event];
		if (callbacks)
			callbacks.forEach(callback => {callback(data)});
	}

	on(event, callback) {
		if (this._onCallbacks[event])
			this._onCallbacks[event].push(callback);
		else
			this._onCallbacks[event] = [callback];
	}
}

class wsEmulator extends EmitterEmulator {
	constructor() {
		super();
	}

	send(message) {
		message = JSON.parse(message);
		this.emit('send', message);
	}
}

class wssEmulator extends EmitterEmulator {
	constructor() {
		super();

		this.data = {
			ws: undefined
		}
	}

	startConnection() {
		this.data.ws = new wsEmulator();
		this.emitRaw('connection', this.data.ws);
	}

	sendAddNewImage(hash, artist, callback) {
		this.data.ws.emit('message', {
			event: 'upload',
			data: {
				hash,
				artist
			},
			callback: `sendAddNewImage${callback ? `.${callback}` : ''}`
		});
	}

	sendRemoveSingleImage(uuid, callback) {
		this.data.ws.emit('message', {
			event: 'remove.single',
			data: {
				uuid
			},
			callback: `sendRemoveSingleImage${callback ? `.${callback}` : ''}`
		});
	}

	sendRemoveBatchImage(uuids, callback) {
		this.data.ws.emit('message', {
			event: 'remove.batch',
			data: {
				uuids
			},
			callback: `sendRemoveBatchImage${callback ? `.${callback}` : ''}`
		});
	}

	sendGetSingleMetadata(uuid, callback) {
		this.data.ws.emit('message', {
			event: 'get.single',
			data: {
				uuid
			},
			callback: `sendGetSingleMetadata${callback ? `.${callback}` : ''}`
		});
	}

	sendGetBatchMetadata(uuids, callback) {
		this.data.ws.emit('message', {
			event: 'get.batch',
			data: {
				uuids
			},
			callback: `sendGetBatchMetadata${callback ? `.${callback}` : ''}`
		});
	}

	sendUpdateMetadata(uuid, metadata, callback) {
		this.data.ws.emit('message', {
			event: 'update',
			data: {
				uuid,
				metadata
			},
			callback: `sendUpdateMetadata${callback ? `.${callback}` : ''}`
		});
	}

	sendCustomEvent(event, data, callback) {
		this.data.ws.emit('message', {
			event,
			data,
			callback: `sendCustomEvent.${event}${callback ? `.${callback}` : ''}`
		});
	}

	sendSearchDateModified(min, max, count=10, startPos=0, callback) {
		this.data.ws.emit('message', {
			event: 'search.dateModified',
			data: {
				min,
				max,
				count,
				startPos
			},
			callback: `sendSearchDateModified.${callback ? `.${callback}` : ''}`
		});
	}

	sendSearchDateAdded(min, max, count=10, startPos=0, callback) {
		this.data.ws.emit('message', {
			event: 'search.dateAdded',
			data: {
				min,
				max,
				count,
				startPos
			},
			callback: `sendSearchDateAdded.${callback ? `.${callback}` : ''}`
		});
	}

	sendSearchArtist(name, count=10, startPos=0, callback) {
		this.data.ws.emit('message', {
			event: 'search.artist',
			data: {
				name,
				count,
				startPos
			},
			callback: `sendSearchArtistName.${callback ? `.${callback}` : ''}`
		});
	}
}


const wss = new wssEmulator();
const socket = new Sockets(wss);

let testUuid = '';
let testUuidList = [];

wss.startConnection();

wss.data.ws.on('send', message => {
	message = JSON.parse(message);
	switch (message.event) {
		case 'search.dateModified':
			if (message.callback.endsWith('test12')) {
				console.log(`\nTest 12: ws.search.dateModified\nExpected: '3'\nGot: '${message.data.length}'`);
				completedTests++;
				if (Object.keys(message.data).length === 3) {
					passedTests++;
					console.log('PASS');
				} else
					console.log('FAIL');
			}
			if (message.callback.endsWith('test13')) {
				console.log(`\nTest 13: ws.search.dateModified\nExpected: '0'\nGot: '${message.data.length}'`);
				completedTests++;
				if (Object.keys(message.data).length === 0) {
					passedTests++;
					console.log('PASS');
				} else
					console.log('FAIL');
			}
			break;
		case 'search.dateAdded':
			if (message.callback.endsWith('test14')) {
				console.log(`\nTest 14: ws.search.dateAdded\nExpected: '3'\nGot: '${message.data.length}'`);
				completedTests++;
				if (Object.keys(message.data).length === 3) {
					passedTests++;
					console.log('PASS');
				} else
					console.log('FAIL');
			}
			if (message.callback.endsWith('test15')) {
				console.log(`\nTest 15: ws.search.dateAdded\nExpected: '0'\nGot: '${message.data.length}'`);
				completedTests++;
				if (Object.keys(message.data).length === 0) {
					passedTests++;
					console.log('PASS');
				} else
					console.log('FAIL');
			}
			break;
		case 'get.single':
			if (message.callback.endsWith('test2')) {
				console.log(`\nTest 2: ws.get.single\nExpected: '{'${testUuid}': {...}}'\nGot: '${message.data[testUuid] ? `{'${testUuid}': {...}}` : `{}`}'`);
				completedTests++;
				if (Object.keys(message.data).length === 1 && message.data[testUuid]) {
					passedTests++;
					console.log('PASS');
				} else
					console.log('FAIL');
			}
			if (message.callback.endsWith('test3')) {
				console.log(`\nTest 3: ws.get.single\nExpected: '{}'\nGot: '${message.data.length ? `{'?': {...}}` : `{}`}'`);
				completedTests++;
				if (Object.keys(message.data).length === 0) {
					passedTests++;
					console.log('PASS');
				} else
					console.log('FAIL');
			}
			break;
		case 'get.batch':
			if (message.callback.endsWith('test4')) {
				console.log(`\nTest 4: ws.get.batch\nExpected: '{'${testUuidList[0]}': {...}, '${testUuidList[1]}': {...}}'\nGot: '${message.data[testUuidList[0]] && message.data[testUuidList[1]] ? `{'${testUuidList[0]}': {...}, '${testUuidList[1]}': {...}}` : `{}`}'`);
				completedTests++;
				if (Object.keys(message.data).length === testUuidList.length && message.data[testUuidList[0]] && message.data[testUuidList[1]]) {
					passedTests++;
					console.log('PASS');
				} else
					console.log('FAIL');
			}
			if (message.callback.endsWith('test5')) {
				console.log(`\nTest 5: ws.get.batch\nExpected: '{}'\nGot: '${message.data.length ? `{'?': {...}}` : `{}`}'`);
				completedTests++;
				if (Object.keys(message.data).length === 0) {
					passedTests++;
					console.log('PASS');
				} else
					console.log('FAIL');
			}
			break;
		case 'update':
			if (message.callback.endsWith('test6')) {
				console.log(`\nTest 6: ws.update\nExpected: 'bob620'\nGot: '${message.data[testUuid].artist}'`);
				completedTests++;
				if (message.data[testUuid].artist === 'bob620') {
					passedTests++;
					console.log('PASS');
				} else
					console.log('FAIL');
			}
			if (message.callback.endsWith('test7')) {
				console.log(`\nTest 7: ws.update\nExpected: 'test'\nGot: '${message.data[testUuid].artist}'`);
				completedTests++;
				if (message.data[testUuid].artist === 'test') {
					passedTests++;
					console.log('PASS');
				} else
					console.log('FAIL');
			}
			break;
		case 'error':
			if (message.callback.endsWith('Kappa.test1')) {
				console.log(`\nTest 1: ws.invalidEvent\nExpected: 'Unknown event type'\nGot: '${message.data.message}'`);
				completedTests++;
				if (message.data.message === 'Unknown event type') {
					passedTests++;
					console.log('PASS');
				} else
					console.log('FAIL');
			} else
				console.log(message);
			break;
		case 'remove.single':
			if (message.callback.endsWith('test8')) {
				console.log(`\nTest 8: ws.remove.single\nExpected: '1'\nGot: '${message.data.total}'`);
				completedTests++;
				if (message.data.total === 1) {
					passedTests++;
					console.log('PASS');
				} else
					console.log('FAIL');
			}
			if (message.callback.endsWith('test9')) {
				console.log(`\nTest 9: ws.remove.single\nExpected: '0'\nGot: '${message.data.total}'`);
				completedTests++;
				if (message.data.total === 0) {
					passedTests++;
					console.log('PASS');
				} else
					console.log('FAIL');
			}
			break;
		case 'remove.batch':
			if (message.callback.endsWith('test10')) {
				console.log(`\nTest 10: ws.remove.batch\nExpected: '${testUuidList.length}'\nGot: '${message.data.total}'`);
				completedTests++;
				if (message.data.total === testUuidList.length) {
					passedTests++;
					console.log('PASS');
				} else
					console.log('FAIL');
			}
			if (message.callback.endsWith('test11')) {
				console.log(`\nTest 11: ws.remove.batch\nExpected: '0'\nGot: '${message.data.total}'`);
				completedTests++;
				if (message.data.total === 0) {
					passedTests++;
					console.log('PASS');
				} else
					console.log('FAIL');
			}
			break;
		case 'upload':
			if (message.callback.endsWith('testUuidList'))
				testUuidList.push(message.data.uuid);
			if (message.callback.endsWith('test0')) {
				console.log(`\nTest 0: ws.upload\nExpected: 'https://gazou.bobco.moe/{?}'\nGot: '${message.data.link}'`);
				completedTests++;
				if (message.data.link.startsWith('https://gazou.bobco.moe/')) {
					testUuid = message.data.uuid;
					passedTests++;
					console.log('PASS');
				} else
					console.log('FAIL');
			}
			break;
	}

	if (totalTests === completedTests) {
		console.log(`\nPassed ${passedTests} out of ${totalTests} tests\n`);
		testingFinished = true;
	}
});

wss.sendAddNewImage('somehash', 'artistOne', 'test0');
wss.sendAddNewImage('somenewhash', 'artistTwo', 'testUuidList');
wss.sendAddNewImage('someotherhash', 'artistThree', 'testUuidList');
setTimeout(() => {
	wss.sendCustomEvent('Kappa', {}, 'test1');
	wss.sendGetSingleMetadata(testUuid, 'test2');
	wss.sendGetSingleMetadata('0', 'test3');
	wss.sendGetBatchMetadata(testUuidList, 'test4');
	wss.sendGetBatchMetadata(['0'], 'test5');
	wss.sendUpdateMetadata(testUuid, {
		artist: 'bob620'
	}, 'test6');

	wss.sendSearchDateModified(0, Date.now(), 10, 0, 'test12');
	wss.sendSearchDateModified(0, 100, 10, 0, 'test13');
	wss.sendSearchDateAdded(0, Date.now(), 10, 0, 'test14');
	wss.sendSearchDateAdded(0, 100, 10, 0, 'test15');

	setTimeout(() => {
		wss.sendUpdateMetadata(testUuid, {
			artist: 'test'
		}, 'test7');

//		setTimeout(() => {
//			wss.sendRemoveSingleImage(testUuid, 'test8');
//			wss.sendRemoveSingleImage('invalidUuid', 'test9');
//			wss.sendRemoveBatchImage(testUuidList, 'test10');
//			wss.sendRemoveBatchImage(['invalidUuid1', 'invalidUuid2'], 'test11');
//		}, 1000);
	}, 1000);
}, 1000);


setTimeout(() => {
	if (!testingFinished)
		console.log(`\nPassed ${passedTests} out of ${totalTests} tests\n`);
	testingFinished = true;

	process.exit();
}, 5000);
