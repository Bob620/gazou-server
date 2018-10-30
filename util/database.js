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
	updateImageMetadata: async (uuid, {artist=false, dateModified=Date.now(), addTags=[], removeTags=[], size=0}) => {
		// Update date modified in search index
		await redis.z.add(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, dateModified, uuidModify.toLexical(uuid));

		// Update date modified in metadata
		await redis.hm.set(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'dateModified', dateModified);

		if (size > 0)
			await redis.hm.set(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'size', size);

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
	addImageMetadata: async (uuid, {hash, type, uploader, dateAdded=Date.now(), artist, dateModified=Date.now()}, tags) => {
		// Add metadata
		await redis.hm.set(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`,
			'dateModified', dateModified,
			'artist', artist,
			'hash', hash,
			'dateAdded', dateAdded,
			'uploader', uploader,
			'uuid', uuid,
			'notuploaded', true,
			'size', 0,
			'type', type
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
	findImagesByLex: async (minTimestamp, maxTimestamp, start=0, count=10) => {
		const lexUuids = await redis.z.rangeByLex(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, '['+uuidModify.timestampToUlid(minTimestamp), '['+`${uuidModify.timestampToUlid(maxTimestamp)}-ffff-ffffffffffff`, 'LIMIT', start, count);

		let normUuid = [];
		for (const lexUuid of lexUuids)
			normUuid.push(uuidModify.toRegular(lexUuid));
		return normUuid;
	},
	findImagesByScore: async (minTimestamp, maxTimestamp, start=0, count=10) => {
		const lexUuids = await redis.z.rangeByScore(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}`, minTimestamp, maxTimestamp, 'LIMIT', start, count);

		let normUuid = [];
		for (const lexUuid of lexUuids)
			normUuid.push(uuidModify.toRegular(lexUuid));
		return normUuid;
	},
	findImagesByArtistId: async (artistId, start=0, count=10) => {
		const lexUuids = await redis.z.rangeByScore(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.ARTISTIMAGES}:${artistId}`, '-inf', '+inf', 'LIMIT', start, count);

		let normUuid = [];
		for (const lexUuid of lexUuids)
			normUuid.push(uuidModify.toRegular(lexUuid));
		return normUuid;
	},
	findImagesByTag: async (tagId, start=0, count=10) => {
		const lexUuids = await redis.z.rangeByScore(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGES}:${tagId}`, '-inf', '+inf', 'LIMIT', start, count);

		let normUuid = [];
		for (const lexUuid of lexUuids)
			normUuid.push(uuidModify.toRegular(lexUuid));
		return normUuid;
	},
	setImageIntersectionMeta: async (intersectionStore, {tags, locked=true}) => {
		const intersection = `${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGEINTERSECTIONS}:${intersectionStore}`;
		await redis.hm.set(`${intersection}:${constants.redis.search.intersection.METADATA}`, 'locked', locked);
		await redis.s.rem(`${intersection}:${constants.redis.search.intersection.TAGS}`, ...await redis.s.members(`${intersection}:${constants.redis.search.intersection.TAGS}`));
		await redis.s.add(`${intersection}:${constants.redis.search.intersection.TAGS}`, ...tags);
	},
	getImageIntersectionMeta: async intersectionStore => {
		const intersection = `${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGEINTERSECTIONS}:${intersectionStore}`;
		let metadata = await redis.s.members(`${intersection}:${constants.redis.search.intersection.METADATA}`);
		metadata.tags = await redis.s.members(`${intersection}:${constants.redis.search.intersection.TAGS}`);
		const lifespan = await redis.s.members(`${intersection}:${constants.redis.search.intersection.LIFESPAN}`);
		if (lifespan) {
			metadata.expired = false;
			metadata.expires = lifespan;
		} else
			metadata.expired = true;

		return metadata;
	},
	checkAndLockImageIntersection: async intersectionStore => {
		return !!await redis.eval("local isLocked = redis.call('hget', KEYS[1], 'locked') if not isLocked then redis.call('hmset', KEYS[1], 'locked', 1) end return not isLocked", 1, `${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGEINTERSECTIONS}:${intersectionStore}:${constants.redis.search.intersection.METADATA}`);
	},
	lockImageIntersection: intersectionStore => {
		return redis.h.set(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGEINTERSECTIONS}:${intersectionStore}:${constants.redis.search.intersection.METADATA}`, 'locked', true);
	},
	unlockImageIntersection: async (intersectionStore, maxLifespan=60) => {
		await redis.set(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGEINTERSECTIONS}:${intersectionStore}:${constants.redis.search.intersection.METADATA}:${constants.redis.search.intersection.LIFESPAN}`, Date.now()+maxLifespan, 'EX', maxLifespan);
		return await redis.h.del(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGEINTERSECTIONS}:${intersectionStore}:${constants.redis.search.intersection.METADATA}`, 'locked');
	},
	findImagesByTags: async (intersectionStore, tagIds, start=0, count=10) => {
		await redis.z.interstore(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGEINTERSECTIONS}:${intersectionStore}`, tagIds.length, ...tagIds.map(tagId => {
			return `${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGES}:${tagId}`;
		}));
		const lexUuids = await await redis.z.range(`${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGEINTERSECTIONS}:${intersectionStore}`, start, start+count);

		let normUuid = [];
		for (const lexUuid of lexUuids)
			normUuid.push(uuidModify.toRegular(lexUuid));
		return normUuid;
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
		return !!await redis.h.get(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'locked');
	},
	lockImage: uuid => {
		return redis.hm.set(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'locked', true);
	},
	unlockImage: uuid => {
		return redis.h.del(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'locked');
	},
	checkAndLockImage: async uuid => {
		return !!await redis.eval("local isLocked = redis.call('hget', KEYS[1], 'locked') if not isLocked then redis.call('hmset', KEYS[1], 'locked', 1) end return not isLocked", 1, `${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`);
	},
	imageIsUploaded: async uuid => {
		return !await redis.h.get(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'notuploaded');
	},
	setImageUploaded: uuid => {
		return redis.h.del(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'notuploaded');
	},
	setImageNotUploaded: uuid => {
		return redis.hm.set(`${constants.redis.DOMAIN}:${constants.redis.IMAGES}:${uuidModify.toLexical(uuid)}:${constants.redis.images.METADATA}`, 'notuploaded', true);
	},
	addUploader: async (userId, displayName) => {
		await redis.z.add(`${constants.redis.DOMAIN}:${constants.redis.UPLOADERS}`, userId, displayName);
		return await redis.hm.set(`${constants.redis.DOMAIN}:${constants.redis.UPLOADERS}:${userId}`, 'canupload', true);
	},
	revokeUploader: userId => {
		return redis.hm.set(`${constants.redis.DOMAIN}:${constants.redis.UPLOADERS}:${userId}`, 'canupload', false);
	},
	approveUploader: userId => {
		return redis.hm.set(`${constants.redis.DOMAIN}:${constants.redis.UPLOADERS}:${userId}`, 'canupload', true);
	},
	uploaderCanUpload: async userId => {
		return !!await redis.h.get(`${constants.redis.DOMAIN}:${constants.redis.UPLOADERS}:${userId}`, 'canupload');
	},
	updateUploader: (userId, displayName) => {
		return redis.z.add(`${constants.redis.DOMAIN}:${constants.redis.UPLOADERS}`, 'XX', userId, displayName);
	},
	getUserDisplayName: async userId => {
		const names = await  redis.z.rangeByScore(`${constants.redis.DOMAIN}:${constants.redis.UPLOADERS}`, userId, userId);
		return names[0];
	},
	getUserId: displayName => {
		return redis.z.score(`${constants.redis.DOMAIN}:${constants.redis.UPLOADERS}`, displayName);
	},
	getUploaders: () => {
		return redis.z.rangeByScore(`${constants.redis.DOMAIN}:${constants.redis.UPLOADERS}`, '-inf', '+inf');
	}
};

module.exports = database;