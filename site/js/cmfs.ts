import rawCMFs from "../data/cmfs.json"
const CMFs: Record<string, number[]> = rawCMFs

export function lerp(x: number): number[] {
    // If x is OUT of the visible espectrum, return [0, 0, 0]
    if (x < 360 || x > 830) return [0, 0, 0];

    // If x is an integer, return the "tabulated" value
    if (Number.isInteger(x)) return CMFs[x];

    // If x is NOT an integer, return the interpolated value
    const x0 = Math.floor(x);
    const x1 = Math.ceil(x);

    const r = CMFs[x0][0] + ( (CMFs[x1][0] - CMFs[x0][0]) / (x1-x0) ) * (x-x0);
    const g = CMFs[x0][1] + ( (CMFs[x1][1] - CMFs[x0][1]) / (x1-x0) ) * (x-x0);
    const b = CMFs[x0][2] + ( (CMFs[x1][2] - CMFs[x0][2]) / (x1-x0) ) * (x-x0);

    return [r, g, b];
}
