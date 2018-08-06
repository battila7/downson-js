const EMPTY_LIST_LITERAL = 'empty';
const EMPTY_OBJECT_LITERAL = 'empty';

const success = value => ({ value });

const failure = error => ({ error });

function list(type, literal) {
    return literal == EMPTY_LIST_LITERAL ? success([]) : failure(`Unknown list literal "${literal}".`);
}

function object(type, literal) {
    return literal == EMPTY_OBJECT_LITERAL ? success({}) : failure(`Unknown object literal "${literal}".`);
}

const Converter = {
    methodMap: new Map(),
    defaultMethods: {
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