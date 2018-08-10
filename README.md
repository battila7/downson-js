# Downson.js

A downson parser, based on the fork of the awesome [marked](https://github.com/markedjs/marked) Markdown parser.

What's downson? It's the new configuration/data file format, y'all've been waiting for! :rocket: Check it out at here: [downson](https://github.com/battila7/downson/).

Downson.js supports both server-side and client-side (browser) usage and has an accompanying CLI – [downson-js-cli](https://github.com/battila7/downson-js-cli/)

## Documentation

For a detailed API documentation, please see [API.md](API.md).

## Example

### Node

Installation: 

~~~~bash
npm install downson --save
~~~~

Usage:

~~~~JavaScript
const downson = require('downson');

const md =
`
  * What's your favourite **.greeting** [](right)?
  * [Hello, World!](string) What else?
`;

console.log(downson(md).data); // prints { greeting: 'Hello, World!' }
~~~~

## License

Copyright (c) 2011-2018, Attila Bagossy. (MIT License)
