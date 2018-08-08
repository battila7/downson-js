const { ambiguousSyntax } = require('./Failure');
const BlockLexer = require('../markdown/BlockLexer');
const InlineLexer = require('../markdown/InlineLexer');

const BlockTypes = BlockLexer.Types;
const InlineTypes = InlineLexer.Types;

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
const isHeading = token => token.type == BlockTypes.heading;

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

const ContextBuilder = {
    ContextBuilder(tokens) {
        this.failures = [];
        this.tokens = [...tokens].reverse();
    },
    contextify() {
        const topLevelContext = emptyContext(0, null);

        this.buildContext(topLevelContext, this.tokens);

        return {
            topLevelContext,
            contextifyFailures: this.failures
        };
    },
    /**
     * Checks if the heading is a valid downson heading as described in the specification.
     * @param {*} heading the heading token
     */
    isInvalidHeading(heading) {
        if (heading.inner.length == 1) {
            // spec: a heading containing simple text only
            if (heading.inner[0].type != InlineTypes.text) {
                this.failures.push(ambiguousSyntax('Heading containing a single, non-text element.', heading));

                return true;
            }
        } else if (heading.inner.length == 2) {
            // spec: a heading containing simple text followed by a single key alias or a single ignore alias only
            // Here we can only check if the second inner token is a link, because downson lexing takes part after contextify.
            if (heading.inner[0].type != InlineTypes.text || heading.inner[1].type != InlineTypes.link) {
                this.failures.push(ambiguousSyntax('Heading containing two elements, which are not a text element followed by a link element.', heading));

                return true;
            }
        }

        return false;
    },
    buildContext(context, tokens) {
        let shouldIgnore = false;
    
        while (tokens.length > 0) {
            const token = tokens[tokens.length - 1];
    
            if (!isHeading(token)) {            
                if (!shouldIgnore) {
                    context.elements.push(token);
                }
    
                tokens.pop();
            } else {
                const heading = token;
    
                if (this.isInvalidHeading(heading)) {
                    shouldIgnore = true;
                }
    
                if (isSibling(heading.depth, context.depth) || isUpperLevel(heading.depth, context.depth)) {
                    return;
                } else if (isDirectChild(heading.depth, context.depth)) {
                    shouldIgnore = false;
    
                    const childContext = emptyContext(heading.depth, heading);
                    context.childContexts.push(childContext);
    
                    tokens.pop();
    
                    this.buildContext(childContext, tokens);
                } else {
                    // spec: Cases when p - n > 1 are not permitted.
                    this.failures.push(ambiguousSyntax(`Invalid heading nesting. Current level was ${context.depth}, new level is ${heading.depth}.`, heading));
    
                    shouldIgnore = true;
    
                    tokens.pop();
                }
            }
        }
    }
}

/**
 * Creates a top-level context with appropriate nestings from the specified tokens.
 * @param {*} tokens an array of tokens
 */
module.exports = function contextify(tokens) {    
    const builder = Object.create(ContextBuilder);
    builder.ContextBuilder(tokens);

    return builder.contextify();
};
