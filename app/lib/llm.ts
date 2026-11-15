import OpenAI from "openai";

type Message = OpenAI.Chat.ChatCompletionMessageParam;

interface ChatOptions {
  messages: Message[];
  maxTokens: number;
  temperature: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  /**
   * Ask for a single JSON object (response_format: json_object). Plain prompting is not enough: in testing every
   * provider eventually dropped a brace or truncated mid-object. With this set, a reply cut off by the token
   * limit is treated as a failure so the next provider is tried instead of returning broken JSON.
   */
  json?: boolean;
}

interface Provider {
  name: string;
  keyEnv: string;
  baseURL?: string;
  model: string;
  /** Reasoning models spend part of max_tokens on hidden thinking, so they need headroom. */
  reasoning: boolean;
  /** Extra request headers built from the API key. */
  headers?: (key: string) => Record<string, string>;
  /** Only OpenAI is sent presence/frequency penalties. */
  penalties?: boolean;
}

/**
 * Tried in order. A provider without a key, or one that recently failed on billing/auth, is skipped.
 * Sarvam (fast, already needed for the coach voice) -> Groq -> OpenAI as a last resort.
 */
const PROVIDERS: Provider[] = [
  {
    name: "Sarvam",
    keyEnv: "SARVAM_API_KEY",
    baseURL: "https://api.sarvam.ai/v1",
    model: "sarvam-105b-conversations",
    reasoning: false,
    headers: (key) => ({ "api-subscription-key": key }),
  },
  { name: "Groq", keyEnv: "GROQ_API_KEY", baseURL: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-20b", reasoning: true },
  { name: "OpenAI", keyEnv: "OPENAI_API_KEY", model: "gpt-4o-mini", reasoning: false, penalties: true },
];

const COOLDOWN_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30_000;
const skipUntil = new Map<string, number>();

/** True when at least one provider has an API key configured. */
export function hasLlmProvider(): boolean {
  return PROVIDERS.some((p) => Boolean(process.env[p.keyEnv]));
}

function isAccountProblem(err: unknown): boolean {
  const e = err as { status?: number; code?: string; message?: string } | undefined;
  return (
    e?.status === 401 ||
    e?.status === 402 ||
    e?.status === 403 ||
    e?.code === "insufficient_quota" ||
    e?.code === "credit_balance_exhausted" ||
    (e?.status === 429 && /quota|credit|billing/i.test(e.message ?? ""))
  );
}

/** Chat completion with automatic fallback between providers. Returns the reply text. */
export async function chatCompletion(opts: ChatOptions): Promise<string> {
  let lastError: unknown = new Error("No LLM API key configured (set SARVAM_API_KEY, GROQ_API_KEY or OPENAI_API_KEY)");

  for (const provider of PROVIDERS) {
    const apiKey = process.env[provider.keyEnv];
    if (!apiKey) continue;
    if ((skipUntil.get(provider.name) ?? 0) > Date.now()) continue;

    try {
      const client = new OpenAI({
        apiKey,
        baseURL: provider.baseURL,
        defaultHeaders: provider.headers?.(apiKey),
        timeout: REQUEST_TIMEOUT_MS,
        maxRetries: 1,
      });
      const completion = await client.chat.completions.create({
        model: provider.model,
        messages: opts.messages,
        temperature: opts.temperature,
        ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
        ...(provider.reasoning
          ? { max_tokens: opts.maxTokens + 700, reasoning_effort: "low" as const }
          : {
              max_tokens: opts.maxTokens,
              ...(provider.penalties
                ? { presence_penalty: opts.presencePenalty, frequency_penalty: opts.frequencyPenalty }
                : {}),
            }),
      });

      const choice = completion.choices[0];
      const text = choice?.message?.content?.trim();
      if (text && opts.json && choice?.finish_reason === "length") {
        lastError = new Error(`${provider.name} reply was cut off by the token limit`);
        console.error(`[llm] ${provider.name} truncated a JSON reply, trying next provider`);
        continue;
      }
      if (text) return text;
      lastError = new Error(`${provider.name} returned an empty reply`);
    } catch (err) {
      lastError = err;
      if (isAccountProblem(err)) skipUntil.set(provider.name, Date.now() + COOLDOWN_MS);
      console.error(`[llm] ${provider.name} failed, trying next provider:`, err instanceof Error ? err.message : err);
    }
  }

  throw lastError;
}
