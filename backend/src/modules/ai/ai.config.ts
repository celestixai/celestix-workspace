import OpenAI from 'openai';

const AI_BASE_URL = process.env.AI_BASE_URL || 'http://localhost:11434/v1';
const AI_MODEL = process.env.AI_MODEL || 'llama3.1:8b';
const AI_ENABLED = process.env.AI_ENABLED === 'true';

const aiClient = new OpenAI({
  baseURL: AI_BASE_URL,
  apiKey: 'ollama', // Ollama doesn't need a real key
});

export { aiClient, AI_MODEL, AI_ENABLED, AI_BASE_URL };
