const database = require('./database');
const uuidModify = require('./uuidmodify');

class Search {
	constructor() {

	}

	exactHash(hash) {

	}

	hasExactHash(hash) {
		return false;
	}

	byDateAdded(minTimestamp, maxTimestamp) {
		return database.findImagesByLex(minTimestamp, maxTimestamp);
	}

	byDateModified(minTimestamp, maxTimestamp) {
		return database.findImagesByScore(minTimestamp, maxTimestamp);
	}
}

module.exports = new Search();