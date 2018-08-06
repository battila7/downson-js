const EMPTY_LIST_LITERAL = 'empty';
const EMPTY_OBJECT_LITERAL = 'empty';

const success = value => ({ value });

const failure = error => ({ error });

const intRegExp = /[+-]?[1-9]([_,. ]?[0-9]+)*/;
const floatRegExp = /[+-]?[1-9]([_,. ]?[0-9]+)*([eE][+-]?[0-9]+)?/;
const exponentialSplitRegExp = /[eE]/;
const groupingRegExp = /[_,. ]/;

function charCount(str, chr) {
    let count = 0;

    for (let i = 0; i < str.length; ++i) {
        if (str[i] == chr) {
            ++count;
        }
    }

    return count;
}

function boolean(type, literal) {
    if (literal == 'true') {
        return success(true)
    } else if (literal == 'false') {
        return success(false);
    } else {
        return failure(`Invalid boolean literal "${literal}".`);
    }
}

function int(type, literal) {
    if (literal.match(intRegExp)) {
        const str = literal.replace(groupingRegExp, '');

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
    if (literal == 'inf' || literal == '+inf') {
        return success(Number.POSITIVE_INFINITY);
    }

    if (literal == '-inf') {
        return success(Number.NEGATIVE_INFINITY);
    }

    if (literal == 'nan') {
        return success(Number.NaN);
    }

    if (literal.match(floatRegExp)) {
        const [ intAndFracPart, expPart ] = literal.split(exponentialSplitRegExp);

        const commas = charCount(intAndFracPart, ',');
        const dots = charCount(intAndFracPart, '.');

        if (commas == 0 && dots == 0) {
            const str = intAndFracPart.replace(groupingRegExp, '');

            const res = str + (expPart ? ('E' + expPart) : '');

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

        const intStr = intPart.replace(groupingRegExp, '');
        const fracStr = fracPart.replace(groupingRegExp, '');

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
    return literal == EMPTY_LIST_LITERAL ? success([]) : failure(`Unknown list literal "${literal}".`);
}

function object(type, literal) {
    return literal == EMPTY_OBJECT_LITERAL ? success({}) : failure(`Unknown object literal "${literal}".`);
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
    tryConvert(type, literal) {
        if (this.methodMap.has(type)) {
            return this.methodMap.get(type)(type, literal);
        } else {
            return failure(`Missing converter for type "${type}"!`);
        }
    }
};

Object.keys(Converter.defaultMethods).forEach(key => Converter.register(key, Converter.defaultMethods[key]));

module.exports = Converter;
