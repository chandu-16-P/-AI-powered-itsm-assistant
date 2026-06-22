var AIIncidentSummarizer = Class.create();
AIIncidentSummarizer.prototype = {
    initialize: function() {
        this.providerManager = new x_ai_itsm.AIProviderManager();
        this.promptManager = new x_ai_itsm.AIPromptManager();
        this.parser = new x_ai_itsm.AIResponseParser();
    },

    /**
     * Generates summaries for an incident ticket including technical, executive, and agent summaries.
     * 
     * @param {GlideRecord} incidentGr - The incident GlideRecord
     * @returns {object} Summarization results containing summaries
     */
    summarizeTicket: function(incidentGr) {
        var results = {
            ticket_summary: '',
            executive_summary: '',
            agent_notes: '',
            resolution_notes: ''
        };

        if (!incidentGr) {
            gs.error('AIIncidentSummarizer: No incident record provided.');
            return results;
        }

        // Get recent work notes for context
        var journalGr = new GlideRecord('sys_journal_field');
        journalGr.addQuery('element_id', incidentGr.getUniqueValue());
        journalGr.addQuery('element', 'work_notes');
        journalGr.orderByDesc('sys_created_on');
        journalGr.setLimit(5);
        journalGr.query();

        var workNotes = [];
        while (journalGr.next()) {
            workNotes.push(journalGr.getValue('value'));
        }

        var variables = {
            number: incidentGr.getValue('number') || '',
            short_description: incidentGr.getValue('short_description') || '',
            description: incidentGr.getValue('description') || '',
            work_notes: workNotes.join('\n\n') || 'No recent work notes.'
        };

        // 1. Build prompt
        var prompt = this.promptManager.buildPrompt('summarization', variables);
        var sysInstruction = "You are a professional IT support manager. Analyze the ticket and work notes and respond ONLY with JSON containing: ticket_summary, executive_summary, agent_notes, resolution_notes.";

        // 2. Call AI
        var responseText = this.providerManager.executeCall(
            prompt,
            '',
            sysInstruction,
            'incident',
            incidentGr.getUniqueValue(),
            'Summarizer',
            'Summarize Ticket'
        );

        if (!responseText) {
            gs.error('AIIncidentSummarizer: Empty response from AI.');
            return results;
        }

        // 3. Parse JSON
        var jsonResult = this.parser.extractJson(responseText);
        if (jsonResult) {
            results.ticket_summary = jsonResult.ticket_summary || '';
            results.executive_summary = jsonResult.executive_summary || '';
            results.agent_notes = jsonResult.agent_notes || '';
            results.resolution_notes = jsonResult.resolution_notes || '';
            
            // Post summaries to Incident work notes
            var note = '[AI Ticket Summary]\n' +
                       '• Ticket Summary: ' + results.ticket_summary + '\n' +
                       '• Executive Summary: ' + results.executive_summary + '\n' +
                       '• Suggested Agent Technical Notes: ' + results.agent_notes + '\n' +
                       '• Draft Resolution Notes: ' + results.resolution_notes;
            
            incidentGr.work_notes = note;
        } else {
            gs.error('AIIncidentSummarizer: Failed to parse JSON from AI response: ' + responseText);
        }

        return results;
    },

    type: 'AIIncidentSummarizer'
};
