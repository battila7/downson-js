const InlineLexer = require('./InlineLexer');

/**
 * Parsing & Compiling
 */

function Parser(options) {
    this.tokens = [];
    this.token = null;
    this.options = options;
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
    this.inline = Object.create(InlineLexer);
    this.inline.InlineLexer(this.options);

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

module.exports = Parser;
