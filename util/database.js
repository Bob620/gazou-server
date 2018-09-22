const redis = require('./redis');
const uuidModify = require('./uuidmodify');

const constants = require('./constants');

const database = {
	getImageMetadata: async uuid => {
		const imageLocation = `${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${constants.redis.images.IMAGES}:${uuidModify.toLexical(uuid)}`;
		return redis.h.getAll(`${imageLocation}:${constants.redis.images.METADATA}`);
	},
	setImageMetadata: async (uuid, metadata) => {
		const imageLocation = `${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${constants.redis.images.IMAGES}:${uuidModify.toLexical(uuid)}`;
		return redis.hm.set(`${imageLocation}:${constants.redis.images.METADATA}`, ...Object.keys(metadata).flatMap(key => {
			return [key, metadata[key]];
		}));
	},
	addImageMetadata: async (uuid, metadata) => {
		return await redis.z.add(metadata.dateModified, uuidModify.toLexical(uuid));
	}
};

module.exports = database;