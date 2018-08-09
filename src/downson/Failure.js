const Types = {
    ambiguousSyntax: 'ambiguous syntax',
    interpretationError: 'interpretation error'
};

const ambiguousSyntax = (reason, token) => ({ reason, token, type: Types.ambiguousSyntax });

const interpretationError = (reason, token) => ({ reason, token, type: Types.interpretationError });

module.exports = {
    ambiguousSyntax,
    interpretationError,
    Types
};
