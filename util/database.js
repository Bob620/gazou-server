const redis = require('./redis');
const uuidModify = require('./uuidmodify');

const constants = require('./constants');

const database = {
	getImageMetadata: async uuid => {
		let metadata = await redis.h.getAll(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`);
		if (metadata) {
			const tags = await redis.s.members(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.TAGS}`);
			metadata.tags = tags ? tags : [];
			return metadata;
		} else
			return {};
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
	addImageMetadata: async (uuid, {hash, uploader, dateAdded=Date.now(), artist, dateModified=Date.now()}, tags, notUploaded=true) => {
		// Add metadata
		if (!notUploaded)
			await redis.hm.set(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`,
				'dateModified', dateModified,
				'artist', artist,
				'hash', hash,
				'dateAdded', dateAdded,
				'uploader', uploader,
				'uuid', uuid
			);
		else
			await redis.hm.set(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`,
				'dateModified', dateModified,
				'artist', artist,
				'hash', hash,
				'dateAdded', dateAdded,
				'uploader', uploader,
				'uuid', uuid,
				'notuploaded', notUploaded
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
		const metadata = await database.getImageMetadata(uuid);
		if (metadata.tags.length > 0)
			return Promise.all([
				redis.z.rem(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, uuidModify.toLexical(uuid)),
				redis.h.del(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, ...Object.keys(metadata)),
				redis.s.rem(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.TAGS}`, ...metadata.tags)
			]);
		else
			return Promise.all([
				redis.z.rem(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, uuidModify.toLexical(uuid)),
				redis.h.del(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, ...Object.keys(metadata))
			]);
	},
	findImagesByLex: (minTimestamp, maxTimestamp, start=0, count=10) => {
		return redis.z.rangeByLex(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, '['+uuidModify.timestampToUlid(minTimestamp), '['+uuidModify.timestampToUlid(maxTimestamp), 'LIMIT', start, count);
	},
	findImagesByScore: (minTimestamp, maxTimestamp, start=0, count=10) => {
		return redis.z.rangeByScore(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, minTimestamp, maxTimestamp, 'LIMIT', start, count);
	},
	findImagesByArtistId: (artistId, start=0, count=10) => {
		return redis.z.rangeByScore(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.ARTISTIMAGES}:${artistId}`, '-inf', '+inf', 'LIMIT', start, count);
	},
	findImagesByTag: (tagId, start=0, count=10) => {
		return redis.z.rangeByScore(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGES}:${tagId}`, '-inf', '+inf', 'LIMIT', start, count);
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
	},
	imageIsLocked: async uuid => {
		return !!redis.h.get(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'locked');
	},
	lockImage: uuid => {
		return redis.hm.set(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'locked', true);
	},
	unlockImage: uuid => {
		return redis.h.del(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'locked');
	},
	checkAndLockImage: uuid => {
		return !!redis.eval("local isLocked = redis.call('hget', KEYS[1], 'locked') if not isLocked then redis.call('hmset', KEYS[1], 'locked', 1) end return isLocked", 1, `${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`);
	},
	imageIsUploaded: uuid => {
		return !redis.h.get(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'notuploaded');
	},
	setImageUploaded: uuid => {
		return redis.h.del(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'notuploaded');
	}
};

module.exports = database;