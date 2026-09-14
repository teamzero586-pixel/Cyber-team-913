const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../../../config');

const AI_MEMORY_PATH = path.join(process.cwd(), 'database', 'ai.json');

function initMemory() {
  const dbDir = path.join(process.cwd(), 'database');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  if (!fs.existsSync(AI_MEMORY_PATH)) {
    fs.writeFileSync(AI_MEMORY_PATH, JSON.stringify({ conversations: [] }, null, 2));
  }
}

function getConversationHistory() {
  initMemory();
  const data = JSON.parse(fs.readFileSync(AI_MEMORY_PATH, 'utf-8'));
  return data.conversations.slice(-20);
}

function saveExchange(userMsg, botResponse) {
  initMemory();
  const data = JSON.parse(fs.readFileSync(AI_MEMORY_PATH, 'utf-8'));
  data.conversations.push({ user: userMsg, assistant: botResponse });
  fs.writeFileSync(AI_MEMORY_PATH, JSON.stringify(data, null, 2));
}

function clearMemory() {
  initMemory();
  fs.writeFileSync(AI_MEMORY_PATH, JSON.stringify({ conversations: [] }, null, 2));
}

function buildSystemPrompt(history) {
  const botName = config.BOT_NAME || 'Cyber-team-913 bot';
  const corePrompt = `You are ${botName} AI, integrated inside ${botName}.
Your mission: help users build, debug, and enhance WhatsApp bot plugins.
You have memory — the conversation history below is your training data.
Use it to improve your answers, avoid past mistakes, and suggest better solutions.

IMPORTANT RULES:
- When generating a plugin, you MUST output it in EXACT format:
\`\`\`filename.js
// code here
\`\`\`
- After the code block, provide a clear explanation: features, how to install, what the plugin does.
- Append this training disclaimer at the end of every response (outside code blocks):
"This response is for training — your input helps me evolve."

CONVERSATION HISTORY (user ↔ assistant):`;

  let historyBlock = '';
  for (const exch of history) {
    historyBlock += `\nUser: ${exch.user}\nAssistant: ${exch.assistant}`;
  }
  return corePrompt + historyBlock;
}

module.exports = {
  name: 'cyberteam913',
  aliases: ['ai', 'cyberai', 'dev'],
  category: 'ai',
  description: 'Cyber-team-913 AI developer with memory — builds plugins, debugs, learns from you.',
  usage: `${config.PREFIX}cyberteam913 <your prompt>`,
  ownerOnly: false,
  modOnly: false,
  groupOnly: false,
  privateOnly: false,
  adminOnly: false,
  botAdminNeeded: false,

  async execute(sock, msg, args, extra) {
    try {
      const botName = config.BOT_NAME || 'Cyber-team-913 bot';

      if (args[0] && args[0].toLowerCase() === 'clear') {
        clearMemory();
        await extra.reply('🧠 AI memory cleared. I will start fresh.');
        await extra.react('🧹');
        return;
      }

      if (!args.length) {
        await extra.reply(`🤖 *${botName} AI* – Developer with memory\n\n_Usage:_ \`${this.usage}\`\n_Example:_ \`${config.PREFIX}cyberteam913 create a ping command\`\n_Aliases:_ \`.ai\`, \`.cyberai\`, \`.dev\`\n\n_Commands:_ \`${config.PREFIX}cyberteam913 clear\` – wipe my memory\n\n*Features:*\n• Remembers past conversations\n• Learns from your corrections\n• Generates production-ready plugins\n• Saves plugins directly to bot folder\n• Includes full install/usage guide`);
        await extra.react('🧠');
        return;
      }

      const userPrompt = args.join(' ');
      await extra.react('⏳');

      const history = getConversationHistory();
      const systemPrompt = buildSystemPrompt(history);

      const apiUrl = 'https://proboy-ai.vercel.app/';
      const response = await axios.post(apiUrl, {
        prompt: userPrompt,
        systemPrompt: systemPrompt
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000
      });

      let aiReply = response.data.response;
      if (!aiReply) throw new Error('Empty response from AI API');

      const disclaimer = '\n\n> ✨ *This response is for training* — your input helps me evolve.';
      aiReply += disclaimer;

      saveExchange(userPrompt, aiReply);

      const codeBlockRegex = /```([\w.-]+\.js)\n([\s\S]*?)```/;
      const match = aiReply.match(codeBlockRegex);

      if (match && match[1] && match[2]) {
        const filename = match[1];
        const code = match[2].trim();

        let category = 'generated';
        const targetDir = path.join(process.cwd(), 'commands', category);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const targetPath = path.join(targetDir, filename);
        fs.writeFileSync(targetPath, code, 'utf-8');

        await extra.reply(`✅ *Plugin generated & saved!*\n\n📁 Location: \`commands/${category}/${filename}\`\n🔁 Restart the bot or use \`.loadplugin ${filename.replace('.js','')}\` to activate.\n\n📦 *Plugin details:*\n${aiReply.replace(codeBlockRegex, '*Code saved successfully*')}`);
        await extra.react('✅');
      } else {
        await extra.reply(aiReply);
        await extra.react('🤖');
      }
    } catch (error) {
      console.error('Cyber-team-913 AI error:', error.message);
      let errorMsg = `❌ *AI Error:* ${error.message}`;
      if (error.response) errorMsg += `\nAPI Response: ${error.response.status}`;
      await extra.reply(errorMsg);
      await extra.react('❌');
    }
  }
};
