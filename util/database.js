const redis = require('./redis');
const uuidModify = require('./uuidmodify');

const constants = require('./constants');

const database = {
	getImageMetadata: async uuid => {
		return redis.h.getAll(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`);
	},
	updateImageMetadata: async (uuid, {artist=false, dateModified=false, addTags=[], removeTags=[]}) => {

		// CHANGE TO SEARCH FUNCTIONS
		// UPDATE date modified in search index
		redis.z.add(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, dateModified, uuidModify.toLexical(uuid));

		// Update date modified in metadata
		await redis.hm.set(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'dateModified', dateModified);

		// Update artist in metadata
		if (artist)
			await redis.hm.set(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'artist', artist);

		// Handle changed tags
		if (addTags) {

		}

		if (removeTags) {

		}
	},
	addImageMetadata: async (uuid, metadata) => {
		await redis.hm.set(
			`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`,
			...Object.keys(metadata).reduce((acc, key) => acc.concat([key, metadata[key]]), [])
		);
		// CHANGE TO SEARCH FUNCTIONS
		// set date modified in search index
		return await redis.z.add(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, metadata.dateModified, uuidModify.toLexical(uuid));
	},
	removeImageMetadata: (uuid) => {
		return Promise.all([
			redis.z.rem(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, uuidModify.toLexical(uuid)),
			redis.h.del(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'uuid', 'hash', 'dateAdded', 'dateModified', 'uploader', 'artist')
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
	findImagesByTag: async (tagId, start=0, count=10) => {
		return redis.z.rangeByScore(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGES}`, tagId, tagId, 'LIMIT', start, count);
	},
	findImagesByTags: async (intersectionStore, tagIds, start=0, count=10) => {
		await redis.z.interstore(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGES}:${intersectionStore}`, tagIds.length, ...tagIds);

		return await redis.z.range(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGES}:${intersectionStore}`, start, start+count);
	},
	getArtistByName: (artistName) => {
		return redis.z.rank(`${constants.redis.DOMAIN}:${constants.redis.ARTISTS}`, artistName);
	},
	createArtist: async (artistName) => {
		const artistId = 1 + await redis.z.card(`${constants.redis.DOMAIN}:${constants.redis.ARTISTS}`);
		await redis.z.add(`${constants.redis.DOMAIN}:${constants.redis.ARTISTS}`, artistId, artistName);
		return artistId;
	},
	getTagByName: async (tagName) => {
		return redis.z.rank(`${constants.redis.DOMAIN}:${constants.redis.TAGS}`, tagName);
	},
	createTag: async (tagName) => {
		const tagId = 1 + await redis.z.card(`${constants.redis.DOMAIN}:${constants.redis.TAGS}`);
		await redis.z.add(`${constants.redis.DOMAIN}:${constants.redis.TAGS}`, tagId, tagName);
		return tagId;
	}
};

module.exports = database;