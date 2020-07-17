require('dotenv').config();

const config      = require('./config');
const BigNumber   = require('./bignum'); // wrapper that allows for toBuffer
const grpc        = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const bitcore     = require('bitcore-lib-cash');
const slpMdm      = require('slp-mdm');
const BITBOX      = require('bitbox-sdk').BITBOX;
const cashscript  = require('cashscript');
const Handlebars  = require('handlebars');
const bitbox = new BITBOX();

const creatorPrivKey = bitcore.PrivateKey.fromWIF(process.env.creatorWIF);
const creatorPK = creatorPrivKey.toPublicKey();
const creatorPKH = bitcore.crypto.Hash.sha256ripemd160(creatorPK.toBuffer());
const creatorKeyPair = bitbox.ECPair.fromWIF(process.env.creatorWIF);

const redeemerPrivKey = bitcore.PrivateKey.fromWIF(process.env.redeemerWIF);
const redeemerPK = redeemerPrivKey.toPublicKey();
const redeemerPKH = bitcore.crypto.Hash.sha256ripemd160(redeemerPK.toBuffer());
const redeemerKeyPair = bitbox.ECPair.fromWIF(process.env.redeemerWIF);



const PROTO_PATH = __dirname + '/graphsearch.proto';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const graphsearchProto = grpc.loadPackageDefinition(packageDefinition).graphsearch;


// M how many needed
// N = how many keys
const contractGeneratorTokenType1 = (M, N) => {
    const template = Handlebars.compile(`
    pragma cashscript ^0.4.0;

    contract SlpBuyOrder(
        bytes20 creatorPKH,
        {{#each N}}
        pubkey  validatorPK{{@index}},
        {{/each}}
        bytes32 tokenId,
        bytes8  tokenValue
    ) {
        function exchange(
            sig      s,
            pubkey   pk,
            {{#each N}}
            datasig  validatorSig{{@index}},
            {{/each}}
            bytes8   bchOutputBuf, // satoshis for output minus fee
            bytes72  preimagePrevouts // txid:vout bch, txid:vout slp
        ) {
            // verify spenders sig/pk match
            require(checkSig(s, pk));

            // verify the preimagePrevouts is actually legitimate in transaction
            require(hash256(preimagePrevouts) == tx.hashPrevouts);

            // we require the second input to be SLP
            bytes slpOutpoint = preimagePrevouts.split(36)[1];

            // split the outpoint
            bytes txid = slpOutpoint.split(32)[0];
            bytes vout = slpOutpoint.split(32)[1];

            // verify against the validation oracles
            //                                                 tokenType             ixBaton
            bytes validationPreimage = txid + vout + tokenId + 0x0100 + tokenValue + 0x00;

            int acc = 0;
            {{#each N}}
            acc = acc + int(checkDataSig(validatorSig{{@index}}, validationPreimage, validatorPK{{@index}}));
            {{/each}}

            // we need at least M valid signatures
            require(acc >= {{M}});

            // check that the outputs of this transaction are actually a valid formatted slp output
            // that the slp is received by the creator
            // and that the bch is consumed by the redeemer
            require(tx.hashOutputs == hash256(
                0x0000000000000000386a04534c50000200010453454e4420 + tokenId.reverse() + 0x08 + tokenValue.reverse()
              + new OutputP2PKH(bytes8(546), creatorPKH)
              + new OutputP2PKH(bchOutputBuf, hash160(pk))
            ));
        }

        // allow the creator to cancel his own order
        function cancel(sig creatorSig, pubkey creatorPK) {
            require(hash160(creatorPK) == creatorPKH);
            require(checkSig(creatorSig, creatorPK));
        }
    }`);

    return template({
        M,
        N: [...Array(N).keys()]
    });
}



const reverseHex = (h) => h.match(/.{2}/g).reverse().join('');

const getSignature = (url, pubkey, h, txid, vout) => new Promise((resolve, reject) => {
    const client = new graphsearchProto.GraphSearchService(url,
        grpc.credentials.createInsecure()
    );

    client.OutputOracle({
        txid,
        vout
    }, (err, response) => {
        if (err !== null) {
            console.log(err);
            return reject(new Error(err));
        }
        console.log(response);
        // console.log('msg:', response.msg.toString('hex'));
        // console.log('sig:', response.sig.toString('hex'));
        // console.log('tx:', response.tx.toString('hex'));
        // console.log('tokenId:', reverseHex(response.tokenId.toString('hex')));
        // console.log('value:', response.value);

        const schnorr = new bitcore.crypto.Schnorr();
        schnorr.pubkey = new bitcore.PublicKey(pubkey, { compressed: false });
        schnorr.hashbuf = response.msg;
        schnorr.endianess = 'big';
        schnorr.sig = bitcore.crypto.Signature.fromBuffer(response.sig);

        if (! schnorr.verify().verified) {
            return reject(new Error('schnorr verification failed'));
        }

        if (Buffer.compare(h, response.msg) !== 0) {
            return reject(new Error('h != msg'));
        }

        return resolve(response.sig);
    });
});

const initializeContractTokenType1 = async (tokenId, tokenValue) => {
    const validatorPKBuffers = config.servers.map(v =>
        new bitcore.PublicKey(Buffer.from(v.pubkey, 'hex'), { compressed: false }).toBuffer()
    );

    try {
        // console.log(contractGeneratorTokenType1(config.M, config.servers.length));
        const SlpBuyOrder = await cashscript.Contract.compile(
            contractGeneratorTokenType1(config.M, config.servers.length),
            'mainnet'
        );
        const data = {
            creatorPKH,
            tokenId,
            tokenValue: tokenValue.toBuffer({ endian: 'little', size: 8 }),
        };
        /*
        console.log({
            creatorPKH: data.creatorPKH.toString('hex'),
            tokenId: data.tokenId.toString('hex'),
            tokenValue: data.tokenValue.toString('hex'),
        });
        */
        const contract = SlpBuyOrder.new(data.creatorPKH, ...validatorPKBuffers, data.tokenId, data.tokenValue)
        return contract;
    } catch (e) {
        console.dir(e, { depth: null });
    }
}

const performExchangeTokenType1 = async (txid, vout, tokenId, tokenValue) => {
    console.log(redeemerPK.toAddress().toString());
    // used to compare against results to make sure servers agree
    const H = bitcore.crypto.Hash.sha256(
        Buffer.concat([
            txid,
            new BigNumber(vout).toBuffer({ endian: 'little', size: 4 }),
            tokenId,
            new BigNumber(0x01).toBuffer({ endian: 'little', size: 2 }), // tokenType
            tokenValue.toBuffer({ endian: 'little', size: 8 }),
            new BigNumber(0x00).toBuffer({ endian: 'little', size: 1 }), // isBaton
        ])
    );

    const signatures = await Promise.allSettled(
        config.servers.map(v => getSignature(v.url, v.pubkey, H, txid.toString('hex'), vout))
    );
    
    const instance = await initializeContractTokenType1(tokenId, tokenValue);

    const redeemerCoins = (await bitbox.Address.utxo(redeemerPK.toAddress().toString())).utxos;
    if (redeemerCoins.length === 0) {
        console.log(`SEND ${tokenValue.toString()} TO ${redeemerPK.toAddress().toString()}`);
        process.exit();
    }
    redeemerCoins[0].keyPair = redeemerKeyPair;

    const creatorCoins  = (await bitbox.Address.utxo(instance.address)).utxos;
    if (creatorCoins.length === 0) {
        console.log(`RUN INIT FIRST`);
        process.exit();
    }

    console.log(creatorCoins);
    console.log(redeemerCoins);

    const preimagePrevouts = Buffer.concat([
       Buffer.from(creatorCoins[0].txid.match(/.{2}/g).reverse().join(''), 'hex'),
       new BigNumber(creatorCoins[0].vout).toBuffer({ endian: 'little', size: 4 }),
       Buffer.from(redeemerCoins[0].txid.match(/.{2}/g).reverse().join(''), 'hex'),
       new BigNumber(redeemerCoins[0].vout).toBuffer({ endian: 'little', size: 4 }),
    ]);
    console.log(preimagePrevouts);
    console.log(preimagePrevouts.toString('hex'));
    const outputAmountBCH = new BigNumber(1000); // leave some for feee

    console.log(signatures);
    // TODO do better check here
    if (signatures.filter(v => v.status === 'fulfilled').length < config.M) {
        console.log('NOT ENOUGH SIGNATURES FOUND');
        process.exit(1);
    }

    try {
        let tx = instance.functions
            .exchange(
                new cashscript.SignatureTemplate(redeemerKeyPair),
                redeemerPK.toBuffer(),
                ...signatures.map(v => v.status === 'fulfilled' ? v.value : Buffer.from('00', 'hex')),
                outputAmountBCH.toBuffer({ endian: 'little', size: 8 }),
                preimagePrevouts
            )
            .from([creatorCoins[0]])
            .experimentalFromP2PKH([redeemerCoins[0]], redeemerKeyPair)
            .withMinChange(100000000000);

        const slpBuffer = Buffer.from(
            slpMdm.TokenType1.send(Buffer.from(reverseHex(tokenId.toString('hex')), 'hex'), [ tokenValue ])
                .toString('hex')
                .replace('6a04534c50000101',
                         '6a04534c5000020001')
        , 'hex');

        tx.outputs.push({
            to: slpBuffer,
            amount: 0
        });
        tx = tx.to(bitcore.Address.fromPublicKeyHash(creatorPKH).toString(), 546);
        tx = tx.to(bitcore.Address.fromPublicKeyHash(redeemerPKH).toString(), outputAmountBCH.toNumber());

        console.log(tx);

        const txHex = await tx.build();
        console.log(txHex);

        // TODO use something else to broadcast
        const txid = await bitbox.RawTransactions.sendRawTransaction(txHex);
        console.log(txid);
    } catch (e) {
        console.log(e);
    }
}

const performCancel = async (tokenId, tokenValue) => {
    const contract = await initializeContractTokenType1(tokenId, tokenValue);
    // const creatorCoins = await contract.findCoins("mainnet");

    const creatorCoins = (await bitbox.Address.utxo(contract.address)).utxos;
    creatorCoins[0].keyPair = creatorKeyPair;
    console.log(creatorCoins);

    // TODO maybe we should just create the tx then save the size and create it again to get better fee estimate
    const satoshis = creatorCoins.reduce((a, v) => a + v.satoshis, 0) - 546 - (350 * creatorCoins.length);
    const instance = await initializeContractTokenType1(tokenId, tokenValue);

    if (satoshis < 546) {
        console.log('YOU NEED MORE BCH TO WITHDRAW');
        process.exit();
    }

    try {
        const tx = instance.functions
            .cancel(
                new cashscript.SignatureTemplate(creatorKeyPair),
                creatorPK.toBuffer(),
            )
            .from(creatorCoins)
            .to(bitcore.Address.fromPublicKeyHash(creatorPKH).toString(), satoshis);

        const txHex = await tx.build();
        console.log(txHex);

        // TODO use something else to broadcast
        const txid = await bitbox.RawTransactions.sendRawTransaction(txHex);
        console.log(txid);
    } catch (e) {
        console.log(e);
    }
};

const helpPls = () => {
    console.log('help:');
    console.log('init tokenId value');
    console.log('redeem txid vout tokenId value');
    process.exit(1);
}

const main = async (argv) => {
    if (argv.length < 3) helpPls();

    if (argv[2] === 'init') {
        if (argv.length !== 5) helpPls();

        const tokenId    = Buffer.from(reverseHex(argv[3]), 'hex');
        const tokenValue = new BigNumber(argv[4]);
        
        const contract = await initializeContractTokenType1(tokenId, tokenValue);

        console.log('SEND BCH HERE:');
        console.log(contract.address);
    }
    else if (argv[2] === 'redeem') {
        if (argv.length !== 7) helpPls();

        const txid = Buffer.from(reverseHex(argv[3]), 'hex');
        const vout = parseInt(argv[4], 10);

        const tokenId    = Buffer.from(reverseHex(argv[5]), 'hex');
        const tokenValue = new BigNumber(argv[6]);

        await performExchangeTokenType1(txid, vout, tokenId, tokenValue);
    }
    else if (argv[2] === 'cancel') {
        if (argv.length !== 5) helpPls();

        const tokenId    = Buffer.from(reverseHex(argv[3]), 'hex');
        const tokenValue = new BigNumber(argv[4]);

        await performCancel(tokenId, tokenValue);
    }
    else helpPls();

    process.exit(0);
}

main(process.argv);
