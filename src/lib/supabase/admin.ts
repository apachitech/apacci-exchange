import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { PayoutLockableTransaction, PayoutOrchestratorStore } from "../payout-orchestrator";
import type { ActorType, TransactionStatus } from "../state-machine";

/**
 * Server-only Supabase Service Role client.
 * Used strictly for server-side state transitions, webhook processing,
 * reconciliation cron jobs, and verified admin actions.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey || url.includes("your-project-ref")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL must be configured on the server"
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Creates a `PayoutOrchestratorStore` (which also implements `TransitionStore`)
 * backed by the Supabase Service Role Postgres client.
 */
export function createSupabaseTransactionStore(): PayoutOrchestratorStore {
  const supabase = createServiceRoleClient();

  return {
    async getTransactionById(id: string) {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch transaction ${id}: ${error.message}`);
      }
      return data;
    },

    async updateTransactionStatus(
      id: string,
      expectedFromStatus: TransactionStatus,
      patch: Record<string, unknown>
    ) {
      const { data, error } = await supabase
        .from("transactions")
        .update(patch)
        .eq("id", id)
        .eq("status", expectedFromStatus)
        .select("id");

      if (error) {
        throw new Error(`Failed to update transaction ${id}: ${error.message}`);
      }
      return Array.isArray(data) && data.length === 1;
    },

    async insertTransactionEvent(event) {
      const { error } = await supabase.from("transaction_events").insert({
        transaction_id: event.transaction_id,
        from_status: event.from_status,
        to_status: event.to_status,
        actor_type: event.actor_type,
        actor_id: event.actor_id ?? null,
        reason: event.reason,
        metadata: event.metadata,
      });

      if (error) {
        throw new Error(`Failed to write transaction_events audit log: ${error.message}`);
      }
    },

    async acquirePayoutLock(params: {
      transactionId: string;
      actorType: ActorType;
      actorId?: string | null;
      reason: string;
    }): Promise<PayoutLockableTransaction | null> {
      const { data, error } = await supabase.rpc("acquire_payout_lock", {
        p_tx_id: params.transactionId,
        p_actor_type: params.actorType,
        p_actor_id: params.actorId ?? null,
        p_reason: params.reason,
      });

      if (error) {
        throw new Error(`acquire_payout_lock RPC failed: ${error.message}`);
      }

      const row = Array.isArray(data) ? data[0] : data;
      return (row as PayoutLockableTransaction) ?? null;
    },

    async savePayoutProviderId(transactionId: string, saspayPayoutId: string) {
      const { error } = await supabase
        .from("transactions")
        .update({
          saspay_payout_id: saspayPayoutId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transactionId);

      if (error) {
        throw new Error(`Failed to save saspay_payout_id: ${error.message}`);
      }
    },
  };
}

