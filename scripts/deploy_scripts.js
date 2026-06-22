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

async function deployScripts() {
  const srcDir = path.join(__dirname, '..', 'src');
  if (!fs.existsSync(srcDir)) {
    console.error('Source directory src/ not found!');
    return;
  }

  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js'));
  console.log(`Found ${files.length} script files to deploy...`);

  let snScript = `
var scopeId = "${scopeSysId}";

function deployScriptInclude(name, scriptContent) {
    var apiName = "x_ai_itsm." + name;
    var gr = new GlideRecord("sys_script_include");
    gr.addQuery("name", name);
    gr.addQuery("sys_scope", scopeId);
    gr.query();
    
    if (gr.next()) {
        print("Updating Script Include: " + name);
        gr.script = scriptContent;
        gr.api_name = apiName;
        gr.active = "true";
        gr.access = "public";
        gr.update();
        print("Updated " + name + " successfully (sys_id: " + gr.getUniqueValue() + ")");
    } else {
        print("Creating Script Include: " + name);
        gr.initialize();
        gr.name = name;
        gr.api_name = apiName;
        gr.script = scriptContent;
        gr.sys_scope = scopeId;
        gr.sys_package = scopeId;
        gr.active = "true";
        gr.client_callable = "false";
        gr.access = "public";
        var sysId = gr.insert();
        print("Created " + name + " successfully (sys_id: " + sysId + ")");
    }
}

try {
`;

  files.forEach(file => {
    const scriptName = path.basename(file, '.js');
    const filePath = path.join(srcDir, file);
    let scriptContent = fs.readFileSync(filePath, 'utf8');

    const escapedContent = scriptContent
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r/g, '')
      .replace(/\n/g, '\\n');

    snScript += `  deployScriptInclude("${scriptName}", "${escapedContent}");\n`;
  });

  snScript += `  print("All scripts deployed successfully!");\n} catch (e) {\n  print("Error deploying scripts: " + e.toString());\n}`;

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
      console.error('Failed to deploy scripts:', response.status);
      console.error(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

deployScripts();
