import { lerp } from './cmfs';
import { readFile } from "./utils/file-reader";
import { createGridRenderer } from "./gpu/renderer";
import { assertNotNull } from "./utils/assertions";

function gamma(C: number): number {
    if (Math.abs(C) < 0.0031308){
        return 12.92 * C
    }
    return 1.055 * (C ** (1 / 2.4)) - 0.055
}

document.getElementById("file-input")?.addEventListener("change", async (event) => {

    const target = event.target as HTMLInputElement;
    const files = target.files;
    const file = files ? files[0] : null;
    if (!file) return;

    const dataGen = await readFile(file);

    const [nx, ny]: number[] = (await dataGen.next()).value;
    const wavelengths: number[] = (await dataGen.next()).value;

    const h = new Array(wavelengths.length)
    h[0] = (wavelengths[1] - wavelengths[0]) / 2;
    for (let i = 1; i < wavelengths.length-1; i++) {
        h[i] = (wavelengths[i+1] - wavelengths[i-1])/2;
    }
    h[wavelengths.length-1] = (wavelengths[wavelengths.length-1] - wavelengths[wavelengths.length-2]) / 2

    // M = h * M_cmfs
    const M: number[][] = wavelengths.map((lambda, index) => lerp(lambda).map(value => value * h[index]));

    let result = [];
    let max = 1;

    for await (let data of dataGen) {
        let X = data.map((value, index) => value * M[index][0]).reduce((prev, curr) => prev + curr, 0);
        let Y = data.map((value, index) => value * M[index][1]).reduce((prev, curr) => prev + curr, 0);
        let Z = data.map((value, index) => value * M[index][2]).reduce((prev, curr) => prev + curr, 0);

        max = Math.max(X, Y, Z, max);

        result.push([X, Y, Z]);
    }

    result = result.map(XYZ => [XYZ[0]/max, XYZ[1]/max, XYZ[2]/max]);
    result = result.map(XYZ => [
        gamma(Math.min(Math.max(3.2404542 * XYZ[0] - 1.5371385 * XYZ[1] - 0.4985314 * XYZ[2], 0), 1)),
        gamma(Math.min(Math.max(-0.9692660 * XYZ[0] + 1.8760108 * XYZ[1] + 0.0415560 * XYZ[2], 0), 1)),
        gamma(Math.min(Math.max(0.0556434 * XYZ[0] - 0.2040259 * XYZ[1] + 1.0572252 * XYZ[2], 0), 1)),
        0
    ]).flat();


    assertNotNull(navigator.gpu, "WebGPU not supported")

    const adapter = await navigator.gpu.requestAdapter();
    assertNotNull(adapter, "No GPUAdapter found.");

    const device = await adapter.requestDevice();

    const renderer = createGridRenderer(device, nx, ny);
    renderer.render(new Float32Array(result));
});
