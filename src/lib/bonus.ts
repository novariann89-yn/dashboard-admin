export type BonusProgressResult = {
  progress: number;
  bonusEarned: boolean;
  bonusesEarned: number;
};

export function applyPurchase(progress: number, threshold: number): BonusProgressResult {
  const safeProgress = Number.isFinite(progress) && progress > 0 ? Math.floor(progress) : 0;

  if (!Number.isFinite(threshold) || threshold <= 0) {
    return { progress: safeProgress + 1, bonusEarned: false, bonusesEarned: 0 };
  }

  let remaining = safeProgress + 1;
  let bonusesEarned = 0;
  while (remaining >= threshold) {
    remaining -= threshold;
    bonusesEarned += 1;
  }

  return {
    progress: remaining,
    bonusEarned: bonusesEarned > 0,
    bonusesEarned,
  };
}