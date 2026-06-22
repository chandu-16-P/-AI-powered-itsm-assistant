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

// Load schema from parent directory
const schemaPath = path.join(__dirname, '..', 'schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

// Build the ServiceNow background script
let snScript = `
var scopeId = "${scopeSysId}";

function createTable(tName, tLabel) {
    var grCheck = new GlideRecord("sys_db_object");
    grCheck.addQuery("name", tName);
    grCheck.query();
    if (grCheck.next()) {
        print("Table " + tName + " already exists.");
        return grCheck.getUniqueValue();
    }
    
    print("Creating table: " + tName + " (" + tLabel + ")...");
    var grTable = new GlideRecord("sys_db_object");
    grTable.initialize();
    grTable.name = tName;
    grTable.label = tLabel;
    grTable.sys_scope = scopeId;
    grTable.sys_package = scopeId;
    grTable.access = "public";
    grTable.read_access = "true";
    grTable.create_access = "true";
    grTable.write_access = "true";
    grTable.delete_access = "true";
    grTable.ws_access = "true";
    var tableId = grTable.insert();
    print("Table " + tName + " created successfully (sys_id: " + tableId + ")");
    return tableId;
}

function createColumn(tName, colName, colLabel, type, maxLength, refTable, defaultValue) {
    var grCheck = new GlideRecord("sys_dictionary");
    grCheck.addQuery("name", tName);
    grCheck.addQuery("element", colName);
    grCheck.query();
    if (grCheck.next()) {
        print("Column " + tName + "." + colName + " already exists.");
        return grCheck.getUniqueValue();
    }
    
    print("Creating column: " + tName + "." + colName + " (" + colLabel + ") of type: " + type + "...");
    var grDict = new GlideRecord("sys_dictionary");
    grDict.initialize();
    grDict.name = tName;
    grDict.element = colName;
    grDict.column_label = colLabel;
    grDict.internal_type = type;
    if (maxLength) grDict.max_length = maxLength;
    if (refTable) grDict.reference = refTable;
    if (defaultValue) grDict.default_value = defaultValue;
    grDict.sys_scope = scopeId;
    grDict.sys_package = scopeId;
    
    var dictId = grDict.insert();
    print("Column " + tName + "." + colName + " created (sys_id: " + dictId + ")");
    return dictId;
}

function createChoice(tName, colName, choiceVal, idx) {
    var grCheck = new GlideRecord("sys_choice");
    grCheck.addQuery("name", tName);
    grCheck.addQuery("element", colName);
    grCheck.addQuery("value", choiceVal);
    grCheck.query();
    if (grCheck.next()) {
        return;
    }
    
    print("Adding choice to " + tName + "." + colName + ": " + choiceVal);
    var grChoice = new GlideRecord("sys_choice");
    grChoice.initialize();
    grChoice.name = tName;
    grChoice.element = colName;
    grChoice.value = choiceVal;
    grChoice.label = choiceVal;
    grChoice.language = "en";
    grChoice.sequence = idx;
    grChoice.sys_scope = scopeId;
    grChoice.sys_package = scopeId;
    grChoice.insert();
}

try {
`;

schema.forEach(table => {
  snScript += `  createTable("${table.tableName}", "${table.label}");\n`;
  table.columns.forEach(col => {
    const maxLength = col.max_length || null;
    const refTable = col.reference || null;
    const defVal = col.default_value || null;
    snScript += `  createColumn("${table.tableName}", "${col.element}", "${col.label}", "${col.type}", ${maxLength}, "${refTable || ''}", "${defVal || ''}");\n`;
    if (col.choices) {
      col.choices.forEach((choice, idx) => {
        snScript += `  createChoice("${table.tableName}", "${col.element}", "${choice}", ${idx});\n`;
      });
    }
  });
});

snScript += `  print("Schema deployment complete!");
} catch (e) {
    print("Error deploying schema: " + e.toString());
}`;

async function deploySchema() {
  console.log('Deploying schema to ServiceNow...');
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
      console.error('Failed to run deployment:', response.status);
      console.error(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

deploySchema();
