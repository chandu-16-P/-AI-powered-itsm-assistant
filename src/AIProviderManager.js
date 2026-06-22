var AIProviderManager = Class.create();
AIProviderManager.prototype = {
    initialize: function() {
        this.handler = new x_ai_itsm.AIRequestHandler();
        this.parser = new x_ai_itsm.AIResponseParser();
        this.logger = new x_ai_itsm.AIUsageLogger();
    },

    /**
     * Executes a complete AI call: request construction, sending, response parsing, and logging.
     * 
     * @param {string} prompt - The prompt to send to the AI
     * @param {string} providerName - Optional provider override
     * @param {string} systemInstruction - Optional system instructions/context
     * @param {string} sourceTable - The table trigger (e.g. incident, change_request)
     * @param {string} sourceId - The sys_id of the record triggering the call
     * @param {string} module - The application module name (e.g. "Incident Classifier")
     * @param {string} action - The action being performed (e.g. "Categorize Incident")
     * @returns {string} The raw text response from the AI provider, or empty string on failure
     */
    executeCall: function(prompt, providerName, systemInstruction, sourceTable, sourceId, module, action) {
        if (!prompt) {
            gs.error('AIProviderManager: Execute call failed due to empty prompt.');
            return '';
        }

        // 1. Send the request via handler
        var handlerResult = this.handler.sendRequest(prompt, providerName, systemInstruction);

        // 2. Parse response via parser
        var parsedResult = this.parser.parseResponse(handlerResult);

        // 3. Log detailed transaction for audit
        var status = parsedResult.success ? 'completed' : 'failed';
        var errorMsg = parsedResult.success ? '' : parsedResult.errorMessage;
        
        this.logger.logRequest(
            sourceTable ? sourceTable + '_' + action : 'general',
            sourceTable || 'none',
            sourceId || 'none',
            prompt,
            parsedResult.success ? parsedResult.text : handlerResult.body,
            status,
            errorMsg,
            handlerResult.model || 'unknown',
            parsedResult.totalTokens
        );

        // 4. Log usage metrics for analytics if successful
        if (parsedResult.success) {
            this.logger.logUsage(
                module || 'General',
                action || 'AI Call',
                handlerResult.model || 'unknown',
                handlerResult.elapsedTimeMs,
                parsedResult.totalTokens,
                handlerResult.provider || 'unknown'
            );
            return parsedResult.text;
        }

        return '';
    },

    type: 'AIProviderManager'
};
