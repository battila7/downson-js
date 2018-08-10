const { charCount } = require('../Utility');

const Literals = {
    object: {
        empty: 'empty'
    },
    list: {
        empty: 'empty'
    },
    boolean: {
        true: 'true',
        false: 'false'
    },
    float: {
        positiveInfinity: 'inf',
        signedPositiveInfinity: '+inf',
        negativeInfinity: '-inf',
        notANumber: 'nan'
    }
};

const Patterns = {
    int: /[+-]?0|[1-9]([_,. ]?[0-9]+)*/,
    float: /[+-]?0|[1-9]([_,. ]?[0-9]+)*([eE][+-]?[0-9]+)?/,
    exponentialSplit: /[eE]/,
    grouping: /[_,. ]/g
};

const success = value => ({ value });

const failure = error => ({ error });

function boolean(type, literal) {
    if (literal == Literals.boolean.true) {
        return success(true)
    } else if (literal == Literals.boolean.false) {
        return success(false);
    } else {
        return failure(`Invalid boolean literal "${literal}".`);
    }
}

function int(type, literal) {
    if (literal.match(Patterns.int)) {
        const str = literal.replace(Patterns.grouping, '');

        const result = Number.parseInt(str);

        if (Number.isNaN(result)) {
            return failure(`Invalid int literal "${literal}".`);
        } else {
            return success(result);
        }
    } else {
        return failure(`Invalid int literal "${literal}".`);
    }
}

function float(type, literal) {
    if (literal == Literals.float.positiveInfinity || literal == Literals.float.signedPositiveInfinity) {
        return success(Number.POSITIVE_INFINITY);
    }

    if (literal == Literals.float.negativeInfinity) {
        return success(Number.NEGATIVE_INFINITY);
    }

    if (literal == Literals.float.notANumber) {
        return success(Number.NaN);
    }

    if (literal.match(Patterns.float)) {
        const [ intAndFracPart, expPart ] = literal.split(Patterns.exponentialSplit);

        const commas = charCount(intAndFracPart, ',');
        const dots = charCount(intAndFracPart, '.');

        if (commas == 0 && dots == 0) {
            const str = intAndFracPart.replace(Patterns.grouping, '');

            const res = str + (expPart ? ('e' + expPart) : '');

            const num = Number.parseFloat(res);

            if (Number.isNaN(num)) {
                return failure(`Invalid float literal "${literal}".`);
            } else {
                return success(num);
            }
        }

        if (commas > 1 && dots > 1) {
            return failure(`Could not determine decimal separator in float literal "${literal}".`);
        }

        const decimalSeparator = commas == 1 ? ',' : '.';

        const [ intPart, fracPart ] = intAndFracPart.split(decimalSeparator);

        const intStr = intPart.replace(Patterns.grouping, '');
        const fracStr = fracPart.replace(Patterns.grouping, '');

        const res = intStr + '.' + fracStr + (expPart ? ('E' + expPart) : '');

        const num = Number.parseFloat(res);

        if (Number.isNaN(num)) {
            return failure(`Invalid float literal "${literal}".`);
        } else {
            return success(num);
        }
    } else {
        return failure(`Invalid float literal "${literal}".`);
    }
}

function string(type, literal) {
    return success(literal);
}

function list(type, literal) {
    return literal == Literals.list.empty ? success([]) : failure(`Unknown list literal "${literal}".`);
}

function object(type, literal) {
    return literal == Literals.object.empty ? success({}) : failure(`Unknown object literal "${literal}".`);
}

const Converter = {
    methodMap: new Map(),
    defaultMethods: {
        boolean,
        int,
        float,
        string,
        list,
        object
    },
    register(type, method) {
        this.methodMap.set(type, method);
    },
    deregister(type) {
        return this.methodMap.delete(type);
    },
    tryConvert(type, literal) {
        if (this.methodMap.has(type)) {
            return this.methodMap.get(type)(type, literal);
        } else {
            return failure(`Missing converter for type "${type}"!`);
        }
    },
    isKnownType(type) {
        return this.methodMap.has(type);
    }
};

Object.keys(Converter.defaultMethods).forEach(key => Converter.register(key, Converter.defaultMethods[key]));

module.exports = Converter;
