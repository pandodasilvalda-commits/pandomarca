declare module "potrace" {
  export interface PotraceOptions {
    turnPolicy?: string;
    turdSize?: number;
    alphaMax?: number;
    optCurve?: boolean;
    optTolerance?: number;
    threshold?: number;
    blackOnWhite?: boolean;
    color?: string;
    background?: string;
  }

  export function trace(
    file: string | Buffer,
    options: PotraceOptions,
    cb: (err: Error | null, svg: string) => void
  ): void;
  export function trace(
    file: string | Buffer,
    cb: (err: Error | null, svg: string) => void
  ): void;
}
