import { describe, expect, it, vi } from "vitest";
import {
  executePayoutFromPaid,
  type PayoutLockableTransaction,
  type PayoutOrchestratorStore,
} from "../src/lib/payout-orchestrator";
import type { TransactionStatus } from "../src/lib/state-machine";

function createMockOrchestratorStore(initialStatus: TransactionStatus = "paid") {
  let tx: PayoutLockableTransaction = {
    id: "9c3f2a10-4b7e-4f1a-9d2e-9b6a7c1e4a02",
    reference: "APC-20261106-0001",
    status: initialStatus,
    destination_country: "ML",
    destination_currency: "XOF",
    destination_network: "orange_ml",
    recipient_msisdn: "+22370000000",
    recipient_name: "Moussa Traore",
    payout_amount: "25000.00",
    fee_charge_mode: "DEDUCTED",
    payout_idempotency_key: null,
    payout_attempt_count: 0,
    saspay_payout_id: null,
  };

  let lockHeld = false;
  const events: Array<{ from: string | null; to: string; reason: string }> = [];

  const store: PayoutOrchestratorStore = {
    async getTransactionById(id) {
      return id === tx.id ? { ...tx } : null;
    },
    async updateTransactionStatus(id, expectedFrom, patch) {
      if (id !== tx.id || tx.status !== expectedFrom) return false;
      tx = { ...tx, ...(patch as Partial<PayoutLockableTransaction>) };
      return true;
    },
    async insertTransactionEvent(ev) {
      events.push({
        from: ev.from_status,
        to: ev.to_status,
        reason: ev.reason,
      });
    },
    async acquirePayoutLock({ transactionId }) {
      // Simulates Postgres `FOR UPDATE SKIP LOCKED` where status IN ('paid', 'retry')
      if (transactionId !== tx.id) return null;
      if (lockHeld || (tx.status !== "paid" && tx.status !== "retry")) {
        return null;
      }
      lockHeld = true;
      const attempt = tx.payout_attempt_count + 1;
      const idemKey = `apacci-payout-${tx.id}-attempt-${attempt}`;
      tx = {
        ...tx,
        status: "payout_pending",
        payout_attempt_count: attempt,
        payout_idempotency_key: idemKey,
      };
      events.push({
        from: "paid",
        to: "payout_pending",
        reason: "Acquired payout lock",
      });
      return { ...tx };
    },
    async savePayoutProviderId(transactionId, saspayPayoutId) {
      if (transactionId === tx.id) {
        tx.saspay_payout_id = saspayPayoutId;
      }
    },
  };

  return { store, getTx: () => tx, getEvents: () => events };
}

describe("Payout Idempotency & Atomic Lock Guard", () => {
  it("executes SasPay payout exactly ONCE even when invoked concurrently from webhook + cron", async () => {
    const { store, getTx } = createMockOrchestratorStore("paid");

    const mockPayoutExecutor = vi.fn().mockResolvedValue({
      message: "Payout transaction initialized successfully",
      id: "payout-uuid-999",
      status: "PENDING",
    });

    // Fire two concurrent payout attempts (e.g., webhook and reconciliation cron)
    const [res1, res2] = await Promise.all([
      executePayoutFromPaid(store, {
        transactionId: "9c3f2a10-4b7e-4f1a-9d2e-9b6a7c1e4a02",
        actorType: "webhook",
        payoutExecutor: mockPayoutExecutor,
      }),
      executePayoutFromPaid(store, {
        transactionId: "9c3f2a10-4b7e-4f1a-9d2e-9b6a7c1e4a02",
        actorType: "cron",
        payoutExecutor: mockPayoutExecutor,
      }),
    ]);

    // Exactly ONE call to SasPay POST /payouts/initialize/ must happen
    expect(mockPayoutExecutor).toHaveBeenCalledTimes(1);

    // Verify Idempotency-Key was passed to SasPay
    const [, passedIdempotencyKey] = mockPayoutExecutor.mock.calls[0]!;
    expect(passedIdempotencyKey).toBe(
      "apacci-payout-9c3f2a10-4b7e-4f1a-9d2e-9b6a7c1e4a02-attempt-1"
    );

    expect(res1.started).toBe(true);
    expect(res2.started).toBe(false);
    expect(res2.alreadyProcessedOrLocked).toBe(true);
    expect(getTx().status).toBe("payout_pending");
    expect(getTx().saspay_payout_id).toBe("payout-uuid-999");
  });

  it("refuses to start a payout if transaction is still in payment_pending", async () => {
    const { store } = createMockOrchestratorStore("payment_pending");
    const mockPayoutExecutor = vi.fn();

    const res = await executePayoutFromPaid(store, {
      transactionId: "9c3f2a10-4b7e-4f1a-9d2e-9b6a7c1e4a02",
      actorType: "system",
      payoutExecutor: mockPayoutExecutor,
    });

    expect(res.started).toBe(false);
    expect(mockPayoutExecutor).not.toHaveBeenCalled();
  });
});

