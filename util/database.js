const redis = require('./redis');
const uuidModify = require('./uuidmodify');

const constants = require('./constants');

const database = {
	getImageMetadata: async uuid => {
		let metadata = await redis.h.getAll(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`);
		metadata.tags = await redis.s.members(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.TAGS}`);
		return metadata;
	},
	updateImageMetadata: async (uuid, {artist=false, dateModified=Date.now(), addTags=[], removeTags=[]}) => {
		// Update date modified in search index
		await redis.z.add(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, dateModified, uuidModify.toLexical(uuid));

		// Update date modified in metadata
		await redis.hm.set(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'dateModified', dateModified);

		// Update artist in metadata
		if (artist)
			await redis.hm.set(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'artist', artist);

		// Handle changed tags
		if (addTags.length > 0)
			await redis.s.add(
				`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.TAGS}`,
				...addTags
			);

		if (removeTags.length > 0)
			await redis.s.rem(
				`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.TAGS}`,
				...removeTags
			);
	},
	addImageMetadata: async (uuid, {hash, uploader, dateAdded=Date.now(), artist, dateModified=Date.now()}, tags) => {
		// Add metadata
		await redis.hm.set(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`,
			'dateModified', dateModified,
			'artist', artist,
			'hash', hash,
			'dateAdded', dateAdded,
			'uploader', uploader,
			'uuid', uuid
		);

		// Add the tags
		await redis.s.add(
			`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.TAGS}`,
			...tags
		);

		// set date modified in search index with the uuid
		return await redis.z.add(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, dateModified, uuidModify.toLexical(uuid));
	},
	removeImageMetadata: async uuid => {
		const tags = await database.getImageMetadata(uuid).tags;
		return Promise.all([
			redis.z.rem(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, uuidModify.toLexical(uuid)),
			redis.h.del(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'uuid', 'hash', 'dateAdded', 'dateModified', 'uploader', 'artist'),
			redis.s.rem(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.TAGS}`, uuidModify.toLexical(uuid), ...tags)
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
	findImagesByTag: (tagId, start=0, count=10) => {
		return redis.z.rangeByScore(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGES}`, tagId, tagId, 'LIMIT', start, count);
	},
	findImagesByTags: async (intersectionStore, tagIds, start=0, count=10) => {
		await redis.z.interstore(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGES}:${intersectionStore}`, tagIds.length, ...tagIds);
		return await redis.z.range(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGES}:${intersectionStore}`, start, start+count);
	},
	addImageToTag: (uuid, tag) => {
		return redis.z.add(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGES}`, tag, uuid);
	},
	removeImageFromTag: (uuid, tag) => {
		return redis.z.rem(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGES}`, tag, uuid);
	},
	getArtistByName: artistName => {
		return redis.z.rank(`${constants.redis.DOMAIN}:${constants.redis.ARTISTS}`, artistName);
	},
	createArtist: async artistName => {
		const artistId = 1 + await redis.z.card(`${constants.redis.DOMAIN}:${constants.redis.ARTISTS}`);
		await redis.z.add(`${constants.redis.DOMAIN}:${constants.redis.ARTISTS}`, artistId, artistName);
		return artistId;
	},
	getTagByName: tagName => {
		return redis.z.rank(`${constants.redis.DOMAIN}:${constants.redis.TAGS}`, tagName);
	},
	createTag: async tagName => {
		const tagId = 1 + await redis.z.card(`${constants.redis.DOMAIN}:${constants.redis.TAGS}`);
		await redis.z.add(`${constants.redis.DOMAIN}:${constants.redis.TAGS}`, tagId, tagName);
		return tagId;
	},
	addHash: hash => {
		return redis.s.add(`${constants.redis.DOMAIN}:${constants.redis.HASHES}`, hash);
	},
	removeHash: hash => {
		return redis.s.rem(`${constants.redis.DOMAIN}:${constants.redis.HASHES}`, hash);
	},
	hasHash: hash => {
		return redis.s.isMember(`${constants.redis.DOMAIN}:${constants.redis.HASHES}`, hash);
	}
};

module.exports = database;