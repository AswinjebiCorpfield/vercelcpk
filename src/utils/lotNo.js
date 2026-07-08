// Lot-number sorting helper.
//
// BRD: Lot No. lists are sorted ascending by the *last 7 digits* of the lot
// number (e.g. "…2603_005" → key "2603005"). Non-digit separators (underscores,
// dashes) are ignored for the comparison, and because the keys are fixed-width
// 7-digit strings, a lexicographic compare is equivalent to a numeric one.

export const lotNoLast7 = (lotNo) => String(lotNo ?? '').replace(/\D/g, '').slice(-7);

// Ascending comparator by last-7 digits (returns <0 / 0 / >0).
export const compareLotNoLast7 = (a, b) => lotNoLast7(a).localeCompare(lotNoLast7(b));
