import rawCMFs from "../data/cmfs.json"
import { createGridRenderer } from "./gpu/renderer";
import {assertNotNull} from "./utils/assertions";

const CMFs: Record<string, number[]> = rawCMFs

const c = 299792458.0;      // Speed Of Light
const h = 6.62607015e-34;   // Planck's Constant
const k = 1.380649e-23;     // Boltzmann constant

function planck(wavelength: number, temperature: number): number{
    const a = (2 * h * c * c) / (wavelength**5)
    const b = (h * c) / (wavelength * k * temperature)
    return a / (Math.exp(b) - 1)
}

// Temporary gamma func
function gamma(C: number): number {
    if (Math.abs(C) < 0.0031308){ return 12.92 * C }
    return 1.055 * (C ** (1 / 2.4)) - 0.055
}

/////////////////////
// -> BLACKBODY <- //
/////////////////////

export class BlackBody{
    temperature: number;
    diameter: number;
    SpectralPowerDistribution: Record<number, number>;

    constructor(temperature = 1000, diameter = 1000){
        this.temperature = temperature; // this.setTemperature(temperature);
        this.diameter = diameter;
        this.SpectralPowerDistribution = {};
    }

    setTemperature(temperature: number){
        this.temperature = temperature;

        for (let wavelength = 360; wavelength <= 830; wavelength++) {
            this.SpectralPowerDistribution[wavelength] = planck(wavelength * 1e-9, this.temperature);
        }
    }
}

// Temporary color computation
function computeColor(spd: Record<number, number>, l1: HTMLParagraphElement, l2: HTMLParagraphElement){

    // SPD -> XYZ
    let X = 0;
    let Y = 0;
    let Z = 0;

    for (let i = 360; i <= 830; i++){
        X += spd[i] * CMFs[i][0];
        Y += spd[i] * CMFs[i][1];
        Z += spd[i] * CMFs[i][2];
    }

    let normX = X/Y;
    let normY = Y/Y;
    let normZ = Z/Y;

    // XYZ -> sRGB
    let R = 3.2404542*normX - 1.5371385*normY - 0.4985314*normZ
    let G = -0.9692660*normX + 1.8760108*normY + 0.0415560*normZ
    let B = 0.0556434*normX - 0.2040259*normY + 1.0572252*normZ

    let m = Math.max(R, G, B)
    // let R = 1.4628067*normX - 0.1840623*normY - 0.2743606*normZ
    // let G = -0.5217933*normX + 1.4472381*normY + 0.0677227*normZ
    // let B = 0.0349342*normX - 0.0968930*normY + 1.2884099*normZ

    // R = R/m;//Math.min(Math.max(R, 0), 1);
    // G = G/m;//Math.min(Math.max(G, 0), 1);
    // B = B/m;//Math.min(Math.max(B, 0), 1);

    R = Math.min(Math.max(R, 0), 1);
    G = Math.min(Math.max(G, 0), 1);
    B = Math.min(Math.max(B, 0), 1);

    ////////
    l1.innerText = "X:" + X.toExponential(3) + "\nY:" + Y.toExponential(3) + "\nZ:" + Z.toExponential(3);
    l2.innerText = "R:" + gamma(R).toExponential(3) + "\nG:" + gamma(G).toExponential(3) + "\nB:" + gamma(B).toExponential(3);
    /////////

    return [gamma(R), gamma(G), gamma(B)];
}

////////////////
// -> MAIN <- //
////////////////
async function main(){
    const diameter = 512;
    let blackbody = new BlackBody();

    let temperatureSlider = document.getElementById("temperatureSliderId") as HTMLInputElement ;
    let temperatureSliderLabel = document.getElementById("temperatureSliderLabelId") as HTMLLabelElement;

    assertNotNull(navigator.gpu, "WebGPU not supported")

    const adapter = await navigator.gpu.requestAdapter();
    assertNotNull(adapter, "No GPUAdapter found.");

    const device = await adapter.requestDevice();

    const renderer = createGridRenderer(device, diameter, diameter);

    ////////
    let XYZlabel = document.getElementById("XYZ") as HTMLParagraphElement;
    let RGBlabel = document.getElementById("RGB") as HTMLParagraphElement;

    ////////////

    temperatureSlider.oninput = function (){
        temperatureSliderLabel.innerText = "Temperature: " + temperatureSlider.value + "K";
        blackbody.setTemperature(temperatureSlider.valueAsNumber);

        const RGBs = new Float32Array(diameter * diameter * 4);

        let RGB = computeColor(blackbody.SpectralPowerDistribution, XYZlabel, RGBlabel);
        let i = 0;
        for (let x = 0; x < diameter; x++) {
            for (let y = 0; y < diameter; y++) {
                if ( (x - (diameter-1)/2)**2 + (y - (diameter-1)/2)**2 <= ((diameter-1)/2)**2){
                    RGBs.set(RGB, i);
                }
                i += 4;
            }
        }
        console.log(RGBs);
        renderer.render(RGBs);
    }
}

main();
