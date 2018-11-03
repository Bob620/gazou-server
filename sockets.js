const WSEvents = require('./util/wsevents');
const uuidv1 = require('uuid/v1');

const config = require('./config/config');

const rateLimiter = require('./util/ratelimiter')(config.websocket.rateLimit.duration, config.websocket.rateLimit.messages);

class Sockets {
	constructor(wss, auth, random) {
		this.data = {
			wss,
			auth,
			random,
			clients: new Map(),
			heartbeat: setInterval(() => {
				for (const [, client] of this.data.clients) {
					if (client.isAlive) {
						client.isAlive = false;
						client.ws.ping();
					} else {
						client.ws.terminate();
					}
				}
			}, 30000)
		};

		wss.on('error', err => {
			console.log(err);
		});

		wss.on('connection', ws => {
			const handleMessage = async message => {
				message = JSON.parse(message);
				let responseMessage = {
					event: message.event,
					data: {},
					callback: message.callback
				};

				try {
					const eventStructure = message.event.split('.');
					let event = WSEvents;
					for (let i = 0; i < eventStructure.length; i++)
						if (event[eventStructure[i]])
							event = event[eventStructure[i]];
						else
							throw {
								event: message.event,
								message: 'Unknown event type'
							};

					if (typeof event === 'function')
						responseMessage.data = await event(message.data, this.data, client);
					else
						throw {
							event: message.event,
							message: 'Unknown event type'
						};
				} catch (err) {
					responseMessage = {
						event: 'error',
						data: err,
						callback: message.callback
					}
				}

				if (responseMessage.data.beginAuth)
					client.id = message.data.id;

				if (responseMessage.data && responseMessage.data.authed)
					client.authed = true;

				ws.send(JSON.stringify(responseMessage));
			};

			rateLimiter(ws);

			let client = {
				isAlive: true,
				authed: false,
				key: uuidv1(),
				id: ''
			};

			this.data.clients.set(client.key, client);

			ws.on('limited', async message => {
				if (client.id)
					await handleMessage(message);
				message = JSON.parse(message);

				ws.send(JSON.stringify({
					event: message.event,
					data: 'Rate limited',
					callback: message.callback
				}));
			});

			ws.on('close', () => {
				client.isAlive = false;
				this.data.clients.delete(client.key);
			});

			ws.on('error', err => {
				console.log(err);
			});

			ws.on('pong', () => {
				client.isAlive = true;
			});

			ws.on('message', handleMessage);
		});
	}
}

module.exports = Sockets;