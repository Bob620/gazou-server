const WSEvents = require('./util/wsevents');

class Sockets {
	constructor(wss) {
		this.data = {
			wss
		};

		wss.on('connection', ws => {
			let data = {
				user: undefined
			};

			ws.on('message', async message => {
				message = JSON.parse(message);
				let responseMessage = {
					event: message.event,
					data: {},
					callback: message.callback
				};

				try {
					if (WSEvents[message.event])
						responseMessage.data = await WSEvents[message.event](message.data, data);
				} catch(err) {
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