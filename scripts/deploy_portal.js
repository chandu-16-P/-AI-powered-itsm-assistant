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

const chatWidget = {
  id: "ai_itsm_chat",
  name: "AI Virtual Agent Chatbot",
  template: `<div class="panel panel-default chat-container">
  <div class="panel-heading chat-header">
    <span class="glyphicon glyphicon-comment icon-mr"></span> AI Virtual Agent Assistant
  </div>
  <div class="panel-body chat-body" id="chat-body">
    <div ng-repeat="msg in c.messages" class="chat-bubble-wrapper" ng-class="{'user-msg-align': msg.role === 'user'}">
      <div class="chat-bubble" ng-class="{'bot-bubble': msg.role === 'bot', 'user-bubble': msg.role === 'user'}">
        <div class="chat-bubble-text" ng-bind-html="msg.text"></div>
        <div class="chat-bubble-time">{{msg.time}}</div>
      </div>
    </div>
    <div ng-if="c.loading" class="chat-bubble-wrapper">
      <div class="chat-bubble bot-bubble loading-bubble">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  </div>
  <div class="panel-footer chat-footer">
    <form ng-submit="c.sendMessage()">
      <div class="input-group">
        <input type="text" ng-model="c.messageInput" class="form-control chat-input" placeholder="Ask me something..." ng-disabled="c.loading">
        <span class="input-group-btn">
          <button class="btn btn-primary send-btn" type="submit" ng-disabled="c.loading || !c.messageInput.trim()">Send</button>
        </span>
      </div>
    </form>
  </div>
</div>`,
  css: `.chat-container {
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  overflow: hidden;
  border: none;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
}
.chat-header {
  background: linear-gradient(135deg, #1b365d, #4b9cd3);
  color: white;
  font-weight: bold;
  padding: 15px;
  font-size: 16px;
}
.icon-mr {
  margin-right: 8px;
}
.chat-body {
  height: 400px;
  overflow-y: auto;
  padding: 15px;
  background-color: #f7f9fc;
}
.chat-bubble-wrapper {
  display: flex;
  margin-bottom: 15px;
}
.user-msg-align {
  justify-content: flex-end;
}
.chat-bubble {
  max-width: 75%;
  padding: 12px 16px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 1.4;
  position: relative;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}
.bot-bubble {
  background-color: white;
  color: #333333;
  border-bottom-left-radius: 4px;
}
.user-bubble {
  background: linear-gradient(135deg, #4b9cd3, #1b365d);
  color: white;
  border-bottom-right-radius: 4px;
}
.chat-bubble-text {
  word-wrap: break-word;
}
.chat-bubble-time {
  font-size: 10px;
  color: #999999;
  text-align: right;
  margin-top: 4px;
}
.user-bubble .chat-bubble-time {
  color: rgba(255,255,255,0.7);
}
.chat-footer {
  background-color: white;
  padding: 15px;
  border-top: 1px solid #eef2f5;
}
.chat-input {
  border-radius: 20px;
  padding: 10px 15px;
  border: 1px solid #d2dbe2;
  box-shadow: none;
}
.chat-input:focus {
  border-color: #4b9cd3;
}
.send-btn {
  border-radius: 20px;
  margin-left: 8px;
  padding: 6px 20px;
}
.typing-indicator span {
  display: inline-block;
  width: 8px;
  height: 8px;
  background-color: #999999;
  border-radius: 50%;
  margin-right: 4px;
  animation: typing 1s infinite alternate;
}
.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}
.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes typing {
  from { transform: translateY(0); }
  to { transform: translateY(-5px); }
}`,
  client_script: `function($scope, $timeout, $sce) {
    var c = this;
    c.messageInput = '';
    c.messages = [
        { role: 'bot', text: 'Hello! I am your AI Virtual Agent. How can I help you today? You can search knowledge, check ticket status, or open a new incident.', time: new Date().toLocaleTimeString() }
    ];
    c.loading = false;
    
    c.sendMessage = function() {
        if (!c.messageInput.trim()) return;
        
        var userText = c.messageInput;
        c.messages.push({
            role: 'user',
            text: userText,
            time: new Date().toLocaleTimeString()
        });
        
        c.messageInput = '';
        c.loading = true;
        
        c.server.get({
            action: 'send_message',
            message: userText
        }).then(function(response) {
            c.loading = false;
            if (response.data.reply) {
                response.data.reply.text = $sce.trustAsHtml(response.data.reply.text.replace(/\\n/g, '<br>'));
                c.messages.push(response.data.reply);
            }
            $timeout(function() {
                var chatBody = document.getElementById('chat-body');
                if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
            }, 100);
        });
    };
}`,
  server_script: `(function() {
    if (input && input.action === 'send_message') {
        var userMsg = input.message;
        var reply = {
            role: 'bot',
            text: '',
            time: new Date().toLocaleTimeString()
        };
        
        var msgLower = userMsg.toLowerCase();
        
        if (msgLower.indexOf('create incident') > -1 || msgLower.indexOf('open ticket') > -1) {
            var grInc = new GlideRecord('incident');
            grInc.initialize();
            grInc.short_description = userMsg.replace(/create incident|open ticket/gi, '').trim() || 'Ticket opened via AI Virtual Agent';
            grInc.description = 'Opened via Service Portal AI Chatbot: "' + userMsg + '"';
            grInc.caller_id = gs.getUserID();
            var incSysId = grInc.insert();
            
            var grIncRead = new GlideRecord('incident');
            if (grIncRead.get(incSysId)) {
                reply.text = "I've created an incident for you! Ticket Number: **" + grIncRead.number + "**. The support team has been notified.";
            } else {
                reply.text = "I started creating an incident but encountered a system issue. Please contact support.";
            }
        } 
        else if (msgLower.indexOf('ticket status') > -1 || msgLower.indexOf('my tickets') > -1 || msgLower.indexOf('my incidents') > -1) {
            var grTkt = new GlideRecord('incident');
            grTkt.addQuery('caller_id', gs.getUserID());
            grTkt.orderByDesc('sys_created_on');
            grTkt.setLimit(3);
            grTkt.query();
            
            var tkts = [];
            while (grTkt.next()) {
                tkts.push("• " + grTkt.number + ": " + grTkt.short_description + " (Status: " + grTkt.getDisplayValue('state') + ")");
            }
            
            if (tkts.length > 0) {
                reply.text = "Here are your 3 most recent tickets:\\n" + tkts.join('\\n');
            } else {
                reply.text = "I couldn't find any recent tickets opened for you.";
            }
        }
        else if (msgLower.indexOf('search') > -1 || msgLower.indexOf('knowledge') > -1 || msgLower.indexOf('kb') > -1) {
            var searchStr = userMsg.replace(/search|knowledge|kb/gi, '').trim();
            var kbGr = new GlideRecord('kb_knowledge');
            kbGr.addQuery('active', true);
            kbGr.addQuery('workflow_state', 'published');
            if (searchStr) {
                kbGr.addQuery('123TEXTQUERY321', searchStr);
            }
            kbGr.setLimit(3);
            kbGr.query();
            
            var articles = [];
            while (kbGr.next()) {
                articles.push("• " + kbGr.number + ": " + kbGr.short_description);
            }
            
            if (articles.length > 0) {
                reply.text = "Here are some knowledge articles that might help:\\n" + articles.join('\\n');
            } else {
                reply.text = "I searched the knowledge base but couldn't find any matching articles.";
            }
        }
        else {
            var promptMgr = new x_ai_itsm.AIPromptManager();
            var providerMgr = new x_ai_itsm.AIProviderManager();
            
            var prompt = promptMgr.buildPrompt('chatbot', {
                user_message: userMsg,
                context: 'User name is ' + gs.getUserName() + '. System time is ' + new Date().toString()
            });
            
            var responseText = providerMgr.executeCall(
                prompt,
                '',
                'You are a ServiceNow Virtual Agent. Help the user with IT requests. Keep answers concise.',
                'chat_queue',
                'none',
                'Virtual Agent',
                'Chat message'
            );
            
            reply.text = responseText || "I'm sorry, I'm having trouble processing that request right now. Is there anything else I can try?";
        }
        
        data.reply = reply;
    }
})();`
};

async function deployPortal() {
  console.log('Deploying Service Portal resources...');

  const snScript = `
var scopeId = "${scopeSysId}";

function createPortal() {
    var gr = new GlideRecord("sp_portal");
    gr.addQuery("url", "ai_itsm");
    gr.addQuery("sys_scope", scopeId);
    gr.query();
    if (gr.next()) {
        print("Portal 'ai_itsm' already exists.");
        return gr.getUniqueValue();
    }
    
    print("Creating Service Portal 'ai_itsm'...");
    gr.initialize();
    gr.url = "ai_itsm";
    gr.title = "AI-Powered ITSM Portal";
    gr.homepage = "ai_itsm_home";
    gr.sys_scope = scopeId;
    gr.sys_package = scopeId;
    var portalId = gr.insert();
    print("Created Portal successfully (sys_id: " + portalId + ")");
    return portalId;
}

function createPage() {
    var gr = new GlideRecord("sp_page");
    gr.addQuery("id", "ai_itsm_home");
    gr.addQuery("sys_scope", scopeId);
    gr.query();
    if (gr.next()) {
        print("Portal Page 'ai_itsm_home' already exists.");
        return gr.getUniqueValue();
    }
    
    print("Creating Portal Page 'ai_itsm_home'...");
    gr.initialize();
    gr.id = "ai_itsm_home";
    gr.title = "AI-Powered ITSM Home";
    gr.sys_scope = scopeId;
    gr.sys_package = scopeId;
    var pageId = gr.insert();
    print("Created Page successfully (sys_id: " + pageId + ")");
    return pageId;
}

function createWidget(wId, wName, wTemplate, wCss, wClient, wServer) {
    var gr = new GlideRecord("sp_widget");
    gr.addQuery("id", wId);
    gr.addQuery("sys_scope", scopeId);
    gr.query();
    
    if (gr.next()) {
        print("Updating Widget: " + wName);
        gr.template = wTemplate;
        gr.css = wCss;
        gr.client_script = wClient;
        gr.script = wServer;
        gr.update();
        print("Updated Widget successfully (sys_id: " + gr.getUniqueValue() + ")");
    } else {
        print("Creating Widget: " + wName);
        gr.initialize();
        gr.id = wId;
        gr.name = wName;
        gr.template = wTemplate;
        gr.css = wCss;
        gr.client_script = wClient;
        gr.script = wServer;
        gr.sys_scope = scopeId;
        gr.sys_package = scopeId;
        var sysId = gr.insert();
        print("Created Widget successfully (sys_id: " + sysId + ")");
    }
}

try {
    createPortal();
    createPage();
    createWidget(
        "${chatWidget.id}",
        "${chatWidget.name}",
        "${chatWidget.template.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '').replace(/\n/g, '\\n')}",
        "${chatWidget.css.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '').replace(/\n/g, '\\n')}",
        "${chatWidget.client_script.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '').replace(/\n/g, '\\n')}",
        "${chatWidget.server_script.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '').replace(/\n/g, '\\n')}"
    );
    print("All Portal resources deployed successfully!");
} catch (e) {
    print("Error deploying Portal resources: " + e.toString());
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
      console.error('Failed to deploy Portal resources:', response.status);
      console.error(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

deployPortal();
