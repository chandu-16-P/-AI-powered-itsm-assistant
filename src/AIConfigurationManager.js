var AIConfigurationManager = Class.create();
AIConfigurationManager.prototype = {
    initialize: function() {
        this.configTable = 'x_ai_itsm_model_config';
    },

    /**
     * Retrieves the active AI model configuration for a specific provider.
     * If no provider is specified, it returns the first active configuration.
     * 
     * @param {string} providerName - Optional name of the provider (Gemini, OpenAI, Groq, Claude, Antigravity AI)
     * @returns {object} Config object containing endpoint, apiKey, model, timeout, temperature, maxTokens
     */
    getConfig: function(providerName) {
        var config = {
            providerName: '',
            endpointUrl: '',
            apiKey: '',
            modelName: '',
            timeout: 30,
            temperature: 0.7,
            maxTokens: 2048,
            active: false
        };

        var gr = new GlideRecord(this.configTable);
        gr.addQuery('active', true);
        if (providerName) {
            gr.addQuery('provider_name', providerName);
        }
        gr.query();

        if (gr.next()) {
            config.providerName = gr.getValue('provider_name');
            config.endpointUrl = gr.getValue('endpoint_url');
            config.apiKey = gr.getValue('api_key');
            config.modelName = gr.getValue('model_name');
            config.timeout = parseInt(gr.getValue('timeout'), 10) || 30;
            config.temperature = parseFloat(gr.getValue('temperature')) || 0.7;
            config.maxTokens = parseInt(gr.getValue('max_tokens'), 10) || 2048;
            config.active = true;
            
            // Log access to config (excluding key)
            gs.info('AIConfigurationManager: Loaded active config for provider: ' + config.providerName + ', model: ' + config.modelName);
            return config;
        }

        // Fallback: Check System Properties if no table record exists
        gs.warn('AIConfigurationManager: No active config found in ' + this.configTable + '. Falling back to system properties.');
        
        var prefix = 'x_ai_itsm.ai.';
        config.providerName = gs.getProperty(prefix + 'provider', 'Gemini');
        config.endpointUrl = gs.getProperty(prefix + 'endpoint', 'https://api.now.com/v1/chat/completions');
        config.apiKey = gs.getProperty(prefix + 'api_key', '');
        config.modelName = gs.getProperty(prefix + 'model', 'gemini-1.5-flash');
        config.timeout = parseInt(gs.getProperty(prefix + 'timeout', '30'), 10);
        config.temperature = parseFloat(gs.getProperty(prefix + 'temperature', '0.7'));
        config.maxTokens = parseInt(gs.getProperty(prefix + 'max_tokens', '2048'), 10);
        config.active = config.apiKey ? true : false;

        return config;
    },

    /**
     * Scoped helper to update Gemini configuration records.
     * Bypasses cross-scope write restrictions when called from global context.
     */
    updateGeminiConfig: function(key, endpoint, model) {
        var gr = new GlideRecord(this.configTable);
        gr.addQuery('provider_name', 'Gemini');
        gr.query();
        if (gr.next()) {
            gr.api_key = key;
            gr.endpoint_url = endpoint;
            gr.model_name = model;
            gr.active = true;
            var sysId = gr.update();
            return "SUCCESS: Record updated " + sysId;
        }
        return "ERROR: Gemini record not found";
    },

    /**
     * Checks if a valid API configuration exists.
     * @returns {boolean}
     */
    isConfigured: function() {
        var config = this.getConfig();
        return config.active && config.endpointUrl && config.apiKey;
    },

    type: 'AIConfigurationManager'
};
