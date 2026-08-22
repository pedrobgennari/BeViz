import { lerp } from './cmfs.js';
import { setupRenderer } from "./renderer";

class FileReader{
    constructor(file){
        this.file = file;
    }

    async getDataView(start, end){

        const blob = this.file.slice(start, end);
        const buffer = await blob.arrayBuffer();
        return new DataView(buffer);
    }

    async getFloat32Array(count, fileOffset, littleEndian = false){

        let result = new Float32Array(count);

        const dataView = await this.getDataView(fileOffset, fileOffset + 4 * count);

        let dataViewOffset = 0;

        for (let i = 0; i < count; ++i) {
            result[i] = dataView.getFloat32(dataViewOffset, littleEndian);
            dataViewOffset += 4
        }
        return result
    }


    // Reads `count` sequential values of type `dtype` from the file, starting at `start`
    async unpack(dtype, count, fileOffset, littleEndian = false){

        // TODO: remove magic number (it's here because both 'l' and 'f' are 4 bytes)
        const size = 4;

        let result = new Array(count);

        const blob = this.file.slice(fileOffset, fileOffset + size * count);
        const buffer = await blob.arrayBuffer();
        const view = new DataView(buffer);

        let viewOffset = 0;
        for (let i = 0; i < count; ++i) {
            switch (dtype) {
                case 'l':
                    result[i] = view.getInt32(viewOffset, littleEndian) || 0; // || 0;
                    break;
                case 'f':
                    result[i] = view.getFloat32(viewOffset, littleEndian) || 0; // || 0;
                    break;
                default:
                    throw new Error(`Unknown type ${dtype}`);
            }
            viewOffset += size;
        }
        return result
    }
}

async function* read_maps_file(file){
    let reader = new FileReader(file);

    const [nobs, lnum, nx, ny] = await reader.unpack("l", 4, 0)
    const [Ra, Rstar, Lratio, xmax_] = await reader.unpack("l", 4, 16)
    const [nf] = await reader.unpack("f", 1, 32)
    const [nm] = await reader.unpack("l", 1, 36)
    const xmax = await reader.unpack("f", nm, 40)

    console.log("[nx, ny, lnum] = ", nx, ny, lnum);

    const obslist = await reader.unpack("f", 2 * nobs, 40 + 4*(nm) + 4*(nm * nobs * lnum * ny * nx));
    const lbdarr = await reader.unpack("f", lnum + 1, 40 + 4*(nm) + 4*(nm * nobs * lnum * ny * nx) + 4*(2 * nobs));
    const wavelengths = lbdarr.slice(0, -1).map((num, index) => 1e3 * (num + lbdarr.slice(1)[index]) / 2);

    yield wavelengths;

    ///////////////////////
    let all_data = []


    let offset = 40 + 4*(nm);
    for (let i = 0; i < lnum; i++){
        all_data.push(await reader.unpack("f", nx*ny, offset));
        offset += 4*nx*ny;
    }

    for (let i = 0; i < nx*ny; i++){
        yield all_data.map(value => value[i]);
    }

    console.log('finish');

    ///////////////////////

    return;

    const MAX_CHUNK_SIZE = 100;

    for (let i = 0; i < ny; i++) {
        let offset = 40 + 4*(nm) + 4*(i * nx);
        let result = [];

        for (let j = 0; j < lnum; j++) {
            let part_result = [];
            let left = nx;

            console.time('readpart');
            const ay = await reader.unpack("f", 500, offset);
            console.timeEnd('readpart');

            console.time('pushpart');
            part_result.push(...ay);
            console.timeEnd('pushpart');

            // while(left > 0) {
            //     const to_read = Math.min(MAX_CHUNK_SIZE, left);
            //     part_result.push(await reader.unpack("f", to_read, offset));
            //     left -= to_read;
            //     offset += 4 * to_read;
            // }

            result.push(part_result);
            offset += 4 * nx * ny;
            //offset += 4 * nx * (ny-1);
        }
        // //console.log(result);
        // console.log(result.length);
        // for (let l = 0; l < 50; l++){
        //     console.log(result[l].length);
        // }
        //console.log(result[0].flatMap((_, index) => result.map(a => a[index])).length);
        yield result[0].flatMap((_, index) => result.map(a => a[index]));
    }

    // const CHUNK_SIZE = 20;
    // //let offset = 44;
    // for (let i = 0; i <= lnum; i++){
    //     let offset = 44 + (i * ny * 4);
    //     for (let j = 0; j <= CHUNK_SIZE; j++) {
    //         console.log(await reader.unpack("f", CHUNK_SIZE, offset))
    //         offset += nx * 4
    //     }
    // }
}

function gamma(C) {
    if (Math.abs(C) < 0.0031308){
        return 12.92 * C
    }
    return 1.055 * (C ** (1 / 2.4)) - 0.055
}

document.getElementById("mapsFileInput").addEventListener("change", async (event) => {
    const file = event.target.files[0];

    if (!file) return;

    const dataGen = await read_maps_file(file);

    const wavelengths = (await dataGen.next()).value;

    const h = new Array(wavelengths.length)
    h[0] = (wavelengths[1] - wavelengths[0]) / 2;
    for (let i = 1; i < wavelengths.length-1; i++) {
        h[i] = (wavelengths[i+1] - wavelengths[i-1])/2;
    }
    h[wavelengths.length-1] = (wavelengths[wavelengths.length-1] - wavelengths[wavelengths.length-2]) / 2

    // h * M_cmfs
    const M = wavelengths.map((lambda, index) => lerp(lambda).map(value => value * h[index]));
    console.log(h);

    const renderer = await setupRenderer(500, 500);

    //let offset = 0;
    let result = [];
    let max = 0.1;
    console.time("data2xyzTimer");
    for await (let data of dataGen) {

        for (let j = 0; j < 1; j++) {
            let a = data.slice(j * 50, j * 50 + 50);
            let X = a.map((value, index) => value * M[index][0]).reduce((prev, curr) => prev + curr, 0);
            let Y = a.map((value, index) => value * M[index][1]).reduce((prev, curr) => prev + curr, 0);
            let Z = a.map((value, index) => value * M[index][2]).reduce((prev, curr) => prev + curr, 0);

            max = Math.max(X, Y, Z, max);

            result.push([X, Y, Z]);
            //console.log('a');

            // let normX = X / Y;
            // let normY = Y / Y;
            // let normZ = Z / Y;
            //
            // // XYZ -> sRGB
            // let R = 3.2404542 * normX - 1.5371385 * normY - 0.4985314 * normZ
            // let G = -0.9692660 * normX + 1.8760108 * normY + 0.0415560 * normZ
            // let B = 0.0556434 * normX - 0.2040259 * normY + 1.0572252 * normZ
            //
            // let m = Math.max(R, G, B)
            //
            // // R = gamma(R / m); //Math.min(Math.max(R, 0), 1);
            // // G = gamma(G / m);
            // // B = gamma(B / m);
            //
            // R = Math.min(Math.max(R, 0), 1);
            // G = Math.min(Math.max(G, 0), 1);
            // B = Math.min(Math.max(B, 0), 1);
            //
            // result.push(gamma(R), gamma(G), gamma(B), 0);
        }
        //renderer.render(new Float32Array(result), offset);
        //offset += 4 * (4*500);
    }
    console.timeEnd("data2xyzTimer");

    console.time("xyz2rgbTimer");

    console.log('max: ', max);

    //const max = Math.max(...result.flat());
    //max = 6140.756549867716;
    result = result.map(XYZ => [XYZ[0]/max, XYZ[1]/max, XYZ[2]/max]);
    result = result.map(XYZ => [
        gamma(Math.min(Math.max(3.2404542 * XYZ[0] - 1.5371385 * XYZ[1] - 0.4985314 * XYZ[2], 0), 1)),
        gamma(Math.min(Math.max(-0.9692660 * XYZ[0] + 1.8760108 * XYZ[1] + 0.0415560 * XYZ[2], 0), 1)),
        gamma(Math.min(Math.max(0.0556434 * XYZ[0] - 0.2040259 * XYZ[1] + 1.0572252 * XYZ[2], 0), 1)),
        0
    ]).flat();

    renderer.render(new Float32Array(result));

    console.timeEnd("xyz2rgbTimer");
    console.log("FIN");
});

// async function main(){
//
// }
//
// main();



// let offset = 0;
// for await (let data of dataGen) {
//     //console.log('a');
//     let result = [];
//
//     for (let j = 0; j < 500; j++) {
//         let a = data.slice(j * 50, j * 50 + 50);
//         let X = a.map((value, index) => value * M[index][0]).reduce((prev, curr) => prev + curr, 0);
//         let Y = a.map((value, index) => value * M[index][1]).reduce((prev, curr) => prev + curr, 0);
//         let Z = a.map((value, index) => value * M[index][0]).reduce((prev, curr) => prev + curr, 0);
//
//         result.push([X, Y, Z, 0]);
//
//         let normX = X / Y;
//         let normY = Y / Y;
//         let normZ = Z / Y;
//
//         // XYZ -> sRGB
//         let R = 3.2404542 * normX - 1.5371385 * normY - 0.4985314 * normZ
//         let G = -0.9692660 * normX + 1.8760108 * normY + 0.0415560 * normZ
//         let B = 0.0556434 * normX - 0.2040259 * normY + 1.0572252 * normZ
//
//         let m = Math.max(R, G, B)
//
//         // R = gamma(R / m); //Math.min(Math.max(R, 0), 1);
//         // G = gamma(G / m);
//         // B = gamma(B / m);
//
//         R = Math.min(Math.max(R, 0), 1);
//         G = Math.min(Math.max(G, 0), 1);
//         B = Math.min(Math.max(B, 0), 1);
//
//         result.push(gamma(R), gamma(G), gamma(B), 0);
//     }
//     renderer.render(new Float32Array(result), offset);
//     offset += 4 * (4*500);
// }