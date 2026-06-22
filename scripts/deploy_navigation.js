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

async function deployNavigation() {
  console.log('Deploying Application Menu and Modules to ServiceNow navigation...');

  const snScript = `
var scopeId = "${scopeSysId}";

function createApplicationMenu() {
    var gr = new GlideRecord("sys_app_application");
    gr.addQuery("title", "AI-Powered ITSM Assistant");
    gr.addQuery("sys_scope", scopeId);
    gr.query();
    
    if (gr.next()) {
        print("Application Menu already exists (sys_id: " + gr.getUniqueValue() + ")");
        return gr.getUniqueValue();
    }
    
    print("Creating Application Menu: AI-Powered ITSM Assistant...");
    gr.initialize();
    gr.title = "AI-Powered ITSM Assistant";
    gr.name = "AI-Powered ITSM Assistant";
    gr.active = "true";
    gr.sys_scope = scopeId;
    gr.sys_package = scopeId;
    var menuId = gr.insert();
    print("Created Application Menu successfully (sys_id: " + menuId + ")");
    return menuId;
}

function createModule(menuId, title, table, order) {
    var gr = new GlideRecord("sys_app_module");
    gr.addQuery("application", menuId);
    gr.addQuery("title", title);
    gr.addQuery("sys_scope", scopeId);
    gr.query();
    
    if (gr.next()) {
        print("Module '" + title + "' already exists.");
        return gr.getUniqueValue();
    }
    
    print("Creating Module: " + title + "...");
    gr.initialize();
    gr.application = menuId;
    gr.title = title;
    gr.name = table;
    gr.link_type = "LIST";
    gr.order = order;
    gr.active = "true";
    gr.sys_scope = scopeId;
    gr.sys_package = scopeId;
    var moduleId = gr.insert();
    print("Created Module '" + title + "' successfully (sys_id: " + moduleId + ")");
    return moduleId;
}

try {
    var menuId = createApplicationMenu();
    if (menuId) {
        createModule(menuId, "Model Configurations", "x_ai_itsm_model_config", 10);
        createModule(menuId, "AI Prompt Library", "x_ai_itsm_prompt_library", 20);
        createModule(menuId, "AI Request Logs", "x_ai_itsm_request", 30);
        createModule(menuId, "AI Performance Logs", "x_ai_itsm_ai_log", 40);
        createModule(menuId, "Change Risk Assessments", "x_ai_itsm_risk_assessment", 50);
        createModule(menuId, "AI Feedback", "x_ai_itsm_ai_feedback", 60);
        createModule(menuId, "Knowledge Recommendations", "x_ai_itsm_recommendation", 70);
    }
    print("Navigation deployment completed successfully!");
} catch (e) {
    print("Error deploying navigation: " + e.toString());
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
      console.error('Failed to configure navigation:', response.status);
    }
  } catch (err) {
    console.error(err);
  }
}

deployNavigation();
