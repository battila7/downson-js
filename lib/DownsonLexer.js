const BlockLexer = require('./BlockLexer');
const InlineLexer = require('./InlineLexer');

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

const processors = {
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
            return this.noise();
        }
    },
    [BlockTypes.paragraph](token) {
        return token.inner.map(processToken);
    },
    [BlockTypes.code](token) {
        return {
            type: Types.primitiveLiteral,
            literal: token.text,
            typeHint: 'string'
        };
    },
    [BlockTypes.listStart](token) {
        const innerElements = token.inner.map(processToken);

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
            .map(processToken);

        return {
            type: Types.listItem,
            elements: innerElements
        };
    },
    [BlockTypes.table](token) {
        const processCell = cell => cell.map(processToken);

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
            elements: token.inner.map(processToken)
        };
    },
    [BlockTypes.space]() {
        return {
            type: Types.space
        };
    }
};

function processToken(token) {
    const isSignificantToken = Object.prototype.hasOwnProperty.call(processors, token.type);

    return isSignificantToken ? processors[token.type](token) : processors.noise();
}

function processContext(context) {
    return {
        elements: singleFlatten(context.elements.map(processToken)),
        childContexts: context.childContexts.map(processContext),
        depth: context.depth,
        heading: context.heading ? processToken(context.heading) : null
    };
}

module.exports = {
    lex: processContext,  
    Types
};
