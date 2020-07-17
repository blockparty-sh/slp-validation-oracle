# Offline SLP Buy Order
#### RFC
#### Date published: July 26, 2019

### Authors
JT Freeman

### Acknowledgements
James Cramer, Grido


## Introduction

Today only SLP sell orders can be done offline such as on memo.cash. The reason being that SLP tokens are not miner validated. Some other techniques can be used for online systems requiring back and forth communication between parties, however this is not ideal to use as users may go offline temporarily or refuse to respond to requests for other reasons.

A proof-of-concept offline buy order script is included. This allows someone to put up BCH with a requirement for it to be exchanged for a specific SLP token amount. Additionally, a way to cancel the position is implemented.


## Description

```
Alice wants to buy 30 SPICE in exchange for 2 Bitcoin Cash
Bob wants to sell SPICE for Bitcoin Cash

Alice compiles contract by passing in her public key hash, tokenid, and tokenvalue and gets the buyaddress
Alice sends 2 BCH to buyaddress
Alice lets the world know about the contract by sharing her public key hash, tokenid, tokenvalue, and the outpoint of the BCH for easy indexing
Alice broadcasts an `op_return` signal # research memo 009.mip
    outpoint - referencing above buyaddress
    tokenid - what token Alice wants
    value - how many tokens Alice wants
    M int number of valid signatures required from N
    N public keys (for validators)
    signed output-- from outpoint

Bob uses bitdb to find `op_return` signals matching SPICE which are unspent
Bob compiles the contract 

Bob creates and broadcasts a transaction of:
    1 input from buyaddress (signed output above)
    1 output of SLP SEND with script `value` being sent
    1 output of 546 satoshis to Alice (30 SPICE)
    1 output of 2 BCH to Bob
```


## Setup

```sh
git clone https://github.com/blockparty-sh/SLP-validation-oracle
cd SLP-validation-oracle
npm i
```

Edit `config.js` - set M to the amount of signatures you require, and add as many servers (or remove) as you want

You may want to set up gs++ for an additional test server


Create a new wallet in Electron Cash SLP Edition and fund it with some BCH

Copy .env.example to .env and edit:

Extract WIFs from ECSLP (addresses -> right click address -> private key) and insert into `creatorWIF` and `redeemerWIF`

Create a new token with 0 decimals (doesn't have to be but easier for testing)

Send 4000 sats to the address generated with:

`node buy.js init TOKENID 100`

Send 100 of the token to the address associated with redeemerwif, save the txid and output index of the 100 tokens

Now you can perform the exchange:

`node buy.js redeem TXID VOUT TOKENID 100`

If all goes well the buy order will have succeeded and it will print the txid.


## On-Chain Broadcasting DEX

When sending to the p2sh you may include an OP_RETURN with the following data to allow for easy discovery.

(txid and vout are inferred from this tx)

All bytes are little endian.

`lokadId` should be set to `SDXO`

`creatorPKH` is used for cancelling the order.

`M` is How many of the sigs must match

`pubkeyhash` multiple allowed (separate pushes) referencing validators pubkeys

| field          | bytes |
|----------------|-------|
| lokadId        | 4     |
| creatorPKH     | 20    |
| tokenid        | 32    |
| tokentype      | 2     |
| tokenamount    | 8     |
| M              | 1     |
| pubkeyhash...  | 20    |


Clients will have to maintain a mapping of:

`pubkeyhash` -> `pubkey`, `url`

If the client does not have all of the mappings, they should attempt to look them up using the format below.



## Publicly Registering a Validation Service

`lokadId` set to `SDXV`

`url`: set to url of validation `https://slporacle.fountainhead.cash`

| field          | bytes |
|----------------|-------|
| lokadId        | 4     |
| url            | variable    |

These can be queried with bitdb using `out.h1` for the pk and looking at `out.h2` for the pkh

The most recent block should take precedence.

TODO provide queries

TODO write register script



## Off-Chain Broadcasting

TODO
