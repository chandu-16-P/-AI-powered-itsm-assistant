var AIIncidentClassifier = Class.create();
AIIncidentClassifier.prototype = {
    initialize: function() {
        this.providerManager = new x_ai_itsm.AIProviderManager();
        this.promptManager = new x_ai_itsm.AIPromptManager();
        this.parser = new x_ai_itsm.AIResponseParser();
    },

    /**
     * Classifies an incident ticket by predicting category, subcategory, impact, urgency, priority, and assignment group.
     * Can be run synchronously on a GlideRecord.
     * 
     * @param {GlideRecord} incidentGr - The incident record to classify
     * @param {boolean} applyChanges - If true, writes the predictions to the GlideRecord directly
     * @returns {object} The prediction results
     */
    classifyIncident: function(incidentGr, applyChanges) {
        var results = {
            category: '',
            subcategory: '',
            assignment_group: '',
            priority: '',
            impact: '',
            urgency: '',
            confidence_score: 0.0,
            rawResponse: ''
        };

        if (!incidentGr) {
            gs.error('AIIncidentClassifier: No incident record provided.');
            return results;
        }

        var variables = {
            short_description: incidentGr.getValue('short_description') || '',
            description: incidentGr.getValue('description') || ''
        };

        // 1. Build prompt
        var prompt = this.promptManager.buildPrompt('classification', variables);
        var sysInstruction = "You are a professional IT support agent. Analyze the ticket details and respond ONLY with JSON containing: category, subcategory, assignment_group, priority, impact, urgency, confidence_score.";

        // 2. Call AI
        var responseText = this.providerManager.executeCall(
            prompt,
            '', // default provider
            sysInstruction,
            'incident',
            incidentGr.getUniqueValue(),
            'Incident Classifier',
            'Classify Ticket'
        );

        results.rawResponse = responseText;

        if (!responseText) {
            gs.error('AIIncidentClassifier: Empty response from AI provider.');
            return results;
        }

        // 3. Parse JSON output
        var jsonResult = this.parser.extractJson(responseText);
        if (jsonResult) {
            results.category = (jsonResult.category || '').toLowerCase().trim();
            results.subcategory = (jsonResult.subcategory || '').toLowerCase().trim();
            results.priority = jsonResult.priority || '';
            results.impact = jsonResult.impact || '';
            results.urgency = jsonResult.urgency || '';
            results.confidence_score = parseFloat(jsonResult.confidence_score) || 0.0;

            // Resolve assignment group name to sys_id
            if (jsonResult.assignment_group) {
                var groupSysId = this.resolveGroup(jsonResult.assignment_group);
                if (groupSysId) {
                    results.assignment_group = groupSysId;
                } else {
                    gs.warn('AIIncidentClassifier: Could not resolve group name: ' + jsonResult.assignment_group);
                }
            }

            // 4. Apply changes if requested
            if (applyChanges) {
                if (results.category) incidentGr.category = results.category;
                if (results.subcategory) incidentGr.subcategory = results.subcategory;
                if (results.assignment_group) incidentGr.assignment_group = results.assignment_group;
                
                // Urgency/Impact to determine priority
                if (results.impact) incidentGr.impact = this.mapUrgencyImpact(results.impact);
                if (results.urgency) incidentGr.urgency = this.mapUrgencyImpact(results.urgency);
                
                // Store AI classification note in work notes
                var note = '[AI Classifier] Ticket classified automatically:\n' +
                           '- Category: ' + results.category + '\n' +
                           '- Subcategory: ' + results.subcategory + '\n' +
                           '- Assignment Group: ' + (jsonResult.assignment_group || 'Unresolved') + '\n' +
                           '- Impact/Urgency: ' + results.impact + '/' + results.urgency + '\n' +
                           '- Confidence Score: ' + (results.confidence_score * 100).toFixed(1) + '%';
                incidentGr.work_notes = note;
                
                // Also log the confidence score on the incident if a custom field exists
                // We will add custom fields or handle dynamically
            }
        } else {
            gs.error('AIIncidentClassifier: Failed to parse JSON from AI response: ' + responseText);
        }

        return results;
    },

    /**
     * Resolves a group name to its sys_id.
     */
    resolveGroup: function(groupName) {
        var grGroup = new GlideRecord('sys_user_group');
        grGroup.addQuery('name', 'CONTAINS', groupName).addOrCondition('name', groupName);
        grGroup.addQuery('active', true);
        grGroup.query();
        if (grGroup.next()) {
            return grGroup.getUniqueValue();
        }
        return '';
    },

    /**
     * Maps verbal or numeric impact/urgency to standard ServiceNow choice integers (1, 2, 3).
     */
    mapUrgencyImpact: function(val) {
        var str = String(val).toLowerCase();
        if (str.indexOf('1') > -1 || str.indexOf('high') > -1 || str.indexOf('critical') > -1) {
            return '1'; // High
        }
        if (str.indexOf('2') > -1 || str.indexOf('medium') > -1 || str.indexOf('moderate') > -1) {
            return '2'; // Medium
        }
        if (str.indexOf('3') > -1 || str.indexOf('low') > -1) {
            return '3'; // Low
        }
        return '';
    },

    type: 'AIIncidentClassifier'
};
