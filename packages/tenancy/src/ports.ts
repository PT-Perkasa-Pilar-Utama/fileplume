/** Injected seams. technical-specs/05-module-definitions.md 5.1 declares none beyond time. */
export interface Clock {
  now(): Date;
}
