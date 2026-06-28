export const hardExpiry = (h = 24) => new Date(Date.now() + h * 3_600_000);
export const viewExpiry = ()       => new Date(Date.now() + 3_600_000);
