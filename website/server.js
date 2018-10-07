const config = require('../config/config');
const constants = require('../util/constants');
const database = require('../util/database');

const serverHead = {
	'Server': 'nodejs'
};

const fs = require('fs');
const http = config.website.certLocation && config.website.keyLocation ? require('https') : require('http');
let options = {};

if (config.website.certLocation && config.website.keyLocation) {
	options.key = fs.readFileSync(config.website.keyLocation);
	options.cert = fs.readFileSync(config.website.certLocation);
}

const server = http.createServer(options, async (req, res) => {
	function sendResponse(statusCode, file='', head={}) {
		for (const key of Object.keys(serverHead))
			head[key] = serverHead[key];

		if (typeof file === 'object') {
			file = JSON.stringify(file);
			head['Content-Type'] = 'application/json; charset=utf-8';
		}

		switch(statusCode) {
			case 200:
				res.writeHead(200, 'OK', head);
				res.write(file);
				res.end();
				break;
			case 500:
			default:
				res.writeHead(500, 'Internal Server Error', head);
				res.write(file);
				res.end();
				break;
			case 400:
				res.writeHead(400, 'Bad Request', head);
				res.write(file);
				res.end();
				break;
			case 404:
				head['Content-Type'] = 'text/html; charset=utf-8';
				res.writeHead(404, 'Not Found', head);
				res.write('<head><style>h1{text-align:center;width:100vw;top:6vh;position:relative;font-size:5em;}</style></head><body><h1>404</h1></body>');
				res.end();
				break;
		}
	}

	try {
		const [rawUrl, rawArgs] = req.url.split('?');
		const [, command, ...input] = rawUrl.split('/');
		let argPairs = [];
		let args = {};

		switch(req.method.toUpperCase() + '-' + command.toLowerCase()) {
			case 'POST-upload':
				sendResponse(200, {upload: input});
				break;
			case 'GET-get':
				switch(input[0]) {
					case 'single':
						const item = await database.getImageMetadata(input[1]);
						if (item.hash)
							sendResponse(200, {
								[input[1]]: item
							});
						else
							sendResponse(200, {});
						break;
					case 'batch':
						argPairs = rawArgs.split('&');
						for (const arg of argPairs) {
							const [key, value] = arg.split('=');
							args[key.toLowerCase()] = value;
						}

						if (args.uuids === undefined || args.uuids.length < 0) {
							sendResponse(400, {error: 'Malformed search criteria'});
							break;
						} else
							args.uuids = args.uuids.split(',');

						let metadata = {};
						for (const uuid of args.uuids) {
							const item = await database.getImageMetadata(uuid);
							if (item.hash)
								metadata[uuid] = item;
						}

						sendResponse(200, metadata);
						break;
					default:
						sendResponse(404);
				}
				break;
			case 'GET-search':
				argPairs = rawArgs.split('&');
				for (const arg of argPairs) {
					const [key, value] = arg.split('=');
					args[key.toLowerCase()] = value;
				}

				switch(input[0].toLowerCase()) {
					case 'datemodified':
						try {
							let count = args.count;
							count = count > constants.search.MAXMAX ? constants.search.MAXMAX : count;
							return await database.findImagesByScore(args.min, args.max, args.startposition, count);

						} catch (err) {
							sendResponse(400, {error: 'Malformed search criteria'});
						}
						break;
					case 'dateadded':
						try {
							let count = args.count;
							count = count > constants.search.MAXMAX ? constants.search.MAXMAX : count;
							return await database.findImagesByLex(args.min, args.max, args.startposition, count);

						} catch (err) {
							sendResponse(400, {error: 'Malformed search criteria'});
						}
						break;
					case 'artist':
						try {
							const name = args.name.toLowerCase();
							const artistId = await database.getArtistByName(name);
							if (artistId)
								sendResponse(200, await database.findImagesByArtistId(artistId, args.startposition, args.count));
							else
								sendResponse(400, {error: `Unknown artist '${name}`});
						} catch (err) {
							sendResponse(400, {error: 'Malformed search criteria'});
						}
						break;
					case 'tags':
						const tags = args.tags.split(',');
						switch(tags.length) {
							case 0:
								sendResponse(200, {});
								break;
							case 1:
								try {
									const tagId = await database.getTagByName(tags[0]);
									if (tagId)
										sendResponse(200, await database.findImagesByTag(tagId, args.startposition, args.count));
									else
										sendResponse(400, {error: `Unknown tag '${tags[0]}'`});
								} catch (err) {
									sendResponse(400, {error: 'Malformed search criteria'});
								}
								break;
							default:
								try {
									let tagPromises = [];
									for (const tagName of tags)
										tagPromises.push(new Promise(async (resolve, reject) => {
											const tagId = await database.getTagByName(tagName);
											if (tagId)
												resolve(tagId);
											else
												reject({
													error: `Unknown tag '${tagName}'`
												});
										}));

									const tagIds = await Promise.all(tagPromises);
									return await database.findImagesByTags(tagIds, args.startposition ? args.startposition : 0, args.count ? args.count : 10);
								} catch (err) {
									sendResponse(400, err);
								}
								break;
						}
						break;
					default:
						sendResponse(404);
						break;
				}
				break;
			default:
				sendResponse(404);
				break;
		}
	} catch(err) {
		console.log(err);
		sendResponse(500);
	}
});

server.on('close', () => {
	console.log('API webserver closed');
});


module.exports = server;