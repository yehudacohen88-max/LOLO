import assert from "node:assert/strict";
import test from "node:test";
import { formatGiftAmount } from "@/lib/guest-draft";
import { giftProgressCopy, participationLine } from "@/app/e/[slug]/progress-copy";

test("guest progress copy uses only the supplied figures", async (t) => {
  await t.test("zero guests show the target and no invented activity", () => {
    const copy = giftProgressCopy({
      raisedAmount: 0,
      contributorCount: 0,
      percentOfTarget: 0,
      targetAmount: 4800,
      prominent: true,
    });
    assert.equal(copy.showEmptyGuests, true);
    assert.equal(copy.raisedText, null);
    assert.equal(copy.countText, null);
    assert.equal(copy.remainingText, null);
    assert.equal(copy.targetText, formatGiftAmount(4800));
    assert.equal(copy.percentText, "\u20660%\u2069");
    assert.equal(copy.bar, 0);
    assert.equal(copy.reached, null);
  });

  await t.test("a partial gift keeps the api percent and the rounded remainder", () => {
    const copy = giftProgressCopy({
      raisedAmount: 4500,
      contributorCount: 23,
      percentOfTarget: 93.75,
      targetAmount: 4800,
      prominent: true,
    });
    assert.equal(copy.countText, "כבר 23 חברים הצטרפו");
    assert.equal(copy.countNumber, "23");
    assert.equal(copy.raisedText, formatGiftAmount(4500));
    assert.equal(copy.targetText, formatGiftAmount(4800));
    assert.equal(copy.remainingText, formatGiftAmount(300));
    assert.equal(copy.percentValue, 93.75);
    assert.equal(copy.percentText, "\u206693.75%\u2069");
    assert.equal(copy.bar, 0.9375);
    assert.equal(copy.closeToGoal, true);
    assert.equal(copy.reached, null);
  });

  await t.test("one participant is not pluralized", () => {
    const copy = giftProgressCopy({
      raisedAmount: 150,
      contributorCount: 1,
      percentOfTarget: 15,
      targetAmount: 1000,
    });
    assert.equal(copy.singleGuest, true);
    assert.equal(copy.countShort, "חבר אחד");
    assert.equal(copy.closeToGoal, false);
    assert.equal(copy.remainingText, formatGiftAmount(850));
  });

  await t.test("meeting the target does not say money is still missing", () => {
    const copy = giftProgressCopy({
      raisedAmount: 200,
      contributorCount: 4,
      percentOfTarget: 100,
      targetAmount: 200,
    });
    assert.equal(copy.reached, "met");
    assert.equal(copy.remainingText, null);
    assert.equal(copy.percentText, "\u2066100%\u2069");
    assert.equal(copy.bar, 1);
  });

  await t.test("money over the target keeps the real percent above 100", () => {
    const copy = giftProgressCopy({
      raisedAmount: 5000,
      contributorCount: 30,
      percentOfTarget: 104.17,
      targetAmount: 4800,
    });
    assert.equal(copy.reached, "over");
    assert.equal(copy.remainingText, null);
    assert.equal(copy.percentValue, 104.17);
    assert.equal(copy.percentText, "\u2066104.17%\u2069");
    assert.equal(copy.bar, 1);
    assert.equal(copy.raisedText, formatGiftAmount(5000));
    const line = participationLine(copy);
    assert.equal(line.includes("המטרה הושגה!"), true);
    assert.equal(line.includes(formatGiftAmount(5000)), true);
    assert.equal(line.includes("104.17%"), false);
  });

  await t.test("a percent far above the target stays on the amount, not a wrapped percent", () => {
    const copy = giftProgressCopy({
      raisedAmount: 5000,
      contributorCount: 8,
      percentOfTarget: 500,
      targetAmount: 1000,
    });
    const line = participationLine(copy);
    assert.equal(copy.reached, "over");
    assert.equal(copy.percentValue, 500);
    assert.equal(copy.bar, 1);
    assert.equal(line.startsWith("המטרה הושגה!"), true);
    assert.equal(line.includes(formatGiftAmount(5000)), true);
    assert.equal(line.includes(formatGiftAmount(1000)), true);
    assert.equal(line.includes("500%"), false);
    assert.equal(copy.summary.includes("500%"), false);
  });

  await t.test("a missing percent is omitted instead of calculated", () => {
    const copy = giftProgressCopy({
      raisedAmount: 80,
      contributorCount: 2,
      percentOfTarget: null,
      targetAmount: 100,
    });
    assert.equal(copy.percentText, null);
    assert.equal(copy.percentValue, null);
    assert.equal(copy.bar, null);
    assert.equal(copy.closeToGoal, false);
    assert.equal(copy.remainingText, formatGiftAmount(20));
  });

  await t.test("missing or invalid figures are left out", () => {
    const copy = giftProgressCopy({
      raisedAmount: Number.NaN,
      contributorCount: -3,
      percentOfTarget: Number.NaN,
      targetAmount: 0,
      prominent: true,
    });
    assert.equal(copy.raisedText, null);
    assert.equal(copy.countText, null);
    assert.equal(copy.showEmptyGuests, false);
    assert.equal(copy.targetText, null);
    assert.equal(copy.percentText, null);
    assert.equal(copy.bar, null);
    assert.equal(copy.reached, null);
  });

  await t.test("agorot stay exact on both sides of the remainder", () => {
    const copy = giftProgressCopy({
      raisedAmount: 10.25,
      contributorCount: 2,
      percentOfTarget: 25.63,
      targetAmount: 40,
    });
    assert.equal(copy.raisedText, formatGiftAmount(10.25));
    assert.equal(copy.remainingText, formatGiftAmount(29.75));
    assert.equal(copy.percentText, "\u206625.63%\u2069");
  });
});
