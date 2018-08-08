const ambiguousSyntax = (reason, token) => ({ reason, token });

const interpretationError = (reason, token) => ({ reason, token });

const Types = {
    ambiguousSyntax: 'ambiguousSyntax',
    interpretationError: 'interpretationError'
};

module.exports = {
    ambiguousSyntax,
    interpretationError,
    Types
};
