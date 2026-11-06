import "server-only";
import { logger } from "./logger";

/**
 * Transaction State Machine for Apacci Exchange
 *
 * Allowed flow:
 * created -> payment_pending -> paid -> payout_pending -> completed
 * Failure branches:
 * payment_failed | payout_failed -> (retry | refunded | manual_review)
 */

export type TransactionStatus =
  | "created"
  | "payment_pending"
  | "paid"
  | "payout_pending"
  | "completed"
  | "payment_failed"
  | "payout_failed"
  | "retry"
  | "refunded"
  | "manual_review";

export type ActorType = "user" | "system" | "webhook" | "cron" | "admin";

export const ALLOWED_TRANSITIONS: Readonly<Record<TransactionStatus, readonly TransactionStatus[]>> = {
  created: ["payment_pending", "payment_failed"],
  payment_pending: ["paid", "payment_failed"],
  paid: ["payout_pending", "payout_failed"],
  payout_pending: ["completed", "payout_failed"],
  completed: [],
  payment_failed: ["retry", "manual_review"],
  payout_failed: ["retry", "refunded", "manual_review"],
  retry: ["payment_pending", "payout_pending", "payment_failed", "payout_failed"],
  refunded: [],
  manual_review: ["retry", "refunded", "completed", "payout_failed"],
};

export class InvalidStateTransitionError extends Error {
  public readonly fromStatus: TransactionStatus;
  public readonly toStatus: TransactionStatus;

  constructor(fromStatus: TransactionStatus, toStatus: TransactionStatus) {
    super(`Invalid transaction state transition: ${fromStatus} -> ${toStatus}`);
    this.name = "InvalidStateTransitionError";
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

export function isValidTransition(
  fromStatus: TransactionStatus,
  toStatus: TransactionStatus
): boolean {
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus);
}

export interface TransitionStore {
  getTransactionById(id: string): Promise<{
    id: string;
    status: TransactionStatus;
    paid_at?: string | null;
    completed_at?: string | null;
    [key: string]: unknown;
  } | null>;
  updateTransactionStatus(
    id: string,
    expectedFromStatus: TransactionStatus,
    patch: Record<string, unknown>
  ): Promise<boolean>;
  insertTransactionEvent(event: {
    transaction_id: string;
    from_status: TransactionStatus | null;
    to_status: TransactionStatus;
    actor_type: ActorType;
    actor_id?: string | null;
    reason: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
}

export interface TransitionTransactionInput {
  transactionId: string;
  toStatus: TransactionStatus;
  actorType: ActorType;
  actorId?: string | null;
  reason: string;
  metadata?: Record<string, unknown>;
  extraFields?: Record<string, unknown>;
}

/**
 * Transitions a transaction from its current status to `toStatus`, validating
 * the state machine rules and writing an audit row to `transaction_events`.
 */
export async function transitionTransaction(
  store: TransitionStore,
  input: TransitionTransactionInput
): Promise<{ previousStatus: TransactionStatus; newStatus: TransactionStatus }> {
  const tx = await store.getTransactionById(input.transactionId);
  if (!tx) {
    throw new Error(`Transaction ${input.transactionId} not found`);
  }

  const fromStatus = tx.status;

  if (!isValidTransition(fromStatus, input.toStatus)) {
    throw new InvalidStateTransitionError(fromStatus, input.toStatus);
  }

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: input.toStatus,
    updated_at: nowIso,
    ...(input.extraFields ?? {}),
  };

  if (input.toStatus === "paid" && !tx.paid_at) {
    patch.paid_at = nowIso;
  }
  if (input.toStatus === "completed" && !tx.completed_at) {
    patch.completed_at = nowIso;
  }

  const updated = await store.updateTransactionStatus(
    input.transactionId,
    fromStatus,
    patch
  );

  if (!updated) {
    throw new Error(
      `Concurrent state modification detected for transaction ${input.transactionId} (expected ${fromStatus})`
    );
  }

  await store.insertTransactionEvent({
    transaction_id: input.transactionId,
    from_status: fromStatus,
    to_status: input.toStatus,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    reason: input.reason,
    metadata: input.metadata ?? {},
  });

  logger.info("Transaction state transitioned", {
    transactionId: input.transactionId,
    fromStatus,
    toStatus: input.toStatus,
    actorType: input.actorType,
    reason: input.reason,
  });

  return { previousStatus: fromStatus, newStatus: input.toStatus };
}

