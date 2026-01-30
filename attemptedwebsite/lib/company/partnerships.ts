export const MAX_PARTNERSHIPS = 5;

export function normalizeCompanyPair(a: string, b: string) {
  if (a.localeCompare(b) <= 0) {
    return { companyAId: a, companyBId: b };
  }
  return { companyAId: b, companyBId: a };
}
