var AIPromptManager = Class.create();
AIPromptManager.prototype = {
    initialize: function() {
        this.promptTable = 'x_ai_itsm_prompt_library';
        this.fallbacks = {
            'classification': "You are an expert ServiceNow ITSM classifier. Classify the following Incident based on short description and description.\nIncident Details:\nShort Description: {{short_description}}\nDescription: {{description}}\n\nRespond with a JSON object containing exactly these fields (do not include markdown block markers outside JSON):\n{\n  \"category\": \"string\",\n  \"subcategory\": \"string\",\n  \"assignment_group\": \"string\",\n  \"priority\": \"string\",\n  \"impact\": \"string\",\n  \"urgency\": \"string\",\n  \"confidence_score\": 0.00\n}\nUse standard IT categories (Hardware, Software, Network, Database, Inquiry) and match priority logic (1-Critical, 2-High, 3-Moderate, 4-Low) based on impact and urgency.",
            
            'summarization': "Summarize this incident ticket for service desk agents and executives.\nTicket details:\nNumber: {{number}}\nShort Description: {{short_description}}\nDescription: {{description}}\nWork Notes: {{work_notes}}\n\nProvide your response in JSON format containing:\n{\n  \"ticket_summary\": \"brief summary of the issue\",\n  \"executive_summary\": \"summary for management\",\n  \"agent_notes\": \"key technical facts for next agent\",\n  \"resolution_notes\": \"how it was or should be resolved\"\n}",
            
            'knowledge': "Based on the incident description, recommend relevant troubleshooting steps and article topics.\nIncident:\nShort Description: {{short_description}}\nDescription: {{description}}\n\nProvide your response in JSON format:\n{\n  \"recommended_topics\": [\"topic1\", \"topic2\"],\n  \"troubleshooting_suggestions\": \"detailed text steps\",\n  \"relevancy_score\": 95.0\n}",
            
            'resolution': "Analyze this incident and generate resolution recommendations, troubleshooting steps, and a checklist.\nIncident details:\nShort Description: {{short_description}}\nDescription: {{description}}\nCategory: {{category}}\n\nRespond in JSON format:\n{\n  \"resolution_suggestions\": \"proposed resolution\",\n  \"root_cause_analysis\": \"likely root cause\",\n  \"escalation_recommendation\": \"should it be escalated and to whom\",\n  \"troubleshooting_steps\": [\"step 1\", \"step 2\"],\n  \"resolution_checklist\": [\"task 1\", \"task 2\"]\n}",
            
            'change_risk': "Analyze this Change Request and perform a risk assessment.\nChange Details:\nShort Description: {{short_description}}\nDescription: {{description}}\nJustification: {{justification}}\nImplementation Plan: {{implementation_plan}}\nRisk and Impact Analysis: {{risk_impact}}\n\nRespond with a JSON object:\n{\n  \"risk_score\": 0 to 100,\n  \"risk_level\": \"Low|Medium|High|Critical\",\n  \"impact_assessment\": \"summary of impact\",\n  \"rollback_plan\": \"rollback strategy evaluation\",\n  \"testing_plan\": \"testing strategy evaluation\",\n  \"approval_recommendation\": \"Approve|Reject|Request Info\"\n}",
            
            'chatbot': "You are an AI Virtual Agent helper for ServiceNow. The user says: {{user_message}}.\nContext: {{context}}.\n\nRespond with a friendly, helpful message, suggesting knowledge article search terms or incident creation details if appropriate."
        };
    },

    /**
     * Gets a prompt template by name, either from the database or fallbacks.
     * 
     * @param {string} purpose - The purpose key (e.g. classification, summarization, etc.)
     * @returns {string} The prompt template string
     */
    getTemplate: function(purpose) {
        var gr = new GlideRecord(this.promptTable);
        gr.addQuery('purpose', purpose);
        gr.addQuery('active', true);
        gr.orderByDesc('version');
        gr.query();

        if (gr.next()) {
            return gr.getValue('prompt_template');
        }

        // Return fallback if not found in table
        return this.fallbacks[purpose] || '';
    },

    /**
     * Retrieves the template and replaces all variables of form {{var_name}} with values.
     * 
     * @param {string} purpose - Prompt purpose
     * @param {object} variables - Key-value map of template variables
     * @returns {string} The formatted prompt string
     */
    buildPrompt: function(purpose, variables) {
        var template = this.getTemplate(purpose);
        if (!template) {
            return '';
        }

        for (var key in variables) {
            if (variables.hasOwnProperty(key)) {
                var val = variables[key] || '';
                // Escape simple regex characters in key just in case
                var placeholder = new RegExp('{{\\s*' + key + '\\s*}}', 'g');
                template = template.replace(placeholder, val);
            }
        }

        return template;
    },

    type: 'AIPromptManager'
};
