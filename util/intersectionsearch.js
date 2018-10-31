const database = require('./database');
const uuidv1 = require('uuid/v1');

function* IdGenerator(type, total) {
	while(true)
		for (let i = 0; i < total; i++)
			yield `${type}:${i}`;
}


// Could implement caching system here
class Search {
	constructor(tags, searches, cleanup) {
		this.data = {
			cleanup,
			tags,
			resolved: false,
			rejected: false,
			data: undefined,
			uuid: undefined,
			searches
		};
	}

	addSearch(startPosition, count, resolve, reject) {
		if (this.data.resolved) {
			database.getImageIntersectionMeta(this.data.data).then(metadata => {
				if (!metadata.locked && !metadata.expired && metadata.uuid === this.data.uuid)
					database.findImagesByTags(this.data.data, this.data.tags, startPosition, count).then(data => {
						resolve(data);
					}).catch(() => {
						reject('An error occurred during search request');
					});
			}).catch(() => {
				reject('An error occurred during search request');
			});
		} else if (this.data.rejected)
			reject(this.data.data);
		else
			this.data.searches.push({
				startPosition,
				count,
				resolve,
				reject
			});
	}

	async resolve(data, uuid) {
		this.data.uuid = uuid;
		this.data.data = data;
		this.data.resolved = true;

		const metadata = await database.getImageIntersectionMeta(this.data.data);
		if (!metadata.locked && !metadata.expired && metadata.uuid === this.data.uuid)
			for (const search of this.data.searches)
				search.resolve(await database.findImagesByTags(this.data.data, this.data.tags, search.startPosition, search.count));
		else
			for (const search of this.data.searches)
				search.reject('An error occurred during search request');

		this.data.cleanup();
	}

	reject(data) {
		this.data.data = data;
		this.data.rejected = true;

		for (const search of this.data.searches)
			search.reject(data);

		this.data.cleanup();
	}
}

class IntersectionSearch {
	constructor(type, maxIntersections = 10, maxSearches = 1, maxIntersectionLifespan=300) {
		this.data = {
			type,
			maxIntersections,
			maxSearches,
			maxIntersectionLifespan,
			currentSearches: new Map(),
			searches: new Map(),
			searchQueue: [],
			generator: IdGenerator(type, maxIntersections)
		}
	}

	async tryNextSearch() {
		if (this.data.currentSearches.size < this.data.maxSearches) {
			const tags = this.data.searchQueue.shift();
			const search = this.data.searches.get(tags);
			this.data.currentSearches.set(tags, search);
			const uuid = uuidv1();
			if (tags)
				for (let i = 0; i < this.data.maxIntersections; i++) {
					const intersection = this.data.generator.next().value;
					if (await database.checkAndLockImageIntersection(intersection)) {
						await database.setImageIntersectionMeta(intersection, {tags, uuid});
						await database.unlockImageIntersection(intersection, this.data.maxIntersectionLifespan);

						await search.resolve(intersection, uuid);
						break;
					}
				}

			this.data.currentSearches.delete(tags);
			if (this.data.searchQueue.length > 0)
				this.tryNextSearch();
		}
	}

	search(tags, startPosition, count) {
		return new Promise((resolve, reject) => {
			let search = this.data.searches.get(tags);
			if (search)
				search.addSearch({
					startPosition,
					count,
					resolve,
					reject
				});
			else
				this.data.searches.set(tags, new Search(tags, [{
					startPosition,
					count,
					resolve,
					reject
				}], () => {
					this.data.searches.delete(tags);
				}));

			this.data.searchQueue.push(tags);
			this.tryNextSearch();
		});
	}
}

module.exports = IntersectionSearch;