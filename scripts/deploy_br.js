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

const businessRules = [
  {
    name: "AI Incident Classifier",
    collection: "incident",
    when: "async",
    action_insert: "true",
    action_update: "false",
    condition: "current.short_description.nil() == false",
    script: `(function executeRule(current, previous /*null when async*/) {
    try {
        var classifier = new x_ai_itsm.AIIncidentClassifier();
        classifier.classifyIncident(current, true);
        current.update();
    } catch(ex) {
        gs.error("Business Rule AI Incident Classifier Error: " + ex.toString());
    }
})(current, previous);`
  },
  {
    name: "AI Change Risk Analyzer",
    collection: "change_request",
    when: "async",
    action_insert: "true",
    action_update: "true",
    condition: "current.short_description.changes() || current.description.changes() || current.justification.changes() || current.implementation_plan.changes()",
    script: `(function executeRule(current, previous /*null when async*/) {
    try {
        var analyzer = new x_ai_itsm.AIChangeRiskAnalyzer();
        analyzer.analyzeChangeRisk(current);
        current.update();
    } catch(ex) {
        gs.error("Business Rule AI Change Risk Analyzer Error: " + ex.toString());
    }
})(current, previous);`
  }
];

async function deployBusinessRules() {
  console.log(`Preparing to deploy ${businessRules.length} Business Rules...`);

  let snScript = `
var scopeId = "${scopeSysId}";

function deployBR(name, table, when, insert, update, condition, scriptContent) {
    var gr = new GlideRecord("sys_script");
    gr.addQuery("name", name);
    gr.addQuery("sys_scope", scopeId);
    gr.query();
    
    if (gr.next()) {
        print("Updating Business Rule: " + name);
        gr.collection = table;
        gr.when = when;
        gr.action_insert = insert;
        gr.action_update = update;
        gr.condition = condition;
        gr.script = scriptContent;
        gr.active = "true";
        gr.update();
        print("Updated BR " + name + " successfully (sys_id: " + gr.getUniqueValue() + ")");
    } else {
        print("Creating Business Rule: " + name);
        gr.initialize();
        gr.name = name;
        gr.collection = table;
        gr.when = when;
        gr.action_insert = insert;
        gr.action_update = update;
        gr.condition = condition;
        gr.script = scriptContent;
        gr.active = "true";
        gr.advanced = "true";
        gr.sys_scope = scopeId;
        gr.sys_package = scopeId;
        var sysId = gr.insert();
        print("Created BR " + name + " successfully (sys_id: " + sysId + ")");
    }
}

try {
`;

  businessRules.forEach(br => {
    const escapedScript = br.script
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r/g, '')
      .replace(/\n/g, '\\n');

    snScript += `  deployBR("${br.name}", "${br.collection}", "${br.when}", "${br.action_insert}", "${br.action_update}", "${br.condition}", "${escapedScript}");\n`;
  });

  snScript += `  print("All Business Rules deployed successfully!");\n} catch (e) {\n  print("Error deploying Business Rules: " + e.toString());\n}`;

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
      console.error('Failed to deploy business rules:', response.status);
      console.error(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

deployBusinessRules();
