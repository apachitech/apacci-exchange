import "server-only";
import { createPayout, SasPayError } from "./saspay";
import { transitionTransaction, type ActorType, type TransitionStore, type TransactionStatus } from "./state-machine";
import { logger } from "./logger";

export interface PayoutLockableTransaction {
  id: string;
  reference: string;
  status: TransactionStatus;
  destination_country: string;
  destination_currency: string;
  destination_network: string;
  recipient_msisdn: string;
  recipient_name: string;
  payout_amount: string;
  fee_charge_mode: "ADD_ON" | "DEDUCTED";
  payout_idempotency_key: string | null;
  payout_attempt_count: number;
  saspay_payout_id: string | null;
  sender_email?: string;
  sender_name?: string;
  sender_phone?: string;
}

export interface PayoutOrchestratorStore extends TransitionStore {
  /**
   * Atomically locks the transaction row ONLY if status == 'paid' (or 'retry' after admin retry)
   * and transitions it to 'payout_pending' with a deterministic `payout_idempotency_key`
   * while writing a `transaction_events` row.
   * Returns null if the row is not in a lockable state or is already locked by another worker.
   */
  acquirePayoutLock(params: {
    transactionId: string;
    actorType: ActorType;
    actorId?: string | null;
    reason: string;
  }): Promise<PayoutLockableTransaction | null>;

  savePayoutProviderId(transactionId: string, saspayPayoutId: string): Promise<void>;
}

export interface PayoutExecutionResult {
  started: boolean;
  alreadyProcessedOrLocked?: boolean;
  saspayPayoutId?: string;
  status: TransactionStatus;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Initiates a payout to the recipient ONLY from `paid` (or `retry` when explicitly unlocked by admin)
 * and ONLY ONCE per attempt using an atomic DB lock + SasPay `Idempotency-Key`.
 */
export async function executePayoutFromPaid(
  store: PayoutOrchestratorStore,
  params: {
    transactionId: string;
    actorType: ActorType;
    actorId?: string | null;
    payoutExecutor?: typeof createPayout;
  }
): Promise<PayoutExecutionResult> {
  const {
    transactionId,
    actorType,
    actorId = null,
    payoutExecutor = createPayout,
  } = params;

  // 1. Atomic DB lock & transition `paid` -> `payout_pending`
  const lockedTx = await store.acquirePayoutLock({
    transactionId,
    actorType,
    actorId,
    reason: "Atomically locked transaction in paid state to initiate SasPay payout",
  });

  if (!lockedTx) {
    logger.info("Skipped payout initiation: transaction not in `paid` state or already locked", {
      transactionId,
    });
    const current = await store.getTransactionById(transactionId);
    return {
      started: false,
      alreadyProcessedOrLocked: true,
      status: current?.status ?? "paid",
    };
  }

  const idempotencyKey =
    lockedTx.payout_idempotency_key ||
    `apacci-payout-${lockedTx.id}-attempt-${lockedTx.payout_attempt_count || 1}`;

  const [firstName = "Client", ...restNames] = (lockedTx.recipient_name || "Beneficiaire").trim().split(/\s+/);
  const lastName = restNames.join(" ") || "Apacci";

  try {
    // 2. Call SasPay POST /payouts/initialize/ with Idempotency-Key
    const payoutRes = await payoutExecutor(
      {
        amount: String(lockedTx.payout_amount),
        currency: lockedTx.destination_currency,
        country: lockedTx.destination_country,
        customer: {
          email: lockedTx.sender_email || "transfer@apacci.exchange",
          first_name: firstName,
          last_name: lastName,
          phone: lockedTx.recipient_msisdn,
        },
        method: lockedTx.destination_network,
        recipient: {
          msisdn: lockedTx.recipient_msisdn,
        },
        description: `Apacci Exchange ${lockedTx.reference}`,
        metadata: {
          apacci_transaction_id: lockedTx.id,
          apacci_reference: lockedTx.reference,
        },
        fee_charge_mode: lockedTx.fee_charge_mode,
      },
      idempotencyKey
    );

    await store.savePayoutProviderId(lockedTx.id, payoutRes.id);

    // If SasPay synchronously returned SUCCESS, transition immediately to completed
    if (payoutRes.status === "SUCCESS") {
      await transitionTransaction(store, {
        transactionId: lockedTx.id,
        toStatus: "completed",
        actorType: "system",
        reason: "SasPay payout succeeded synchronously",
        metadata: { saspay_payout_id: payoutRes.id },
        extraFields: { saspay_payout_id: payoutRes.id },
      });
      return {
        started: true,
        saspayPayoutId: payoutRes.id,
        status: "completed",
      };
    }

    return {
      started: true,
      saspayPayoutId: payoutRes.id,
      status: "payout_pending",
    };
  } catch (err) {
    const errorCode = err instanceof SasPayError ? err.errorCode : "payout_init_error";
    const errorMessage = err instanceof Error ? err.message : "Unknown payout error";

    logger.error("SasPay payout initialization failed", {
      transactionId: lockedTx.id,
      errorCode,
      errorMessage,
    });

    await transitionTransaction(store, {
      transactionId: lockedTx.id,
      toStatus: "payout_failed",
      actorType: "system",
      reason: `Payout initialization failed: ${errorCode}`,
      metadata: {
        error_code: errorCode,
        error_message: errorMessage,
        payout_idempotency_key: idempotencyKey,
      },
      extraFields: {
        failure_code: errorCode,
        failure_reason: errorMessage,
      },
    });

    return {
      started: false,
      status: "payout_failed",
      errorCode,
      errorMessage,
    };
  }
}

