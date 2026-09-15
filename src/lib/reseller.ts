export interface ResellerLevelInput {
  id: string;
  name: string;
  minBottles: number;
  active: boolean;
  prices: Record<string, number>;
}

export interface ResellerPriceInput {
  totalBottles: number;
  moq: number;
  levels: ResellerLevelInput[];
  lockedLevelId: string | null;
  variantId: string;
  fallbackPrice: number;
}

export interface ResellerPriceResult {
  price: number;
  levelId: string | null;
  levelName: string | null;
  eligible: boolean;
  reason: "locked" | "tier" | "base" | "below-moq" | "no-level";
}

export function resolveResellerPrice(
  input: ResellerPriceInput,
): ResellerPriceResult {
  if (input.lockedLevelId) {
    const locked = input.levels.find((level) => level.id === input.lockedLevelId);
    if (locked) {
      return {
        price: locked.prices[input.variantId] ?? input.fallbackPrice,
        levelId: locked.id,
        levelName: locked.name,
        eligible: true,
        reason: "locked",
      };
    }
  }

  if (input.totalBottles < input.moq) {
    return {
      price: input.fallbackPrice,
      levelId: null,
      levelName: null,
      eligible: false,
      reason: "below-moq",
    };
  }

  const level = input.levels
    .filter((item) => item.active)
    .sort((a, b) => b.minBottles - a.minBottles)
    .find((item) => input.totalBottles >= item.minBottles);

  if (!level) {
    return {
      price: input.fallbackPrice,
      levelId: null,
      levelName: null,
      eligible: true,
      reason: "base",
    };
  }

  return {
    price: level.prices[input.variantId] ?? input.fallbackPrice,
    levelId: level.id,
    levelName: level.name,
    eligible: true,
    reason: "tier",
  };
}

export function levelMarginWarning(
  price: number,
  costPrice: number,
  minimumMarginPercent = 10,
): boolean {
  if (price <= 0 || costPrice <= 0) return true;
  return price <= costPrice * (1 + minimumMarginPercent / 100);
}