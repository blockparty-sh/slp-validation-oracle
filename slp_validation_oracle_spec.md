# SLP Validation Oracle Protocol Specification
#### RFC
#### Date published: July 26, 2019

### Authors
JT Freeman

### Acknowledgements
James Cramer, Grido

## Introduction

Due to SLP's nature as a non-miner-enforced token system, a variety of validation systems have been developed. This ranges from full validation by clients, to fully trusted validation from a 3rd party. However, there is no standard way for a party to share their validation result publicly, meaning anyone who wishes to verify a party has validated an output must re-run the query themselves. In addition, there is no definition of what a validity result looks like, causing fragmentation in the ecosystem- a standard interface that allows radically different backends could provide greater ease for wallets and other services to aggregate validation results. We attempt to define a minimal and easy to implement interface for sharing validation results that are cryptographically signed by the validator, and are able to be used by a wide range of applications.

## Requirements

* Easy to implement.

* Tamper-proof.

* Fast.

* Simple.



## Implementation Details


All data shall be treated as little endian.

[secp256k1](https://github.com/bitcoin-abc/secp256k1) library is highly recommended to be used.

To perform the signing concatenate all of the objects, perform sha256, then sign using Schnorr

As an example for Token Type 1 Transactions:

`S(H(txid || vout || tokenid || tokentype || tokenvalue || is_baton))`



A client will forge a request to a validation oracle server by providing the server an outpoint.

If the outpoint is SLP valid return a signed message as described

If the outpoint is SLP invalid the server may respond with an error or a 0 value response.

The server MUST conform to the below description of data and ordering for the message by tokenType.

The server MUST respond with both the message and signature

The server MAY respond with additional information 

The client SHOULD perform the same concatenation and hashing step and verify the message matches servers response

The client SHOULD verify the signature matches the message

### Type Descriptions

Different data is relevant depending on the token type. This is left open for future expansion of the SLP protocol token types, however the already defined type definitions will not change.

#### Token Type 1

| field      | bytes |
|------------|-------|
| txid       | 32    |
| vout       | 4     |
| tokenid    | 32    |
| tokentype  | 2     |
| tokenvalue | 8     |
| is_baton   | 1     |

#### NFT1 Group

| field      | bytes |
|------------|-------|
| txid       | 32    |
| vout       | 4     |
| tokenid    | 32    |
| tokentype  | 2     |
| tokenvalue | 8     |
| is_baton   | 1     |

#### NFT1 Child

| field      | bytes |
|------------|-------|
| txid       | 32    |
| vout       | 4     |
| tokenid    | 32    |
| tokentype  | 2     |
| groupid    | 32    |


### Server Details

Servers shall provide a HTTP/HTTPS 1.1 endpoint of the form:

`/{txid}/{vout}`

Which responds with a JSON document that contains at least these fields:

```json
{
    "msg": "SHA256 OF CONCAT FIELDS",
    "sig": "SIGNATURE"
}

```

Additional fields may be added for debugging or general developer experience. 

It is recommended that servers do not include their public keys in the response, or as part of an API. These should be manually whitelisted by developers and not automatically pulled from any source.
