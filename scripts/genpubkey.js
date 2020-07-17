// enter privateKey here to generate publickey to use during grpc lookup
const privateKey = '15a6297a6181ac93a65a8a33f96fe563bd25c1e7596f11fe04c4a2a92941ce2b';

const bitcore = require('bitcore-lib-cash');
const privkey = new bitcore.PrivateKey(bitcore.crypto.BN.fromBuffer(privateKey, 'hex'), 'livenet');
const pubkey = privkey.toPublicKey();
console.log(pubkey.toString('hex'))
const scripthash = bitcore.crypto.Hash.sha256ripemd160(pubkey.toBuffer());
console.log(scripthash.toString('hex'));
