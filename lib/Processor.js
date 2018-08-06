const KEY_METADATA_SEPARATOR = ':';

const KEY_NAME_STARTER = '.';

const VALID_KEY_METADATA_HREFS = [
    'left',
    'right',
    'left:object',
    'right:object',
    'left:alias',
    'right:alias',
    'left:object:alias',
    'right:object:alias'
];

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
            type: 'noise'
        };
    },
    link(token) {
        switch (token.data.href) {
            case 'alias':
                return {
                    type: 'key alias',
                    alias: token.data.title
                };
            case 'ignore':
                return {
                    type: 'ignore alias'
                };
            case '$':
                return {
                    type: 'object terminator'
                };
            default:
                if (isLinkKeyMetadata(token.data.href)) {
                    return {
                        type: 'key metadata',
                        metadata: token.data.href.split(KEY_METADATA_SEPARATOR),
                        alias: token.data.title
                    };
                } else {
                    return {
                        type: 'primitive literal',
                        literal: token.data.cap[1],
                        typeHint: token.data.href,
                        valueOverride: token.data.title
                    };
                }
        }
    },
    text(token) {
        return {
            type: 'text',
            text: token.data.text
        };
    },
    strong(token) {
        if (token.data.text.startsWith(KEY_NAME_STARTER)) {
            return {
                type: 'object key',
                keyName: token.data.text.substring(1) 
            };
        } else {
            return this.noise();
        }
    },
    paragraph(token) {
        return token.inner.map(processToken);
    },
    code(token) {
        return {
            type: 'primitive literal',
            literal: token.text,
            typeHint: 'string'
        };
    },
    list_start(token) {
        const innerElements = token.inner.map(processToken);

        if (token.ordered) {
            return {
                type: 'list',
                elements: innerElements
            }
        } else {
            return singleFlatten(innerElements.map(el => el.elements));
        }
    },
    list_item_start(token) {
        const innerElements = singleFlatten(token.inner)
            .map(processToken);

        return {
            type: 'list item',
            elements: innerElements
        };
    },
    table(token) {
        const processCell = cell => cell.map(processToken);

        const header = token.inner.header.map(processCell);
        
        const rows = token.inner.rows.map(row => row.map(processCell));

        return {
            type: 'table',
            header,
            rows
        };
    },
    paragraph(token) {
        return token.inner.map(processToken);
    },
    heading(token) {
        return {
            type: 'context start',
            elements: token.inner.map(processToken)
        };
    },
    space() {
        return {
            type: 'space'
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

module.exports = function process(topLevelContext) {
    return processContext(topLevelContext);
};
