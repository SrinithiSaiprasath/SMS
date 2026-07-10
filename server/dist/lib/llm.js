import OpenAI from 'openai';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
function resolveApiKey() {
    const groqKey = process.env.GROQ_API_KEY?.trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (groqKey)
        return groqKey;
    if (openaiKey)
        return openaiKey;
    throw new Error('Set GROQ_API_KEY or OPENAI_API_KEY in .env');
}
function resolveBaseURL() {
    const explicit = process.env.OPENAI_BASE_URL?.trim();
    if (explicit)
        return explicit;
    if (process.env.GROQ_API_KEY?.trim())
        return GROQ_BASE_URL;
    return undefined;
}
function resolveDefaultModel() {
    if (process.env.OPENAI_MODEL?.trim())
        return process.env.OPENAI_MODEL.trim();
    if (process.env.GROQ_API_KEY?.trim())
        return GROQ_DEFAULT_MODEL;
    return OPENAI_DEFAULT_MODEL;
}
let client = null;
export function getLlmClient() {
    if (!client) {
        client = new OpenAI({
            apiKey: resolveApiKey(),
            baseURL: resolveBaseURL(),
        });
    }
    return client;
}
export function getModelForAgent(agent) {
    const agentModel = agent === 'A' ? process.env.OPENAI_MODEL_AGENT_A?.trim() : process.env.OPENAI_MODEL_AGENT_B?.trim();
    return agentModel || resolveDefaultModel();
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function isRateLimitError(err) {
    if (err && typeof err === 'object' && 'status' in err) {
        return err.status === 429;
    }
    return false;
}
export async function chatCompletionJson(agent, params) {
    const openai = getLlmClient();
    const model = params.model ?? getModelForAgent(agent);
    const maxRetries = Number(process.env.LLM_MAX_RETRIES ?? 3);
    const baseDelayMs = Number(process.env.LLM_RETRY_DELAY_MS ?? 2000);
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await openai.chat.completions.create({
                ...params,
                model,
            });
            const content = response.choices[0]?.message?.content;
            if (!content)
                throw new Error(`Agent ${agent} returned empty response`);
            return content;
        }
        catch (err) {
            lastError = err;
            if (isRateLimitError(err) && attempt < maxRetries) {
                const delay = baseDelayMs * Math.pow(2, attempt);
                console.warn(`[LLM] Rate limited (agent ${agent}), retry ${attempt + 1}/${maxRetries} in ${delay}ms`);
                await sleep(delay);
                continue;
            }
            throw err;
        }
    }
    throw lastError;
}
export function getLlmConfigSummary() {
    const usingGroq = Boolean(process.env.GROQ_API_KEY?.trim()) || resolveBaseURL() === GROQ_BASE_URL;
    return {
        provider: usingGroq ? 'groq' : 'openai',
        base_url: resolveBaseURL() ?? 'https://api.openai.com/v1',
        default_model: resolveDefaultModel(),
        agent_a_model: getModelForAgent('A'),
        agent_b_model: getModelForAgent('B'),
    };
}
