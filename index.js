const Random = require('random-js');
const random = new Random(Random.engines.mt19937().autoSeed());

const Auth = require('./util/auth');
const Sockets = require('./sockets');

// Create wss

// Initialize services
const auth = new Auth(random);
const sockets = new Sockets(wss, auth, random);
const webserver = require('./webserver');
