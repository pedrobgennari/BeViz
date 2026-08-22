///////////////////
// -> IMPORTS <- //
///////////////////

import CMFs from "../data/cmfs.json"
import {setupRenderer} from "./renderer";

//import "../css/main.css";

/////////////////////
// -> CONSTANTS <- //
/////////////////////

const c = 299792458.0;      // Speed Of Light
const h = 6.62607015e-34;   // Planck's Constant
const k = 1.380649e-23;     // Boltzmann constant

//////////////////
// -> PLANCK <- //
//////////////////

function planck(wavelength, temperature){
    const a = (2 * h * c * c) / (wavelength**5)
    const b = (h * c) / (wavelength * k * temperature)
    const B = a / (Math.exp(b) - 1)
    return B
}

// Temprary gamma func
function gamma(C) {
    if (Math.abs(C) < 0.0031308){ return 12.92 * C }
    return 1.055 * (C ** (1 / 2.4)) - 0.055
}

/////////////////////
// -> BLACKBODY <- //
/////////////////////

export class BlackBody{
    constructor(temperature = 1000, diameter = 1000){
        this.temperature = temperature; // this.setTemperature(temperature);
        this.diameter = diameter;
        this.SpectralPowerDistribution = {};
    }

    setTemperature(temperature){
        this.temperature = temperature;

        for (let wavelength = 360; wavelength <= 830; wavelength++) {
            const intensity = planck(wavelength * 1e-9, this.temperature);
            this.SpectralPowerDistribution[wavelength] = intensity;
        }
    }

    // getSpectralPowerDistribution(){
    //     // Create flat array with SPD
    //     let SPD = [];
    //     for (let [key, value] of Object.entries(this.SpectralPowerDistribution)){
    //         SPD.push(key, value);
    //     }
    //     SPD = new Float32Array(SPD);
    //
    //     // Create empty matrix
    //     const SPDsMatrix = new Array(this.diameter+1);
    //     for (let i = 0; i < this.diameter+1; i++){
    //         SPDsMatrix[i] = new Array(this.diameter+1);
    //     }
    //
    //     // Fill matrix with SPDs, making a circle
    //     for (let x = 0; x <= this.diameter; x++) {
    //         for (let y = 0; y <= this.diameter; y++) {
    //             if ( (x - this.diameter/2)**2 + (y - this.diameter/2)**2 <= (this.diameter/2)**2){
    //                 SPDsMatrix[x][y] = SPD;
    //             }
    //         }
    //     }
    //     console.log(SPDsMatrix);
    //     return SPDsMatrix;
    // }
}

// Temporary color computation
function computeColor(spd, l1, l2){

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

    let temperatureSlider = document.getElementById("temperatureSliderId");
    let temperatureSliderLabel = document.getElementById("temperatureSliderLabelId");

    const renderer = await setupRenderer(diameter, diameter);

    ////////
    let XYZlabel = document.getElementById("XYZ");
    let RGBlabel = document.getElementById("RGB");

    ////////////

    temperatureSlider.oninput = function (){
        temperatureSliderLabel.innerText = "Temperature: " + temperatureSlider.value + "K";
        blackbody.setTemperature(temperatureSlider.value);

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
