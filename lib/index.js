const BlockLexer = require('./markdown/BlockLexer');
const Parser = require('./markdown/Parser');
const contextify = require('./downson/Contextify');
const DownsonLexer = require('./downson/Lexer');
const parse = require('./downson/Parser');
const Converter = require('./downson/Converter');

function checkArguments(src) {
    if (typeof src === 'undefined' || src === null) {
        throw new Error('downson(): input parameter is undefined or null');
    }
    if (typeof src !== 'string') {
        throw new Error('downson(): input parameter is of type '
            + Object.prototype.toString.call(src) + ', string expected');
    }
}

function processMarkdown(src, options) {
    const blockLexer = Object.create(BlockLexer);
    blockLexer.BlockLexer(options);
    const blockTokens = blockLexer.lex(src);

    const parser = Object.create(Parser);
    parser.Parser(options);

    return parser.parse(blockTokens);
}

function processAsDownson(markdown) {
    const topLevelContext = contextify(markdown);

    const lexedTopLevelContext = DownsonLexer.lex(topLevelContext);

    return parse(lexedTopLevelContext);
}

function downson(src, options) {
    checkArguments(src);

    try {
        const opts = Object.assign({}, downson.defaults, options || {});

        const markdown = processMarkdown(src, opts);        

        return processAsDownson(markdown);
    } catch (e) {
        e.message += '\nPlease report this to https://github.com/battila7/downson-js.';

        if ((options || downson.defaults).silent) {
            return {};
        }

        throw e;
    }
}

downson.options =
    downson.setOptions = function (opt) {
        Object.assign(downson.defaults, opt);
        return downson;
    };

downson.getDefaults = function () {
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

downson.defaults = downson.getDefaults();

downson.registerType = function registerType(type, converterMethod) {
    Converter.register(tyoe, converterMethod);
};

downson.deregisterType = function deregisterType(type) {
    return Converter.deregister(type);
}

module.exports = downson;
