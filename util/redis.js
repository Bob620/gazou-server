const { promisify } = require('util');

const config = require('../config/config.json');

const redis = require('redis');
const client = redis.createClient(config.redis);

client.on('error', (err) => {
	console.log('Redis encountered an error!\n'+err);
});

module.exports = {
	eval: promisify(client.eval).bind(client),
	set: promisify(client.set).bind(client),
	get: promisify(client.get).bind(client),
	del: promisify(client.del).bind(client),
	s: {
		add: promisify(client.sadd).bind(client),
		rem: promisify(client.srem).bind(client),
		members: promisify(client.smembers).bind(client),
		isMember: (...values) => { return new Promise((resolve, reject) => {
			client.sismember(...values, (err, value) => {
				if (err) reject(err);
				resolve(!!value);
			});
		})}
	},
	z: {
		add: promisify(client.zadd).bind(client),
		card: promisify(client.zcard).bind(client),
		count: promisify(client.zcount).bind(client),
		rank: promisify(client.zrank).bind(client),
		range: promisify(client.zrange).bind(client),
		rangeByLex: promisify(client.zrangebylex).bind(client),
		rangeByScore: promisify(client.zrangebyscore).bind(client),
		rem: promisify(client.zrem).bind(client),
		scan: promisify(client.zscan).bind(client),
		interstore: promisify(client.zinterstore).bind(client),
		score: promisify(client.zscore).bind(client)
	},
	h: {
		del: promisify(client.hdel).bind(client),
		keys: promisify(client.hkeys).bind(client),
		get: promisify(client.hget).bind(client),
		getAll: promisify(client.hgetall).bind(client)
	},
	hm: {
		get: promisify(client.hmget).bind(client),
		set: promisify(client.hmset).bind(client)
	}
};