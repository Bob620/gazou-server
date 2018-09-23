module.exports = {
	toLexical: uuid => {
		return uuid.substr(14, 5) + uuid.substr(9, 5) + uuid.substr(0, 9) + uuid.substr(19);
	},
	toRegular: ulid => {
		return ulid.substr(10, 9) + ulid.substr(5, 5) + ulid.substr(0, 5) + ulid.substr(19);
	},
	timestampToUlid: timestamp => {
		const hiAndMid = (((timestamp + 12219292800000) / 0x100000000 * 10000) & 0xfffffff).toString(16);
		return `1${hiAndMid.substr(0, 3)}-${hiAndMid.substr(3)}-${((((timestamp + 12219292800000) & 0xfffffff) * 10000) % 0x100000000).toString(16)}`;
	}
};