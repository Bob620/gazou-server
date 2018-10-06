const database = require('./database');
const uuidModify = require('./uuidmodify');

const constants = require('./constants');

class Search {
	constructor() {
		this.data = {
			lists: {
				artists: `${constants.redis.DOMAIN}:${constants.redis.ARTISTS}`,
				tags: `${constants.redis.DOMAIN}:${constants.redis.TAGS}`,
				imageTagged: `${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.TAGIMAGES}`,
				imageArtists: `${constants.redis.DOMAIN}:${constants.redis.SEARCH}:${constants.redis.search.ARTISTIMAGES}`
			}
		}
	}

	async indexImage(uuid, {addTags, removeTags, tags, artist, uploader, dateModified}, oldMetadata) {
		if (uuid) {
			if (tags)
				for (const tag of tags) {
					let tagId = await database.getTagByName(tag);
					if (!tagId)
						tagId = await database.createTag(tag);
					await database.addImageToTag(uuid, tagId, dateModified);
				}
			else if ((addTags || removeTags)) {
				for (const tag of addTags) {
					let tagId = await database.getTagByName(tag);
					if (!tagId)
						tagId = await database.createTag(tag);
					await database.addImageToTag(uuid, tagId, dateModified);
				}

				for (const tag of removeTags) {
					let tagId = await database.getTagByName(tag);
					if (tagId)
						await database.removeImageFromTag(uuid, tagId);
				}
			}

			if (oldMetadata) {
				if (artist !== oldMetadata.artist) {
					let oldArtistId = await database.getArtistByName(oldMetadata.artist);
					if (oldArtistId)
						await database.removeImageFromArtist(uuid, oldArtistId);

					let artistId = await database.getArtistByName(artist);
					if (!artistId)
						artistId = await database.createArtist(artist);
					await database.addImageToArtist(uuid, artistId, dateModified);
				}
			} else {
				if (artist) {
					let artistId = await database.getArtistByName(artist);
					if (!artistId) {
						artistId = await database.createArtist(artist);
					}
					await database.addImageToArtist(uuid, artistId, dateModified);
				}
			}

//			if (uploader !== oldUploader)
//				if (!await database.getUploaderByName(uploader))
//					await database.addImageToUploader(uploader, uuid);
		}
	}

	async unindexImage(uuid) {
		if (uuid) {
			const metadata = await database.getImageMetadata(uuid);
			if (!metadata)
				return;
			const {artist, tags, uploader} = metadata;

			for (const tag of tags) {
				const tagId = await database.getTagByName(tag);
				if (tagId)
					await database.removeImageFromTag(uuid, tagId);
			}

			if (artist) {
				const artistId = await database.getArtistByName(artist);

				if (artistId)
					await database.removeImageFromArtist(uuid, artistId);
			}

//			if (uploader) {
//				const uploaderId = await database.getUploaderByUsername(uploader);
//				if (uploaderId)
//					await database.removeImageFromUploader(uploader, uuid);
//			}
		}
	}
}

module.exports = new Search();