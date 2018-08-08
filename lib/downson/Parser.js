const Converter = require('./Converter');
const { Types } = require('./Lexer');

const isNestingKeyedFromRight = nesting => !nesting.isTopLevel && nesting.key === null

const Parser = {
    Parser(topLevelContext) {
        this.failures = [];
        this.topLevelContext = topLevelContext;
    },
    parse() {
        return this.parseContext(this.topLevelContext);
    },
    getContextKey(context) {
        const elements = context.heading.elements;
    
        if (elements.length < 1 || elements.length > 2) {
            return null;
        }
    
        if (elements[0].type != 'text') {
            return null;
        }
    
        if (elements.length == 2) {
            if (elements[1].type == 'ignore alias') {
                return null;
            } else if (elements[1].type == 'key alias') {
                return elements[1].alias;
            } else {
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
            if (headerElements.length == 1 && headerElements[0].type == 'text') {
                keys.push(headerElements[0].text.trim());
            } else if (headerElements.length == 2) {
                switch (headerElements[1].type) {
                    case 'key alias':
                        keys.push(headerElements[1].alias);
                        break;
                    case 'ignore alias':
                        keys.push(null);
                        break;
                    default:
                        // err
                    return [];
                }
            } else {
                // err
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
                        // err
                    } else {
                        const element = cell[0];

                        if (element.type != 'primitive literal') {
                            // err
                        } else {
                            const { value, error } = Converter.tryConvert(element.typeHint, element.valueOverride || element.literal);

                            if (!error) {
                                obj[keys[i]] = value;
                            } else {
                                // err
                            }
                        }
                    }
                }            
            }

            result.push(obj);
        }

        return result;
    },
    parseElements(originalElements) {
        const elements = [...originalElements].reverse();

        const result = {
            isTopLevel: true,
            key: null,
            contents: {}
        };

        // Stack of nested objects
        let nestingStack = [];

        nestingStack.push(result);

        // Contains the last unmatched literal
        let currentLiteral = null;
        // Contains the last unmatched object key
        let currentKey = null;

        while (elements.length > 0) {
            const element = elements[elements.length - 1];
            // The object we register values on
            const currentObject = nestingStack[nestingStack.length - 1];

            if (element.type == Types.objectTerminator) {
                if (currentKey || currentLiteral) {
                    // err
                    currentKey = null;
                    currentLiteral = null;
                } else if (currentObject.isTopLevel || isNestingKeyedFromRight(currentObject)) {
                    nestingStack.push({
                        isTopLevel: false,
                        key: null,
                        contents: {}
                    });
                } else {
                    const obj = nestingStack.pop();

                    nestingStack[nestingStack.length - 1].contents[obj.key] = obj.contents;
                }

                elements.pop();
            } else if (element.type == Types.primitiveLiteral) {
                const { value, error } = Converter.tryConvert(element.typeHint, element.valueOverride || element.literal);

                if (!error) {
                    if (currentLiteral) {
                        // err
                        currentLiteral = null;
                        currentKey = null;
                    } else if (currentKey) {
                        currentObject.contents[currentKey] = value;
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
                                currentObject.contents[key] = currentLiteral;
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
                    currentObject.contents[currentKey] = value;
                    currentKey = null;
                } else {
                    currentLiteral = value;
                }

                elements.pop();
            } else if (element.type == 'table') {
                const value = this.parseTable(element);

                if (currentLiteral) {
                    // err
                    currentLiteral = null;
                    currentKey = null;
                } else if (currentKey) {
                    currentObject.contents[currentKey] = value;
                    currentKey = null;
                } else {
                    currentLiteral = value;
                }

                elements.pop();
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
