var AIResolutionAssistant = Class.create();
AIResolutionAssistant.prototype = {
    initialize: function() {
        this.providerManager = new x_ai_itsm.AIProviderManager();
        this.promptManager = new x_ai_itsm.AIPromptManager();
        this.parser = new x_ai_itsm.AIResponseParser();
    },

    /**
     * Generates a complete troubleshooting guide, root cause analysis, and resolution checklist for an incident.
     * 
     * @param {GlideRecord} incidentGr - The incident record
     * @returns {object} The resolution recommendations and checklist
     */
    generateResolutionGuide: function(incidentGr) {
        var results = {
            resolution_suggestions: '',
            root_cause_analysis: '',
            escalation_recommendation: '',
            troubleshooting_steps: [],
            resolution_checklist: []
        };

        if (!incidentGr) {
            gs.error('AIResolutionAssistant: No incident record provided.');
            return results;
        }

        var variables = {
            short_description: incidentGr.getValue('short_description') || '',
            description: incidentGr.getValue('description') || '',
            category: incidentGr.getValue('category') || 'general'
        };

        // 1. Build prompt
        var prompt = this.promptManager.buildPrompt('resolution', variables);
        var sysInstruction = "You are a senior service desk engineer. Respond ONLY with JSON containing: resolution_suggestions, root_cause_analysis, escalation_recommendation, troubleshooting_steps (array of strings), resolution_checklist (array of strings).";

        // 2. Call AI
        var responseText = this.providerManager.executeCall(
            prompt,
            '',
            sysInstruction,
            'incident',
            incidentGr.getUniqueValue(),
            'Resolution Assistant',
            'Generate Resolution Guide'
        );

        if (!responseText) {
            gs.error('AIResolutionAssistant: Empty response from AI provider.');
            return results;
        }

        // 3. Parse JSON output
        var jsonResult = this.parser.extractJson(responseText);
        if (jsonResult) {
            results.resolution_suggestions = jsonResult.resolution_suggestions || '';
            results.root_cause_analysis = jsonResult.root_cause_analysis || '';
            results.escalation_recommendation = jsonResult.escalation_recommendation || '';
            results.troubleshooting_steps = jsonResult.troubleshooting_steps || [];
            results.resolution_checklist = jsonResult.resolution_checklist || [];
        } else {
            gs.error('AIResolutionAssistant: Failed to parse JSON from response: ' + responseText);
        }

        return results;
    },

    type: 'AIResolutionAssistant'
};
