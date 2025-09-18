trim = require('../lib/wsdl/index.js').trim
var assert = require('assert');

it('should trim correctly', async () => {
    describe('removes whitespace', async () => {
        const input = ' \n <> \n  ';
        const expected = '<>';

        verify(input, expected);
    })

    describe('removes non breaking space', async () => {
        const input = '\xA0<>';
        const expected = '<>';

        verify(input, expected);
    });

    describe('removes all', async () => {
        const input = '\xA0\n \t<\n\t\xA0>\t \n \xA0';
        const expected = '<\n\t\xA0>';

        verify(input, expected);
    });
})

function verify(input, expected) {
    const actual = trim(input);
    assert(actual === expected, `${actual} != ${expected}`);
}
