const { Types } = require('../markdown/BlockLexer');

/**
 * Creates a new empty context.
 * @param {*} depth the depth (nesting level) of the context
 * @param {*} heading the heading token that introduced the context
 */
const emptyContext = (depth, heading) => ({
    elements: [],
    childContexts: [],
    depth,
    heading
});

/**
 * Checks if a token is a heading token.
 * @param {*} token the token to check
 */
const isHeading = token => token.type == Types.heading;

/**
 * Checks if two consecutive contexts are siblings (based on their depths).
 * @param {*} otherDepth the newly detected context
 * @param {*} currentDepth the current context
 */
const isSibling = (otherDepth, currentDepth) => otherDepth == currentDepth;

/**
 * Checks if a newly detected consecutive context is a direct child (its depth is one more) of the current one.
 * @param {*} otherDepth  the newly detected context
 * @param {*} currentDepth the current context
 */
const isDirectChild = (otherDepth, currentDepth) => (otherDepth - currentDepth) == 1;

/**
 * Checks if a newly detected consecutive context is a directly upper level context (its depth is one less) with respect to the current one.
 * @param {*} otherDepth  the newly detected context
 * @param {*} currentDepth the current context
 */
const isUpperLevel = (otherDepth, currentDepth) => (currentDepth - otherDepth) > 0;

/**
 * Builds a new context including child-contexts.
 * @param {*} context the context to fill up
 * @param {*} tokens the tokens to consume
 */
function buildContext(context, tokens) {
    let isInvalidNestingMode = false;

    while (tokens.length > 0) {
        const token = tokens[tokens.length - 1];

        if (!isHeading(token)) {
            if (!isInvalidNestingMode) {
                context.elements.push(token);
            }

            tokens.pop();
        } else {
            const heading = token;

            if (isSibling(heading.depth, context.depth) || isUpperLevel(heading.depth, context.depth)) {
                return;
            } else if (isDirectChild(heading.depth, context.depth)) {
                isInvalidNestingMode = false;

                const childContext = emptyContext(heading.depth, heading);
                context.childContexts.push(childContext);

                tokens.pop();

                buildContext(childContext, tokens);
            } else {
                isInvalidNestingMode = true;

                tokens.pop();
            }
        }
    }
}

/**
 * Creates a top-level context with appropriate nestings from the specified tokens.
 * @param {*} tokens an array of tokens
 */
module.exports = function contextify(tokens) {
    const topLevelContext = emptyContext(0, null);    
    
    buildContext(topLevelContext, [...tokens].reverse());

    return topLevelContext;
};
