import GRID_SHADER from "../../shaders/grid.wgsl?raw"
import { assertNotNull } from "../utils/assertions"

export function createGridRenderer(device: GPUDevice, width: number, height: number) {

    ///////////////////////
    // -> BASIC SETUP <- //
    ///////////////////////

    // Get canvas (from .html file)
    const canvas = document.querySelector("canvas");
    assertNotNull(canvas, "Canvas not found.");

    // Get canvas context (for drawing)
    const context = canvas.getContext("webgpu");
    assertNotNull(context, "Context not found.");

    // Get canvas format
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

    context.configure({ device, format: canvasFormat });

    //////////////////////////
    // -> SHADER MODULES <- //
    //////////////////////////

    const GridShaderModule = device.createShaderModule({
        label: "Grid Shader",
        code: GRID_SHADER
    });

    ///////////////////
    // -> BUFFERS <- //
    ///////////////////

    // Vertex Buffer
    const CELLSIZE = 1;
    const vertexArray = new Float32Array([
        -CELLSIZE, -CELLSIZE, CELLSIZE, -CELLSIZE, CELLSIZE, CELLSIZE, // Triangle #1
        -CELLSIZE, -CELLSIZE, CELLSIZE, CELLSIZE, -CELLSIZE, CELLSIZE, // Triangle #2
    ]);
    const vertexBuffer = device.createBuffer({
        label: "Cell Vertices Buffer",
        size: vertexArray.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertexArray);

    const vertexBufferLayout  = {
        arrayStride: 8,
        attributes: [
            {
                format: "float32x2",
                offset: 0,
                shaderLocation: 0,
            },
        ],
    } satisfies GPUVertexBufferLayout;

    // Uniforms Buffer
    const uniformArray = new Float32Array([width, height]);
    const uniformBuffer = device.createBuffer({
        label: "Grid Uniforms Buffer",
        size: uniformArray.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

    // RGBs Buffer
    const RGBsSize = width * height * 4 * 4;
    const RGBsBuffer = device.createBuffer({
        label: "RGBs Buffer.",
        size: RGBsSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    //////////////////////////
    // -> BINDING GROUPS <- //
    //////////////////////////

    const renderBindGroupLayout = device.createBindGroupLayout({
        label: "Render Bind Group Layout",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,// | GPUShaderStage.FRAGMENT,
                buffer: {},
            },
            {
                binding: 1,
                visibility: GPUShaderStage.VERTEX,// | GPUShaderStage.FRAGMENT,
                buffer: { type: "read-only-storage" },
            },
        ],
    });

    const renderBindGroup = device.createBindGroup({
        label: "Render renderer bind",
        layout: renderBindGroupLayout,
        entries: [{
            binding: 0,
            resource: { buffer: uniformBuffer }
        }, {
            binding: 1,
            resource: {buffer: RGBsBuffer}
        }],
    });

    /////////////////////
    // -> PIPELINES <- //
    /////////////////////

    const renderPipelineLayout = device.createPipelineLayout({
        label: "Render Pipeline Layout",
        bindGroupLayouts: [renderBindGroupLayout],
    });

    const renderPipeline = device.createRenderPipeline({
        label: "Render Pipeline",
        layout: renderPipelineLayout,
        vertex: {
            module: GridShaderModule,
            entryPoint: "vertexMain",
            buffers: [vertexBufferLayout]
        },
        fragment: {
            module: GridShaderModule,
            entryPoint: "fragmentMain",
            targets: [{
                format: canvasFormat
            }]
        }
    });

    //////////////////
    // -> RENDER <- //
    //////////////////

    function render(RGBsArray: Float32Array, offset: number = 0){

        // Write RGBs to Buffer
        device.queue.writeBuffer(RGBsBuffer, offset, RGBsArray);

        ///////////////////////
        // -> RENDER PASS <- //
        ///////////////////////

        const encoder = device.createCommandEncoder();

        assertNotNull(context);
        const renderPass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: "clear",
                clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
                storeOp: "store",
            }]
        });

        renderPass.setPipeline(renderPipeline);
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.setBindGroup(0, renderBindGroup);

        const instanceCount = width * height;
        renderPass.draw(vertexArray.length / 2, instanceCount);

        renderPass.end();

        device.queue.submit([encoder.finish()]);
    }

    return { render };
}
