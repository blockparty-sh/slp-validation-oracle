// generates new privateKey for you
const bitcore = require('bitcore-lib-cash');
const privkey = new bitcore.PrivateKey();
console.log(privkey.toString('hex'))
