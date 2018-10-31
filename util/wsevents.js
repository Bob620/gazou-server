const uuidv1 = require('uuid/v1');

const config = require('../config/config');
const constants = require('./constants');

const aws = require('aws-sdk');

aws.config.update(config.aws);

const S3Upload = require('./s3upload.js');
const database = require('./database');
const search = require('./search');

const s3Upload = new S3Upload();

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

//					if (!await database.getTagByName(tag))
//						await database.createTag(tag);
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
				if (!removed) throw {
					event: 'remove.single',
					message: 'Unable to delete the image'
				};

				// Allow the image to be reuploaded
				await database.removeHash(metadata.hash);
				// Remove the image from s3
				await s3Upload.delete(`${metadata.uuid}.${metadata.type}`);

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
	upload: async ({hash, type, artist='', tags=[]}, {}, currentUser) => {
		const canUpload = await database.uploaderCanUpload(currentUser.id);
		if (currentUser.authed && canUpload) {
			if (hash && typeof hash === 'string')
				if (type === 'png' || type === 'jpg' || type === 'jpeg' || type === 'gif')
					if (!await database.hasHash(hash)) {
						artist = artist.toLowerCase();

						const dateAdded = Date.now();
						const metadata = {
							uuid: uuidv1(),
							artist: artist ? artist : 'no artist',
							hash: hash.toLowerCase(),
							dateModified: dateAdded,
							dateAdded,
							type,
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

						metadata.tags = tags;
						await search.indexImage(metadata.uuid, metadata);

						return {
							uuid: metadata.uuid,
							uploadLink: `${config.uploadUrl}/upload/${metadata.uuid}`
						};
					} else
						throw {
							event: 'upload',
							message: 'Image already exists'
						};
				else
					throw {
						event: 'upload',
						message: 'Image type required'
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
				event: 'search.artist',
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
							event: 'search.tags',
							message: `Unknown tag '${tags[0]}'`
						};
				default:
					if (tags.length < config.search.maxTagSearch) {
						let tagPromises = [];
						for (const tagName of tags)
							tagPromises.push(new Promise(async (resolve, reject) => {
								const tagId = await database.getTagByName(tagName);
								if (tagId)
									resolve(tagId);
								else
									reject({
										event: 'search.tags',
										message: `Unknown tag '${tagName}'`
									});
							}));

						const tagIds = await Promise.all(tagPromises);
						return await search.byTagIds(tagIds, startPosition, count);
					} else
						throw {
							event: 'search.tags',
							message: `Too many tags, currently allowed up to ${config.search.maxTagSearch} tags per search`
						};
			}
		},
		randomByArtist: async ({name, count=1}, {random}) => {
			const images = await database.countArtistImages();
			if (images && images.length > 0)
				return random.sample(images, images.length < count ? images.length : count);
			else
				return [];
		},
		randomByTags: async ({tags=[], count=1}, {random}) => {
			switch(tags.length) {
				case 0:
					return [];
				case 1:
					const images = await database.countTagImages();
					if (images && images.length > 0)
						return random.sample(images, images.length < count ? images.length : count);
					return [];
				default:
					throw {
						event: 'search.randomByTags',
						message: 'Currently supports max 1 tag'
					}
			}
		}
	},
	authenticate: {
		init: async (message, {auth}, currentUser) => {
			if (currentUser.authed)
				throw {
					event: 'authenticate',
					message: 'Already authenticated'
				};
			if (message.id && await database.getUserDisplayName(message.id)) {
				await auth.requestAuth(message.id);
				return {
					beginAuth: true
				};
			} else
				throw {
					event: 'authenticate',
					message: 'Invalid user'
				};
		},
		submit: async (message, {auth}, currentUser) => {
			if (currentUser.authed)
				throw {
					event: 'authenticate',
					message: 'Already authenticated'
				};
			if (message.token && auth.testToken(currentUser.id, message.token)) {
				return {
					authed: true
				};
			} else
				throw {
					event: 'authenticate',
					message: 'Invalid token'
				};
		}
	},
	get: {
		single: async ({uuid}) => {
			if (!uuid || typeof uuid !== 'string' || uuid.length !== 36)
				throw {
					event: 'get.single',
					message: 'Invalid uuid'
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
				if (uuid || typeof uuid === 'string' || uuid.length === 36) {
					const item = await database.getImageMetadata(uuid);
					if (item.hash)
						metadata[uuid] = item;
				}
			}
			return metadata;
		},
		random: async ({count=1}, {random}) => {
			const images = database.countImages();
			if (images && images.length > 0)
				return random.sample(images, images.length < count ? images.length : count);
			return [];
		}
	},
	has: {
		singleHash: async ({hash}) => {
			if (hash || typeof hash !== 'string' || hash.length !== 40)
				throw {
					event: 'has.singleHash',
					message: 'Invalid hash'
				};
			if (await database.hasHash(hash))
				return [
					hash
				];
			else
				return [];
		},
		batchHash: async ({hashes}) => {
			if (hashes === undefined || hashes.length < 0)
				throw {
					event: 'has.batchHash',
					message: 'Undefined hashes'
				};
			let hasHashes = [];
			for (const hash of hashes) {
				if (hash || typeof hash === 'string' || hash.length === 40) {
					if (await database.hasHash(hash))
						hasHashes.push(hash);
				}
			}
			return hasHashes;
		},
	}
};