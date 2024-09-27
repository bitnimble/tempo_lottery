export function zip<T, U>(t: T[], u: U[]) {
  // Not sure if we need mismatched array lengths
  if (t.length !== u.length) {
    throw new Error('attempted to zip two arrays of differing lengths');
  }

  return t.map((tv, i) => [tv, u[i]]);
}

export function recordZip<T, U extends string | number | symbol>(u: U[], t: Record<U, T>) {
  return u.map((uv) => [t[uv], uv] as const);
}
