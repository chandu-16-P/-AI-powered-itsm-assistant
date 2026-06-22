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

async function deployDefaults() {
  console.log('Deploying model configurations and prompt library defaults...');

  const snScript = `
var scopeId = "${scopeSysId}";

function createModelConfig(provider, endpoint, model, active, key) {
    var gr = new GlideRecord("x_ai_itsm_model_config");
    gr.addQuery("provider_name", provider);
    gr.query();
    if (gr.next()) {
        print("Model configuration for " + provider + " already exists.");
        return;
    }
    
    print("Creating model config for: " + provider);
    gr.initialize();
    gr.provider_name = provider;
    gr.endpoint_url = endpoint;
    gr.model_name = model;
    gr.api_key = key || "";
    gr.active = active;
    gr.timeout = 30;
    gr.temperature = 0.7;
    gr.max_tokens = 2048;
    gr.sys_scope = scopeId;
    gr.sys_package = scopeId;
    gr.insert();
}

function createPrompt(name, purpose, template) {
    var gr = new GlideRecord("x_ai_itsm_prompt_library");
    gr.addQuery("name", name);
    gr.query();
    if (gr.next()) {
        print("Prompt template '" + name + "' already exists.");
        return;
    }
    
    print("Creating prompt template: " + name);
    gr.initialize();
    gr.name = name;
    gr.purpose = purpose;
    gr.prompt_template = template;
    gr.version = "1.0";
    gr.active = "true";
    gr.sys_scope = scopeId;
    gr.sys_package = scopeId;
    gr.insert();
}

try {
    createModelConfig("Gemini", "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent", "gemini-1.5-flash", "true", "${process.env.GEMINI_API_KEY || ''}");
    createModelConfig("OpenAI", "https://api.openai.com/v1/chat/completions", "gpt-4o-mini", "false");
    createModelConfig("Groq", "https://api.groq.com/openai/v1/chat/completions", "llama-3.1-70b-versatile", "false");
    createModelConfig("Claude", "https://api.anthropic.com/v1/messages", "claude-3-5-sonnet-20240620", "false");
    createModelConfig("Antigravity AI", "https://api.antigravity.ai/v1/chat/completions", "agy-model-v2", "false");
    
    createPrompt(
        "Incident Classification Prompt",
        "classification",
        "You are an expert ServiceNow ITSM classifier. Classify the following Incident based on short description and description.\\nIncident Details:\\nShort Description: {{short_description}}\\nDescription: {{description}}\\n\\nRespond with a JSON object containing exactly these fields (do not include markdown block markers outside JSON):\\n{\\n  \\"category\\": \\"string\\",\\n  \\"subcategory\\": \\"string\\",\\n  \\"assignment_group\\": \\"string\\",\\n  \\"priority\\": \\"string\\",\\n  \\"impact\\": \\"string\\",\\n  \\"urgency\\": \\"string\\",\\n  \\"confidence_score\\": 0.00\\n}\\nUse standard IT categories (Hardware, Software, Network, Database, Inquiry) and match priority logic (1-Critical, 2-High, 3-Moderate, 4-Low) based on impact and urgency."
    );
    
    createPrompt(
        "Incident Summarization Prompt",
        "summarization",
        "Summarize this incident ticket for service desk agents and executives.\\nTicket details:\\nNumber: {{number}}\\nShort Description: {{short_description}}\\nDescription: {{description}}\\nWork Notes: {{work_notes}}\\n\\nProvide your response in JSON format containing:\\n{\\n  \\"ticket_summary\\": \\"brief summary of the issue\\",\\n  \\"executive_summary\\": \\"summary for management\\",\\n  \\"agent_notes\\": \\"key technical facts for next agent\\",\\n  \\"resolution_notes\\": \\"how it was or should be resolved\\"\\n}"
    );

    createPrompt(
        "Knowledge Recommendation Prompt",
        "knowledge",
        "Based on the incident description, recommend relevant troubleshooting steps and article topics.\\nIncident:\\nShort Description: {{short_description}}\\nDescription: {{description}}\\n\\nProvide your response in JSON format:\\n{\\n  \\"recommended_topics\\": [\\"topic1\\", \\"topic2\\"],\\n  \\"troubleshooting_suggestions\\": \\"detailed text steps\\",\\n  \\"relevancy_score\\": 95.0\\n}"
    );

    createPrompt(
        "Incident Resolution Prompt",
        "resolution",
        "Analyze this incident and generate resolution recommendations, troubleshooting steps, and a checklist.\\nIncident details:\\nShort Description: {{short_description}}\\nDescription: {{description}}\\nCategory: {{category}}\\n\\nRespond in JSON format:\\n{\\n  \\"resolution_suggestions\\": \\"proposed resolution\\",\\n  \\"root_cause_analysis\\": \\"likely root cause\\",\\n  \\"escalation_recommendation\\": \\"should it be escalated and to whom\\",\\n  \\"troubleshooting_steps\\": [\\"step 1\\", \\"step 2\\"],\\n  \\"resolution_checklist\\": [\\"task 1\\", \\"task 2\\"]\\n}"
    );

    createPrompt(
        "Change Request Risk Analyzer Prompt",
        "change_risk",
        "Analyze this Change Request and perform a risk assessment.\\nChange Details:\\nShort Description: {{short_description}}\\nDescription: {{description}}\\nJustification: {{justification}}\\nImplementation Plan: {{implementation_plan}}\\nRisk and Impact Analysis: {{risk_impact}}\\n\\nRespond with a JSON object:\\n{\\n  \\"risk_score\\": 0 to 100,\\n  \\"risk_level\\": \\"Low|Medium|High|Critical\\",\\n  \\"impact_assessment\\": \\"summary of impact\\",\\n  \\"rollback_plan\\": \\"rollback strategy evaluation\\",\\n  \\"testing_plan\\": \\"testing strategy evaluation\\",\\n  \\"approval_recommendation\\": \\"Approve|Reject|Request Info\\"\\n}"
    );

    createPrompt(
        "Virtual Agent Chatbot Prompt",
        "chatbot",
        "You are an AI Virtual Agent helper for ServiceNow. The user says: {{user_message}}.\\nContext: {{context}}.\\n\\nRespond with a friendly, helpful message, suggesting knowledge article search terms or incident creation details if appropriate."
    );

    print("Default configs and prompts deployed successfully!");
} catch (e) {
    print("Error deploying defaults: " + e.toString());
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
      console.error('Failed to deploy defaults:', response.status);
      console.error(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

deployDefaults();
