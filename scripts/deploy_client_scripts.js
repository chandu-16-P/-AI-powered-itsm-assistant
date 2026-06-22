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

const clientScriptCode = `function onChange(control, oldValue, newValue, isLoading, isTemplate) {
    if (isLoading || newValue === '') {
        return;
    }

    var desc = g_form.getValue('description') || '';
    
    var ga = new GlideAjax('x_ai_itsm.AIClientFacade');
    ga.addParam('sysparm_name', 'classifyIncidentAjax');
    ga.addParam('sysparm_short_description', newValue);
    ga.addParam('sysparm_description', desc);
    
    ga.getXMLAnswer(function(answer) {
        if (answer) {
            try {
                var predictions = JSON.parse(answer);
                if (predictions && predictions.confidence_score > 0.3) {
                    var pct = (predictions.confidence_score * 100).toFixed(0);
                    var msg = "[AI Suggestion] Auto-classification predicted (" + pct + "% confidence):" +
                              "\\n• Category: " + predictions.category + 
                              "\\n• Subcategory: " + predictions.subcategory + 
                              "\\n• Group: " + (predictions.assignment_group_name || 'Service Desk');
                    
                    g_form.showFieldMsg('short_description', msg, 'info', false);
                    
                    var currentCat = g_form.getValue('category');
                    if ((!currentCat || currentCat === 'inquiry') && predictions.category) {
                        g_form.setValue('category', predictions.category.toLowerCase());
                    }
                    var currentSubcat = g_form.getValue('subcategory');
                    if (!currentSubcat && predictions.subcategory) {
                        g_form.setValue('subcategory', predictions.subcategory.toLowerCase());
                    }
                    if (!g_form.getValue('assignment_group') && predictions.assignment_group) {
                        g_form.setValue('assignment_group', predictions.assignment_group);
                    }
                    if (!g_form.getValue('impact') && predictions.impact) {
                        g_form.setValue('impact', predictions.impact);
                    }
                    if (!g_form.getValue('urgency') && predictions.urgency) {
                        g_form.setValue('urgency', predictions.urgency);
                    }
                }
            } catch(e) {
                // Ignore parse errors
            }
        }
    });
}`;

async function deployClientScript() {
  console.log('Deploying Incident onChange Client Script...');

  const snScript = `
var scopeId = "${scopeSysId}";

try {
    var gr = new GlideRecord("sys_script_client");
    gr.addQuery("name", "AI Incident Auto Classifier");
    gr.addQuery("sys_scope", scopeId);
    gr.query();
    
    if (gr.next()) {
        print("Updating Client Script: AI Incident Auto Classifier");
        gr.table = "incident";
        gr.type = "onChange";
        gr.field = "short_description";
        gr.script = "${clientScriptCode.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '').replace(/\n/g, '\\n')}";
        gr.active = "true";
        gr.update();
        print("Updated Client Script successfully (sys_id: " + gr.getUniqueValue() + ")");
    } else {
        print("Creating Client Script: AI Incident Auto Classifier");
        gr.initialize();
        gr.name = "AI Incident Auto Classifier";
        gr.table = "incident";
        gr.type = "onChange";
        gr.field = "short_description";
        gr.script = "${clientScriptCode.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '').replace(/\n/g, '\\n')}";
        gr.active = "true";
        gr.sys_scope = scopeId;
        gr.sys_package = scopeId;
        var sysId = gr.insert();
        print("Created Client Script successfully (sys_id: " + sysId + ")");
    }
} catch (e) {
    print("Error deploying Client Script: " + e.toString());
}
`;

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
      console.error('Failed to deploy Client Script:', response.status);
      console.error(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

deployClientScript();
