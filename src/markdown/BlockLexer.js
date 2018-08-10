const { block } = require('./Grammar');
const { splitCells, rtrim } = require('../Utility');

const NEWLINE = '\n';
const SPACE = ' ';
const EMPTY = '';

const Alignment = {
    right: 'right',
    center: 'center',
    left: 'left',
    unset: null
};

const Patterns = {
    newlines: /\r\n|\r/g,
    tabs: /\t/g,
    noBreakSpace:  /\u00a0/g,
    symbolForNewline: /\u2424/g,
    excessiveSpaces: /^ +$/gm,

    code: {
        indentation: /^ {4}/gm
    },

    blockquote: {
        start: /^ *> ?/gm
    },

    table: {
        alignment: {
            right: /^ *-+: *$/,
            center: /^ *:-+: *$/,
            left: /^ *:-+ *$/
        }
    }
};

const Types = {
    space: 'space',
    code: 'code',
    heading: 'heading',
    table: 'table',
    thematicBreak: 'hr',
    blockquoteStart: 'blockquote_start',
    blockquoteEnd: 'blockquote_end',
    listStart: 'list_start',
    listItemStart: 'list_item_start',
    listItemEnd: 'list_item_end',
    listEnd: 'list_end',
    paragraph: 'paragraph',
    html: 'html',
    table: 'table',
    text: 'text'
};

const BlockLexer = {
    Types,
    BlockLexer(options) {
        this.options = options;
        this.rules = block.normal;

        if (this.options.pedantic) {
            this.rules = block.pedantic;
        } else if (this.options.gfm) {
            if (this.options.tables) {
                this.rules = block.tables;
            } else {
                this.rules = block.gfm;
            }
        }
    },
    lex(source) {
        const replacedSource = source
            .replace(Patterns.newlines, NEWLINE)
            .replace(Patterns.tabs, SPACE.repeat(4))
            .replace(Patterns.noBreakSpace, SPACE.repeat(1))
            .replace(Patterns.symbolForNewline, NEWLINE);

        const tokens = [];
        tokens.links = Object.create(null);
    
        return this.token(replacedSource, true, tokens);
    },
    determineCellAlignment(cell) {
        if (Patterns.table.alignment.right.test(cell)) {
            return Alignment.right;
        } else if (Patterns.table.alignment.center.test(cell)) {
            return Alignment.center;
        } else if (Patterns.table.alignment.left.test(cell)) {
            return Alignment.left;
        } else {
            return Alignment.unset;
        }
    },
    token(src, isTop, tokens) {
        src = src.replace(Patterns.excessiveSpaces, EMPTY);
        var next,
            loose,
            cap,
            bull,
            b,
            item,
            listStart,
            listItems,
            t,
            space,
            i,
            tag,
            l,
            isOrdered,
            isTask,
            isChecked;
    
        while (src) {
            // newline
            if (cap = this.rules.newline.exec(src)) {
                src = src.substring(cap[0].length);

                if (cap[0].length > 1) {
                    tokens.push({
                        type: Types.space
                    });
                }
            }
    
            // code
            if (cap = this.rules.code.exec(src)) {
                src = src.substring(cap[0].length);
                cap = cap[0].replace(Patterns.code.indentation, EMPTY);

                tokens.push({
                    type: Types.code,
                    text: !this.options.pedantic
                        ? rtrim(cap, NEWLINE)
                        : cap
                });

                continue;
            }
    
            // fences (gfm)
            if (cap = this.rules.fences.exec(src)) {
                src = src.substring(cap[0].length);

                tokens.push({
                    type: Types.code,
                    lang: cap[2],
                    text: cap[3] || EMPTY
                });

                continue;
            }
    
            // heading
            if (cap = this.rules.heading.exec(src)) {
                src = src.substring(cap[0].length);
                tokens.push({
                    type: Types.heading,
                    depth: cap[1].length,
                    text: cap[2]
                });
                continue;
            }
    
            // table no leading pipe (gfm)
            if (isTop && (cap = this.rules.nptable.exec(src))) {
                item = {
                    type: Types.table,
                    header: splitCells(cap[1].replace(/^ *| *\| *$/g, EMPTY)),
                    align: cap[2].replace(/^ *|\| *$/g, EMPTY).split(/ *\| */),
                    cells: cap[3] ? cap[3].replace(/\n$/, EMPTY).split(NEWLINE) : []
                };
    
                if (item.header.length === item.align.length) {
                    src = src.substring(cap[0].length);
    
                    item.align = item.align.map(cell => this.determineCellAlignment(cell));

                    item.cells = item.cells.map(cell => splitCells(cell, item.header.length));
    
                    tokens.push(item);
    
                    continue;
                }
            }
    
            // hr
            if (cap = this.rules.hr.exec(src)) {
                src = src.substring(cap[0].length);

                tokens.push({
                    type: Types.thematicBreak
                });

                continue;
            }
    
            // blockquote
            if (cap = this.rules.blockquote.exec(src)) {
                src = src.substring(cap[0].length);
    
                tokens.push({
                    type: Types.blockquoteStart
                });
    
                cap = cap[0].replace(Patterns.blockquote.start, EMPTY);
    
                // Pass `isTop` to keep the current
                // "toplevel" state. This is exactly
                // how markdown.pl works.
                tokens = this.token(cap, isTop, tokens);
    
                tokens.push({
                    type: Types.blockquoteEnd
                });
    
                continue;
            }
    
            // list
            if (cap = this.rules.list.exec(src)) {
                src = src.substring(cap[0].length);
                bull = cap[2];
                isOrdered = bull.length > 1;
    
                listStart = {
                    type: Types.listStart,
                    ordered: isOrdered,
                    start: isOrdered ? +bull : EMPTY,
                    loose: false
                };
    
                tokens.push(listStart);
    
                // Get each top-level item.
                cap = cap[0].match(this.rules.item);
    
                listItems = [];
                next = false;
                l = cap.length;
                i = 0;
    
                for (; i < l; i++) {
                    item = cap[i];
    
                    // Remove the list item's bullet so it is seen as the next token.
                    space = item.length;
                    item = item.replace(/^ *([*+-]|\d+\.) +/, EMPTY);
    
                    // Outdent whatever the list item contains. Hacky.
                    if (~item.indexOf('\n ')) {
                        space -= item.length;
                        item = !this.options.pedantic
                            ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), EMPTY)
                            : item.replace(/^ {1,4}/gm, '');
                    }
    
                    // Determine whether the next list item belongs here.
                    // Backpedal if it does not belong in this list.
                    if (this.options.smartLists && i !== l - 1) {
                        b = block.bullet.exec(cap[i + 1])[0];

                        if (bull !== b && !(bull.length > 1 && b.length > 1)) {
                            src = cap.slice(i + 1).join(NEWLINE) + src;
                            i = l - 1;
                        }
                    }
    
                    // Determine whether item is loose or not.
                    // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
                    // for discount behavior.
                    loose = next || /\n\n(?!\s*$)/.test(item);
                    if (i !== l - 1) {
                        next = item.charAt(item.length - 1) === NEWLINE;
                        if (!loose) {
                            loose = next;
                        }
                    }
    
                    if (loose) {
                        listStart.loose = true;
                    }
    
                    // Check for task list items
                    isTask = /^\[[ xX]\] /.test(item);
                    isChecked = undefined;
                    if (isTask) {
                        isChecked = item[1] !== ' ';
                        item = item.replace(/^\[[ xX]\] +/, EMPTY);
                    }
    
                    t = {
                        type: Types.listItemStart,
                        task: isTask,
                        checked: isChecked,
                        loose: loose
                    };
    
                    listItems.push(t);
                    tokens.push(t);
    
                    // Recurse.
                    tokens = this.token(item, false, tokens);
    
                    tokens.push({
                        type: Types.listItemEnd
                    });
                }
    
                if (listStart.loose) {
                    l = listItems.length;
                    i = 0;
                    for (; i < l; i++) {
                        listItems[i].loose = true;
                    }
                }
    
                tokens.push({
                    type: Types.listEnd
                });
    
                continue;
            }
    
            // html
            if (cap = this.rules.html.exec(src)) {
                src = src.substring(cap[0].length);

                tokens.push({
                    type: this.options.sanitize
                        ? Types.paragraph
                        : Types.html,
                    pre: !this.options.sanitizer
                        && (cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style'),
                    text: cap[0]
                });
                
                continue;
            }
    
            // def
            if (isTop && (cap = this.rules.def.exec(src))) {
                src = src.substring(cap[0].length);

                if (cap[3]) {
                    cap[3] = cap[3].substring(1, cap[3].length - 1);
                }

                tag = cap[1].toLowerCase().replace(/\s+/g, SPACE);
                if (!tokens.links[tag]) {
                    tokens.links[tag] = {
                        href: cap[2],
                        title: cap[3]
                    };
                }

                continue;
            }
    
            // table (gfm)
            if (isTop && (cap = this.rules.table.exec(src))) {
                item = {
                    type: Types.table,
                    header: splitCells(cap[1].replace(/^ *| *\| *$/g, EMPTY)),
                    align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
                    cells: cap[3] ? cap[3].replace(/(?: *\| *)?\n$/, EMPTY).split(NEWLINE) : []
                };
    
                if (item.header.length === item.align.length) {
                    src = src.substring(cap[0].length);
    
                    item.align = item.align.map(cell => this.determineCellAlignment(cell));

                    item.cells = item.cells.map(cell => splitCells(cell.replace(/^ *\| *| *\| *$/g, EMPTY), item.header.length));
    
                    tokens.push(item);
    
                    continue;
                }
            }
    
            // lheading
            if (cap = this.rules.lheading.exec(src)) {
                src = src.substring(cap[0].length);

                const isLevelOne = cap[2] == '=';

                tokens.push({
                    type: Types.heading,
                    depth: isLevelOne ? 1 : 2,
                    text: cap[1]
                });

                continue;
            }
    
            // top-level paragraph
            if (isTop && (cap = this.rules.paragraph.exec(src))) {
                src = src.substring(cap[0].length);

                tokens.push({
                    type: Types.paragraph,
                    text: cap[1].charAt(cap[1].length - 1) === NEWLINE
                        ? cap[1].slice(0, -1)
                        : cap[1]
                });

                continue;
            }
    
            // text
            if (cap = this.rules.text.exec(src)) {
                // Top-level should never reach here.
                src = src.substring(cap[0].length);

                tokens.push({
                    type: Types.text,
                    text: cap[0]
                });

                continue;
            }
    
            if (src) {
                throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
            }
        }
    
        return tokens;
    }
}

module.exports = BlockLexer;
