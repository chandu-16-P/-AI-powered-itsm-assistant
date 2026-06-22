const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      process.env[key] = value;
    }
  });
}
loadEnv();

const instanceUrl = process.env.SN_SDK_INSTANCE_URL;
const username = process.env.SN_SDK_USER;
const password = process.env.SN_SDK_USER_PWD;
const auth = Buffer.from(`${username}:${password}`).toString('base64');
const scopeSysId = "6d5fac8b83690b10e051ccb6feaad3c4"; // sys_id of x_ai_itsm scoped app

const uiActions = [
  {
    name: "AI Summarize Ticket",
    table: "incident",
    comments: "Summarizes the ticket details and work notes using AI",
    script: `(function() {
    try {
        var summarizer = new x_ai_itsm.AIIncidentSummarizer();
        summarizer.summarizeTicket(current);
        current.update();
        action.setRedirectURL(current);
    } catch(ex) {
        gs.addErrorMessage("AI Summarization failed: " + ex.toString());
    }
})();`
  },
  {
    name: "AI Suggest Resolution",
    table: "incident",
    comments: "Generates a resolution plan and root cause analysis using AI",
    script: `(function() {
    try {
        var assistant = new x_ai_itsm.AIResolutionAssistant();
        var guide = assistant.generateResolutionGuide(current);
        
        var stepLines = [];
        for (var i = 0; i < guide.troubleshooting_steps.length; i++) {
            stepLines.push("  " + (i + 1) + ". " + guide.troubleshooting_steps[i]);
        }
        var checklistLines = [];
        for (var j = 0; j < guide.resolution_checklist.length; j++) {
            checklistLines.push("  [ ] " + guide.resolution_checklist[j]);
        }

        var note = "[AI Suggested Resolution Guide]\\n" +
                   "• Resolution Suggestions: " + guide.resolution_suggestions + "\\n\\n" +
                   "• Root Cause Analysis: " + guide.root_cause_analysis + "\\n\\n" +
                   "• Escalation Recommendation: " + guide.escalation_recommendation + "\\n\\n" +
                   "• Troubleshooting Steps:\\n" + stepLines.join("\\n") + "\\n\\n" +
                   "• Checklist:\\n" + checklistLines.join("\\n");
        
        current.work_notes = note;
        current.update();
        action.setRedirectURL(current);
    } catch(ex) {
        gs.addErrorMessage("AI Resolution generation failed: " + ex.toString());
    }
})();`
  },
  {
    name: "AI Recommend Articles",
    table: "incident",
    comments: "Finds and scores relevant KB articles using hybrid AI matching",
    script: `(function() {
    try {
        var assistant = new x_ai_itsm.AIKnowledgeAssistant();
        var recs = assistant.recommendArticles(current);
        
        if (recs.length > 0) {
            var lines = [];
            for (var i = 0; i < recs.length; i++) {
                lines.push("• KB Article " + recs[i].kb_number + " - " + recs[i].kb_title + " (Relevancy: " + recs[i].relevancy_score.toFixed(0) + "%)");
            }
            current.work_notes = "[AI Knowledge Recommendations]\\n" + lines.join("\\n");
        } else {
            current.work_notes = "[AI Knowledge Recommendations] No matching articles found with high confidence.";
        }
        current.update();
        action.setRedirectURL(current);
    } catch(ex) {
        gs.addErrorMessage("AI Knowledge recommendation failed: " + ex.toString());
    }
})();`
  }
];

async function deployUIActions() {
  console.log(`Preparing to deploy ${uiActions.length} Form UI Actions...`);

  let snScript = `
var scopeId = "${scopeSysId}";

function deployAction(name, table, comments, scriptContent) {
    var gr = new GlideRecord("sys_ui_action");
    gr.addQuery("name", name);
    gr.addQuery("table", table);
    gr.addQuery("sys_scope", scopeId);
    gr.query();
    
    if (gr.next()) {
        print("Updating UI Action: " + name);
        gr.script = scriptContent;
        gr.comments = comments;
        gr.form_button = "true";
        gr.show_insert = "false";
        gr.show_update = "true";
        gr.active = "true";
        gr.update();
        print("Updated UI Action " + name + " successfully (sys_id: " + gr.getUniqueValue() + ")");
    } else {
        print("Creating UI Action: " + name);
        gr.initialize();
        gr.name = name;
        gr.table = table;
        gr.comments = comments;
        gr.script = scriptContent;
        gr.form_button = "true";
        gr.show_insert = "false";
        gr.show_update = "true";
        gr.active = "true";
        gr.sys_scope = scopeId;
        gr.sys_package = scopeId;
        var sysId = gr.insert();
        print("Created UI Action " + name + " successfully (sys_id: " + sysId + ")");
    }
}

try {
`;

  uiActions.forEach(action => {
    const escapedScript = action.script
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r/g, '')
      .replace(/\n/g, '\\n');

    snScript += `  deployAction("${action.name}", "${action.table}", "${action.comments}", "${escapedScript}");\n`;
  });

  snScript += `  print("All UI Actions deployed successfully!");\n} catch (e) {\n  print("Error deploying UI Actions: " + e.toString());\n}`;

  try {
    const response = await fetch(`${instanceUrl}/api/1954563/evaluator/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ script: snScript })
    });

    const data = await response.json();
    if (response.ok) {
      console.log('Evaluator output:\n', data.result.output);
    } else {
      console.error('Failed to deploy UI Actions:', response.status);
      console.error(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

deployUIActions();
