var AIUsageLogger = Class.create();
AIUsageLogger.prototype = {
    initialize: function() {
        this.logTable = 'x_ai_itsm_ai_log';
        this.requestTable = 'x_ai_itsm_request';
    },

    /**
     * Inserts an entry into the performance log table (x_ai_itsm_ai_log).
     */
    logUsage: function(module, action, model, executionTimeMs, tokenCount, provider) {
        try {
            var cost = this.calculateCost(provider, model, tokenCount);

            var grLog = new GlideRecord(this.logTable);
            grLog.initialize();
            grLog.module = module;
            grLog.action = action;
            grLog.model = model + ' (' + provider + ')';
            grLog.user = gs.getUserID();
            grLog.execution_time_ms = executionTimeMs;
            grLog.token_count = tokenCount;
            grLog.cost = cost;
            var logSysId = grLog.insert();
            
            return logSysId;
        } catch (ex) {
            gs.error('AIUsageLogger: Error logging performance metrics: ' + ex.toString());
            return null;
        }
    },

    /**
     * Logs a detailed transaction in the AI Request table for audit and fallback history.
     */
    logRequest: function(type, sourceTable, sourceId, requestPayload, responsePayload, status, errorMessage, modelUsed, tokensUsed) {
        try {
            var grReq = new GlideRecord(this.requestTable);
            grReq.initialize();
            grReq.request_type = type;
            grReq.source_table = sourceTable;
            grReq.source_id = sourceId;
            grReq.request_payload = typeof requestPayload === 'object' ? JSON.stringify(requestPayload) : requestPayload;
            grReq.response_payload = typeof responsePayload === 'object' ? JSON.stringify(responsePayload) : responsePayload;
            grReq.status = status;
            grReq.error_message = errorMessage;
            grReq.model_used = modelUsed;
            grReq.tokens_used = tokensUsed;
            var reqSysId = grReq.insert();

            return reqSysId;
        } catch (ex) {
            gs.error('AIUsageLogger: Error logging audit request: ' + ex.toString());
            return null;
        }
    },

    /**
     * Calculates the estimated cost of a transaction based on average API pricing (per token).
     */
    calculateCost: function(provider, model, tokenCount) {
        if (!tokenCount) return 0;
        
        var p = provider ? provider.toLowerCase() : '';
        var m = model ? model.toLowerCase() : '';
        var ratePer1K = 0.00015; // default rate (e.g. Gemini 1.5 Flash average)

        if (p === 'openai') {
            if (m.indexOf('gpt-4') > -1) {
                ratePer1K = 0.010; // GPT-4 average
            } else {
                ratePer1K = 0.0015; // GPT-3.5 average
            }
        } else if (p === 'claude' || p === 'anthropic') {
            if (m.indexOf('opus') > -1) {
                ratePer1K = 0.045;
            } else if (m.indexOf('sonnet') > -1) {
                ratePer1K = 0.008;
            } else {
                ratePer1K = 0.0015;
            }
        } else if (p === 'groq') {
            ratePer1K = 0.0002; // very cheap open source models
        } else if (p === 'antigravity ai' || p === 'antigravity') {
            ratePer1K = 0.0001;
        }

        // Return calculated cost: (tokens / 1000) * rate
        return (tokenCount / 1000) * ratePer1K;
    },

    type: 'AIUsageLogger'
};
