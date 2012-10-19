# node-expat #

## Motivation ##

You use [node.js](http://github.com/ry/node) for speed? You process
XML streams? Then you want the fastest XML parser: [libexpat](http://expat.sourceforge.net/)!

## Speed ##

A stupid speed test is supplied in `bench.js`. We measure how many
25-byte elements a SAX parser can process:

- [node-xml](http://github.com/robrighter/node-xml) (pure JavaScript): 23,000 el/s
- [libxmljs](http://github.com/polotek/libxmljs) (libxml2 binding): 77,000 el/s
- [node-expat](http://github.com/astro/node-expat) (libexpat binding, this): 113,000 el/s

These numbers were recorded on a Core 2 2400 MHz and may turn out to
be bullshit, given my few node.js experience.

## Instructions ##

    node-waf configure
    node-waf build

For using the library, make sure `build/default/expat.node` is in
either `$NODE_PATH` or `require.paths`.

Important events emitted by a parser:

- *startElement* with `name, attrs`
- *endElement* with `name`
- *text* with `string`

There are more. Use `test.js` for reference.

It's possible to stop and resume the parser from within element handlers using the parsers 
stop() and resume() methods.

## Error handling ##

We don't emit an error event because libexpat doesn't use a callback
either. Instead, check that `parse()` returns `true`. A descriptive
string can be obtained via `getError()` to provide user feedback.

## Namespace handling ##

A word about special parsing of *xmlns:* this is not neccessary in a
bare SAX parser like this, given that the DOM replacement you are
using (if any) is not relevant to the parser.
