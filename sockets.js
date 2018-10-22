const WSEvents = require('./util/wsevents');

class Sockets {
	constructor(wss, auth, random) {
		this.data = {
			wss,
			auth,
			random
		};

		wss.on('error', err => {
			console.log(err);
		});

		wss.on('connection', ws => {
			let currentUser = {
				authed: false,
				id: ''
			};

			ws.on('error', err => {
				console.log(err);
			});

			ws.on('message', async message => {
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
						responseMessage.data = await event(message.data, this.data, currentUser);
					else
						throw {
							event: message.event,
							message: 'Unknown event type'
						};
				} catch(err) {
					responseMessage = {
						event: 'error',
						data: err,
						callback: message.callback
					}
				}

				if (responseMessage.data.beginAuth)
					currentUser.id = message.data.id;

				if (responseMessage.data && responseMessage.data.authed)
					currentUser.authed = true;

				ws.send(JSON.stringify(responseMessage));
			});
		});
	}
}

module.exports = Sockets;