import { describe, expect, it } from "vitest";
import { calculateQuote, isValidDecimalString, type PricingTier } from "../src/lib/money";

describe("Decimal String Money & Fee Calculation", () => {
  const samplePayinTier: PricingTier = {
    min_amount: "0.00",
    max_amount: "500000.00",
    currency: "XOF",
    percent: "2.500",
    fixed: "0.00",
    floor_amount: "50.00",
    cap_amount: null,
    fee_charge_mode: "ADD_ON",
  };

  const samplePayoutTier: PricingTier = {
    min_amount: "0.00",
    max_amount: "500000.00",
    currency: "XOF",
    percent: "1.500",
    fixed: "0.00",
    floor_amount: null,
    cap_amount: "5000.00",
    fee_charge_mode: "DEDUCTED",
  };

  it("computes ADD_ON fee and exact received amount for XOF -> XOF (CI -> ML)", () => {
    // 25,000.00 XOF with 2.5% payin (625.00) + 1.5% payout (375.00) + 1.0% platform (250.00) = 1,250.00 XOF fee
    const quote = calculateQuote({
      sendAmount: "25000.00",
      senderCurrency: "XOF",
      destinationCurrency: "XOF",
      exchangeRate: "1.00000000",
      feeChargeMode: "ADD_ON",
      payinTier: samplePayinTier,
      payoutTier: samplePayoutTier,
      platformFeePercent: "1.000",
      platformFeeFixed: "0.00",
    });

    expect(quote.sendAmount).toBe("25000.00");
    expect(quote.feeAmount).toBe("1250.00");
    expect(quote.totalCharged).toBe("26250.00");
    expect(quote.netSendAmount).toBe("25000.00");
    expect(quote.payoutAmount).toBe("25000.00");
  });

  it("computes DEDUCTED fee and converts to TZS (CI -> TZ)", () => {
    // 10,000.00 XOF in DEDUCTED mode:
    // Payin 2.5% = 250.00, Payout 1.5% = 150.00, Platform 1.0% = 100.00 => Total Fee = 500.00 XOF
    // Net send = 9,500.00 XOF. At rate 4.45000000 TZS/XOF => 42,275.00 TZS
    const quote = calculateQuote({
      sendAmount: "10000.00",
      senderCurrency: "XOF",
      destinationCurrency: "TZS",
      exchangeRate: "4.45000000",
      feeChargeMode: "DEDUCTED",
      payinTier: samplePayinTier,
      payoutTier: samplePayoutTier,
      platformFeePercent: "1.000",
      platformFeeFixed: "0.00",
    });

    expect(quote.sendAmount).toBe("10000.00");
    expect(quote.feeAmount).toBe("500.00");
    expect(quote.totalCharged).toBe("10000.00");
    expect(quote.netSendAmount).toBe("9500.00");
    expect(quote.payoutAmount).toBe("42275.00");
    expect(quote.destinationCurrency).toBe("TZS");
  });

  it("respects floor_amount on small transfers", () => {
    // 500.00 XOF: 2.5% is 12.50 XOF, but payinTier floor_amount is 50.00 XOF
    const quote = calculateQuote({
      sendAmount: "500.00",
      senderCurrency: "XOF",
      destinationCurrency: "XOF",
      exchangeRate: "1.00000000",
      feeChargeMode: "ADD_ON",
      payinTier: samplePayinTier,
      payoutTier: null,
      platformFeePercent: "0.00",
      platformFeeFixed: "0.00",
    });

    expect(quote.feeAmount).toBe("50.00");
    expect(quote.totalCharged).toBe("550.00");
  });

  it("rejects non-decimal or negative strings", () => {
    expect(isValidDecimalString("2500.00")).toBe(true);
    expect(isValidDecimalString("-100.00")).toBe(false);
    expect(isValidDecimalString("abc")).toBe(false);
    expect(() =>
      calculateQuote({
        sendAmount: "0.00",
        senderCurrency: "XOF",
        destinationCurrency: "XOF",
        exchangeRate: "1.00000000",
        feeChargeMode: "ADD_ON",
      })
    ).toThrow();
  });
});

