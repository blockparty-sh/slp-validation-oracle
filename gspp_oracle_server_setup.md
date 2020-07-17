## Setup GS++ Oracle Server

To provide your own validation oracle you may use GS++ to quickly get going. Ideally in the future multiple other backends will support this, a benefit to GS++ is that it takes less than an hour to sync today.

> NOTE: Currently the web frontend as described in the [SLP Validation Oracle Spec](./slp_validation_oracle_spec.md) is not implemented, so we just use gRPC to connect to GS++ for the demo. As this document moves from draft to a finished spec this will be completed.

Download and setup [GS++](https://github.com/blockparty-sh/cpp_slp_graph_search).

Run `node scripts/genprivkey.js` to generate a private key.

Put this in the `config.toml` of GS++ root under [graphsearch] like:

```toml
[graphsearch]
max_exclusion_set_size = 5 
private_key = "0000000000000000000000000000000000000000000000000000000000000000"
```

Edit `scripts/genpubkey.js` to add your private key

Run `node scripts/genpubkey.js`

Take the first line and add it into `config.js` as a new server, it could look like:

```js
    servers: [
        {
            url: 'localhost:50051',
            pubkey: '02c6c49085a25ad0eed256d1c87e5cc6525a27783b94483cebefa9eee39717e526',
        },
        ...
    ]
```


Make sure GS++ is running and accepting connections otherwise it cannot provide you signatures obviously, it should sync relatively quickly.
