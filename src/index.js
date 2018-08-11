const BlockLexer = require('./markdown/BlockLexer');
const Parser = require('./markdown/Parser');
const contextify = require('./downson/Contextify');
const DownsonLexer = require('./downson/Lexer');
const parse = require('./downson/Parser');
const Converter = require('./downson/Converter');
const Failure = require('./downson/Failure');

function marked(src, options) {
    const blockLexer = Object.create(BlockLexer);
    blockLexer.BlockLexer(options);
    const blockTokens = blockLexer.lex(src);

    const parser = Object.create(Parser);
    parser.Parser(options);

    return parser.parse(blockTokens);
}

function processAsDownson(markdown) {
    const { topLevelContext, contextifyFailures } = contextify(markdown);

    const { lexedTopLevelContext, lexerFailures } = DownsonLexer.lex(topLevelContext);

    const { data, parserFailures } = parse(lexedTopLevelContext);

    const failures = contextifyFailures.concat(lexerFailures, parserFailures)

    return {
        data,
        failures,
        hasInterpretationsErrors: failures.some(element => element.type == Failure.Types.interpretationError)
    };
}

/**
 * Parses the specified Markdown input and returns the extracted data layer and the list of failures.
 * @param {string} input the Markdown input to process
 * @param {object} options options to fine-tune the parsing/data extraction process
 * @returns {object} the data layer and the failures
 */
function downson(input, options = { marked: {} }) {
    if (typeof input === 'undefined' || input === null) {
        throw new Error('downson(): input parameter is undefined or null');
    }
    if (typeof input !== 'string') {
        throw new Error('downson(): input parameter is of type '
            + Object.prototype.toString.call(input) + ', string expected');
    }

    try {
        const markedOptions = Object.assign({}, downson.defaultOptions.marked || {}, options.marked);

        const markdown = marked(input, markedOptions);

        return processAsDownson(markdown);
    } catch (e) {
        e.message += '\nPlease report this to https://github.com/battila7/downson-js.';

        if ((options || downson.defaultOptions).silent) {
            return {};
        }

        throw e;
    }
}

/**
 * Returns the factory default settings of downson.
 * @returns {object} the factory defaults
 */
downson.getFactoryDefaults = function getFactoryDefaults() {
    return {
        marked: {
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
            smartLists: false,
            smartypants: false,
            tables: true,
            xhtml: false
        },
        silent: false
    };
}

/**
 * The default options of the library. Can be modified if desired.
 */
downson.defaultOptions = downson.getFactoryDefaults();

/**
 * Registers a new custom primitive type.
 * @param {string} type the name of the type
 * @param {function} converterMethod the converter method, which converts a literal to a value
 */
downson.registerType = function registerType(type, converterMethod) {
    if (typeof type === 'undefined' || type === null || converterMethod === 'undefined' || converterMethod === null) {
        throw new Error('registerType(): type or converterMethod is undefined/null.');
    }

    if (typeof type !== 'string') {
        throw new Error('registerType(): type parameter is of type '
            + Object.prototype.toString.call(src) + ', string expected');
    }

    if (typeof converterMethod !== 'function') {
        throw new Error('registerType(): converterMethod parameter is of type '
            + Object.prototype.toString.call(src) + ', function expected');
    }

    Converter.register(type, converterMethod);
};

/**
 * Deregisters the specified custom primitive type.
 * @param {string} type the name of the type
 * @returns {boolean} true if the specified type has been deregistered, false otherwise
 */
downson.deregisterType = function deregisterType(type) {
    if (typeof type === 'undefined' || type === null) {
        throw new Error('deregisterType(): type is undefined/null.');
    }

    if (typeof type !== 'string') {
        throw new Error('deregisterType(): type parameter is of type '
            + Object.prototype.toString.call(src) + ', string expected');
    }

    return Converter.deregister(type);
}

module.exports = downson;
