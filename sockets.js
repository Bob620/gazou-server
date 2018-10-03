const WSEvents = require('./util/wsevents');

class Sockets {
	constructor(wss) {
		this.data = {
			wss
		};

		wss.on('connection', ws => {
			let data = {
				user: {
					username: 'bb620'
				}
			};

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
						responseMessage.data = await event(message.data, data);
					else
						throw {
							event: message.event,
							message: 'Unknown event type'
						};
				} catch(err) {
					console.log(err);
					responseMessage = {
						event: 'error',
						data: err,
						callback: message.callback
					}
				}

				ws.send(JSON.stringify(responseMessage));
			});
		});
	}
}

module.exports = Sockets;