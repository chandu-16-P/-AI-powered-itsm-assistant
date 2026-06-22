var AIChangeRiskAnalyzer = Class.create();
AIChangeRiskAnalyzer.prototype = {
    initialize: function() {
        this.providerManager = new x_ai_itsm.AIProviderManager();
        this.promptManager = new x_ai_itsm.AIPromptManager();
        this.parser = new x_ai_itsm.AIResponseParser();
        this.riskTable = 'x_ai_itsm_risk_assessment';
    },

    /**
     * Evaluates the risk of a Change Request.
     * 
     * @param {GlideRecord} changeGr - The change request GlideRecord
     * @returns {object} Risk assessment details (score, level, summary, plans)
     */
    analyzeChangeRisk: function(changeGr) {
        var result = {
            risk_score: 50,
            risk_level: 'Medium',
            assessment_summary: '',
            rollback_plan: '',
            testing_plan: '',
            recommendation: 'Request Info'
        };

        if (!changeGr) {
            gs.error('AIChangeRiskAnalyzer: No Change Request record provided.');
            return result;
        }

        var variables = {
            short_description: changeGr.getValue('short_description') || '',
            description: changeGr.getValue('description') || '',
            justification: changeGr.getValue('justification') || '',
            implementation_plan: changeGr.getValue('implementation_plan') || '',
            risk_impact: changeGr.getValue('risk_impact') || ''
        };

        // 1. Build prompt
        var prompt = this.promptManager.buildPrompt('change_risk', variables);
        var sysInstruction = "You are an Enterprise Change Advisory Board (CAB) Analyst. Analyze the plans and justifications, and respond ONLY with JSON containing: risk_score (integer 0-100), risk_level (Low|Medium|High|Critical), assessment_summary, rollback_plan, testing_plan, approval_recommendation (Approve|Reject|Request Info).";

        // 2. Call AI
        var responseText = this.providerManager.executeCall(
            prompt,
            '',
            sysInstruction,
            'change_request',
            changeGr.getUniqueValue(),
            'Change Risk Analyzer',
            'Assess Change Risk'
        );

        if (!responseText) {
            gs.error('AIChangeRiskAnalyzer: Empty response from AI provider.');
            return result;
        }

        // 3. Parse JSON
        var jsonResult = this.parser.extractJson(responseText);
        if (jsonResult) {
            result.risk_score = parseInt(jsonResult.risk_score, 10) || 50;
            result.risk_level = jsonResult.risk_level || 'Medium';
            result.assessment_summary = jsonResult.assessment_summary || '';
            result.rollback_plan = jsonResult.rollback_plan || '';
            result.testing_plan = jsonResult.testing_plan || '';
            result.recommendation = jsonResult.approval_recommendation || 'Request Info';

            // 4. Save to x_ai_itsm_risk_assessment table
            this.saveRiskAssessment(changeGr.getUniqueValue(), result);

            // 5. Update Change Request record work notes with summary
            var note = '[AI Risk Analysis]\n' +
                       '- Estimated Risk Level: ' + result.risk_level + ' (Score: ' + result.risk_score + '/100)\n' +
                       '- CAB Approval Recommendation: ' + result.recommendation + '\n' +
                       '- Summary: ' + result.assessment_summary + '\n' +
                       '- Test Plan Review: ' + result.testing_plan + '\n' +
                       '- Rollback Plan Review: ' + result.rollback_plan;
            changeGr.work_notes = note;
        } else {
            gs.error('AIChangeRiskAnalyzer: Failed to parse JSON from AI response: ' + responseText);
        }

        return result;
    },

    /**
     * Saves the risk assessment results in the custom database table.
     */
    saveRiskAssessment: function(changeSysId, data) {
        try {
            var gr = new GlideRecord(this.riskTable);
            gr.addQuery('change_request', changeSysId);
            gr.query();

            if (gr.next()) {
                gr.risk_score = data.risk_score;
                gr.risk_level = data.risk_level;
                gr.assessment_summary = data.assessment_summary;
                gr.rollback_plan = data.rollback_plan;
                gr.testing_plan = data.testing_plan;
                gr.recommendation = data.recommendation;
                gr.update();
            } else {
                gr.initialize();
                gr.change_request = changeSysId;
                gr.risk_score = data.risk_score;
                gr.risk_level = data.risk_level;
                gr.assessment_summary = data.assessment_summary;
                gr.rollback_plan = data.rollback_plan;
                gr.testing_plan = data.testing_plan;
                gr.recommendation = data.recommendation;
                gr.insert();
            }
        } catch (ex) {
            gs.error('AIChangeRiskAnalyzer: Error saving risk assessment: ' + ex.toString());
        }
    },

    type: 'AIChangeRiskAnalyzer'
};
