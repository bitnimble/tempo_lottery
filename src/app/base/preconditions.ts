export class Preconditions {
  static checkExists<T>(x: T | undefined | null): NonNullable<T> {
    if (x == null) {
      throw new Error('expected something to exist, but it was nullish');
    }
    return x;
  }
}
