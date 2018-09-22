const { promisify } = require('util');

const config = require('../config/config.json');

const redis = require('redis');
const client = redis.createClient(config.redis);

client.on('error', (err) => {
	console.log('Redis encountered an error!\n'+err);
});

module.exports = {
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
		add: promisify(client.zadd),
		range: promisify(client.zrange),
		rangeByLex: promisify(client.zrangebylex),
		rangeByScore: promisify(client.zrangebyscore),
		rem: promisify(client.zrem),
		scan: promisify(client.zscan)
	},
	h: {
		del: promisify(client.hdel),
		keys: promisify(client.hkeys),
		get: promisify(client.hget),
		getAll: promisify(client.hgetall)
	},
	hm: {
		get: promisify(client.hmget),
		set: promisify(client.hmset)
	}
};