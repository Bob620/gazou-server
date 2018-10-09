const config = require('../config/config');

const database = require('./database');

const Discord = require('discord.js');

class Auth {
	constructor(random) {
		this.data = {
			random,
			activeAuthRequests: new Map(),
			client: new Discord.Client()
		};

		this.data.client.on('ready', () => {
			console.log('Discord logged in');
		});

		this.data.client.on('message', async message => {
			try {
				if (config.discord.adminUsers.includes(message.author.id) && message.cleanContent.startsWith(config.discord.commandPrefix)) {
					const [command, ...input] = message.cleanContent.split(' ');
					switch(command.toLowerCase().substr(1)) {
						case 'adduploader':
							if (input[0] && input[1]) {
								const potentialUserId = await database.getUserDisplayName(input[0]);
								const potentialDisplayName = await database.getUserId(input[1]);
								if (!potentialUserId && !potentialDisplayName) {
									await database.addUploader(input[0], input[1]);
									await message.author.send(`${input[0]} added with display name of ${input[1]}`);
									await message.author.send(`Permissions approved for ${input[1]}`);
								} else
									await message.author.send('UserId or DisplayName already exists in the database!');
							} else
								await message.author.send('No UserId or DisplayName provided!');
							break;
						case 'revokeuploader':
							if (input[0]) {
								const userId = await database.getUserId(input[0]);
								if (userId) {
									await database.revokeUploader(userId);
									await message.author.send(`Permissions revoked from ${input[0]}`);
								} else
									await message.author.send('No user found with that name!');
							} else
								await message.author.send('No DisplayName provided!');
							break;
						case 'approveuploader':
							if (input[0]) {
								const userId = await database.getUserId(input[0]);
								if (userId) {
									await database.approveUploader(userId);
									await message.author.send(`Permissions approved for ${input[0]}`);
								} else
									await message.author.send('No user found with that name!');
							} else
								await message.author.send('No DisplayName provided!');
							break;
						case 'listuploaders':
							const uploaders = await database.getUploaders();
							const pageNumber = input[0] ? input[0] : '0';
							let fields = [];
							for (const uploader of uploaders)
								fields.push({
									name: uploader,
									value: await database.getUserId(uploader)
								});

							await message.author.send({
								embed: {
									title: `Uploaders Page ${pageNumber}`,
									color: 1927392,
									fields
								}
							});
							break;
						case 'changedisplayname':
							if (input[0] && input[1]) {
								const userId = await database.getUserDisplayName(input[0]);
								const potentialDisplayName = await database.getUserDisplayName(input[1]);
								if (userId && !potentialDisplayName) {
									await database.updateUploader(userId, input[1]);
									await message.author.send(`${input[0]} changed to ${input[1]}`);
								} else
									await message.author.send('UserId doesn\'t exist or newDisplayName already exists in the database!');
							} else
							await message.author.send('No DisplayNames provided!');
							break;
						case 'help':
							await message.author.send({
								embed: {
									title: 'Commands',
									color: 1927392,
									fields: [
										{
											name: '!help',
											value: 'Shows helpful command info'
										},
										{
											name: '!addUploader userId displayName',
											value: 'Adds a user and allows them to upload images'
										},
										{
											name: '!revokeUploader displayName',
											value: 'Revokes a user from uploading images'
										},
										{
											name: '!approveUploader displayName',
											value: 'Approves a user to upload images'
										},
										{
											name: '!listUploaders [pageNumber]',
											value: 'Shows all users who can upload images'
										},
										{
											name: '!changeDisplayName displayName newDisplayName',
											value: 'Changes the display name of an uploader'
										}
									]
								}
							});
							break;
						default:
							await message.author.send('Unknown Command, use !help for commands');
							break;
					}
				}
			} catch(err) {
				console.log(err);
			}
		});

		this.data.client.login(config.discord.discordToken);
	}

	testToken(userId, testToken) {
		try {
			let {token, tries} = this.data.activeAuthRequests.get(userId);
			if (token === testToken)
				return true;
			else
				tries++;
			if (tries < 2)
				this.data.activeAuthRequests.set(userId, {token, tries});
			else
				this.voidRequest(userId);
			return false;
		} catch(err) {
			return false;
		}
	}

	voidRequest(userId) {
		this.data.activeAuthRequests.delete(userId);
	}

	async requestAuth(userId) {
		try {
			const token = this.data.random.string(6);
			this.data.activeAuthRequests.set(userId, {token, tries: 0});
			const user = await this.data.client.fetchUser(userId);
			user.send(`Your login token is: \`${token}\`\nThis token will expire in 30 seconds or after 2 tries.\nIf this message was not expected, someone attempted to log into ${config.uploadUrl} using your username.`);
			setTimeout(() => {
				try {
					this.voidRequest(userId);
				} catch (err) {
				}
			}, 30000);
		} catch(err) {
			console.log(err);
		}
	}
}

module.exports = Auth;