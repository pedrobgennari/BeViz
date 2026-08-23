class FileReader{
    file: File;

    constructor(file: File){
        this.file = file;
    }

    async getDataView(start: number, end: number){
        const blob = this.file.slice(start, end);
        const buffer = await blob.arrayBuffer();
        return new DataView(buffer);
    }

    async getInt32Array(count: number, offset: number, littleEndian: boolean = false){
        const dataView = await this.getDataView(offset, offset + 4 * count);

        let result: number[] =  new Array(count);//Int32Array(count);

        let byteOffset = 0;
        for (let i = 0; i < count; ++i) {
            result[i] = dataView.getInt32(byteOffset, littleEndian) || 0;
            byteOffset += 4
        }
        return result;
    }

    async getFloat32Array(count: number, offset: number, littleEndian: boolean = false){
        const dataView = await this.getDataView(offset, offset + 4 * count);

        let result: number[] = new Array(count);

        let byteOffset = 0;
        for (let i = 0; i < count; ++i) {
            result[i] = dataView.getFloat32(byteOffset, littleEndian) || 0;
            byteOffset += 4
        }

        return result;
    }
}

async function* readMapsFile(file: File): AsyncGenerator<number[]>{
    let reader = new FileReader(file);

    const [nobs, lnum, nx, ny] = await reader.getInt32Array(4, 0)

    yield [nx, ny]

    const [Ra, Rstar, Lratio, xmax_] = await reader.getInt32Array(4, 16)

    const [nf] =  await reader.getFloat32Array(1, 32)

    const [nm] = await reader.getInt32Array(1, 36)

    const xmax =  await reader.getFloat32Array(nm, 40)

    const obslist = await reader.getFloat32Array(2 * nobs, 40 + 4*(nm) + 4*(nm * nobs * lnum * ny * nx))

    const lbdarr = await reader.getFloat32Array(lnum + 1, 40 + 4*(nm) + 4*(nm * nobs * lnum * ny * nx) + 4*(2 * nobs))

    const wavelengths = lbdarr.slice(0, -1).map((num, index) => 1e3 * (num + lbdarr.slice(1)[index]) / 2);

    yield wavelengths;

    let data = []
    let offset = 40 + 4*(nm);
    for (let i = 0; i < lnum; i++){
        data.push(await reader.getFloat32Array(nx*ny, offset));
        offset += 4*nx*ny;
    }

    for (let i = 0; i < nx*ny; i++){
        yield data.map(value => value[i]);
    }
}

export async function readFile(file: File){

    const fileExt = file.name.split('.').pop()

    switch (fileExt) {
        case "maps":
            return readMapsFile(file);
        case "fullsed2":
            throw new Error(`Not implemented for ${fileExt} files!`);
        default:
            throw new Error(`Unsupported file extension (${fileExt})`);
    }
}
