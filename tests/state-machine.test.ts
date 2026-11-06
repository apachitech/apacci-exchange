import { describe, expect, it } from "vitest";
import {
  InvalidStateTransitionError,
  isValidTransition,
  transitionTransaction,
  type TransactionStatus,
  type TransitionStore,
} from "../src/lib/state-machine";

function createInMemoryStore(initialStatus: TransactionStatus = "created"): {
  store: TransitionStore;
  getTx: () => { id: string; status: TransactionStatus; paid_at?: string | null; completed_at?: string | null };
  getEvents: () => Array<{
    from_status: TransactionStatus | null;
    to_status: TransactionStatus;
    actor_type: string;
    reason: string;
  }>;
} {
  let tx: { id: string; status: TransactionStatus; paid_at?: string | null; completed_at?: string | null } = {
    id: "tx-1001",
    status: initialStatus,
    paid_at: null,
    completed_at: null,
  };
  const events: Array<{
    from_status: TransactionStatus | null;
    to_status: TransactionStatus;
    actor_type: string;
    reason: string;
  }> = [];

  const store: TransitionStore = {
    async getTransactionById(id: string) {
      return id === tx.id ? { ...tx } : null;
    },
    async updateTransactionStatus(id, expectedFromStatus, patch) {
      if (id !== tx.id || tx.status !== expectedFromStatus) return false;
      tx = { ...tx, ...(patch as Partial<typeof tx>) };
      return true;
    },
    async insertTransactionEvent(ev) {
      events.push({
        from_status: ev.from_status,
        to_status: ev.to_status,
        actor_type: ev.actor_type,
        reason: ev.reason,
      });
    },
  };

  return {
    store,
    getTx: () => tx,
    getEvents: () => events,
  };
}

describe("Transaction State Machine", () => {
  it("supports the full happy path: created -> payment_pending -> paid -> payout_pending -> completed", async () => {
    const { store, getTx, getEvents } = createInMemoryStore("created");

    await transitionTransaction(store, {
      transactionId: "tx-1001",
      toStatus: "payment_pending",
      actorType: "system",
      reason: "Checkout session created",
    });
    expect(getTx().status).toBe("payment_pending");

    await transitionTransaction(store, {
      transactionId: "tx-1001",
      toStatus: "paid",
      actorType: "webhook",
      reason: "Payment verified via SasPay",
    });
    expect(getTx().status).toBe("paid");
    expect(getTx().paid_at).toBeTruthy();

    await transitionTransaction(store, {
      transactionId: "tx-1001",
      toStatus: "payout_pending",
      actorType: "system",
      reason: "Payout initiated",
    });
    expect(getTx().status).toBe("payout_pending");

    await transitionTransaction(store, {
      transactionId: "tx-1001",
      toStatus: "completed",
      actorType: "webhook",
      reason: "Payout confirmed",
    });
    expect(getTx().status).toBe("completed");
    expect(getTx().completed_at).toBeTruthy();

    const events = getEvents();
    expect(events).toHaveLength(4);
    expect(events.map((e) => `${e.from_status}->${e.to_status}`)).toEqual([
      "created->payment_pending",
      "payment_pending->paid",
      "paid->payout_pending",
      "payout_pending->completed",
    ]);
  });

  it("supports failure branches: payout_failed -> retry | refunded | manual_review", async () => {
    const { store, getTx } = createInMemoryStore("payout_failed");

    expect(isValidTransition("payout_failed", "retry")).toBe(true);
    expect(isValidTransition("payout_failed", "refunded")).toBe(true);
    expect(isValidTransition("payout_failed", "manual_review")).toBe(true);

    await transitionTransaction(store, {
      transactionId: "tx-1001",
      toStatus: "retry",
      actorType: "admin",
      reason: "Admin triggered manual payout retry",
    });
    expect(getTx().status).toBe("retry");

    await transitionTransaction(store, {
      transactionId: "tx-1001",
      toStatus: "payout_pending",
      actorType: "admin",
      reason: "Retrying payout on SasPay",
    });
    expect(getTx().status).toBe("payout_pending");
  });

  it("rejects illegal transitions such as payment_pending -> payout_pending or completed -> paid", async () => {
    const { store } = createInMemoryStore("payment_pending");

    await expect(
      transitionTransaction(store, {
        transactionId: "tx-1001",
        toStatus: "payout_pending",
        actorType: "system",
        reason: "Attempt to skip paid state",
      })
    ).rejects.toThrow(InvalidStateTransitionError);

    const completedCtx = createInMemoryStore("completed");
    await expect(
      transitionTransaction(completedCtx.store, {
        transactionId: "tx-1001",
        toStatus: "retry",
        actorType: "admin",
        reason: "Cannot retry completed transaction",
      })
    ).rejects.toThrow(InvalidStateTransitionError);
  });
});

