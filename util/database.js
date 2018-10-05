const redis = require('./redis');
const uuidModify = require('./uuidmodify');

const constants = require('./constants');

const database = {
	getImageMetadata: async uuid => {
		let metadata = await redis.h.getAll(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`);
		if (metadata) {
			metadata.tags = await redis.s.members(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.TAGS}`);
			return metadata;
		}
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
		if (tags.length > 0)
			await redis.s.add(
				`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.TAGS}`,
				...tags
			);

		// set date modified in search index with the uuid
		return await redis.z.add(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, dateModified, uuidModify.toLexical(uuid));
	},
	removeImageMetadata: async uuid => {
		const tags = await database.getImageMetadata(uuid).tags;
		if (tags)
			return Promise.all([
				redis.z.rem(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, uuidModify.toLexical(uuid)),
				redis.h.del(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'uuid', 'hash', 'dateAdded', 'dateModified', 'uploader', 'artist'),
				redis.s.rem(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.TAGS}`, ...tags)
			]);
		else
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
	findImagesByTag: (tagId, start=0, count=10) => {
		return redis.z.rangeByScore(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGES}`, tagId, tagId, 'LIMIT', start, count);
	},
	findImagesByTags: async (intersectionStore, tagIds, start=0, count=10) => {
		await redis.z.interstore(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGEINTERSECTIONS}:${intersectionStore}`, tagIds.length, ...tagIds.map((tagId) => {
			return `${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGES}:${tagId}`;
		}));
		return await redis.z.range(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGEINTERSECTIONS}:${intersectionStore}`, start, start+count);
	},
	addImageToTag: (uuid, tagId, dateModified=Date.now()) => {
		return redis.z.add(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGES}:${tagId}`, dateModified, uuidModify.toLexical(uuid));
	},
	removeImageFromTag: (uuid, tagId) => {
		return redis.z.rem(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGES}:${tagId}`, uuidModify.toLexical(uuid));
	},
	getArtistByName: artistName => {
		return redis.z.score(`${constants.redis.DOMAIN}:${constants.redis.ARTISTS}`, artistName);
	},
	addImageToArtist: (uuid, artistId, dateModified=Date.now()) => {
		return redis.z.add(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.ARTISTIMAGES}:${artistId}`, dateModified, uuidModify.toLexical(uuid));
	},
	removeImageFromArtist: (uuid, artistId) => {
		return redis.z.rem(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.ARTISTIMAGES}:${artistId}`, uuidModify.toLexical(uuid));
	},
	createArtist: async artistName => {
		return await redis.eval("local artistId = redis.call('zcard', KEYS[1]) redis.call('zadd', KEYS[2], artistId, KEYS[3]) return artistId", 3, `${constants.redis.DOMAIN}:${constants.redis.ARTISTS}`, `${constants.redis.DOMAIN}:${constants.redis.ARTISTS}`, artistName);
	},
	getTagByName: tagName => {
		return redis.z.score(`${constants.redis.DOMAIN}:${constants.redis.TAGS}`, tagName);
	},
	createTag: async tagName => {
		return await redis.eval("local tagId = redis.call('zcard', KEYS[1]) redis.call('zadd', KEYS[2], tagId, KEYS[3]) return tagId", 3, `${constants.redis.DOMAIN}:${constants.redis.TAGS}`, `${constants.redis.DOMAIN}:${constants.redis.TAGS}`, tagName);
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