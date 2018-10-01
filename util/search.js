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

	async indexImage(uuid, {addTags, removeTags, tags, artist, uploader, hash}) {
		if (uuid)
			if (tags)
				for (const tag of tags) {
					if (!await database.getTagByName(tag))
						await database.createTag(tag);
					await database.addImageToTag(uuid, tag);
				}
			else if((addTags || removeTags)) {
				for (const tag of addTags) {
					if (!await database.getTagByName(tag))
						await database.createTag(tag);
					await database.addImageToTag(uuid, tag);
				}

				for (const tag of removeTags)
					if (await database.getTagByName(tag))
						await database.removeImageFromTag(tag);
			}
	}
}

module.exports = new Search();