const { ambiguousSyntax, interpretationError } = require('./Failure');

const BlockLexer = require('../markdown/BlockLexer');
const InlineLexer = require('../markdown/InlineLexer');

const BlockTypes = BlockLexer.Types;
const InlineTypes = InlineLexer.Types;

const KEY_METADATA_SEPARATOR = ':';

const KEY_NAME_STARTER = '.';

const Metadata = {
    left: 'left',
    right: 'right',
    object: 'object'
};

const LinkDestination = {
    alias: 'alias',
    ignore: 'ignore',
    terminator: '$'
};

const VALID_KEY_METADATA_HREFS = [
    `${Metadata.left}`,
    `${Metadata.right}`,
    `${Metadata.left}${KEY_METADATA_SEPARATOR}${Metadata.object}`,
    `${Metadata.right}${KEY_METADATA_SEPARATOR}${Metadata.object}`
];

const Types = {
    noise: 'noise',
    keyAlias: 'key alias',
    ignoreAlias: 'ignore alias',
    objectTerminator: 'object terminator',
    keyMetadata: 'key metadata',
    primitiveLiteral: 'primitive literal',
    text: 'text',
    objectKey: 'object key',
    list: 'list',
    listItem: 'list item',
    table: 'table',
    contextStart: 'context start',
    space: 'space'
};

function singleFlatten(arr) {
    return arr.map(el => {
        if (Array.isArray(el)) {
            return el;
        } else {
            return [el];
        }
    })
    .reduce((acc, curr) => acc.concat(curr), []);
}

const isLinkKeyMetadata = href => VALID_KEY_METADATA_HREFS.includes(href);

const Lexer = {
    Lexer(topLevelContext) {
        this.failures = [];
        this.topLevelContext = topLevelContext;
    },
    lex() {
        const lexedTopLevelContext = this.processContext(this.topLevelContext);

        return {
            lexedTopLevelContext,
            lexerFailures: this.failures
        };
    },
    processors: {
        noise() {
            return {
                type: Types.noise
            };
        },
        [InlineTypes.link](token) {
            switch (token.data.href) {
                case LinkDestination.alias:
                    return {
                        type: Types.keyAlias,
                        alias: token.data.title
                    };
                case LinkDestination.ignore:
                    return {
                        type: Types.ignoreAlias
                    };
                case LinkDestination.terminator:
                    return {
                        type: Types.objectTerminator
                    };
                default:
                    if (isLinkKeyMetadata(token.data.href)) {
                        const metadata = token.data.href.split(KEY_METADATA_SEPARATOR);
    
                        return {
                            type: Types.keyMetadata,
                            metadata,
                            right: metadata.includes(Metadata.right),
                            left: metadata.includes(Metadata.left),
                            object: metadata.includes(Metadata.object),
                            alias: token.data.title
                        };
                    } else {
                        return {
                            type: Types.primitiveLiteral,
                            literal: token.data.cap[1],
                            typeHint: token.data.href,
                            valueOverride: token.data.title
                        };
                    }
            }
        },
        [InlineTypes.text](token) {
            return {
                type: Types.text,
                text: token.data.text
            };
        },
        [InlineTypes.strong](token) {
            if (token.data.text.startsWith(KEY_NAME_STARTER)) {
                return {
                    type: Types.objectKey,
                    keyName: token.data.text.substring(1) 
                };
            } else {
                return this.processors.noise();
            }
        },
        [BlockTypes.paragraph](token) {
            return token.inner.map(token => this.processToken(token));
        },
        [BlockTypes.code](token) {
            return {
                type: Types.primitiveLiteral,
                literal: token.text,
                typeHint: 'string'
            };
        },
        [BlockTypes.listStart](token) {
            const innerElements = token.inner.map(token => this.processToken(token));
    
            if (token.ordered) {
                return {
                    type: Types.list,
                    elements: innerElements
                }
            } else {
                return singleFlatten(innerElements.map(el => el.elements));
            }
        },
        [BlockTypes.listItemStart](token) {
            const innerElements = singleFlatten(token.inner)
                .map(token => this.processToken(token));
    
            return {
                type: Types.listItem,
                elements: innerElements
            };
        },
        [BlockTypes.table](token) {
            const processCell = cell => cell.map(contents => this.processToken(contents));
    
            const header = token.inner.header.map(processCell);
            
            const rows = token.inner.rows.map(row => row.map(processCell));
    
            return {
                type: Types.table,
                header,
                rows
            };
        },
        [BlockTypes.heading](token) {
            return {
                type: Types.contextStart,
                elements: token.inner.map(element => this.processToken(element))
            };
        },
        [BlockTypes.space]() {
            return {
                type: Types.space
            };
        }
    },
    processToken(token) {
        const isSignificantToken = Object.prototype.hasOwnProperty.call(this.processors, token.type);
    
        return isSignificantToken ? this.processors[token.type].call(this, token) : this.processors.noise();
    },
    processContext(context) {
        return {
            elements: singleFlatten(context.elements.map(element => this.processToken(element))),
            childContexts: context.childContexts.map(context => this.processContext(context)),
            depth: context.depth,
            heading: context.heading ? this.processToken(context.heading) : null
        };
    }
};

module.exports = {
    Types,
    lex(topLevelContext) {
        const lexer = Object.create(Lexer);
        lexer.Lexer(topLevelContext);

        return lexer.lex();
    } 
};
