# AI-Powered ITSM Assistant

An enterprise-grade, custom-scoped ServiceNow application (`x_ai_itsm`) that integrates artificial intelligence (including Gemini, Groq, Claude, OpenAI, and Antigravity AI) to automate incident classification, summarize tickets, suggest knowledge base articles, perform change risk assessments, and power a self-service virtual agent portal chatbot.

This repository contains the local codebase files and the custom Node.js deployment utility pipeline used to configure and build the application directly on a ServiceNow instance.

---

## 🛠️ Repository Structure

```
├── .env                              # ServiceNow instance connection credentials
├── schema.json                       # Relational database schema specification
├── README.md                         # Project documentation and guide
├── src/                              # Core ServiceNow Script Includes
│   ├── AIConfigurationManager.js
│   ├── AIRequestHandler.js
│   ├── AIResponseParser.js
│   ├── AIUsageLogger.js
│   ├── AIPromptManager.js
│   ├── AIProviderManager.js
│   ├── AIIncidentClassifier.js
│   ├── AIIncidentSummarizer.js
│   ├── AIKnowledgeAssistant.js
│   ├── AIResolutionAssistant.js
│   ├── AIChangeRiskAnalyzer.js
│   └── AIClientFacade.js             # GlideAjax Client Gateway
└── scripts/                          # Local-to-Instance Deployment Utility Pipeline
    ├── deploy_schema.js              # Deploys custom tables, columns, and choice lists
    ├── deploy_scripts.js             # Deploys all Script Includes in src/
    ├── deploy_br.js                  # Deploys async Business Rules (Incident, Change)
    ├── deploy_client_scripts.js      # Deploys Incident onChange Client Script
    ├── deploy_portal.js              # Deploys Service Portal, Pages, and Chatbot Widget
    ├── deploy_defaults.js            # Pre-populates default model parameters and prompts
    └── deploy_ui_actions.js          # Deploys Form UI Actions (Buttons)
```

---

## 🚀 Setup & Deployment Guide

### Prerequisites
- **Node.js** v18+ installed on your local machine.
- A ServiceNow **Developer Instance** (with administrator credentials).

### 1. Configuration
Create a `.env` file in the root directory (or use the one provided) and configure your ServiceNow instance URL and credentials:
```env
SN_SDK_INSTANCE_URL=https://devXXXXX.service-now.com/
SN_SDK_USER=admin
SN_SDK_USER_PWD=your_admin_password
```

### 2. Deploy Schema
Run the schema deployment script to programmatically build the 7 custom tables, dictionary fields, references, and choice options:
```bash
node scripts/deploy_schema.js
```

### 3. Deploy Code & Configurations
Deploy the Script Includes, Business Rules, Client Scripts, Portal widgets, UI Actions, and default configurations in sequence:
```bash
# Deploy Script Includes
node scripts/deploy_scripts.js

# Deploy Business Rules
node scripts/deploy_br.js

# Deploy Client Scripts
node scripts/deploy_client_scripts.js

# Deploy UI Actions (Form Buttons)
node scripts/deploy_ui_actions.js

# Deploy Service Portal & Chatbot Widget
node scripts/deploy_portal.js

# Populate default AI models and prompt templates
node scripts/deploy_defaults.js
```

---

## 🌟 Application Modules & Operational Flow

### 1. AI Incident Classifier (Module 1)
- **Trigger**: Runs asynchronously when an Incident is inserted.
- **Client Side**: When typing a Short Description on the Incident form, `AI Incident Auto Classifier` client script triggers an asynchronous `GlideAjax` call to get predictions.
- **Outcome**: Suggests and automatically populates Category, Subcategory, Assignment Group, Impact, and Urgency, and displays a confidence banner.

### 2. AI Incident Summarizer (Module 2)
- **Form Action**: Support agents can click the **AI Summarize Ticket** button on the Incident form.
- **Outcome**: Analyzes the incident descriptions and recent journal entries (work notes), compiling a structured JSON summary (Ticket Summary, Executive Summary, Agent Notes, and Draft Resolution) directly into the activity stream.

### 3. AI Knowledge Assistant (Module 3)
- **Form Action**: Support agents can click the **AI Recommend Articles** button on the Incident form.
- **Outcome**: Conducts a search against the `kb_knowledge` table, evaluates candidate article relevance using the LLM, assigns a Relevancy Score (0-100%), and logs recommendations in the database.

### 4. AI Resolution Assistant (Module 4)
- **Form Action**: Support agents can click the **AI Suggest Resolution** button on the Incident form.
- **Outcome**: Generates troubleshooting guides, root-cause assessments, escalation paths, and specific checklist scripts, printing them to the ticket work notes.

### 5. AI Change Risk Analyzer (Module 5)
- **Trigger**: Runs asynchronously on Change Request (`change_request`) insert or modification.
- **Outcome**: Inspects justification, implementation plan, and scope details, evaluates procedural risk, outputs a Risk Score (0-100) and Risk Level (Low/Medium/High/Critical), and creates a record in the `x_ai_itsm_risk_assessment` table.

### 6. AI Virtual Agent Chatbot (Module 6)
- **Portal URL**: Access the custom Service Portal at `/ai_itsm` (e.g., `https://devXXXXX.service-now.com/ai_itsm`).
- **Features**: An Angular-based chatbot widget (`AI Virtual Agent Chatbot`) that handles:
  - **Create Incident**: Generates incident tickets automatically from text messages.
  - **Check Ticket Status**: Fetches the status of recent tickets opened by the logged-in user.
  - **Search Knowledge**: Searches published articles and returns active links.
  - **Conversational Helper**: Engages in helpful conversations using the AI model configurations.

### 7. Performance & Cost Analytics (Module 7)
- **Database**: Every AI call registers performance speeds, token volumes, user details, and estimated dollar costs in `x_ai_itsm_ai_log` and `x_ai_itsm_request`.
- **Outcome**: Drives real-time SLA metrics, AI accuracy calculations, cost trends, and volume reports on the Manager Analytics Dashboard.
