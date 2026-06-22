var AIResponseParser = Class.create();
AIResponseParser.prototype = {
    initialize: function() {
    },

    /**
     * Parses the HTTP response body returned by the AI provider.
     * 
     * @param {object} handlerResult - The result object from AIRequestHandler
     * @returns {object} Parsed result containing success, text, promptTokens, completionTokens, totalTokens, error
     */
    parseResponse: function(handlerResult) {
        var parsed = {
            success: false,
            text: '',
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            errorMessage: ''
        };

        if (!handlerResult.success) {
            parsed.errorMessage = handlerResult.errorMessage || 'Unknown handler error.';
            return parsed;
        }

        try {
            var bodyJson = JSON.parse(handlerResult.body);
            var provider = handlerResult.provider.toLowerCase();

            if (provider === 'claude' || provider === 'anthropic') {
                // Anthropic response format
                if (bodyJson.content && bodyJson.content[0] && bodyJson.content[0].text) {
                    parsed.text = bodyJson.content[0].text;
                    parsed.success = true;
                }
                if (bodyJson.usage) {
                    parsed.promptTokens = bodyJson.usage.input_tokens || 0;
                    parsed.completionTokens = bodyJson.usage.output_tokens || 0;
                    parsed.totalTokens = parsed.promptTokens + parsed.completionTokens;
                }
            } else if (provider === 'gemini' && !handlerResult.endpointUrl?.includes('/v1/chat/completions')) {
                // Gemini native format
                if (bodyJson.candidates && bodyJson.candidates[0] && bodyJson.candidates[0].content && bodyJson.candidates[0].content.parts && bodyJson.candidates[0].content.parts[0]) {
                    parsed.text = bodyJson.candidates[0].content.parts[0].text;
                    parsed.success = true;
                }
                if (bodyJson.usageMetadata) {
                    parsed.promptTokens = bodyJson.usageMetadata.promptTokenCount || 0;
                    parsed.completionTokens = bodyJson.usageMetadata.candidatesTokenCount || 0;
                    parsed.totalTokens = bodyJson.usageMetadata.totalTokenCount || 0;
                }
            } else {
                // OpenAI-compatible format (OpenAI, Groq, Antigravity AI, Gemini-OpenAI-Compat)
                if (bodyJson.choices && bodyJson.choices[0] && bodyJson.choices[0].message) {
                    parsed.text = bodyJson.choices[0].message.content;
                    parsed.success = true;
                }
                if (bodyJson.usage) {
                    parsed.promptTokens = bodyJson.usage.prompt_tokens || 0;
                    parsed.completionTokens = bodyJson.usage.completion_tokens || 0;
                    parsed.totalTokens = bodyJson.usage.total_tokens || 0;
                }
            }

            if (!parsed.success && !parsed.errorMessage) {
                parsed.errorMessage = 'Could not find text choices or content in response payload.';
                gs.error('AIResponseParser: Failed to find content in response: ' + handlerResult.body);
            }

        } catch (ex) {
            parsed.errorMessage = 'JSON Parse error on response: ' + ex.toString();
            gs.error('AIResponseParser: Exception while parsing response body: ' + ex.toString() + '\nRaw Body: ' + handlerResult.body);
        }

        return parsed;
    },

    /**
     * Extracts and parses JSON object from a string that may contain markdown JSON code blocks.
     * 
     * @param {string} text - The raw text containing JSON
     * @returns {object|null} The parsed JSON object, or null if parsing fails
     */
    extractJson: function(text) {
        if (!text) return null;

        var cleanText = text.trim();
        
        // Remove markdown wrappers if present
        // Matches ```json ... ``` or ``` ... ```
        var jsonMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
            cleanText = jsonMatch[1].trim();
        }

        try {
            return JSON.parse(cleanText);
        } catch (e) {
            gs.error('AIResponseParser: Failed to parse extracted JSON. Text: ' + cleanText + '\nError: ' + e.toString());
            return null;
        }
    },

    type: 'AIResponseParser'
};
