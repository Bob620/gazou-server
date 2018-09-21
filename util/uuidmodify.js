module.exports = {
	toLexical: uuid => {
		return uuid.substr(14, 5) + uuid.substr(9, 5) + uuid.substr(0, 9) + uuid.substr(19);
	},
	toRegular: ulid => {
		return ulid.substr(10, 9) + ulid.substr(5, 5) + ulid.substr(0, 5) + ulid.substr(19);
	}
};