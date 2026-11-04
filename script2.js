
// Step 1. Get WebGL Context
const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl');

if (!gl) {
    alert('Sorry, your browser does not support WebGL.');
}

// Step 2. Shaders
const vertexShaderSource = /* glsl */ `
  attribute vec3 a_position;
  attribute float a_shade;

  uniform mat4 u_model;
  uniform mat4 u_view;
  uniform mat4 u_projection;

  varying float v_shade;

  void main() {
    gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
    v_shade = a_shade;
  }
`;

const fragmentShaderSource = /* glsl */ `
  precision mediump float;

  uniform vec3 u_color;
  varying float v_shade;

  void main() {
    gl_FragColor = vec4(u_color * v_shade, 1.0);
  }
`;

// Step 3. Compile Shaders & Link Program
function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
    }
    return shader;
}

const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
}

gl.useProgram(program);

const a_position = gl.getAttribLocation(program, 'a_position');
const a_shade = gl.getAttribLocation(program, 'a_shade');
const u_model = gl.getUniformLocation(program, 'u_model');
const u_view = gl.getUniformLocation(program, 'u_view');
const u_projection = gl.getUniformLocation(program, 'u_projection');
const u_color = gl.getUniformLocation(program, 'u_color');

// Step 4. Describe a cube (geometry) and upload its data to the GPU (buffers)
const cubePositions = new Float32Array([
    // Front face (z = +0.5)
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5,
    -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // Back face (z = -0.5)
    0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5,
    0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5,
    // Top face (y = +0.5)
    -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
    -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
    // Bottom face (y = -0.5)
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    // Right face (x = +0.5)
    0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5,
    0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5,
    // Left face (x = -0.5)
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
]);

// (1.0 = full color, smaller = darker.)
const cubeShades = new Float32Array([
    0.85, 0.85, 0.85, 0.85, 0.85, 0.85, // front
    0.70, 0.70, 0.70, 0.70, 0.70, 0.70, // back
    1.00, 1.00, 1.00, 1.00, 1.00, 1.00, // top
    0.40, 0.40, 0.40, 0.40, 0.40, 0.40, // bottom
    0.75, 0.75, 0.75, 0.75, 0.75, 0.75, // right
    0.60, 0.60, 0.60, 0.60, 0.60, 0.60, // left
]);

const VERTEX_COUNT = 36;

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubePositions, gl.STATIC_DRAW);
gl.vertexAttribPointer(a_position, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(a_position);

const shadeBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, shadeBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeShades, gl.STATIC_DRAW);
gl.vertexAttribPointer(a_shade, 1, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(a_shade);

// Step 5. Matrix helpers
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
    const length = Math.sqrt(dot(v, v));
    return length > 0 ? [v[0] / length, v[1] / length, v[2] / length] : [0, 0, 0];
}

function makeModelMatrix(position, scale) {
    const [tx, ty, tz] = position;
    const [sx, sy, sz] = scale;
    return new Float32Array([
        sx, 0, 0, 0,
        0, sy, 0, 0,
        0, 0, sz, 0,
        tx, ty, tz, 1
    ]);
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

// -----------------------------------------------------------------------------
// Level 3 Helper: Vector LERP & Cubic Bézier Evaluation
// -----------------------------------------------------------------------------
function lerpVec3(a, b, t) {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t
    ];
}

function evaluateCubicBezier(p0, p1, p2, p3, t) {
    const p01 = lerpVec3(p0, p1, t);
    const p12 = lerpVec3(p1, p2, t);
    const p23 = lerpVec3(p2, p3, t);
    const p012 = lerpVec3(p01, p12, t);
    const p123 = lerpVec3(p12, p23, t);
    return lerpVec3(p012, p123, t);
}

// -----------------------------------------------------------------------------
// LEVEL 2: Image Terrain Loader (Single or Dual Images)
// -----------------------------------------------------------------------------
let groundObjects = [];

// function buildTerrainFromPixels(colorPixels, heightPixels, gridWidth, gridDepth, maxHeight = 7.0) {
//     const newGroundObjects = [];

//     // Define a fixed overall world width and depth for the landscape
//     const TOTAL_WORLD_SIZE = 36.0;
//     const cubeSize = TOTAL_WORLD_SIZE / gridWidth; // Cubes shrink as grid resolution increases

//     const halfWidth = gridWidth / 2;
//     const halfDepth = gridDepth / 2;

//     for (let z = 0; z < gridDepth; z++) {
//         for (let x = 0; x < gridWidth; x++) {
//             const idx = (z * gridWidth + x) * 4;

//             const r = colorPixels[idx] / 255.0;
//             const g = colorPixels[idx + 1] / 255.0;
//             const b = colorPixels[idx + 2] / 255.0;

//             const hr = heightPixels[idx] / 255.0;
//             const hg = heightPixels[idx + 1] / 255.0;
//             const hb = heightPixels[idx + 2] / 255.0;

//             const hIntensity = (hr + hg + hb) / 3.0;

//             const h = Math.max(0.15, hIntensity * maxHeight);

//             // Center the grid around (0,0,0) with dynamic cube positioning
//             const posX = (x - halfWidth + 0.5) * cubeSize;
//             const posZ = (z - halfDepth + 0.5) * cubeSize;

//             newGroundObjects.push({
//                 position: [posX, h / 2.0, posZ],
//                 // Scale X and Z dynamically (0.98 maintains a crisp gap between cubes)
//                 scale: [cubeSize * 0.98, h, cubeSize * 0.98],
//                 color: [r, g, b]
//             });
//         }
//     }
//     groundObjects = newGroundObjects;
// }



function buildTerrainFromPixels(
    colorPixels,
    heightPixels,
    gridWidth,
    gridDepth,
    maxHeight = 7.0
) {
    const newGroundObjects = [];

    // Overall terrain dimensions
    const TOTAL_WORLD_SIZE = 36.0;
    const cubeSize = TOTAL_WORLD_SIZE / gridWidth;

    const halfWidth = gridWidth / 2;
    const halfDepth = gridDepth / 2;

    // Hurricane center (assumes the hurricane is centered in the image)
    const centerX = (gridWidth - 1) / 2;
    const centerZ = (gridDepth - 1) / 2;

    // Maximum distance from the center to a corner
    const maxRadius = Math.sqrt(
        centerX * centerX + centerZ * centerZ
    );

    // Height-map settings
    const OCEAN_THRESHOLD = 0.35;
    const MIN_STORM_HEIGHT = 0.15;

    for (let z = 0; z < gridDepth; z++) {
        for (let x = 0; x < gridWidth; x++) {

            const idx = (z * gridWidth + x) * 4;

            // -------------------------------------------------
            // 1. Get original color from the color map
            // -------------------------------------------------
            const r = colorPixels[idx] / 255.0;
            const g = colorPixels[idx + 1] / 255.0;
            const b = colorPixels[idx + 2] / 255.0;

            // -------------------------------------------------
            // 2. Convert height-map pixel to grayscale
            // -------------------------------------------------
            const hr = heightPixels[idx] / 255.0;
            const hg = heightPixels[idx + 1] / 255.0;
            const hb = heightPixels[idx + 2] / 255.0;

            const gray = 0.299 * hr + 0.587 * hg + 0.114 * hb;

            // -------------------------------------------------
            // 3. Separate ocean from hurricane
            // -------------------------------------------------
            let stormMask = 0;

            if (gray > OCEAN_THRESHOLD) {
                stormMask = (gray - OCEAN_THRESHOLD) /
                    (1.0 - OCEAN_THRESHOLD);
            }

            // -------------------------------------------------
            // 4. Calculate distance from hurricane center
            // -------------------------------------------------
            const dx = x - centerX;
            const dz = z - centerZ;

            const radius = Math.sqrt(dx * dx + dz * dz);
            const normalizedRadius = radius / maxRadius;

            // -------------------------------------------------
            // 5. Create radial height profile
            // Higher center -> shorter outer bands
            // -------------------------------------------------
            const radialFactor = 2 - normalizedRadius;

            // -------------------------------------------------
            // 6. Calculate final cube height
            // Ocean remains low; storm gets radial variation
            // -------------------------------------------------
            let h = MIN_STORM_HEIGHT +
                stormMask * radialFactor * maxHeight;

            // Keep ocean almost flat
            if (gray <= OCEAN_THRESHOLD) {
                h = MIN_STORM_HEIGHT;
            }

            // -------------------------------------------------
            // 7. Position each cube
            // -------------------------------------------------
            const posX = (x - halfWidth + 0.5) * cubeSize;
            const posZ = (z - halfDepth + 0.5) * cubeSize;

            newGroundObjects.push({
                position: [posX, h / 2.0, posZ],
                scale: [
                    cubeSize * 0.98,
                    h,
                    cubeSize * 0.98
                ],
                color: [r, g, b]
            });
        }
    }

    groundObjects = newGroundObjects;
}

// Load terrain from colormap.png & heightmap.png
function loadTerrainFromLocalFolder(colorMapPath = 'colormap.png', heightMapPath = 'heightmap.png', gridWidth = 225, gridDepth = 225) {
    let colorPixels = null;
    let heightPixels = null;

    const checkAndBuild = () => {
        if (colorPixels && heightPixels) {
            buildTerrainFromPixels(colorPixels, heightPixels, gridWidth, gridDepth, 7.0);
        }
    };

    const colorImg = new Image();
    colorImg.onload = () => {
        const c = document.createElement('canvas');
        c.width = gridWidth;
        c.height = gridDepth;
        const ctx = c.getContext('2d');
        ctx.drawImage(colorImg, 0, 0, gridWidth, gridDepth);
        colorPixels = ctx.getImageData(0, 0, gridWidth, gridDepth).data;
        checkAndBuild();
    };
    colorImg.onerror = () => {
        alert('Error: Could not load colormap.png. Please check that the file exists in the project folder.');
    };
    colorImg.src = colorMapPath;

    const heightImg = new Image();
    heightImg.onload = () => {
        const c = document.createElement('canvas');
        c.width = gridWidth;
        c.height = gridDepth;
        const ctx = c.getContext('2d');
        ctx.drawImage(heightImg, 0, 0, gridWidth, gridDepth);
        heightPixels = ctx.getImageData(0, 0, gridWidth, gridDepth).data;
        checkAndBuild();
    };
    heightImg.onerror = () => {
        alert('Error: Could not load heightmap.png. Please check that the file exists in the project folder.');
    };
    heightImg.src = heightMapPath;
}

// Fallback pattern if colormap.png and heightmap.png are not in folder yet
// function loadFallbackTerrain(gridWidth = 300, gridDepth = 300) {
//     const dummyColor = new Uint8ClampedArray(gridWidth * gridDepth * 4);
//     const dummyHeight = new Uint8ClampedArray(gridWidth * gridDepth * 4);

//     for (let z = 0; z < gridDepth; z++) {
//         for (let x = 0; x < gridWidth; x++) {
//             const idx = (z * gridWidth + x) * 4;
//             const dx = x - gridWidth / 2;
//             const dz = z - gridDepth / 2;
//             const dist = Math.sqrt(dx * dx + dz * dz);
//             const val = Math.max(0, Math.min(255, Math.floor(255 - dist * 10 + Math.sin(x * 0.4) * 40)));

//             dummyHeight[idx] = val;
//             dummyHeight[idx + 1] = val;
//             dummyHeight[idx + 2] = val;
//             dummyHeight[idx + 3] = 255;

//             dummyColor[idx] = Math.floor(val * 0.3);
//             dummyColor[idx + 1] = Math.floor(val * 0.8);
//             dummyColor[idx + 2] = Math.floor(255 - val);
//             dummyColor[idx + 3] = 255;
//         }
//     }
//     buildTerrainFromPixels(dummyColor, dummyHeight, gridWidth, gridDepth, 7.0, false);
// }

// Load uploaded image via File Input
// document.getElementById('imageUpload').addEventListener('change', function (e) {
//     const file = e.target.files && e.target.files[0];
//     if (file) {
//         const reader = new FileReader();
//         reader.onload = function (evt) {
//             const img = new Image();
//             img.onload = () => {
//                 const c = document.createElement('canvas');
//                 c.width = 36;
//                 c.height = 36;
//                 const ctx = c.getContext('2d');
//                 ctx.drawImage(img, 0, 0, 36, 36);
//                 const pixels = ctx.getImageData(0, 0, 36, 36).data;
//                 buildTerrainFromPixels(pixels, pixels, 36, 36, 7.0, true);
//             };
//             img.src = evt.target.result;
//         };
//         reader.readAsDataURL(file);
//     }
// });

// Load colormap.png & heightmap.png from local folder on startup
loadTerrainFromLocalFolder('colormap.png', 'heightmap.png');

// -----------------------------------------------------------------------------
// MANUAL KEYBOARD CAMERA CONTROLS
// -----------------------------------------------------------------------------
let cameraAngle = Math.PI / 4;  // Orbital rotation angle
let cameraRadius = 35.0;         // Distance from center
let cameraHeight = 18.0;         // Elevation along Y-axis
const LOOK_AT = [0.0, 2.0, 0.0];
const UP = [0.0, 1.0, 0.0];

const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

function updateCameraFromKeys() {
    const rotSpeed = 0.03;
    const zoomSpeed = 0.5;
    const heightSpeed = 0.4;

    if (keys['KeyA'] || keys['ArrowLeft']) cameraAngle -= rotSpeed;
    if (keys['KeyD'] || keys['ArrowRight']) cameraAngle += rotSpeed;
    if (keys['KeyW'] || keys['ArrowUp']) cameraRadius = Math.max(5.0, cameraRadius - zoomSpeed);
    if (keys['KeyS'] || keys['ArrowDown']) cameraRadius = Math.min(120.0, cameraRadius + zoomSpeed);
    if (keys['KeyQ']) cameraHeight = Math.min(80.0, cameraHeight + heightSpeed);
    if (keys['KeyE']) cameraHeight = Math.max(1.0, cameraHeight - heightSpeed);

    if (keys['KeyR']) {
        cameraAngle = Math.PI / 4;
        cameraRadius = 35.0;
        cameraHeight = 18.0;
    }
}

// -----------------------------------------------------------------------------
// LEVEL 3: Sky Objects Path (Bézier Curve)
// -----------------------------------------------------------------------------
const skyBezierPath = {
    p0: [-15.0, 8.0, -15.0],
    p1: [-5.0, 14.0, 5.0],
    p2: [5.0, 4.0, 15.0],
    p3: [15.0, 10.0, -10.0]
};

// Three flying stars with different sizes and positions along the path
const flyingStars = [
    { size: 1.2, phase: 0.0 },
    { size: 0.85, phase: 0.67 },
    { size: 0.55, phase: 1.33 }
];

// Each star is assembled from six cubes
const starParts = [
    { offset: [0.0, 0.0, 0.0], scale: 0.75 },
    { offset: [0.0, 0.0, -1.0], scale: 0.65 },
    { offset: [0.85, 0.0, -0.4], scale: 0.65 },
    { offset: [0.55, 0.0, 0.75], scale: 0.65 },
    { offset: [-0.55, 0.0, 0.75], scale: 0.65 },
    { offset: [-0.85, 0.0, -0.4], scale: 0.65 }
];

const STAR_COLOR = [1.0, 0.78, 0.15];

// -----------------------------------------------------------------------------
// Step 7. Render Loop
// -----------------------------------------------------------------------------
gl.enable(gl.DEPTH_TEST);
gl.clearColor(0.10, 0.12, 0.16, 1.0);

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

    // 1. Process Keyboard Controls & Set Camera Position
    updateCameraFromKeys();

    const eye = [
        cameraRadius * Math.cos(cameraAngle),
        cameraHeight,
        cameraRadius * Math.sin(cameraAngle),
    ];

    const viewMatrix = lookAt(eye, LOOK_AT, UP);
    const aspect = canvas.width / canvas.height;
    const projectionMatrix = perspective(45 * Math.PI / 180, aspect, 0.1, 150.0);

    gl.uniformMatrix4fv(u_view, false, viewMatrix);
    gl.uniformMatrix4fv(u_projection, false, projectionMatrix);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // 2. Draw Terrain Cubes (Level 2)
    for (let i = 0; i < groundObjects.length; i++) {
        const obj = groundObjects[i];
        gl.uniformMatrix4fv(u_model, false, makeModelMatrix(obj.position, obj.scale));
        gl.uniform3fv(u_color, obj.color);
        gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
    }


    // 3. Draw Three Flying Stars along Bézier Curve (Level 3)

    for (let s = 0; s < flyingStars.length; s++) {

        const star = flyingStars[s];

        // Calculate an individual forward-and-backward animation cycle
        const cycle = (seconds * 0.2 + star.phase) % 2.0;
        const t = cycle <= 1.0 ? cycle : 2.0 - cycle;

        // Find the star's position along the Bézier curve
        const starPos = evaluateCubicBezier(
            skyBezierPath.p0,
            skyBezierPath.p1,
            skyBezierPath.p2,
            skyBezierPath.p3,
            t
        );
        // Raise the stars higher above the terrain
        starPos[1] += 5.0;

        // Draw the six cubes that form this star
        for (let i = 0; i < starParts.length; i++) {

            const part = starParts[i];

            const pos = [
                starPos[0] + part.offset[0] * star.size,
                starPos[1] + part.offset[1] * star.size,
                starPos[2] + part.offset[2] * star.size
            ];

            const cubeScale = [
                part.scale * star.size,
                part.scale * star.size,
                part.scale * star.size
            ];

            gl.uniformMatrix4fv(
                u_model,
                false,
                makeModelMatrix(pos, cubeScale)
            );

            gl.uniform3fv(u_color, STAR_COLOR);

            gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
        }
    }

    requestAnimationFrame(render);
}

// Start Render Loop
requestAnimationFrame(render);