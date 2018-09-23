const redis = require('./redis');
const uuidModify = require('./uuidmodify');

const constants = require('./constants');

const database = {
	getImageMetadata: async uuid => {
		const imageLocation = `${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}`;
		return redis.h.getAll(`${imageLocation}:${constants.redis.images.METADATA}`);
	},
	updateImageMetadata: async (uuid, metadata) => {
		const imageLocation = `${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}`;
		return redis.hm.set(`${imageLocation}:${constants.redis.images.METADATA}`, ...Object.keys(metadata).reduce((acc, key) => acc.concat([key, metadata[key]]), []));
	},
	addImageMetadata: async (uuid, metadata) => {
		const imageLocation = `${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}`;
		await redis.hm.set(`${imageLocation}:${constants.redis.images.METADATA}`, ...Object.keys(metadata).reduce((acc, key) => acc.concat([key, metadata[key]]), []));
		return await redis.z.add(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, metadata.dateModified, uuidModify.toLexical(uuid));
	},
	removeImageMetadata: (uuid) => {
		const imageLocation = `${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}`;
		return Promise.all([
			redis.z.rem(uuidModify.toLexical(uuid)),
			redis.h.del(imageLocation, 'uuid', 'hash', 'dateAdded', 'dateModified', 'uploader')
		]);
	}
};

module.exports = database;