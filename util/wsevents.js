const uuidv1 = require('uuid/v1');

const config = require('../config/config');
const constants = require('./constants');

const database = require('./database');
const search = require('./search');

module.exports = {
	update: async ({uuid, metadata: {uploader='', artist='', addTags=[], removeTags=[]}}, {}, currentUser) => {
		if (currentUser.authed && await database.uploaderCanUpload(currentUser.id)) {
			// Need to check if the image is locked, if it is then we can throw an error safely
			if (!await database.checkAndLockImage(uuid))
				throw {
					event: 'update',
					message: 'Image is currently locked (may be being updated or deleted)'
				};
			// Image is now locked and ready for us to work on it

			artist = artist.toLowerCase();
			uploader = uploader.toLowerCase();

			const oldMetadata = await database.getImageMetadata(uuid);
			const newMetadata = {
				addTags: [],
				removeTags: []
			};

			if (artist && oldMetadata.artist !== artist) {
				newMetadata.artist = artist;

//		    	if (!await database.getArtistByName(artist))
//	    			await database.createArtist(artist);
			}

//			if (uploader && oldMetadata.uploader !== artist) {
// 	    		newMetadata.artist = artist;

//			    if (!await database.getUploader(artist))
//				    await database.createArtist(artist);
//			}

			for (const tag of addTags)
				if (!oldMetadata.includes(tag)) {
					newMetadata.addTags.push(tag);

	//				if (!await database.getTagByName(tag))
	//					await database.createTag(tag);
				}

			for (const tag of removeTags)
				if (oldMetadata.includes(tag))
					newMetadata.removeTags.push(tag);

			if (newMetadata.artist || newMetadata.addTags.length > 0 || newMetadata.removeTags.length > 0 || newMetadata.uploader) {
				newMetadata.dateModified = Date.now();

				// update the metadata
				await database.updateImageMetadata(uuid, newMetadata);
				// Index the new metadata
				await search.indexImage(uuid, newMetadata, oldMetadata);

				// Unlock the image since we have updated the image
				await database.unlockImage(uuid);

				return {
					[uuid]: await database.getImageMetadata(uuid)
				};
			}

			// Unlock the unchanged image
			await database.unlockImage(uuid);

			return {};
		} else
			throw {
				event: 'upload',
				message: 'Not authorized to update'
			};
	},
	remove: {
		single: async ({uuid}, {}, currentUser) => {
			if (currentUser.authed && await database.uploaderCanUpload(currentUser.id)) {
				const metadata = await database.getImageMetadata(uuid);
				// Image exists (need hash later anyway)
				if (!metadata.hash)
					throw {
						event: 'remove.single',
						message: 'Image does not exist'
					};

				// Need to check if the image is locked, if it is then we can throw an error safely
				if (!await database.checkAndLockImage(uuid))
					throw {
						event: 'remove.single',
						message: 'Image is currently locked (may be being updated or deleted)'
					};
				// Image is now locked and ready for us to work on it

				await search.unindexImage(uuid);
				const [removed] = await database.removeImageMetadata(uuid);
				// Allow the image to be reuploaded
				await database.removeHash(metadata.hash);

				if (!removed) throw {
					event: 'remove.single',
					message: 'Unable to delete the image'
				};

				// Image lock is removed automatically when deleted, return safely
				// return a confirmation of deletion
				return [uuid];
			} else
				throw {
					event: 'upload',
					message: 'Not authorized to remove'
				};
		},
		batch: async ({uuids}, {}, currentUser) => {
			if (currentUser.authed && await database.uploaderCanUpload(currentUser.id)) {
				// Lock as many images as possible asap
				let imageLocks = [];
				let imageHashes = {};
				for (const uuid of uuids)
					imageLocks.push(new Promise(async resolve => {
						const metadata = await database.getImageMetadata(uuid);
						if (!metadata.hash)
							resolve(false);
						else {
							imageHashes[uuid] = metadata.hash;
							resolve(database.checkAndLockImage(uuid));
						}
					}));
				const locks = await Promise.all(imageLocks);

				// If locked remove the image, can't guarantee everything is locked
				let removed = [];
				for (let i = 0; i < Object.keys(uuids).length; i++)
					if (locks[i]) {
						const uuid = uuids[i];

						await search.unindexImage(uuid);
						if ((await database.removeImageMetadata(uuid))[0])
							removed.push(uuid);
						// Allow the image to be reuploaded
						await database.removeHash(imageHashes[uuid]);
					}

				// Image lock is removed automatically when deleted, return safely
				// return a confirmation of uuids deleted
				return removed;
			} else
				throw {
					event: 'upload',
					message: 'Not authorized to remove'
				};
		}
	},
	upload: async ({hash, artist='', tags=[]}, {}, currentUser) => {
		if (currentUser.authed && await database.uploaderCanUpload(currentUser.id)) {
			if (hash && typeof hash === 'string')
				if (!await database.hasHash(hash)) {
					artist = artist.toLowerCase();

					const dateAdded = Date.now();
					const metadata = {
						uuid: uuidv1(),
						artist: artist ? artist : 'no artist',
						hash,
						dateModified: dateAdded,
						dateAdded,
						uploader: await database.getUserDisplayName(currentUser.id)
					};

//	    			if (!await database.getArtistByName(artist))
//		    			await database.createArtist(artist);

//			    	for (const tag of tags)
//				    	if (!await database.getTagByName(tag))
//					    	await database.createTag(tag);

					// Add image to database, and wait for the image to be uploaded
					await database.addImageMetadata(metadata.uuid, metadata, tags);
					await database.addHash(hash);

					//				metadata.tags = tags;
					// DISABLE THIS UNTIL IMAGE UPLOADED
					await search.indexImage(metadata.uuid, metadata);

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
		} else
			throw {
				event: 'upload',
				message: 'Not authorized to upload'
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
		artist: async ({name, count=10, startPosition=0}) => {
			const artistId = await database.getArtistByName(name.toLowerCase());
			if (artistId)
				return await database.findImagesByArtistId(artistId, startPosition, count);
			throw {
				event: 'tags',
				message: `Unknown artist '${name.toLowerCase()}'`
			};
		},
		tags: async ({tags=[], count=10, startPosition=0}) => {
			switch(tags.length) {
				case 0:
					return {};
				case 1:
					const tagId = await database.getTagByName(tags[0]);
					if (tagId)
						return await database.findImagesByTag(tagId, startPosition, count);
					else
						throw {
							event: 'tags',
							message: `Unknown tag '${tags[0]}'`
						};
				default:
					let tagPromises = [];
					for (const tagName of tags)
						tagPromises.push(new Promise(async (resolve, reject) => {
							const tagId = await database.getTagByName(tagName);
							if (tagId)
								resolve(tagId);
							else
								reject({
									event: 'tags',
									message: `Unknown tag '${tagName}'`
								});
						}));

					const tagIds = await Promise.all(tagPromises);
					return await database.findImagesByTags(tagIds, startPosition, count);
			}
		},
		randomByArtist: async ({name, count=10}, {random}) => {

		},
		randomByTags: async ({tags=[], count=10}, {random}) => {

		}
	},
	authenticate: {
		init: async (message, {auth}, currentUser) => {
			if (currentUser.authed)
				throw {
					event: 'authenticate',
					message: 'Already authenticated'
				};
			else {
				if (message[0] && await database.getUserDisplayName(message[0])) {
					await auth.requestAuth(message[0]);
					return {
						beginAuth: true
					};
				} else
					throw {
						event: 'authenticate',
						message: 'Invalid user'
					};
			}
		},
		submit: async (message, {auth}, currentUser) => {
			if (currentUser.authed)
				throw {
					event: 'authenticate',
					message: 'Already authenticated'
				};
			else {
				if (message[0] && auth.testToken(currentUser.id, message[0])) {
					return {
						authed: true
					};
				} else
					throw {
						event: 'authenticate',
						message: 'Invalid token'
					};
			}
		}
	},
	get: {
		single: async ({uuid}) => {
			if (uuid === undefined || typeof uuid !== 'string')
				throw {
					event: 'get.single',
					message: 'Undefined uuid'
				};
			const item = await database.getImageMetadata(uuid);
			if (item.hash)
				return {
					[uuid]: item
				};
			else
				return {};
		},
		batch: async ({uuids}) => {
			if (uuids === undefined || uuids.length < 0)
				throw {
					event: 'get.batch',
					message: 'Undefined uuids'
				};
			let metadata = {};
			for (const uuid of uuids) {
				const item = await database.getImageMetadata(uuid);
				if (item.hash)
					metadata[uuid] = item;
			}
			return metadata;
		},
		singleRandom: async ({}, {random}) => {

		},
		batchRandom: async ({count=10}, {random}) => {

		}
	}
};