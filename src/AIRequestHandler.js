var AIRequestHandler = Class.create();
AIRequestHandler.prototype = {
    initialize: function() {
        this.configManager = new x_ai_itsm.AIConfigurationManager();
    },

    /**
     * Executes a synchronous REST request to the AI Provider.
     * Implements basic retry logic on 429 Rate Limits and 503 Overloads.
     * 
     * @param {string} prompt - The prompt text to send
     * @param {string} providerName - Optional provider name (Gemini, OpenAI, Groq, Claude, Antigravity AI)
     * @param {string} systemInstruction - Optional system message/context
     * @returns {object} Response object with status, body, error, and elapsed time
     */
    sendRequest: function(prompt, providerName, systemInstruction) {
        var startTime = new Date().getTime();
        var result = {
            success: false,
            statusCode: 0,
            body: '',
            errorMessage: '',
            elapsedTimeMs: 0,
            provider: '',
            model: ''
        };

        var config = this.configManager.getConfig(providerName);
        if (!config.active) {
            result.errorMessage = 'AI configuration is inactive or missing API Key.';
            return result;
        }

        result.provider = config.providerName;
        result.model = config.modelName;

        var requestBody = this.buildRequestBody(config, prompt, systemInstruction);
        var maxRetries = 3;
        var retryDelayMs = 1000; // Starting delay for backoff

        for (var attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                var request = new sn_ws.RESTMessageV2();
                
                // Formulate target URL: dynamic query key for native Gemini
                var targetUrl = config.endpointUrl;
                var providerLower = config.providerName.toLowerCase();
                if (providerLower === 'gemini' && !targetUrl.includes('/chat/completions') && !targetUrl.includes('key=')) {
                    targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'key=' + config.apiKey;
                }

                request.setEndpoint(targetUrl);
                request.setHttpMethod('POST');
                request.setRequestHeader('Content-Type', 'application/json');
                
                // Set provider-specific headers
                this.setProviderHeaders(request, config, targetUrl);
                request.setRequestBody(JSON.stringify(requestBody));
                request.setHttpTimeout(config.timeout * 1000); // milliseconds

                gs.info('AIRequestHandler: Sending request to ' + config.providerName + ' (Attempt ' + attempt + '/' + maxRetries + ')');
                
                var response = request.execute();
                result.statusCode = response.getStatusCode();
                result.body = response.getBody();
                result.elapsedTimeMs = new Date().getTime() - startTime;

                if (result.statusCode === 200) {
                    result.success = true;
                    break;
                } else if (result.statusCode === 429 || result.statusCode === 503) {
                    gs.warn('AIRequestHandler: Rate limit or overload (' + result.statusCode + ') on attempt ' + attempt + '. Retrying in ' + retryDelayMs + 'ms.');
                    if (attempt < maxRetries) {
                        // Safe JavaScript busy-wait loop (gs.sleep is restricted in scoped apps)
                        var sleepStart = new Date().getTime();
                        while (new Date().getTime() - sleepStart < retryDelayMs) {
                            // wait
                        }
                        retryDelayMs *= 2; // Exponential backoff
                    }
                } else {
                    result.errorMessage = 'HTTP Error: ' + result.statusCode + ' - ' + response.getErrorMessage();
                    gs.error('AIRequestHandler: Request failed. ' + result.errorMessage + '\nResponse: ' + result.body);
                    break; // Do not retry on client errors or bad credentials
                }

            } catch (ex) {
                result.errorMessage = ex.toString();
                result.elapsedTimeMs = new Date().getTime() - startTime;
                gs.error('AIRequestHandler: Exception occurred: ' + result.errorMessage);
                if (attempt < maxRetries) {
                    var sleepStartCatch = new Date().getTime();
                    while (new Date().getTime() - sleepStartCatch < retryDelayMs) {
                        // wait
                    }
                    retryDelayMs *= 2;
                }
            }
        }

        return result;
    },

    /**
     * Builds the correct request payload structure based on the provider requirements.
     */
    buildRequestBody: function(config, prompt, systemInstruction) {
        var provider = config.providerName.toLowerCase();
        
        // Anthropic (Claude) structure
        if (provider === 'claude' || provider === 'anthropic') {
            var claudeMessages = [{ role: 'user', content: prompt }];
            var payload = {
                model: config.modelName,
                messages: claudeMessages,
                max_tokens: config.maxTokens,
                temperature: config.temperature
            };
            if (systemInstruction) {
                payload.system = systemInstruction;
            }
            return payload;
        }

        // Gemini native structure (only if it does NOT use the completions endpoints)
        if (provider === 'gemini' && !config.endpointUrl.includes('/chat/completions')) {
            var contents = [];
            if (systemInstruction) {
                return {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: config.temperature,
                        maxOutputTokens: config.maxTokens
                    },
                    systemInstruction: {
                        parts: [{ text: systemInstruction }]
                    }
                };
            }
            return {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: config.temperature,
                    maxOutputTokens: config.maxTokens
                }
            };
        }

        // Default OpenAI-compatible format (OpenAI, Groq, Antigravity AI, Gemini-OpenAI-Compat)
        var messages = [];
        if (systemInstruction) {
            messages.push({ role: 'system', content: systemInstruction });
        }
        messages.push({ role: 'user', content: prompt });

        return {
            model: config.modelName,
            messages: messages,
            temperature: config.temperature,
            max_tokens: config.maxTokens
        };
    },

    /**
     * Sets provider-specific authorization and versioning headers.
     */
    setProviderHeaders: function(request, config, url) {
        var provider = config.providerName.toLowerCase();

        if (provider === 'claude' || provider === 'anthropic') {
            request.setRequestHeader('x-api-key', config.apiKey);
            request.setRequestHeader('anthropic-version', '2023-06-01');
        } else if (provider === 'gemini' && !config.endpointUrl.includes('/chat/completions')) {
            // Only set header if key is not already appended to query string
            if (url && !url.includes('key=')) {
                request.setRequestHeader('x-goog-api-key', config.apiKey);
            }
        } else {
            // OpenAI, Groq, Antigravity AI, OpenAI-compatible APIs (including Gemini-OpenAI-Compat)
            request.setRequestHeader('Authorization', 'Bearer ' + config.apiKey);
        }
    },

    type: 'AIRequestHandler'
};
