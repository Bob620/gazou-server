const database = require('./database');

function* IdGenerator(type, total) {
	while(true)
		for (let i = 0; i < total; i++)
			yield `${type}:${i}`;
}

class IntersectionSearch {
	constructor(maxIntersections = 10, maxSearches = 1) {
		this.data = {
			maxIntersections,
			maxSearches,
			currentSearches: 0,
			searchQueue: [],
			tagGenerator: new IdGenerator('tags', maxIntersections)
		}
	}

	async getMatchingSearchIntersection(type, data) {
		switch(type) {
			case 'tags':

				return;
			default:
				return;
		}
	}

	async tryNextSearch() {
		if (this.data.currentSearches < this.data.maxSearches) {
			this.data.currentSearches++;
			const search = this.data.searchQueue.shift();
			if (search) {
				const {type, data, resolve, reject} = search;

				try {
					switch(type) {
						case 'tags':
							for (let i = 0; i < this.data.maxIntersections; i++) {
								const intersection = this.data.tagGenerator.next().value;
								if (await database.checkAndLockImageIntersection(intersection)) {
									await database.setImageIntersectionMeta(intersection, {tags: data.tags});
									resolve(await database.findImagesByTags(intersection, data.tags, data.startPosition, data.count));
									break;
								}
							}
							break;
						default:
							reject('Error occurred during search');
							break;
					}
				} catch (err) {
					console.log(err);
					reject('Error occurred during search');
				}
			}
			this.data.currentSearches--;
			if (this.data.searchQueue.length > 0)
				this.tryNextSearch();
		}
	}

	searchByTags(tags, startPosition, count) {
		return new Promise((resolve, reject) => {
			this.data.searchQueue.push({
				type: 'tags',
				data: {
					tags,
					startPosition,
					count
				},
				resolve,
				reject
			});
			this.tryNextSearch();
		});
	}
}

module.exports = IntersectionSearch;