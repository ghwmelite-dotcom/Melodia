import { api } from "../lib/api.js";

export interface BillingStatus {
  plan: string;
  credits_remaining: number;
  credits_max: number;
  credits_reset_at: string | null;
  plan_expires_at: string | null;
  has_subscription: boolean;
}

export interface Payment {
  id: string;
  paystack_reference: string;
  amount: number;
  currency: string;
  status: "success" | "failed" | "pending";
  plan: string;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

interface SubscribeResponse {
  success: boolean;
  checkout_url: string;
  reference: string;
}

interface VerifyResponse {
  success: boolean;
  plan: string;
}

interface CancelResponse {
  success: boolean;
  cancelled: boolean;
  plan_expires_at: string;
}

interface StatusResponse extends BillingStatus {
  success: boolean;
}

interface HistoryResponse {
  success: boolean;
  payments: Payment[];
}

export function useBilling() {
  return {
    subscribe: async (plan: string): Promise<{ checkout_url: string; reference: string }> => {
      const res = await api.post<SubscribeResponse>("/api/billing/subscribe", { plan });
      return { checkout_url: res.checkout_url, reference: res.reference };
    },

    verify: async (reference: string): Promise<{ plan: string }> => {
      const res = await api.post<VerifyResponse>("/api/billing/verify", { reference });
      return { plan: res.plan };
    },

    cancel: async (): Promise<{ cancelled: boolean; plan_expires_at: string }> => {
      const res = await api.post<CancelResponse>("/api/billing/cancel");
      return { cancelled: res.cancelled, plan_expires_at: res.plan_expires_at };
    },

    getStatus: async (): Promise<BillingStatus> => {
      const res = await api.get<StatusResponse>("/api/billing/status");
      return {
        plan: res.plan,
        credits_remaining: res.credits_remaining,
        credits_max: res.credits_max,
        credits_reset_at: res.credits_reset_at,
        plan_expires_at: res.plan_expires_at,
        has_subscription: res.has_subscription,
      };
    },

    getHistory: async (): Promise<{ payments: Payment[] }> => {
      const res = await api.get<HistoryResponse>("/api/billing/history");
      return { payments: res.payments };
    },
  };
}
