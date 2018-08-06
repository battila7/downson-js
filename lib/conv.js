/**
 * marked - a markdown parser
 * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/markedjs/marked
 */

;(function(root) {
    'use strict';
    
    /**
     * Block-Level Grammar
     */
    
    var block = {
      newline: /^\n+/,
      code: /^( {4}[^\n]+\n*)+/,
      fences: noop,
      hr: /^ {0,3}((?:- *){3,}|(?:_ *){3,}|(?:\* *){3,})(?:\n+|$)/,
      heading: /^ *(#{1,6}) *([^\n]+?) *(?:#+ *)?(?:\n+|$)/,
      nptable: noop,
      blockquote: /^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/,
      list: /^( *)(bull) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1bull )\n*|\s*$)/,
      html: '^ {0,3}(?:' // optional indentation
        + '<(script|pre|style)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)' // (1)
        + '|comment[^\\n]*(\\n+|$)' // (2)
        + '|<\\?[\\s\\S]*?\\?>\\n*' // (3)
        + '|<![A-Z][\\s\\S]*?>\\n*' // (4)
        + '|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>\\n*' // (5)
        + '|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:\\n{2,}|$)' // (6)
        + '|<(?!script|pre|style)([a-z][\\w-]*)(?:attribute)*? */?>(?=\\h*\\n)[\\s\\S]*?(?:\\n{2,}|$)' // (7) open tag
        + '|</(?!script|pre|style)[a-z][\\w-]*\\s*>(?=\\h*\\n)[\\s\\S]*?(?:\\n{2,}|$)' // (7) closing tag
        + ')',
      def: /^ {0,3}\[(label)\]: *\n? *<?([^\s>]+)>?(?:(?: +\n? *| *\n *)(title))? *(?:\n+|$)/,
      table: noop,
      lheading: /^([^\n]+)\n *(=|-){2,} *(?:\n+|$)/,
      paragraph: /^([^\n]+(?:\n(?!hr|heading|lheading| {0,3}>|<\/?(?:tag)(?: +|\n|\/?>)|<(?:script|pre|style|!--))[^\n]+)*)/,
      text: /^[^\n]+/
    };
    
    block._label = /(?!\s*\])(?:\\[\[\]]|[^\[\]])+/;
    block._title = /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/;
    block.def = edit(block.def)
      .replace('label', block._label)
      .replace('title', block._title)
      .getRegex();
    
    block.bullet = /(?:[*+-]|\d+\.)/;
    block.item = /^( *)(bull) [^\n]*(?:\n(?!\1bull )[^\n]*)*/;
    block.item = edit(block.item, 'gm')
      .replace(/bull/g, block.bullet)
      .getRegex();
    
    block.list = edit(block.list)
      .replace(/bull/g, block.bullet)
      .replace('hr', '\\n+(?=\\1?(?:(?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$))')
      .replace('def', '\\n+(?=' + block.def.source + ')')
      .getRegex();
    
    block._tag = 'address|article|aside|base|basefont|blockquote|body|caption'
      + '|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption'
      + '|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe'
      + '|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option'
      + '|p|param|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr'
      + '|track|ul';
    block._comment = /<!--(?!-?>)[\s\S]*?-->/;
    block.html = edit(block.html, 'i')
      .replace('comment', block._comment)
      .replace('tag', block._tag)
      .replace('attribute', / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/)
      .getRegex();
    
    block.paragraph = edit(block.paragraph)
      .replace('hr', block.hr)
      .replace('heading', block.heading)
      .replace('lheading', block.lheading)
      .replace('tag', block._tag) // pars can be interrupted by type (6) html blocks
      .getRegex();
    
    block.blockquote = edit(block.blockquote)
      .replace('paragraph', block.paragraph)
      .getRegex();
    
    /**
     * Normal Block Grammar
     */
    
    block.normal = merge({}, block);
    
    /**
     * GFM Block Grammar
     */
    
    block.gfm = merge({}, block.normal, {
      fences: /^ *(`{3,}|~{3,})[ \.]*(\S+)? *\n([\s\S]*?)\n? *\1 *(?:\n+|$)/,
      paragraph: /^/,
      heading: /^ *(#{1,6}) +([^\n]+?) *#* *(?:\n+|$)/
    });
    
    block.gfm.paragraph = edit(block.paragraph)
      .replace('(?!', '(?!'
        + block.gfm.fences.source.replace('\\1', '\\2') + '|'
        + block.list.source.replace('\\1', '\\3') + '|')
      .getRegex();
    
    /**
     * GFM + Tables Block Grammar
     */
    
    block.tables = merge({}, block.gfm, {
      nptable: /^ *([^|\n ].*\|.*)\n *([-:]+ *\|[-| :]*)(?:\n((?:.*[^>\n ].*(?:\n|$))*)\n*|$)/,
      table: /^ *\|(.+)\n *\|?( *[-:]+[-| :]*)(?:\n((?: *[^>\n ].*(?:\n|$))*)\n*|$)/
    });
    
    /**
     * Pedantic grammar
     */
    
    block.pedantic = merge({}, block.normal, {
      html: edit(
        '^ *(?:comment *(?:\\n|\\s*$)'
        + '|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)' // closed tag
        + '|<tag(?:"[^"]*"|\'[^\']*\'|\\s[^\'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))')
        .replace('comment', block._comment)
        .replace(/tag/g, '(?!(?:'
          + 'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub'
          + '|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)'
          + '\\b)\\w+(?!:|[^\\w\\s@]*@)\\b')
        .getRegex(),
      def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/
    });
    
    /**
     * Block Lexer
     */
    
    function Lexer(options) {
      this.tokens = [];
      this.tokens.links = Object.create(null);
      this.options = options || marked.defaults;
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
    }
    
    /**
     * Expose Block Rules
     */
    
    Lexer.rules = block;
    
    /**
     * Static Lex Method
     */
    
    Lexer.lex = function(src, options) {
      var lexer = new Lexer(options);
      return lexer.lex(src);
    };
    
    /**
     * Preprocessing
     */
    
    Lexer.prototype.lex = function(src) {
      src = src
        .replace(/\r\n|\r/g, '\n')
        .replace(/\t/g, '    ')
        .replace(/\u00a0/g, ' ')
        .replace(/\u2424/g, '\n');
    
      return this.token(src, true);
    };
    
    /**
     * Lexing
     */
    
    Lexer.prototype.token = function(src, top) {
      src = src.replace(/^ +$/gm, '');
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
          isordered,
          istask,
          ischecked;
    
      while (src) {
        // newline
        if (cap = this.rules.newline.exec(src)) {
          src = src.substring(cap[0].length);
          if (cap[0].length > 1) {
            this.tokens.push({
              type: 'space'
            });
          }
        }
    
        // code
        if (cap = this.rules.code.exec(src)) {
          src = src.substring(cap[0].length);
          cap = cap[0].replace(/^ {4}/gm, '');
          this.tokens.push({
            type: 'code',
            text: !this.options.pedantic
              ? rtrim(cap, '\n')
              : cap
          });
          continue;
        }
    
        // fences (gfm)
        if (cap = this.rules.fences.exec(src)) {
          src = src.substring(cap[0].length);
          this.tokens.push({
            type: 'code',
            lang: cap[2],
            text: cap[3] || ''
          });
          continue;
        }
    
        // heading
        if (cap = this.rules.heading.exec(src)) {
          src = src.substring(cap[0].length);
          this.tokens.push({
            type: 'heading',
            depth: cap[1].length,
            text: cap[2]
          });
          continue;
        }
    
        // table no leading pipe (gfm)
        if (top && (cap = this.rules.nptable.exec(src))) {
          item = {
            type: 'table',
            header: splitCells(cap[1].replace(/^ *| *\| *$/g, '')),
            align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
            cells: cap[3] ? cap[3].replace(/\n$/, '').split('\n') : []
          };
    
          if (item.header.length === item.align.length) {
            src = src.substring(cap[0].length);
    
            for (i = 0; i < item.align.length; i++) {
              if (/^ *-+: *$/.test(item.align[i])) {
                item.align[i] = 'right';
              } else if (/^ *:-+: *$/.test(item.align[i])) {
                item.align[i] = 'center';
              } else if (/^ *:-+ *$/.test(item.align[i])) {
                item.align[i] = 'left';
              } else {
                item.align[i] = null;
              }
            }
    
            for (i = 0; i < item.cells.length; i++) {
              item.cells[i] = splitCells(item.cells[i], item.header.length);
            }
    
            this.tokens.push(item);
    
            continue;
          }
        }
    
        // hr
        if (cap = this.rules.hr.exec(src)) {
          src = src.substring(cap[0].length);
          this.tokens.push({
            type: 'hr'
          });
          continue;
        }
    
        // blockquote
        if (cap = this.rules.blockquote.exec(src)) {
          src = src.substring(cap[0].length);
    
          this.tokens.push({
            type: 'blockquote_start'
          });
    
          cap = cap[0].replace(/^ *> ?/gm, '');
    
          // Pass `top` to keep the current
          // "toplevel" state. This is exactly
          // how markdown.pl works.
          this.token(cap, top);
    
          this.tokens.push({
            type: 'blockquote_end'
          });
    
          continue;
        }
    
        // list
        if (cap = this.rules.list.exec(src)) {
          src = src.substring(cap[0].length);
          bull = cap[2];
          isordered = bull.length > 1;
    
          listStart = {
            type: 'list_start',
            ordered: isordered,
            start: isordered ? +bull : '',
            loose: false
          };
    
          this.tokens.push(listStart);
    
          // Get each top-level item.
          cap = cap[0].match(this.rules.item);
    
          listItems = [];
          next = false;
          l = cap.length;
          i = 0;
    
          for (; i < l; i++) {
            item = cap[i];
    
            // Remove the list item's bullet
            // so it is seen as the next token.
            space = item.length;
            item = item.replace(/^ *([*+-]|\d+\.) +/, '');
    
            // Outdent whatever the
            // list item contains. Hacky.
            if (~item.indexOf('\n ')) {
              space -= item.length;
              item = !this.options.pedantic
                ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
                : item.replace(/^ {1,4}/gm, '');
            }
    
            // Determine whether the next list item belongs here.
            // Backpedal if it does not belong in this list.
            if (this.options.smartLists && i !== l - 1) {
              b = block.bullet.exec(cap[i + 1])[0];
              if (bull !== b && !(bull.length > 1 && b.length > 1)) {
                src = cap.slice(i + 1).join('\n') + src;
                i = l - 1;
              }
            }
    
            // Determine whether item is loose or not.
            // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
            // for discount behavior.
            loose = next || /\n\n(?!\s*$)/.test(item);
            if (i !== l - 1) {
              next = item.charAt(item.length - 1) === '\n';
              if (!loose) loose = next;
            }
    
            if (loose) {
              listStart.loose = true;
            }
    
            // Check for task list items
            istask = /^\[[ xX]\] /.test(item);
            ischecked = undefined;
            if (istask) {
              ischecked = item[1] !== ' ';
              item = item.replace(/^\[[ xX]\] +/, '');
            }
    
            t = {
              type: 'list_item_start',
              task: istask,
              checked: ischecked,
              loose: loose
            };
    
            listItems.push(t);
            this.tokens.push(t);
    
            // Recurse.
            this.token(item, false);
    
            this.tokens.push({
              type: 'list_item_end'
            });
          }
    
          if (listStart.loose) {
            l = listItems.length;
            i = 0;
            for (; i < l; i++) {
              listItems[i].loose = true;
            }
          }
    
          this.tokens.push({
            type: 'list_end'
          });
    
          continue;
        }
    
        // html
        if (cap = this.rules.html.exec(src)) {
          src = src.substring(cap[0].length);
          this.tokens.push({
            type: this.options.sanitize
              ? 'paragraph'
              : 'html',
            pre: !this.options.sanitizer
              && (cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style'),
            text: cap[0]
          });
          continue;
        }
    
        // def
        if (top && (cap = this.rules.def.exec(src))) {
          src = src.substring(cap[0].length);
          if (cap[3]) cap[3] = cap[3].substring(1, cap[3].length - 1);
          tag = cap[1].toLowerCase().replace(/\s+/g, ' ');
          if (!this.tokens.links[tag]) {
            this.tokens.links[tag] = {
              href: cap[2],
              title: cap[3]
            };
          }
          continue;
        }
    
        // table (gfm)
        if (top && (cap = this.rules.table.exec(src))) {
          item = {
            type: 'table',
            header: splitCells(cap[1].replace(/^ *| *\| *$/g, '')),
            align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
            cells: cap[3] ? cap[3].replace(/(?: *\| *)?\n$/, '').split('\n') : []
          };
    
          if (item.header.length === item.align.length) {
            src = src.substring(cap[0].length);
    
            for (i = 0; i < item.align.length; i++) {
              if (/^ *-+: *$/.test(item.align[i])) {
                item.align[i] = 'right';
              } else if (/^ *:-+: *$/.test(item.align[i])) {
                item.align[i] = 'center';
              } else if (/^ *:-+ *$/.test(item.align[i])) {
                item.align[i] = 'left';
              } else {
                item.align[i] = null;
              }
            }
    
            for (i = 0; i < item.cells.length; i++) {
              item.cells[i] = splitCells(
                item.cells[i].replace(/^ *\| *| *\| *$/g, ''),
                item.header.length);
            }
    
            this.tokens.push(item);
    
            continue;
          }
        }
    
        // lheading
        if (cap = this.rules.lheading.exec(src)) {
          src = src.substring(cap[0].length);
          this.tokens.push({
            type: 'heading',
            depth: cap[2] === '=' ? 1 : 2,
            text: cap[1]
          });
          continue;
        }
    
        // top-level paragraph
        if (top && (cap = this.rules.paragraph.exec(src))) {
          src = src.substring(cap[0].length);
          this.tokens.push({
            type: 'paragraph',
            text: cap[1].charAt(cap[1].length - 1) === '\n'
              ? cap[1].slice(0, -1)
              : cap[1]
          });
          continue;
        }
    
        // text
        if (cap = this.rules.text.exec(src)) {
          // Top-level should never reach here.
          src = src.substring(cap[0].length);
          this.tokens.push({
            type: 'text',
            text: cap[0]
          });
          continue;
        }
    
        if (src) {
          throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
        }
      }
    
      return this.tokens;
    };
    
    /**
     * Inline-Level Grammar
     */
    
    var inline = {
      escape: /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,
      autolink: /^<(scheme:[^\s\x00-\x1f<>]*|email)>/,
      url: noop,
      tag: '^comment'
        + '|^</[a-zA-Z][\\w:-]*\\s*>' // self-closing tag
        + '|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>' // open tag
        + '|^<\\?[\\s\\S]*?\\?>' // processing instruction, e.g. <?php ?>
        + '|^<![a-zA-Z]+\\s[\\s\\S]*?>' // declaration, e.g. <!DOCTYPE html>
        + '|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>', // CDATA section
      link: /^!?\[(label)\]\(href(?:\s+(title))?\s*\)/,
      reflink: /^!?\[(label)\]\[(?!\s*\])((?:\\[\[\]]?|[^\[\]\\])+)\]/,
      nolink: /^!?\[(?!\s*\])((?:\[[^\[\]]*\]|\\[\[\]]|[^\[\]])*)\](?:\[\])?/,
      strong: /^__([^\s][\s\S]*?[^\s])__(?!_)|^\*\*([^\s][\s\S]*?[^\s])\*\*(?!\*)|^__([^\s])__(?!_)|^\*\*([^\s])\*\*(?!\*)/,
      em: /^_([^\s][\s\S]*?[^\s_])_(?!_)|^_([^\s_][\s\S]*?[^\s])_(?!_)|^\*([^\s][\s\S]*?[^\s*])\*(?!\*)|^\*([^\s*][\s\S]*?[^\s])\*(?!\*)|^_([^\s_])_(?!_)|^\*([^\s*])\*(?!\*)/,
      code: /^(`+)\s*([\s\S]*?[^`]?)\s*\1(?!`)/,
      br: /^( {2,}|\\)\n(?!\s*$)/,
      del: noop,
      text: /^[\s\S]+?(?=[\\<!\[`*]|\b_| {2,}\n|$)/
    };
    
    inline._escapes = /\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/g;
    
    inline._scheme = /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/;
    inline._email = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/;
    inline.autolink = edit(inline.autolink)
      .replace('scheme', inline._scheme)
      .replace('email', inline._email)
      .getRegex();
    
    inline._attribute = /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/;
    
    inline.tag = edit(inline.tag)
      .replace('comment', block._comment)
      .replace('attribute', inline._attribute)
      .getRegex();
    
    inline._label = /(?:\[[^\[\]]*\]|\\[\[\]]?|`[^`]*`|[^\[\]\\])*?/;
    inline._href = /\s*(<(?:\\[<>]?|[^\s<>\\])*>|(?:\\[()]?|\([^\s\x00-\x1f\\]*\)|[^\s\x00-\x1f()\\])*?)/;
    inline._title = /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/;
    
    inline.link = edit(inline.link)
      .replace('label', inline._label)
      .replace('href', inline._href)
      .replace('title', inline._title)
      .getRegex();
    
    inline.reflink = edit(inline.reflink)
      .replace('label', inline._label)
      .getRegex();
    
    /**
     * Normal Inline Grammar
     */
    
    inline.normal = merge({}, inline);
    
    /**
     * Pedantic Inline Grammar
     */
    
    inline.pedantic = merge({}, inline.normal, {
      strong: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
      em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/,
      link: edit(/^!?\[(label)\]\((.*?)\)/)
        .replace('label', inline._label)
        .getRegex(),
      reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/)
        .replace('label', inline._label)
        .getRegex()
    });
    
    /**
     * GFM Inline Grammar
     */
    
    inline.gfm = merge({}, inline.normal, {
      escape: edit(inline.escape).replace('])', '~|])').getRegex(),
      url: edit(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/)
        .replace('email', inline._email)
        .getRegex(),
      _backpedal: /(?:[^?!.,:;*_~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_~)]+(?!$))+/,
      del: /^~+(?=\S)([\s\S]*?\S)~+/,
      text: edit(inline.text)
        .replace(']|', '~]|')
        .replace('|', '|https?://|ftp://|www\\.|[a-zA-Z0-9.!#$%&\'*+/=?^_`{\\|}~-]+@|')
        .getRegex()
    });
    
    /**
     * GFM + Line Breaks Inline Grammar
     */
    
    inline.breaks = merge({}, inline.gfm, {
      br: edit(inline.br).replace('{2,}', '*').getRegex(),
      text: edit(inline.gfm.text).replace('{2,}', '*').getRegex()
    });
    
    /**
     * Inline Lexer & Compiler
     */
    
    function InlineLexer(links, options) {
      this.options = options || marked.defaults;
      this.links = links;
      this.rules = inline.normal;
    
      if (!this.links) {
        throw new Error('Tokens array requires a `links` property.');
      }
    
      if (this.options.pedantic) {
        this.rules = inline.pedantic;
      } else if (this.options.gfm) {
        if (this.options.breaks) {
          this.rules = inline.breaks;
        } else {
          this.rules = inline.gfm;
        }
      }
    }
    
    /**
     * Expose Inline Rules
     */
    
    InlineLexer.rules = inline;
    
    /**
     * Static Lexing/Compiling Method
     */
    
    InlineLexer.output = function(src, links, options) {
      var inline = new InlineLexer(links, options);
      return inline.output(src);
    };
    
    /**
     * Lexing/Compiling
     */
    
    InlineLexer.prototype.output = function(src) {
      var out = '',
          link,
          text,
          href,
          title,
          cap,
          prevCapZero;

      var tokens = [];
    
      while (src) {
        // escape
        if (cap = this.rules.escape.exec(src)) {
          src = src.substring(cap[0].length);

          tokens.push({
              type: 'escape',
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
              type: 'autolink',
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
              type: 'url (gfm)',
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
              type: 'tag',
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
              title = '';
            }
          } else {
            title = cap[3] ? cap[3].slice(1, -1) : '';
          }
          href = href.trim().replace(/^<([\s\S]*)>$/, '$1');

          tokens.push({
            type: 'link',
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
          link = (cap[2] || cap[1]).replace(/\s+/g, ' ');
          link = this.links[link.toLowerCase()];
          if (!link || !link.href) {
            tokens.push({
                type: 'reflink/nolink',
                data: {
                    text: cap[0].charAt(0)
                }
            });
            src = cap[0].substring(1) + src;
            continue;
          }
          this.inLink = true;
          tokens.push({
              type: 'reflink/nolink',
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
              type: 'strong',
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
              type: 'em',
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
              type: 'code',
              data: {
                  text:escape(cap[2].trim(), true)
              }
          });

          continue;
        }
    
        // br
        if (cap = this.rules.br.exec(src)) {
          src = src.substring(cap[0].length);
          tokens.push({
              type: 'br'
          });
          continue;
        }
    
        // del (gfm)
        if (cap = this.rules.del.exec(src)) {
          src = src.substring(cap[0].length);
          tokens.push({
              type: 'del (gfm)'
          });
          continue;
        }
    
        // text
        if (cap = this.rules.text.exec(src)) {
          src = src.substring(cap[0].length);
          tokens.push({
              type: 'text',
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
    };
    
    InlineLexer.escapes = function(text) {
      return text ? text.replace(InlineLexer.rules._escapes, '$1') : text;
    }
    
    /**
     * Smartypants Transformations
     */
    
    InlineLexer.prototype.smartypants = function(text) {
      if (!this.options.smartypants) return text;
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
    };
    
    /**
     * Mangle Links
     */
    
    InlineLexer.prototype.mangle = function(text) {
      if (!this.options.mangle) return text;
      var out = '',
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
    };
    
    /**
     * Parsing & Compiling
     */
    
    function Parser(options) {
      this.tokens = [];
      this.token = null;
      this.options = options || marked.defaults;
    }
    
    /**
     * Static Parse Method
     */
    
    Parser.parse = function(src, options) {
      var parser = new Parser(options);
      return parser.parse(src);
    };
    
    /**
     * Parse Loop
     */
    
    Parser.prototype.parse = function(src) {
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
    
    Parser.prototype.next = function() {
      return this.token = this.tokens.pop();
    };
    
    /**
     * Preview Next Token
     */
    
    Parser.prototype.peek = function() {
      return this.tokens[this.tokens.length - 1] || 0;
    };
    
    /**
     * Parse Text Tokens
     */
    
    Parser.prototype.parseText = function() {
      var body = this.token.text;
    
      while (this.peek().type === 'text') {
        body += '\n' + this.next().text;
      }
    
      return this.inline.output(body);
    };
    
    /**
     * Parse Current Token
     */
    
    Parser.prototype.tok = function() {
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
      return html.replace(/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig, function(_, n) {
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
        replace: function(name, val) {
          val = val.source || val;
          val = val.replace(/(^|[^\[])\^/g, '$1');
          regex = regex.replace(name, val);
          return this;
        },
        getRegex: function() {
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
    
    function noop() {}
    noop.exec = noop;
    
    function merge(obj) {
      var i = 1,
          target,
          key;
    
      for (; i < arguments.length; i++) {
        target = arguments[i];
        for (key in target) {
          if (Object.prototype.hasOwnProperty.call(target, key)) {
            obj[key] = target[key];
          }
        }
      }
    
      return obj;
    }
    
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
    
    /**
     * Conv
     */
    function conv(src, opt) {
        // throw error in case of non string input
        if (typeof src === 'undefined' || src === null) {
          throw new Error('marked(): input parameter is undefined or null');
        }
        if (typeof src !== 'string') {
          throw new Error('marked(): input parameter is of type '
            + Object.prototype.toString.call(src) + ', string expected');
        }
      
        try {
          if (opt) opt = merge({}, marked.defaults, opt);

          const lexerTokens = Lexer.lex(src, opt);

          console.log(lexerTokens);

          const parseTokens = Parser.parse(lexerTokens, opt);

          console.log('\n\n');
          console.log(JSON.stringify(parseTokens));

          //return Parser.parse(Lexer.lex(src, opt), opt);
        } catch (e) {
          e.message += '\nPlease report this to https://github.com/markedjs/marked.';
          if ((opt || marked.defaults).silent) {
            return '<p>An error occurred:</p><pre>'
              + escape(e.message + '', true)
              + '</pre>';
          }
          throw e;
        }
      }

    /**
     * Marked
     */
    
    function marked(src, opt, callback) {
      // throw error in case of non string input
      if (typeof src === 'undefined' || src === null) {
        throw new Error('marked(): input parameter is undefined or null');
      }
      if (typeof src !== 'string') {
        throw new Error('marked(): input parameter is of type '
          + Object.prototype.toString.call(src) + ', string expected');
      }
    
      if (callback || typeof opt === 'function') {
        if (!callback) {
          callback = opt;
          opt = null;
        }
    
        opt = merge({}, marked.defaults, opt || {});
    
        var highlight = opt.highlight,
            tokens,
            pending,
            i = 0;
    
        try {
          tokens = Lexer.lex(src, opt)
        } catch (e) {
          return callback(e);
        }
    
        pending = tokens.length;
    
        var done = function(err) {
          if (err) {
            opt.highlight = highlight;
            return callback(err);
          }
    
          var out;
    
          try {
            out = Parser.parse(tokens, opt);
          } catch (e) {
            err = e;
          }
    
          opt.highlight = highlight;
    
          return err
            ? callback(err)
            : callback(null, out);
        };
    
        if (!highlight || highlight.length < 3) {
          return done();
        }
    
        delete opt.highlight;
    
        if (!pending) return done();
    
        for (; i < tokens.length; i++) {
          (function(token) {
            if (token.type !== 'code') {
              return --pending || done();
            }
            return highlight(token.text, token.lang, function(err, code) {
              if (err) return done(err);
              if (code == null || code === token.text) {
                return --pending || done();
              }
              token.text = code;
              token.escaped = true;
              --pending || done();
            });
          })(tokens[i]);
        }
    
        return;
      }
      try {
        if (opt) opt = merge({}, marked.defaults, opt);
        return Parser.parse(Lexer.lex(src, opt), opt);
      } catch (e) {
        e.message += '\nPlease report this to https://github.com/markedjs/marked.';
        if ((opt || marked.defaults).silent) {
          return '<p>An error occurred:</p><pre>'
            + escape(e.message + '', true)
            + '</pre>';
        }
        throw e;
      }
    }
    
    /**
     * Options
     */
    
    marked.options =
    marked.setOptions = function(opt) {
      merge(marked.defaults, opt);
      return marked;
    };
    
    marked.getDefaults = function () {
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
    
    marked.defaults = marked.getDefaults();
    
    /**
     * Expose
     */
    
    marked.Parser = Parser;
    marked.parser = Parser.parse;
    
    marked.Lexer = Lexer;
    marked.lexer = Lexer.lex;
    
    marked.InlineLexer = InlineLexer;
    marked.inlineLexer = InlineLexer.output;
    
    marked.parse = marked;
    
    marked.conv = conv;

    if (typeof module !== 'undefined' && typeof exports === 'object') {
      module.exports = marked;
    } else if (typeof define === 'function' && define.amd) {
      define(function() { return marked; });
    } else {
      root.marked = marked;
    }
    })(this || (typeof window !== 'undefined' ? window : global));
    