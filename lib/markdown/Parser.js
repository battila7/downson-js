const { Types } = require('./BlockLexer');
const InlineLexer = require('./InlineLexer');

const Parser = {
    Parser(options) {
        this.options = options;
        this.inline = Object.create(InlineLexer);
        this.inline.InlineLexer(this.options);
    },
    parse(src) {
        this.tokens = src.reverse();

        var out = []
        while (this.next()) {
            out.push(this.tok());
        }

        return out;
    },
    next() {
        return this.token = this.tokens.pop();
    },
    peek() {
        return this.tokens[this.tokens.length - 1] || 0;
    },
    parseText() {
        var body = this.token.text;
    
        while (this.peek().type === Types.text) {
            body += '\n' + this.next().text;
        }
    
        return this.inline.output(body);
    },
    tok() {
        switch (this.token.type) {
            case Types.space: {
                return this.token;
            }
            case Types.thematicBreak: {
                return this.token;
            }
            case Types.heading: {
                return Object.assign({}, this.token, { inner: this.inline.output(this.token.text) });
            }
            case Types.code: {
                return this.token;
            }
            case Types.table: {
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
            case Types.blockquoteStart: {
                var t = Object.assign({}, this.token);
    
                t.inner = [];
    
                while (this.next().type !== Types.blockquoteEnd) {
                    t.inner.push(this.tok());
                }
    
                return t;
            }
            case Types.listStart: {
                var t = Object.assign({}, this.token);
    
                t.inner = [];
    
                var ordered = this.token.ordered,
                    start = this.token.start;
    
                while (this.next().type !== Types.listEnd) {
                    t.inner.push(this.tok());
                }
    
                return t;
            }
            case Types.listItemStart: {
                var t = Object.assign({}, this.token);
                t.inner = [];
                var loose = this.token.loose;
    
                if (this.token.task) {
                    t.inner.push(this.token.checked);
                }
    
                while (this.next().type !== Types.listItemEnd) {
                    t.inner.push(!loose && this.token.type === Types.text
                        ? this.parseText()
                        : this.tok());
                }
    
                return t;
            }
            case Types.html: {
                // TODO parse inline content if parameter markdown=1
                return this.token.text;
            }
            case Types.paragraph: {
                return Object.assign({}, this.token, { inner: this.inline.output(this.token.text) });
            }
            case Types.text: {
                return this.parseText();
            }
        }
    }
};

module.exports = Parser;
