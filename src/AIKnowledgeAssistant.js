var AIKnowledgeAssistant = Class.create();
AIKnowledgeAssistant.prototype = {
    initialize: function() {
        this.providerManager = new x_ai_itsm.AIProviderManager();
        this.promptManager = new x_ai_itsm.AIPromptManager();
        this.parser = new x_ai_itsm.AIResponseParser();
        this.recommendationTable = 'x_ai_itsm_recommendation';
    },

    /**
     * Recommends knowledge base articles for a given incident and generates troubleshooting suggestions.
     * 
     * @param {GlideRecord} incidentGr - The incident record
     * @returns {array} Array of recommended article objects
     */
    recommendArticles: function(incidentGr) {
        var recommendations = [];
        if (!incidentGr) return recommendations;

        var shortDesc = incidentGr.getValue('short_description') || '';
        var desc = incidentGr.getValue('description') || '';
        var incidentSysId = incidentGr.getUniqueValue();

        // 1. Perform database text search on kb_knowledge to get candidates (published articles)
        var kbGr = new GlideRecord('kb_knowledge');
        kbGr.addQuery('active', true);
        kbGr.addQuery('workflow_state', 'published');
        // Simple search query matching terms from short description
        var searchTerms = shortDesc.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(function(t) {
            return t.length > 3;
        }).join(' OR ');
        
        if (searchTerms) {
            kbGr.addQuery('123TEXTQUERY321', searchTerms);
        }
        kbGr.setLimit(5);
        kbGr.query();

        var articleCandidates = [];
        while (kbGr.next()) {
            articleCandidates.push({
                sys_id: kbGr.getUniqueValue(),
                number: kbGr.getValue('number'),
                short_description: kbGr.getValue('short_description'),
                text: kbGr.getValue('text') ? kbGr.getValue('text').replace(/<[^>]*>/g, '').substring(0, 1000) : '' // strip HTML, truncate
            });
        }

        if (articleCandidates.length === 0) {
            gs.warn('AIKnowledgeAssistant: No candidate articles found in knowledge base for query: ' + searchTerms);
            return recommendations;
        }

        // 2. Loop through candidates and evaluate relevancy via AI
        for (var i = 0; i < articleCandidates.length; i++) {
            var candidate = articleCandidates[i];
            
            var promptVars = {
                short_description: shortDesc,
                description: desc + '\n\nKnowledge Article Candidate:\nNumber: ' + candidate.number + '\nTitle: ' + candidate.short_description + '\nContent Snippet:\n' + candidate.text
            };

            var prompt = this.promptManager.buildPrompt('knowledge', promptVars);
            var sysInstruction = "Evaluate the relevancy of the knowledge article to the incident. Respond only with JSON containing: recommended_topics, troubleshooting_suggestions, relevancy_score.";

            var responseText = this.providerManager.executeCall(
                prompt,
                '',
                sysInstruction,
                'kb_knowledge',
                candidate.sys_id,
                'Knowledge Assistant',
                'Rate Article Relevancy'
            );

            if (responseText) {
                var jsonResult = this.parser.extractJson(responseText);
                if (jsonResult) {
                    var relevancy = parseFloat(jsonResult.relevancy_score) || 0.0;
                    
                    // We only recommend articles with a relevancy score > 50%
                    if (relevancy >= 50.0) {
                        var recommendationObj = {
                            kb_sys_id: candidate.sys_id,
                            kb_number: candidate.number,
                            kb_title: candidate.short_description,
                            relevancy_score: relevancy,
                            troubleshooting_suggestions: jsonResult.troubleshooting_suggestions || '',
                            recommended_topics: jsonResult.recommended_topics || []
                        };

                        recommendations.push(recommendationObj);

                        // Save recommendation to the custom x_ai_itsm_recommendation table
                        this.saveRecommendation(incidentSysId, candidate.sys_id, relevancy, 'Troubleshooting');
                    }
                }
            }
        }

        // Sort by relevancy score descending
        recommendations.sort(function(a, b) {
            return b.relevancy_score - a.relevancy_score;
        });

        return recommendations;
    },

    /**
     * Inserts or updates a recommendation record in the x_ai_itsm_recommendation table.
     */
    saveRecommendation: function(incidentSysId, kbSysId, relevancy, type) {
        try {
            var gr = new GlideRecord(this.recommendationTable);
            gr.addQuery('target_record', incidentSysId);
            gr.addQuery('knowledge_article', kbSysId);
            gr.query();

            if (gr.next()) {
                gr.relevancy_score = relevancy;
                gr.suggestion_type = type;
                gr.update();
            } else {
                gr.initialize();
                gr.target_record = incidentSysId;
                gr.knowledge_article = kbSysId;
                gr.relevancy_score = relevancy;
                gr.suggestion_type = type;
                gr.insert();
            }
        } catch (ex) {
            gs.error('AIKnowledgeAssistant: Error saving recommendation: ' + ex.toString());
        }
    },

    type: 'AIKnowledgeAssistant'
};
