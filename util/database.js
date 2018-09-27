const redis = require('./redis');
const uuidModify = require('./uuidmodify');

const constants = require('./constants');

const database = {
	getImageMetadata: async uuid => {
		return redis.h.getAll(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`);
	},
	updateImageMetadata: async (uuid, metadata) => {
		// UPDATE
		if (metadata.dateModified)
			redis.z.add(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, metadata.dateModified, uuidModify.toLexical(uuid));

		return redis.hm.set(
			`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`,
			...Object.keys(metadata).reduce((acc, key) => acc.concat([key, metadata[key]]), [])
		);
	},
	addImageMetadata: async (uuid, metadata) => {
		await redis.hm.set(
			`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`,
			...Object.keys(metadata).reduce((acc, key) => acc.concat([key, metadata[key]]), [])
		);
		return await redis.z.add(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, metadata.dateModified, uuidModify.toLexical(uuid));
	},
	removeImageMetadata: (uuid) => {
		return Promise.all([
			redis.z.rem(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, uuidModify.toLexical(uuid)),
			redis.h.del(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'uuid', 'hash', 'dateAdded', 'dateModified', 'uploader')
		]);
	},
	findImagesByLex: (minTimestamp, maxTimestamp, start=0, count=10) => {
		return redis.z.rangeByLex(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, '['+uuidModify.timestampToUlid(minTimestamp), '['+uuidModify.timestampToUlid(maxTimestamp), 'LIMIT', start, count);
	},
	findImagesByScore: (minTimestamp, maxTimestamp, start=0, count=10) => {
		return redis.z.rangeByScore(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, minTimestamp, maxTimestamp, 'LIMIT', start, count);
	},
	findImagesByArtistId: (artistId, start=0, count=10) => {
		return redis.z.rangeByScore(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.ARTISTIMAGES}`, artistId, artistId, 'LIMIT', start, count);
	},
	getArtistByName: (artistName) => {
		return redis.z.rank(`${constants.redis.DOMAIN}:${constants.redis.ARTISTS}`, artistName);
	},
	createArtist: async (artistName) => {
		const artistId = 1 + await redis.z.card(`${constants.redis.DOMAIN}:${constants.redis.ARTISTS}`);
		return await redis.z.add(`${constants.redis.DOMAIN}:${constants.redis.ARTISTS}`, artistId, artistName);
	}
};

module.exports = database;