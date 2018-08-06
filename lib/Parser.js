const InlineLexer = require('./InlineLexer');

/**
 * Parsing & Compiling
 */

function Parser(options) {
    this.tokens = [];
    this.token = null;
    this.options = options || conv.defaults;
}

/**
 * Static Parse Method
 */

Parser.parse = function (src, options) {
    var parser = new Parser(options);
    return parser.parse(src);
};

/**
 * Parse Loop
 */

Parser.prototype.parse = function (src) {
    this.inline = new InlineLexer(src.links, this.options);

    this.tokens = src.reverse();

    var out = []
    while (this.next()) {
        out.push(this.tok());
    }

    return out;
};

/**
 * Next Token
 */

Parser.prototype.next = function () {
    return this.token = this.tokens.pop();
};

/**
 * Preview Next Token
 */

Parser.prototype.peek = function () {
    return this.tokens[this.tokens.length - 1] || 0;
};

/**
 * Parse Text Tokens
 */

Parser.prototype.parseText = function () {
    var body = this.token.text;

    while (this.peek().type === 'text') {
        body += '\n' + this.next().text;
    }

    return this.inline.output(body);
};

/**
 * Parse Current Token
 */

Parser.prototype.tok = function () {
    switch (this.token.type) {
        case 'space': {
            return this.token;
        }
        case 'hr': {
            return this.token;
        }
        case 'heading': {
            return Object.assign({}, this.token, { inner: this.inline.output(this.token.text) });
        }
        case 'code': {
            return this.token;
        }
        case 'table': {
            var header = '',
                body = '',
                i,
                row,
                cell,
                j;

            var t = Object.assign({}, this.token);
            t.inner = {};

            // header
            cell = '';
            t.inner.header = [];
            for (i = 0; i < this.token.header.length; i++) {
                t.inner.header.push(this.inline.output(this.token.header[i]));
            }

            t.inner.rows = [];
            for (i = 0; i < this.token.cells.length; i++) {
                row = this.token.cells[i];

                var rr = [];

                cell = '';
                for (j = 0; j < row.length; j++) {
                    rr.push(this.inline.output(row[j]));
                }

                t.inner.rows.push(rr);
            }
            return t;
        }
        case 'blockquote_start': {
            var t = Object.assign({}, this.token);

            t.inner = [];

            while (this.next().type !== 'blockquote_end') {
                t.inner.push(this.tok());
            }

            return t;
        }
        case 'list_start': {
            var t = Object.assign({}, this.token);

            t.inner = [];

            var ordered = this.token.ordered,
                start = this.token.start;

            while (this.next().type !== 'list_end') {
                t.inner.push(this.tok());
            }

            return t;
        }
        case 'list_item_start': {
            var t = Object.assign({}, this.token);
            t.inner = [];
            var loose = this.token.loose;

            if (this.token.task) {
                t.inner.push(this.token.checked);
            }

            while (this.next().type !== 'list_item_end') {
                t.inner.push(!loose && this.token.type === 'text'
                    ? this.parseText()
                    : this.tok());
            }

            return t;
        }
        case 'html': {
            // TODO parse inline content if parameter markdown=1
            return this.token.text;
        }
        case 'paragraph': {
            return Object.assign({}, this.token, { inner: this.inline.output(this.token.text) });
        }
        case 'text': {
            return this.parseText();
        }
    }
};

/**
 * Helpers
 */

function escape(html, encode) {
    return html
        .replace(!encode ? /&(?!#?\w+;)/g : /&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function unescape(html) {
    // explicitly match decimal, hex, and named HTML entities
    return html.replace(/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig, function (_, n) {
        n = n.toLowerCase();
        if (n === 'colon') return ':';
        if (n.charAt(0) === '#') {
            return n.charAt(1) === 'x'
                ? String.fromCharCode(parseInt(n.substring(2), 16))
                : String.fromCharCode(+n.substring(1));
        }
        return '';
    });
}

function edit(regex, opt) {
    regex = regex.source || regex;
    opt = opt || '';
    return {
        replace: function (name, val) {
            val = val.source || val;
            val = val.replace(/(^|[^\[])\^/g, '$1');
            regex = regex.replace(name, val);
            return this;
        },
        getRegex: function () {
            return new RegExp(regex, opt);
        }
    };
}

function resolveUrl(base, href) {
    if (!baseUrls[' ' + base]) {
        // we can ignore everything in base after the last slash of its path component,
        // but we might need to add _that_
        // https://tools.ietf.org/html/rfc3986#section-3
        if (/^[^:]+:\/*[^/]*$/.test(base)) {
            baseUrls[' ' + base] = base + '/';
        } else {
            baseUrls[' ' + base] = rtrim(base, '/', true);
        }
    }
    base = baseUrls[' ' + base];

    if (href.slice(0, 2) === '//') {
        return base.replace(/:[\s\S]*/, ':') + href;
    } else if (href.charAt(0) === '/') {
        return base.replace(/(:\/*[^/]*)[\s\S]*/, '$1') + href;
    } else {
        return base + href;
    }
}
var baseUrls = {};
var originIndependentUrl = /^$|^[a-z][a-z0-9+.-]*:|^[?#]/i;

function noop() { }
noop.exec = noop;

function splitCells(tableRow, count) {
    // ensure that every cell-delimiting pipe has a space
    // before it to distinguish it from an escaped pipe
    var row = tableRow.replace(/\|/g, function (match, offset, str) {
        var escaped = false,
            curr = offset;
        while (--curr >= 0 && str[curr] === '\\') escaped = !escaped;
        if (escaped) {
            // odd number of slashes means | is escaped
            // so we leave it alone
            return '|';
        } else {
            // add space before unescaped |
            return ' |';
        }
    }),
        cells = row.split(/ \|/),
        i = 0;

    if (cells.length > count) {
        cells.splice(count);
    } else {
        while (cells.length < count) cells.push('');
    }

    for (; i < cells.length; i++) {
        // leading or trailing whitespace is ignored per the gfm spec
        cells[i] = cells[i].trim().replace(/\\\|/g, '|');
    }
    return cells;
}

// Remove trailing 'c's. Equivalent to str.replace(/c*$/, '').
// /c*$/ is vulnerable to REDOS.
// invert: Remove suffix of non-c chars instead. Default falsey.
function rtrim(str, c, invert) {
    if (str.length === 0) {
        return '';
    }

    // Length of suffix matching the invert condition.
    var suffLen = 0;

    // Step left until we fail to match the invert condition.
    while (suffLen < str.length) {
        var currChar = str.charAt(str.length - suffLen - 1);
        if (currChar === c && !invert) {
            suffLen++;
        } else if (currChar !== c && invert) {
            suffLen++;
        } else {
            break;
        }
    }

    return str.substr(0, str.length - suffLen);
}

const conv = {};

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

module.exports = Parser;
