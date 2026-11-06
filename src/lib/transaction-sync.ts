import "server-only";
import {
  getCheckoutSessionStatus,
  verifyPayment,
  verifyPayout,
} from "./saspay";
import { transitionTransaction, type ActorType, type TransactionStatus } from "./state-machine";
import { executePayoutFromPaid, type PayoutOrchestratorStore } from "./payout-orchestrator";
import { logger } from "./logger";

export interface SyncableTransaction {
  id: string;
  status: TransactionStatus;
  saspay_checkout_id?: string | null;
  saspay_payment_id?: string | null;
  saspay_payout_id?: string | null;
  [key: string]: unknown;
}

/**
 * Server-side verification & synchronization of a single transaction against SasPay.
 * NEVER trusts browser redirects: always verifies via `getCheckoutSessionStatus` + `verifyPayment`
 * before marking `paid` or starting a payout, and via `verifyPayout` before marking `completed`.
 */
export async function verifyAndAdvanceTransaction(
  store: PayoutOrchestratorStore,
  tx: SyncableTransaction,
  actorType: ActorType = "system",
  knownSaspayPaymentId?: string | null
): Promise<TransactionStatus> {
  let currentStatus = tx.status;
  let paymentId = knownSaspayPaymentId || tx.saspay_payment_id || null;

  // 1. If in `payment_pending`, check checkout session status and/or verifyPayment
  if (currentStatus === "payment_pending") {
    if (!paymentId && tx.saspay_checkout_id) {
      try {
        const checkoutStatus = await getCheckoutSessionStatus(tx.saspay_checkout_id);
        if (checkoutStatus.transaction_id) {
          paymentId = checkoutStatus.transaction_id;
        }
        if (checkoutStatus.transaction_status === "FAILED") {
          await transitionTransaction(store, {
            transactionId: tx.id,
            toStatus: "payment_failed",
            actorType,
            reason: "Checkout session reported transaction_status FAILED",
            metadata: { checkout_id: tx.saspay_checkout_id },
            extraFields: {
              saspay_payment_id: paymentId,
              failure_code: "payment_failed",
              failure_reason: "Le paiement a été refusé ou annulé.",
            },
          });
          return "payment_failed";
        }
      } catch (err) {
        logger.warn("Could not query SasPay checkout session status", {
          transactionId: tx.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Confirm with GET /payments/{payment_id}/verify/ before marking `paid`
    if (paymentId) {
      try {
        const verified = await verifyPayment(paymentId);
        if (verified.status === "SUCCESS") {
          await transitionTransaction(store, {
            transactionId: tx.id,
            toStatus: "paid",
            actorType,
            reason: "Payment confirmed SUCCESS via GET /payments/{id}/verify/",
            metadata: {
              saspay_payment_id: verified.id,
              saspay_reference: verified.reference,
              debited_amount: verified.debited_amount,
              net_amount: verified.net_amount,
            },
            extraFields: {
              saspay_payment_id: verified.id,
            },
          });
          currentStatus = "paid";
        } else if (verified.status === "FAILED" || verified.status === "CANCELLED") {
          await transitionTransaction(store, {
            transactionId: tx.id,
            toStatus: "payment_failed",
            actorType,
            reason: `Payment verification returned ${verified.status}`,
            metadata: {
              saspay_payment_id: verified.id,
              status: verified.status,
            },
            extraFields: {
              saspay_payment_id: verified.id,
              failure_code: "payment_failed",
              failure_reason: "Le paiement n'a pas abouti auprès de l'opérateur.",
            },
          });
          return "payment_failed";
        }
      } catch (err) {
        logger.warn("Could not verify SasPay payment status", {
          transactionId: tx.id,
          paymentId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // 2. If in `paid`, atomically lock and start outbound payout to the recipient
  if (currentStatus === "paid") {
    const payoutResult = await executePayoutFromPaid(store, {
      transactionId: tx.id,
      actorType,
    });
    currentStatus = payoutResult.status;
  }

  // 3. If in `payout_pending` and we have a `saspay_payout_id`, verify outbound payout status
  const refreshed = await store.getTransactionById(tx.id);
  const payoutId = (refreshed?.saspay_payout_id as string | null) || tx.saspay_payout_id;

  if (refreshed?.status === "payout_pending" && payoutId) {
    try {
      const verifiedPayout = await verifyPayout(payoutId);
      if (verifiedPayout.status === "SUCCESS") {
        await transitionTransaction(store, {
          transactionId: tx.id,
          toStatus: "completed",
          actorType,
          reason: "Payout confirmed SUCCESS via GET /payouts/{id}/verify/",
          metadata: {
            saspay_payout_id: verifiedPayout.id,
            saspay_reference: verifiedPayout.reference,
          },
        });
        currentStatus = "completed";
      } else if (verifiedPayout.status === "FAILED" || verifiedPayout.status === "CANCELLED") {
        await transitionTransaction(store, {
          transactionId: tx.id,
          toStatus: "payout_failed",
          actorType,
          reason: `Payout verification returned ${verifiedPayout.status}`,
          metadata: {
            saspay_payout_id: verifiedPayout.id,
            status: verifiedPayout.status,
          },
          extraFields: {
            failure_code: "payout_failed",
            failure_reason: "Le transfert sortant vers le bénéficiaire a échoué.",
          },
        });
        currentStatus = "payout_failed";
      }
    } catch (err) {
      logger.warn("Could not verify SasPay payout status", {
        transactionId: tx.id,
        payoutId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return currentStatus;
}

