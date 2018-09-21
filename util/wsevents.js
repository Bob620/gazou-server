module.exports = {
	upload: (message, data) => {
		try {

		} catch(err) {
			throw {
				event: 'upload',
				message: 'Something broke'
			}
		}
	},
	search: (message, data) => {
		try {

		} catch(err) {
			throw {
				event: 'search',
				message: 'Something broke'
			}
		}
	},
	authenticate: (message, data) => {
		try {
			data.user = {
				id: '1234',
				perms: 'upload'
			}
		} catch(err) {
			throw {
				event: 'authenticate',
				message: 'Something broke'
			}
		}
	},
	get: (message, data) => {
		try {

		} catch(err) {
			throw {
				event: 'get',
				message: 'Something broke'
			}
		}
	}
};