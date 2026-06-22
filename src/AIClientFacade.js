var AIClientFacade = Class.create();
AIClientFacade.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {

    /**
     * AJAX wrapper to classify an incident on-the-fly from client inputs.
     * Called onChange of Short Description.
     */
    classifyIncidentAjax: function() {
        var result = {
            category: '',
            subcategory: '',
            assignment_group: '',
            priority: '',
            impact: '',
            urgency: '',
            confidence_score: 0.0
        };

        var shortDesc = this.getParameter('sysparm_short_description');
        var desc = this.getParameter('sysparm_description') || '';
        
        if (!shortDesc) {
            return JSON.stringify(result);
        }

        try {
            // Instantiate classifier and run logic dynamically using a temp record
            var tempIncident = new GlideRecord('incident');
            tempIncident.initialize();
            tempIncident.short_description = shortDesc;
            tempIncident.description = desc;

            var classifier = new x_ai_itsm.AIIncidentClassifier();
            var predictions = classifier.classifyIncident(tempIncident, false);

            result.category = predictions.category;
            result.subcategory = predictions.subcategory;
            result.assignment_group = predictions.assignment_group;
            result.priority = predictions.priority;
            result.impact = predictions.impact;
            result.urgency = predictions.urgency;
            result.confidence_score = predictions.confidence_score;

            // Retrieve assignment group name for UI purposes
            if (predictions.assignment_group) {
                var grGrp = new GlideRecord('sys_user_group');
                if (grGrp.get(predictions.assignment_group)) {
                    result.assignment_group_name = grGrp.getValue('name');
                }
            }
        } catch (ex) {
            gs.error('AIClientFacade: Error in classifyIncidentAjax: ' + ex.toString());
        }

        return JSON.stringify(result);
    },

    /**
     * AJAX wrapper to fetch incident summary.
     */
    summarizeIncidentAjax: function() {
        var incidentSysId = this.getParameter('sysparm_incident_sys_id');
        var result = {
            success: false,
            ticket_summary: '',
            executive_summary: '',
            agent_notes: '',
            resolution_notes: ''
        };

        if (!incidentSysId) return JSON.stringify(result);

        try {
            var gr = new GlideRecord('incident');
            if (gr.get(incidentSysId)) {
                var summarizer = new x_ai_itsm.AIIncidentSummarizer();
                var summaries = summarizer.summarizeTicket(gr);
                result.success = true;
                result.ticket_summary = summaries.ticket_summary;
                result.executive_summary = summaries.executive_summary;
                result.agent_notes = summaries.agent_notes;
                result.resolution_notes = summaries.resolution_notes;
            }
        } catch (ex) {
            gs.error('AIClientFacade: Error in summarizeIncidentAjax: ' + ex.toString());
        }

        return JSON.stringify(result);
    },

    type: 'AIClientFacade'
});
