const uuidv1 = require('uuid/v1');

const config = require('../config/config');
const constants = require('./constants');

const database = require('./database');
const search = require('./search');

function forceMetadataCompliance(metadata) {
	let validMetadata = {};

	for (const key of Object.keys(metadata)) {
		switch(key) {
			case 'uuid':
				if (metadata.uuid && typeof metadata.uuid === 'string')
					validMetadata.uuid = metadata[key];
				break;
			case 'hash':
				if (metadata.hash && typeof metadata.hash === 'string')
					validMetadata.hash = metadata[key];
				break;
			case 'dateAdded':
				if (metadata.dateAdded && typeof metadata.dateAdded === 'number')
					validMetadata.dateAdded = metadata[key];
				break;
			case 'dateModified':
				if (metadata.dateModified && typeof metadata.dateModified === 'number')
					validMetadata.dateModified = metadata[key];
				break;
			case 'uploader':
				if (typeof metadata.uploader === 'string')
					if (metadata.uploader === '')
						validMetadata.uploader = '0';
					else
						validMetadata.uploader = metadata[key];
				break;
		}
	}

	return validMetadata;
}

module.exports = {
	update: async ({uuid, metadata: {artist="", addTags=[], removeTags=[]}}) => {
		artist = artist.toLowerCase();

		const oldMetadata = await database.getImageMetadata(uuid);
		const newMetadata = {
			addTags: [],
			removeTags: []
		};

		if (artist && oldMetadata.artist !== artist)
			newMetadata.artist = artist;

		for (const tag of addTags)
			if (!oldMetadata.includes(tag))
				newMetadata.addTags.push(tag);

		for (const tag of removeTags)
			if (oldMetadata.includes(tag))
				newMetadata.removeTags.push(tag);

		if (newMetadata.artist || newMetadata.addTags.length > 0 || newMetadata.removeTags.length > 0) {
			newMetadata.dateModified = Date.now();

			await database.updateImageMetadata(uuid, newMetadata);

			return {
				[uuid]: await database.getImageMetadata(uuid)
			};
		}

		return {};
	},
	remove: {
		single: async ({uuid}) => {
			const [removed] = await database.removeImageMetadata(uuid);
			return {total: removed};
		},
		batch: async ({uuids}) => {
			let removed = 0;
			for (const uuid of uuids)
				removed += (await database.removeImageMetadata(uuid))[0];
			return {total: removed};
		}
	},
	upload: async ({hash, artist=""}, data) => {
		if (hash && typeof hash === 'string')
			if (!search.hasExactHash(hash)) {
				const dateAdded = Date.now();
				const metadata = {
					uuid: uuidv1(),
					artist: artist ? artist.toLowerCase() : 'no artist',
					hash,
					dateModified: dateAdded,
					dateAdded,
					uploader: data.user.uuid
				};

				await database.addImageMetadata(metadata.uuid, metadata);

				return {
					uuid: metadata.uuid,
					link: `${config.uploadUrl}/${metadata.uuid}`
				};
			} else
				throw {
					event: 'upload',
					message: 'Image already exists'
				};
		else
			throw {
				event: 'upload',
				message: 'No image hash provided'
			};
	},
	search: {
		dateModified: async ({min, max, count=10, startPosition=0}) => {
			count = count > constants.search.MAXMAX ? constants.search.MAXMAX : count;
			return await database.findImagesByScore(min, max, startPosition, count);
		},
		dateAdded: async ({min, max, count=10, startPosition=0}) => {
			count = count > constants.search.MAXMAX ? constants.search.MAXMAX : count;
			return await database.findImagesByLex(min, max, startPosition, count);
		},
		artistId: async ({id, count=10, startPosition=0}) => {
			return await database.findImagesByArtistId(id, startPosition, count);
		},
		artistName: async ({name, count=10, startPosition=0}) => {
			const artistId = database.getArtistByName(name);
			if (artistId)
				return await database.findImagesByArtistId(artistId, startPosition, count);
			return {};
		},
		tags: async ({tags=[], count=10, startPosition=0}) => {
			if (tags.length < 1)
				return {};


		}
	},
	authenticate: async (message, data) => {

	},
	get: {
		single: async ({uuid}) => {
			if (uuid === undefined || typeof uuid !== 'string')
				throw {
					event: 'get.single',
					message: 'Undefined uuid'
				};
			const item = await database.getImageMetadata(uuid);
			if (item)
				return {
					[uuid]: item
				};
			else
				return {};
		},
		batch: async ({uuids}) => {
			if (uuids === undefined || uuids.length < 1)
				throw {
					event: 'get.batch',
					message: 'Undefined uuids'
				};
			let metadata = {};
			for (const uuid of uuids) {
				const item = await database.getImageMetadata(uuid);
				if (item)
					metadata[uuid] = item;
			}
			return metadata;
		}
	}
};