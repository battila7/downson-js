const emptyContext = (depth, heading) => ({
        elements: [],
        childContexts: [],
        depth,
        heading
    });

const isHeading = token => token.type == 'heading';

const isSibling = (otherDepth, currentDepth) => otherDepth == currentDepth;

const isDirectChild = (otherDepth, currentDepth) => (otherDepth - currentDepth) == 1;

const isDirectUpperLevel = (otherDepth, currentDepth) => (currentDepth - otherDepth) == 1;

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

            if (isSibling(heading.depth, context.depth) || isDirectUpperLevel(heading.depth, context.depth)) {
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

function contextify(tokens) {
    const topLevelContext = emptyContext(0, null);    
    
    buildContext(topLevelContext, [...tokens].reverse());

    return topLevelContext;
}

module.exports = function process(tokens, options) {
    const context = contextify(tokens);

    return context;
};
