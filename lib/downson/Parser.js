const { ambiguousSyntax, interpretationError } = require('./Failure');
const Converter = require('./Converter');
const { Types } = require('./Lexer');

const isNestingKeyedFromRight = nesting => !nesting.isTopLevel && nesting.key === null

const Parser = {
    Parser(topLevelContext) {
        this.failures = [];
        this.topLevelContext = topLevelContext;
    },
    parse() {
        const data = this.parseContext(this.topLevelContext);

        return {
            data,
            parserFailures: this.failures
        };
    },
    getContextKey(context) {
        const elements = context.heading.elements;
    
        // Already checked by Contextify.
        if (elements.length < 1 || elements.length > 2) {
            return null;
        }
    
        // Already checked by Contextify.
        if (elements[0].type != Types.text) {
            return null;
        }
    
        if (elements.length == 2) {
            if (elements[1].type == Types.ignoreAlias) {
                return null;
            } else if (elements[1].type == Types.keyAlias) {
                return elements[1].alias;
            } else {
                // spec: a heading containing simple text followed by a single key alias or a single ignore alias only.
                this.failures.push(
                    ambiguousSyntax('Heading containing two elements, which are not a text element followed by a key alias or an ignore alias.', context.heading));

                return null;
            }
        }
    
        return elements[0].text;;
    },
    parseListElement(listElement) {
        const elements = [...listElement.elements].reverse();

        let nestingStack = [];

        let currentLiteral = null;
        let currentKey = null;

        while (elements.length > 0) {
            const element = elements[elements.length - 1];
            const currentObject = nestingStack.length > 0 ? nestingStack[nestingStack.length - 1] : null;

            if (element.type == 'object terminator') {
                if (currentKey || currentLiteral) {
                    // err
                    currentKey = null;
                    currentLiteral = null;
                } else if (currentObject && (currentObject.isTopLevel || isNestingKeyedFromRight(currentObject))) {
                    nestingStack.push({
                        isTopLevel: false,
                        key: null,
                        contents: {}
                    });
                } else {
                    const obj = nestingStack.pop();

                    if (nestingStack.length == 0) {
                        currentLiteral = obj.contents;
                    } else {
                        nestingStack[nestingStack.length - 1].contents[obj.key] = obj.contents;
                    }
                }

                elements.pop();
            } else if (element.type == 'primitive literal') {
                const { value, error } = Converter.tryConvert(element.typeHint, element.valueOverride || element.literal);

                if (!error) {
                    if (currentLiteral) {
                        // err
                        currentLiteral = null;
                        currentKey = null;
                    } else if (currentKey) {
                        if (currentObject) {
                            currentObject.contents[currentKey] = value;
                        } else {
                            // err
                        }
                        currentKey = null;
                    } else {
                        currentLiteral = value;
                    }
                }

                elements.pop();
            } else if (element.type == 'key metadata' || element.type == 'key alias' || element.type == 'ignore alias') {
                // must be misplaced

                elements.pop();
            } else if (element.type == 'object key') {
                elements.pop();

                if (elements.length > 1) {
                    let nextElement = elements[elements.length - 1];

                    if (nextElement.type == 'text' && nextElement.text.trim() == '') {
                        elements.pop();

                        if (elements.length > 1) {
                            nextElement = elements[elements.length - 1];
                        } else {
                            // err

                            nextElement = null;
                        }
                    }

                    if (nextElement && nextElement.type == 'key metadata') {
                        const key = nextElement.alias || element.keyName;

                        if (currentKey) {
                            // err
                            currentKey = null;
                            currentLiteral = null;
                        } else if (currentLiteral) {
                            if (!nextElement.left || nextElement.right) {
                                // err
                            } else if (nextElement.object) {
                                // err
                            } else {
                                if (currentObject) {
                                    currentObject.contents[key] = currentLiteral;
                                } else {
                                    // err
                                }
                                currentLiteral = null;
                            }
                        } else {
                            if (nextElement.left) {
                                if (nextElement.object) {
                                    const obj = nestingStack.pop();

                                    nestingStack[nestingStack.length - 1].contents[key] = obj.contents;
                                } else {
                                    // err
                                }
                            } else if (nextElement.right) {
                                if (nextElement.object) {
                                    nestingStack.push({
                                        isTopLevel: false,
                                        key, // !!!
                                        contents: {}
                                    });
                                } else {
                                    currentKey = key;
                                }
                            } else {
                                // err
                            }
                        }
                    }

                    elements.pop();
                } else {
                    // error, tho
                }
            } else if (element.type == 'noise' || element.type == 'text' || element.type == 'space') {
                // no need for these

                elements.pop();
            } else if (element.type == 'list') {
                const value = element.elements.map(this.parseListElement);

                if (currentLiteral) {
                    // err
                    currentLiteral = null;
                    currentKey = null;
                } else if (currentKey) {
                    if (currentObject) {
                        currentObject.contents[currentKey] = value;
                    } else {
                        // err
                    }
                    currentKey = null;
                } else {
                    currentLiteral = value;
                }

                elements.pop();
            }
        }

        return currentLiteral;
    },
    parseTable(tableElement) {
        const keys = [];

        for (const headerElements of tableElement.header) {
            if (headerElements.length == 1 && headerElements[0].type == Types.text) {
                keys.push(headerElements[0].text.trim());
            } else if (headerElements.length == 2) {
                switch (headerElements[1].type) {
                    case Types.keyAlias:
                        keys.push(headerElements[1].alias);
                        break;
                    case Types.ignoreAlias:
                        keys.push(null);
                        break;
                    default:
                        // spec: a cell containing simple text followed by a single key alias or a single ignore alias only.
                        this.failures.push(ambiguousSyntax('Invalid table header, expected a key alias or an ignore alias.', headerElements));

                        return [];
                }
            } else {
                // spec: a cell containing simple text only
                this.failures.push(
                    ambiguousSyntax('Invalid table header, expected a single text element or two elements (text and key/ignore alias).', headerElements));

                return [];
            }
        }

        const result = [];

        for (const row of tableElement.rows) {
            const obj = {};

            for (let i = 0; i < row.length; ++i) {
                const cell = row[i];

                if (keys[i]) {
                    if (cell.length != 1) {
                        // spec: Normal (ie. non-heading) cells can only contain a single primitive literal
                        this.failures.push(ambiguousSyntax('Invalid table cell; should contain a single element only.', cell));

                        return [];
                    } else {
                        const element = cell[0];

                        if (element.type != 'primitive literal') {
                            // spec: Normal (ie. non-heading) cells can only contain a single primitive literal
                            this.failures.push(ambiguousSyntax('Invalid table cell; should contain a primitive literal.', cell));

                            return [];
                        } else {
                            const { value, error } = Converter.tryConvert(element.typeHint, element.valueOverride || element.literal);

                            if (!error) {
                                obj[keys[i]] = value;
                            } else {
                                this.failures.push(ambiguousSyntax(error), element);

                                return [];
                            }
                        }
                    }
                }            
            }

            result.push(obj);
        }

        return result;
    },
    parseObjectTerminator(ctx) {
        if (ctx.currentKey || ctx.currentLiteral) {
            this.failures.push(interpretationError('Nested object closed before matching all literals/keys.', ctx.element));

            ctx.currentKey = null;
            ctx.currentLiteral = null;
        } else if (ctx.currentObject.isTopLevel || isNestingKeyedFromRight(ctx.currentObject)) {
            ctx.nestingStack.push({
                isTopLevel: false,
                key: null,
                contents: {}
            });
        } else {
            const obj = ctx.nestingStack.pop();

            ctx.nestingStack[ctx.nestingStack.length - 1].contents[obj.key] = obj.contents;
        }

        ctx.elements.pop();
    },
    parsePrimitiveLiteral(ctx) {
        // Unknown types already checked by Lexer.
        const { value, error } = Converter.tryConvert(ctx.element.typeHint, ctx.element.valueOverride || ctx.element.literal);

        if (!error) {
            if (ctx.currentLiteral) {
                this.failures.push(interpretationError('Detected two consecutive, unmatched primitive literals.', ctx.element));
            }
            
            if (ctx.currentKey) {
                ctx.currentObject.contents[ctx.currentKey] = value;
                ctx.currentKey = null;
            } else {
                ctx.currentLiteral = value;
            }
        } else {
            // spec: If the *type hint* describes a known type but neither the *link text*, nor the *value override* describe 
            //       a valid literal of that type, then the *primitive literal* is *ill-formed* and both the *primitive literal*
            //       itself and the corresponding *object key* should be **ignored**.
            this.failures.push(interpretationError(error, ctx.element));
        }

        ctx.elements.pop();
    },
    parseObjectKey(ctx) {
        ctx.elements.pop();

        if (ctx.elements.length > 1) {
            let nextElement = ctx.elements[ctx.elements.length - 1];

            if (nextElement.type == Types.text && nextElement.text.trim() == '') {
                ctx.elements.pop();

                if (ctx.elements.length > 1) {
                    nextElement = ctx.elements[ctx.elements.length - 1];
                } else {
                    nextElement = null;
                }
            }

            if (nextElement && nextElement.type == Types.keyMetadata) {
                const key = nextElement.alias || ctx.element.keyName;

                if (ctx.currentKey) {
                    this.failures.push(interpretationError('Detected two consecutive, unmatched object keys.', ctx.element));
                }
                
                if (ctx.currentLiteral) {
                    if (!nextElement.left || nextElement.right) {
                        this.failures.push(interpretationError('Literal not matched by appropriate object key.', ctx.element));
                    } else if (nextElement.object) {
                        this.failures.push(interpretationError('New nested object started instead of matching previous literal.', ctx.element));
                    } else {
                        ctx.currentObject.contents[key] = ctx.currentLiteral;
                    }
                    ctx.currentLiteral = null;
                } else {
                    if (nextElement.left) {
                        if (nextElement.object) {
                            if (ctx.nestingStack.length > 1) {
                                const obj = ctx.nestingStack.pop();

                                ctx.nestingStack[ctx.nestingStack.length - 1].contents[key] = obj.contents;
                            } else {
                                // spec: If a left-binding object key is detected witout a matching object terminator, 
                                //       then the object key is ill-formed. However, already registered keys and values should remain intact.
                                this.failures.push(interpretationError('Unbalanced object terminators from the left side.', ctx.element));
                            }
                        } else {
                            this.failures.push(interpretationError('Left-binding object key has no literal on its left.', ctx.element));
                        }
                    } else {
                        if (nextElement.object) {
                            ctx.nestingStack.push({
                                isTopLevel: false,
                                key, // !!!
                                contents: {}
                            });
                        } else {
                            ctx.currentKey = key;
                        }
                    }
                }
            } else {
                // spec: If the text inside the emphasis start with a dot, but the emphasis is not followed by key metadata, 
                //       then the object key is ill-formed.
                this.failures.push(ambiguousSyntax('Object key not followed by key metadata.', ctx.element));
            }

            ctx.elements.pop();
        } else {
            // spec: If the text inside the emphasis start with a dot, but the emphasis is not followed by key metadata, 
            //       then the object key is ill-formed.
            this.failures.push(ambiguousSyntax('Object key not followed by key metadata.', ctx.element));

            ctx.elements.pop();
        }
    },
    parseList(ctx) {
        const value = ctx.element.elements.map(this.parseListElement);

        if (ctx.currentLiteral) {
            this.failures.push(interpretationError('Detected two consecutive, unmatched literals.', ctx.element));
        }
        
        if (ctx.currentKey) {
            ctx.currentObject.contents[ctx.currentKey] = value;
            ctx.currentKey = null;
        } else {
            ctx.currentLiteral = value;
        }

        ctx.elements.pop();
    },
    parseTableLiteral(ctx) {
        const value = this.parseTable(ctx.element);

        if (ctx.currentLiteral) {
            this.failures.push(interpretationError('Detected two consecutive, unmatched literals.', ctx.element));
        } 
        
        if (ctx.currentKey) {
            ctx.currentObject.contents[ctx.currentKey] = value;
            ctx.currentKey = null;
        } else {
            ctx.currentLiteral = value;
        }

        ctx.elements.pop();
    },
    parseSkip(ctx) {
        ctx.elements.pop();
    },
    parseElements(originalElements) {
        const parserMap = {
            [Types.objectTerminator]: this.parseObjectTerminator,
            [Types.primitiveLiteral]: this.parsePrimitiveLiteral,
            [Types.objectKey]: this.parseObjectKey,
            [Types.list]: this.parseList,
            [Types.table]: this.parseTableLiteral,

            [Types.noise]: this.parseSkip,
            [Types.text]: this.parseSkip,
            [Types.space]: this.parseSkip
        };

        const result = {
            isTopLevel: true,
            key: null,
            contents: {}
        };

        const ctx = {
            elements: [...originalElements].reverse(),
            // The stack holding nested objects
            nestingStack: [result],
            // Contains the last unmatched literal
            currentLiteral: null,
            // Contains the last unmatched object key
            currentKey: null
        };

        while (ctx.elements.length > 0) {
            ctx.element = ctx.elements[ctx.elements.length - 1];
            // The object we register values on
            ctx.currentObject = ctx.nestingStack[ctx.nestingStack.length - 1];

            if (Object.prototype.hasOwnProperty.call(parserMap, ctx.element.type)) {
                parserMap[ctx.element.type].call(this, ctx);
            } else {
                this.failures.push(ambiguousSyntax('Misplaced/unknown element.', ctx.element));

                ctx.elements.pop();
            }
        }

        if (ctx.currentLiteral) {
            this.failures.push(interpretationError('Unmatched literal at the end of context.', ctx.currentLiteral));
        }

        if (ctx.currentKey) {
            this.failures.push(interpretationError('Unmatched object key at the end of context.', ctx.currentKey));
        }

        if (ctx.nestingStack.length > 1) {
            this.failures.push(interpretationError('Unterminated nested object(s) at the end of context.'));

            for (let i = ctx.nestingStack.length - 1; i > 0; --i) {
                const obj = ctx.nestingStack[i];

                if (obj.key) {
                    ctx.nestingStack[i - 1].contents[obj.key] = obj.contents;
                }
            }
        }

        return result.contents;
    },
    parseChildContexts(contexts) {
        const result = {};

        for (const context of contexts) {
            const contextKey = this.getContextKey(context);

            if (contextKey) {
                result[contextKey] = this.parseContext(context);
            }
        }

        return result;
    },
    parseContext(context) {
        const elementData = this.parseElements(context.elements);
        const childContextData = this.parseChildContexts(context.childContexts);

        return Object.assign({}, elementData, childContextData);
    }
};

module.exports = function parse(topLevelContext) {
    const parser = Object.create(Parser);
    parser.Parser(topLevelContext);

    return parser.parse();
};
