const PAYSTACK_BASE = "https://api.paystack.co";

type InitializeParams = {
  email: string;
  amount: number;
  callback_url: string;
  metadata: Record<string, string>;
  plan?: string;
};

export async function initializeTransaction(
  secretKey: string,
  params: InitializeParams
): Promise<{ authorization_url: string; reference: string }> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as { status: boolean; message?: string; data: { authorization_url: string; reference: string } };
  if (!data.status) throw new Error(data.message ?? "Failed to initialize transaction");
  return data.data;
}

export async function verifyTransaction(
  secretKey: string,
  reference: string
): Promise<Record<string, unknown>> {
  const res = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
    }
  );
  const data = (await res.json()) as { status: boolean; message?: string; data: Record<string, unknown> };
  if (!data.status) throw new Error(data.message ?? "Verification failed");
  return data.data;
}

export async function getSubscription(
  secretKey: string,
  subscriptionCode: string
): Promise<Record<string, unknown>> {
  const res = await fetch(
    `${PAYSTACK_BASE}/subscription/${encodeURIComponent(subscriptionCode)}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
    }
  );
  const data = (await res.json()) as { status: boolean; message?: string; data: Record<string, unknown> };
  if (!data.status) throw new Error(data.message ?? "Failed to get subscription");
  return data.data;
}

export async function disableSubscription(
  secretKey: string,
  code: string,
  token: string
): Promise<void> {
  const res = await fetch(`${PAYSTACK_BASE}/subscription/disable`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code, token }),
  });
  const data = (await res.json()) as { status: boolean; message?: string };
  if (!data.status) throw new Error(data.message ?? "Failed to disable subscription");
}

export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secretKey: string
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody))
  );
  const hex = Array.from(sig)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison to prevent timing side-channel attacks
  if (hex.length !== signature.length) return false;
  const a = new TextEncoder().encode(hex);
  const b = new TextEncoder().encode(signature);
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}
