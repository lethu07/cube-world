// WebGL setup
const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl');

if (!gl) {
    alert('Sorry, your browser does not support WebGL.');
    throw new Error('WebGL is not available.');
}

// Shaders
const vertexShaderSource = /* glsl */ `
  attribute vec3 a_position;
  attribute vec3 a_color;

  uniform mat4 u_model;
  uniform mat4 u_view;
  uniform mat4 u_projection;

  varying vec3 v_color;
  varying float v_fogDistance;

  void main() {
    vec4 viewPosition = u_view * u_model * vec4(a_position, 1.0);
    gl_Position = u_projection * viewPosition;
    v_color = a_color;
    // Level 4 distance to blend distant cubes into the fog
    v_fogDistance = length(viewPosition.xyz);
  }
`;

const fragmentShaderSource = /* glsl */ `
  precision mediump float;

  uniform vec3 u_mapColor;
  uniform float u_useMapColor;
  uniform float u_useFog;

  varying vec3 v_color;
  varying float v_fogDistance;

  void main() {
    vec3 color = v_color;
    if (u_useMapColor > 0.5) {
      color = u_mapColor;
    }
    if (u_useFog > 0.5) { // Level 4 add fog based on distance from camera
      float fogAmount = smoothstep(25.0, 60.0, v_fogDistance);
      color = mix(color, vec3(0.1, 0.12, 0.16), fogAmount);
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;

function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
}

const program = gl.createProgram();
gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexShaderSource));
gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
}
gl.useProgram(program);

const aPosition = gl.getAttribLocation(program, 'a_position');
const aColor = gl.getAttribLocation(program, 'a_color');
const uModel = gl.getUniformLocation(program, 'u_model');
const uView = gl.getUniformLocation(program, 'u_view');
const uProjection = gl.getUniformLocation(program, 'u_projection');
const uMapColor = gl.getUniformLocation(program, 'u_mapColor');
const uUseMapColor = gl.getUniformLocation(program, 'u_useMapColor');
const uUseFog = gl.getUniformLocation(program, 'u_useFog');

// Cube geometry and vertex colors
const cubePositions = new Float32Array([
    // Front
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5,
    -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // Back
    0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5,
    0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5,
    // Top
    -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
    -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
    // Bottom
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    // Right
    0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5,
    0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5,
    // Left
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5
]);
const VERTEX_COUNT = 36;

// Level 1b/c: Each cube uses the same corner-color pattern & WebGL interpolates it
const cubeColors = new Float32Array(cubePositions.length);
for (let i = 0; i < cubePositions.length; i += 3) {
    cubeColors[i] = cubePositions[i] + 0.5;
    cubeColors[i + 1] = cubePositions[i + 1] + 0.5;
    cubeColors[i + 2] = cubePositions[i + 2] + 0.5;
}

// Upload cube data to the GPU
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubePositions, gl.STATIC_DRAW);
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(aPosition);

const colorBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeColors, gl.STATIC_DRAW);
gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(aColor);

// Matrix helpers
function makeModelMatrix(position, scale, rotationY = 0) {
    const [tx, ty, tz] = position;
    const [sx, sy, sz] = scale;
    const cosine = Math.cos(rotationY);
    const sine = Math.sin(rotationY);
    return new Float32Array([
        cosine * sx, 0, -sine * sx, 0,
        0, sy, 0, 0,
        sine * sz, 0, cosine * sz, 0,
        tx, ty, tz, 1
    ]);
}

function subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

function normalize(v) {
    const length = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / length, v[1] / length, v[2] / length];
}

function lookAt(eye, target, up) {
    const zAxis = normalize(subtract(eye, target));
    const xAxis = normalize(cross(up, zAxis));
    const yAxis = cross(zAxis, xAxis);

    return new Float32Array([
        xAxis[0], yAxis[0], zAxis[0], 0,
        xAxis[1], yAxis[1], zAxis[1], 0,
        xAxis[2], yAxis[2], zAxis[2], 0,
        -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1
    ]);
}

function perspective(fieldOfView, aspect, near, far) {
    const f = 1.0 / Math.tan(fieldOfView / 2);
    const rangeInv = 1.0 / (near - far);
    return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (near + far) * rangeInv, -1,
        0, 0, 2 * near * far * rangeInv, 0
    ]);
}

// Level 2: map sampling and terrain settings
const GRID_SIZE = 30;
const TERRAIN_SIZE = 30; // terrain width fixed as resolution changes
const OCEAN_THRESHOLD = 0.35;
const MIN_HEIGHT = 0.2;
const TERRAIN_HEIGHT_SCALE = 2;
const levelSelect = document.getElementById('levelSelect');
const resolutionSelect = document.getElementById('resolutionSelect');
let imageGridSize = Number(resolutionSelect.value);
let currentLevel = '1a';
let cubes = [];
const colorMapImage = new Image();
const heightMapImage = new Image();

// Level 3: Bezier path and stars
function lerpVec3(a, b, t) {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t
    ];
}

function evaluateBezier(p0, p1, p2, p3, t) {
    const p01 = lerpVec3(p0, p1, t);
    const p12 = lerpVec3(p1, p2, t);
    const p23 = lerpVec3(p2, p3, t);
    const p012 = lerpVec3(p01, p12, t);
    const p123 = lerpVec3(p12, p23, t);
    return lerpVec3(p012, p123, t);
}

const skyBezierPath = {
    p0: [-10, 7, -10],
    p1: [-4, 11, 4],
    p2: [4, 6, 10],
    p3: [10, 8, -7]
};

// Different phases to make the stars move differently
const flyingStars = [
    { size: 1.2, phase: 0 },
    { size: 0.85, phase: 0.67 },
    { size: 0.55, phase: 1.33 }
];

const starParts = [
    { offset: [0, 0, 0], scale: 0.75 },
    { offset: [0, 0, -1], scale: 0.65 },
    { offset: [0.85, 0, -0.4], scale: 0.65 },
    { offset: [0.55, 0, 0.75], scale: 0.65 },
    { offset: [-0.55, 0, 0.75], scale: 0.65 },
    { offset: [-0.85, 0, -0.4], scale: 0.65 }
];

const STAR_COLOR = [1, 0.78, 0.15];
const STAR_ROTATION = Math.PI / 4;

function buildGrid(level) {
    const result = [];
    const center = (GRID_SIZE - 1) / 2;
    const cubeSize = TERRAIN_SIZE / GRID_SIZE;

    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const height = level === '1bc' // random height for Level 1bc
                ? 0.5 + Math.random() * 4
                : 1.0;

            result.push({
                position: [
                    (col - center) * cubeSize,
                    height / 2,
                    (row - center) * cubeSize
                ],
                scale: [cubeSize, height, cubeSize]
            });
        }
    }

    return result;
}

function buildImageGrid(gridSize, colorPixels, heightPixels) {
    const result = [];
    const center = (gridSize - 1) / 2;
    const maxRadius = Math.hypot(center, center);
    const cubeSize = TERRAIN_SIZE / gridSize;

    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const index = (row * gridSize + col) * 4;
            const color = [
                colorPixels[index] / 255,
                colorPixels[index + 1] / 255,
                colorPixels[index + 2] / 255
            ];

            const gray = (
                0.299 * heightPixels[index] +
                0.587 * heightPixels[index + 1] +
                0.114 * heightPixels[index + 2]
            ) / 255;
            const stormAmount = Math.max(
                0,
                (gray - OCEAN_THRESHOLD) / (1 - OCEAN_THRESHOLD)
            );
            const distance = Math.hypot(col - center, row - center) / maxRadius;
            // Add a center-to-edge height change when the map is too flat.
            const centerBoost = 1 - distance;
            // The height map is subtle --> more vertical scale
            const height = (
                MIN_HEIGHT + stormAmount * (1 + centerBoost * 3)
            ) * TERRAIN_HEIGHT_SCALE;

            result.push({
                position: [
                    (col - center) * cubeSize,
                    height / 2,
                    (row - center) * cubeSize
                ],
                scale: [cubeSize, height, cubeSize],
                color
            });
        }
    }

    return result;
}

// Rebuild the map terrain after both images load or resolution changes (lv2)
function updateImageGrid() {
    if (
        (currentLevel !== '2' && currentLevel !== '3' && currentLevel !== '4') ||
        !colorMapImage.naturalWidth || !heightMapImage.naturalWidth
    ) {
        return;
    }

    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = imageGridSize;
    sampleCanvas.height = imageGridSize;
    const context = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
        throw new Error('Could not create a 2D canvas context to sample the image.');
    }
    // Resample both maps to match the new grid resolution
    context.drawImage(colorMapImage, 0, 0, imageGridSize, imageGridSize);
    const colorPixels = context.getImageData(0, 0, imageGridSize, imageGridSize).data;
    context.clearRect(0, 0, imageGridSize, imageGridSize);
    context.drawImage(heightMapImage, 0, 0, imageGridSize, imageGridSize);
    const heightPixels = context.getImageData(0, 0, imageGridSize, imageGridSize).data;
    cubes = buildImageGrid(imageGridSize, colorPixels, heightPixels);
}

function selectLevel(level) {
    currentLevel = level;
    
    if (level === '2' || level === '3' || level === '4') {
        resolutionSelect.disabled = false;
        cubes = [];
        updateImageGrid();
        return;
    }

    resolutionSelect.disabled = true;
    cubes = buildGrid(level);
}

levelSelect.addEventListener('change', () => selectLevel(levelSelect.value));
resolutionSelect.addEventListener('change', () => {
    imageGridSize = Number(resolutionSelect.value);
    updateImageGrid();
});
selectLevel(levelSelect.value);
colorMapImage.onload = updateImageGrid;
heightMapImage.onload = updateImageGrid;
colorMapImage.onerror = () => {
    const message = 'Could not load colormap.png. Check that the image is in the project folder.';
    console.error(message);
    alert(message);
};
heightMapImage.onerror = () => {
    const message = 'Could not load heightmap.png. Check that the image is in the project folder.';
    console.error(message);
    alert(message);
};
colorMapImage.src = 'colormap.png';
heightMapImage.src = 'heightmap.png';

// Camera and rendering
gl.enable(gl.DEPTH_TEST);
gl.clearColor(0.1, 0.12, 0.16, 1.0);

function resizeCanvas() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
}

function render(timeInMilliseconds) {
    resizeCanvas();
    const seconds = timeInMilliseconds / 1000;
    const angle = seconds * 0.3;
    const eye = [
        35 * Math.cos(angle),
        18,
        35 * Math.sin(angle)
    ];
    const viewMatrix = lookAt(eye, [0, 0, 0], [0, 1, 0]);
    const projectionMatrix = perspective(
        45 * Math.PI / 180,
        canvas.width / canvas.height,
        0.1,
        100
    );

    gl.uniformMatrix4fv(uView, false, viewMatrix);
    gl.uniformMatrix4fv(uProjection, false, projectionMatrix);
    const useMapColor = currentLevel === '2' || currentLevel === '3' || currentLevel === '4';
    gl.uniform1f(uUseMapColor, useMapColor ? 1 : 0);
    gl.uniform1f(uUseFog, currentLevel === '4' ? 1 : 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    for (const cube of cubes) {
        gl.uniformMatrix4fv(
            uModel,
            false,
            makeModelMatrix(cube.position, cube.scale)
        );
        if (useMapColor) {
            gl.uniform3fv(uMapColor, cube.color);
        }
        gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
    }

    if (currentLevel === '3' || currentLevel === '4') {
        for (const star of flyingStars) {
            const cycle = (seconds * 0.2 + star.phase) % 2;
            const t = cycle <= 1 ? cycle : 2 - cycle;
            const starPosition = evaluateBezier(
                skyBezierPath.p0,
                skyBezierPath.p1,
                skyBezierPath.p2,
                skyBezierPath.p3,
                t
            );
            starPosition[1] += 3;

            const cosine = Math.cos(STAR_ROTATION);
            const sine = Math.sin(STAR_ROTATION);
            for (const part of starParts) {
                const offsetX = part.offset[0] * star.size;
                const offsetZ = part.offset[2] * star.size;
                const position = [
                    starPosition[0] + cosine * offsetX + sine * offsetZ,
                    starPosition[1] + part.offset[1] * star.size,
                    starPosition[2] - sine * offsetX + cosine * offsetZ
                ];
                const size = part.scale * star.size;
                const scale = [size, size, size];

                gl.uniformMatrix4fv(
                    uModel,
                    false,
                    makeModelMatrix(position, scale, STAR_ROTATION) // same rotation for layout and star cubes
                );
                gl.uniform3fv(uMapColor, STAR_COLOR);
                gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
            }
        }
    }

    requestAnimationFrame(render);
}

requestAnimationFrame(render);
