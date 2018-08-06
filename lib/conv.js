/**
 * marked - a markdown parser
 * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/markedjs/marked
 */

const Lexer = require('./BlockLexer');
const Parser = require('./Parser');

/**
 * Conv
 */
function conv(src, opt) {
    // throw error in case of non string input
    if (typeof src === 'undefined' || src === null) {
        throw new Error('conv(): input parameter is undefined or null');
    }
    if (typeof src !== 'string') {
        throw new Error('conv(): input parameter is of type '
            + Object.prototype.toString.call(src) + ', string expected');
    }

    try {
        const options = Object.assign({}, conv.defaults, opt || {});

        const lexerTokens = Lexer.lex(src, options);

        console.log(lexerTokens);

        const parseTokens = Parser.parse(lexerTokens, options);

        console.log('\n\n');
        console.log(JSON.stringify(parseTokens));

        //return Parser.parse(Lexer.lex(src, opt), opt);
    } catch (e) {
        e.message += '\nPlease report this to https://github.com/markedjs/marked.';
        if ((opt || conv.defaults).silent) {
            return '<p>An error occurred:</p><pre>'
                + escape(e.message + '', true)
                + '</pre>';
        }
        throw e;
    }
}

/**
 * Options
 */

conv.options =
    conv.setOptions = function (opt) {
        Object.assign(conv.defaults, opt);
        return conv;
    };

conv.getDefaults = function () {
    return {
        baseUrl: null,
        breaks: false,
        gfm: true,
        headerIds: true,
        headerPrefix: '',
        highlight: null,
        langPrefix: 'language-',
        mangle: true,
        pedantic: false,
        sanitize: false,
        sanitizer: null,
        silent: false,
        smartLists: false,
        smartypants: false,
        tables: true,
        xhtml: false
    };
}

conv.defaults = conv.getDefaults();

/**
 * Expose
 */

conv.Parser = Parser;
conv.parser = Parser.parse;

conv.parse = conv;

conv.conv = conv;

module.exports = conv;
