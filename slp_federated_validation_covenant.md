# SLP Federated Validation Covenant
#### RFC
#### Date published: July 26, 2019


### Authors
JT Freeman

### Acknowledgements
James Cramer, Grido


## Introduction

SLP is a non-miner-enforced token system built on top of Bitcoin Cash. This has allowed it many benefits, most importantly has allowed development to progress without needing Bitcoin Cash protocol developers to agree on a token system. However, the [Token Type 1](https://slp.dev/specs/slp-token-type-1/#comparison-to-other-token-schemes) admits that in a perfect world SLP could have the same security model as Bitcoin instead of requiring 3rd party systems to validate transactions. Because of this design, many Bitcoin Script features are not quite applicable to SLP, due to the inability for Script to operate on what it knows are valid SLP transactions.

We propose a new construction utilizing covenants which rely on a multisignature variation of the SLP Validation Oracle Specification that allows contract designers to utilize Bitcoin Script to operate upon SLP tokens with a reasonably high certainty of their attributes and validity. This can be thought of as a federated model, however the federation is chosen by each contract creator and anyone is able to participate as part of the federation. With enough people running lightweight validity oracles not only is there is not a central source of truth, but there is not a centralized group of servers forced upon the entire SLP ecosystem as the deciders of validity.


## Motivation

To provide a reasonable level of security for high value contracts a single source of truth (unless running your own validation oracle) should not be used. Instead, a M of N scheme of validators which can be agreed upon by both the contract initiator as well as the contract redeemer, can be used which makes this a significantly safer security solution than a fixed set of trusted validation nodes. 

## Use Cases

* Offline SLP buy orders (I want to buy 1B honk for 1BCH)
* Staking reward system (be able to mint X new tokens as long as you have locked up for X days)
* Offline SLP <-> SLP atomic swap (not positive on this, but pretty sure this construction allows for this using multiple txs)
* Meltable tokens (i.e. be able to burn tokens in exchange for locked up BCH)
* Swaps by burning 1 token in exchange for mint output of another (i.e. burn 1000 MIST in exchange for 1000 WIST)
* Burn 1000 spice tokens to create new nft from a special group


## Federated SLP Validation Oracles

The core of this is to simply have the contract check that M of N signatures for specified a input validation. This can be done for multiple inputs if necessary for the contract. This requires concatenating the required slp properties defined in the [SLP Validation Oracle Specification](./slp_validation_oracle_spec.md) and using `checkDataSig` against the signatures provided.

To perform this check a preimage of the `hashPrevouts` property defined in [Replay Protected SigHash](https://www.bitcoincash.org/spec/replay-protected-sighash.html#digest-algorithm) must be provided as input to the script. By splitting every 36 (32+4) bytes each input may be inspected to gather the required txid and vout of the input. The preimage of hashPrevouts must be verified by double hashing then comparing against the hashPrevouts property for the transaction preimage. The other properties needed to fulfill the SLP Validation Oracle Spec may be specified as part of the input to the script or by hardcoding them in.
