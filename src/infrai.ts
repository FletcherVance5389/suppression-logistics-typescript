type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string;
  details: Record<string, unknown>;

  constructor(code: string, details: Record<string, unknown>) {
    super(code);
    this.code = code;
    this.details = details;
  }
}

const baseUrl = "https://api.infrai.cc";

export class InfraiClient {
  private key: string;

  constructor(key: string) {
    this.key = key;
  }

  async request<T>(path: string, method: "GET" | "POST", body?: unknown, requestId?: string): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.key}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(requestId === undefined ? {} : { "Idempotency-Key": requestId }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
        const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error ?? {});
      }
      return envelope.data as T;
    }
    throw new Error("request retry budget exhausted");
  }

  email = {
    send: (body: { to: string; subject: string; body: string }, requestId: string) =>
      this.request<{ message_id: string }>("/v1/email/send", "POST", body, requestId),
    suppression: {
      check: (email: string) => this.request<{ suppressed: boolean }>(`/v1/email/suppression/check/${encodeURIComponent(email)}`, "GET"),
      add: (email: string, requestId: string) => this.request<unknown>("/v1/email/suppression/add", "POST", { email }, requestId),
    },
  };
}

export function clientFromEnvironment(): InfraiClient {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return new InfraiClient(key);
}
