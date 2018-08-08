const { inline } = require('./Grammar');
const { escape } = require('../Utility');

const SPACE = ' ';
const EMPTY = '';

const Types = {
    escape: 'escape',
    autolink: 'autolink',
    urlGfm: 'url (gfm)',
    tag: 'tag',
    link: 'link',
    reflinkNolink: 'reflink/nolink',
    strong: 'strong',
    em: 'em',
    code: 'code',
    br: 'br',
    deleteGfm: 'del (gfm)',
    text: 'text'
};

const InlineLexer = {
    Types,
    InlineLexer(options) {
        this.options = options;
        this.rules = inline.normal;
    
        if (this.options.pedantic) {
            this.rules = inline.pedantic;
        } else if (this.options.gfm) {
            if (this.options.breaks) {
                this.rules = inline.breaks;
            } else {
                this.rules = inline.gfm;
            }
        }
    },
    output(src) {
        var out = EMPTY,
            link,
            text,
            href,
            title,
            cap,
            prevCapZero;

        const tokens = [];
    
        while (src) {
            // escape
            if (cap = this.rules.escape.exec(src)) {
                src = src.substring(cap[0].length);
    
                tokens.push({
                    type: Types.escape,
                    data: {
                        txt: cap[1]
                    }
                });
    
                out += cap[1];
                continue;
            }
    
            // autolink
            if (cap = this.rules.autolink.exec(src)) {
                src = src.substring(cap[0].length);
                if (cap[2] === '@') {
                    text = escape(this.mangle(cap[1]));
                    href = 'mailto:' + text;
                } else {
                    text = escape(cap[1]);
                    href = text;
                }
    
                tokens.push({
                    type: Types.autolink,
                    data: {
                        href,
                        text
                    }
                });
    
                continue;
            }
    
            // url (gfm)
            if (!this.inLink && (cap = this.rules.url.exec(src))) {
                do {
                    prevCapZero = cap[0];
                    cap[0] = this.rules._backpedal.exec(cap[0])[0];
                } while (prevCapZero !== cap[0]);
                src = src.substring(cap[0].length);
                if (cap[2] === '@') {
                    text = escape(cap[0]);
                    href = 'mailto:' + text;
                } else {
                    text = escape(cap[0]);
                    if (cap[1] === 'www.') {
                        href = 'http://' + text;
                    } else {
                        href = text;
                    }
                }
    
                tokens.push({
                    type: Types.urlGfm,
                    data: {
                        href,
                        text
                    }
                });
    
                continue;
            }
    
            // tag
            if (cap = this.rules.tag.exec(src)) {
                if (!this.inLink && /^<a /i.test(cap[0])) {
                    this.inLink = true;
                } else if (this.inLink && /^<\/a>/i.test(cap[0])) {
                    this.inLink = false;
                }
                src = src.substring(cap[0].length);
    
                tokens.push({
                    type: Types.tag,
                    data: {
                        text: this.options.sanitize
                            ? this.options.sanitizer
                                ? this.options.sanitizer(cap[0])
                                : escape(cap[0])
                            : cap[0]
                    }
                });
    
                continue;
            }
    
            // link
            if (cap = this.rules.link.exec(src)) {
                src = src.substring(cap[0].length);
                this.inLink = true;
                href = cap[2];
                if (this.options.pedantic) {
                    link = /^([^'"]*[^\s])\s+(['"])(.*)\2/.exec(href);
    
                    if (link) {
                        href = link[1];
                        title = link[3];
                    } else {
                        title = EMPTY;
                    }
                } else {
                    title = cap[3] ? cap[3].slice(1, -1) : EMPTY;
                }
                href = href.trim().replace(/^<([\s\S]*)>$/, '$1');
    
                tokens.push({
                    type: Types.link,
                    data: {
                        cap: cap,
                        href: InlineLexer.escapes(href),
                        title: InlineLexer.escapes(title)
                    }
                });
    
                this.inLink = false;
                continue;
            }
    
            // reflink, nolink
            if ((cap = this.rules.reflink.exec(src))
                || (cap = this.rules.nolink.exec(src))) {
                src = src.substring(cap[0].length);
                link = (cap[2] || cap[1]).replace(/\s+/g, SPACE);
                if (!link || !link.href) {
                    tokens.push({
                        type: Types.reflinkNolink,
                        data: {
                            text: cap[0].charAt(0)
                        }
                    });
                    src = cap[0].substring(1) + src;
                    continue;
                }
                this.inLink = true;
                tokens.push({
                    type: Types.reflinkNolink,
                    data: {
                        cap,
                        link
                    }
                });
                this.inLink = false;
                continue;
            }
    
            // strong
            if (cap = this.rules.strong.exec(src)) {
                src = src.substring(cap[0].length);
    
                tokens.push({
                    type: Types.strong,
                    data: {
                        text: cap[4] || cap[3] || cap[2] || cap[1]
                    }
                });
    
                continue;
            }
    
            // em
            if (cap = this.rules.em.exec(src)) {
                src = src.substring(cap[0].length);
    
                tokens.push({
                    type: Types.em,
                    data: {
                        text: cap[6] || cap[5] || cap[4] || cap[3] || cap[2] || cap[1]
                    }
                });
    
                continue;
            }
    
            // code
            if (cap = this.rules.code.exec(src)) {
                src = src.substring(cap[0].length);
    
                tokens.push({
                    type: Types.code,
                    data: {
                        text: escape(cap[2].trim(), true)
                    }
                });
    
                continue;
            }
    
            // br
            if (cap = this.rules.br.exec(src)) {
                src = src.substring(cap[0].length);
                tokens.push({
                    type: Types.br
                });
                continue;
            }
    
            // del (gfm)
            if (cap = this.rules.del.exec(src)) {
                src = src.substring(cap[0].length);
                tokens.push({
                    type: Types.deleteGfm
                });
                continue;
            }
    
            // text
            if (cap = this.rules.text.exec(src)) {
                src = src.substring(cap[0].length);
                tokens.push({
                    type: Types.text,
                    data: {
                        text: escape(this.smartypants(cap[0]))
                    }
                });
    
                continue;
            }
    
            if (src) {
                throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
            }
        }
    
        return tokens;
    },
    escapes(text) {
        return text ? text.replace(inline._escapes, '$1') : text;
    },
    smartypants(text) {
        if (!this.options.smartypants) {
            return text;
        }

        return text
            // em-dashes
            .replace(/---/g, '\u2014')
            // en-dashes
            .replace(/--/g, '\u2013')
            // opening singles
            .replace(/(^|[-\u2014/(\[{"\s])'/g, '$1\u2018')
            // closing singles & apostrophes
            .replace(/'/g, '\u2019')
            // opening doubles
            .replace(/(^|[-\u2014/(\[{\u2018\s])"/g, '$1\u201c')
            // closing doubles
            .replace(/"/g, '\u201d')
            // ellipses
            .replace(/\.{3}/g, '\u2026');
    },
    mangle(text) {
        if (!this.options.mangle) {
            return text;
        }

        var out = EMPTY,
            l = text.length,
            i = 0,
            ch;
    
        for (; i < l; i++) {
            ch = text.charCodeAt(i);

            if (Math.random() > 0.5) {
                ch = 'x' + ch.toString(16);
            }

            out += '&#' + ch + ';';
        }
    
        return out;
    }
};

module.exports = InlineLexer;
