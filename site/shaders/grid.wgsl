struct VertexInput {
    @location(0) pos: vec2f,
    @builtin(instance_index) instance: u32,
};

struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) color: vec4f,
};

struct RGBMatrix {
    data: array<vec4<f32>>,
};

@group(0) @binding(0) var<uniform> grid: vec2f; // grid uniform is '[width, height]'
@group(0) @binding(1) var<storage> RGBs: RGBMatrix;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput  {
    // Find cell position in drawing grid
    let i = f32(input.instance);
    let cell = vec2f(i % grid.x, floor(i / grid.x));
    let cellOffset = cell / grid * 2;
    let gridPos = (input.pos + 1) / grid - 1 + cellOffset;

//    let i = f32(input.instance);
//    let cell = vec2f(i % grid.x, -floor(i / grid.x));
//    let cellOffset = 2*cell / grid;
//    let gridPos = (input.pos + vec2f(1, -1)) / grid - vec2f(1, -1) + cellOffset;

    var output: VertexOutput;
    output.pos = vec4f(gridPos, 0, 1);
    output.color = RGBs.data[input.instance];
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    return input.color;
}