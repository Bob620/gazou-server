# Gazou Server
Gazou is a image storage and search system. It utilizes Redis to store all the metadata and information required.

The primary reason I made Gazou was because I needed a way to store and retrieve from a large database of tagged images for Waifu bot.
However this project allows me to use the same image database as a larger tool.

Please visit the [Wiki](https://github.com/Bob620/gazou-server/wiki) to learn more if you want to work with it more.

You first need to copy the defaultConfig.json to config.json and then change the config to what is wanted.

In order to change the ports for http/webserver you cna use command line commands `-p` or `--httpport` and `-s` or `--websocketport` followed by the port wanted.

default ports are 80 for webserver and 8080 for websocket server.

If a cert/key location is provided in the server configs, it will attempt to find and start an https server for either or both servers.

In order to run the server you need to have a redis server set up it can negotiate to, can be configured from the config.json file.
