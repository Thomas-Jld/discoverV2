import './assets/main.css'

import * as THREE from 'three';

import { kdTree } from 'kd-tree-javascript';

import { AudioEngine } from './audio.js';

import data from './assets/umap2_pedion.json';
var MAP_IMAGE = "umap2_pedion";
var STARTING_POINT = [0.66944, 0.8356167];







const searchLimit = 30;
const maxAudio = 15;

let MODE = 'manual';






// *************** GUI *************** //
const canvas = document.getElementById('canvas');
const img = document.getElementById("img");
img.src = `./${MAP_IMAGE}.png`;

const audibleRangeSlider = document.getElementById('audible-range-slider');
const playingRangeSlider = document.getElementById('playing-range-slider');
const visibleRangeSlider = document.getElementById('visible-range-slider');
const visibleRangeDiv = document.getElementById('visible-range-div');

const moveLeftButton = document.getElementById('move-left-button');
const moveRightButton = document.getElementById('move-right-button');
const moveUpButton = document.getElementById('move-up-button');
const moveDownButton = document.getElementById('move-down-button');

const manualModeButton = document.getElementById('manual-mode-button');
const drawModeButton = document.getElementById('draw-mode-button');
const playModeButton = document.getElementById('play-mode-button');
const clearPathButton = document.getElementById('clear-path-button');
const restartPathButton = document.getElementById('restart-path-button');

const pathSpeedSlider = document.getElementById('path-speed-slider');

const logTapperSlopeSlider = document.getElementById("log-tapper-slope-slider");
const minGainSlider = document.getElementById("min-gain-slider");
const maxGainSlider = document.getElementById("max-gain-slider");
const gainModeSelect = document.getElementById("gain-mode-select");

const showGradientCheckbox = document.getElementById("show-gradient-checkbox");
const followListenerCheckbox = document.getElementById("follow-listener-checkbox");
// *************** GUI *************** //





// *************** THREEJS *************** //
const scene = new THREE.Scene();

// Create a basic Perspective Camera
const camera = new THREE.PerspectiveCamera( 90, 1.0, 0.00001, 100000 );

camera.position.x = STARTING_POINT[0];
camera.position.y = 0.007;
camera.position.z = STARTING_POINT[1];
camera.lookAt(STARTING_POINT[0], 0, STARTING_POINT[1]);

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true
});

renderer.setSize( 600, 600 );
renderer.setPixelRatio( window.devicePixelRatio );
// *************** THREEJS *************** //








// *************** Points *************** //
const points = data.map((d) => [d.embedding[0], 0, d.embedding[1]]).flat();
const audio_ids = data.map((d) => d.id);
const colormaps = data.map((d) => d.colormap);

data.length = 0;
// Create particles from the points
const colors = [];

for ( let i = 0; i < points.length; i += 3 ) {
    // Get the color of the colormap, each color is a string of hex values
    const color = colormaps[i / 3];
    const particlesColors = new THREE.Color(color);
    colors.push( particlesColors.r, particlesColors.g, particlesColors.b );
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute( 'customColor', new THREE.Float32BufferAttribute( colors, 3 ) );
const vertices = new Float32Array(points);

geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
const material = new THREE.ShaderMaterial({
    vertexShader: /* glsl */`
        attribute vec3 customColor;

        varying vec3 vColor;
        void main() {
            vColor = customColor;
            vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
            gl_PointSize = 0.0002 * ( 300.0 / -mvPosition.z );
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: /* glsl */`
        varying vec3 vColor;
            void main() {
                gl_FragColor = vec4(vColor, 1.0);
        }
    `,
    transparent: true,
    opacity: 0.5,
    depthWrite: true,
});
const pointsObject = new THREE.Points(geometry, material);
scene.add(pointsObject);
// *************** Points *************** //





// *************** KD-Tree *************** //
// Create a kd-tree to find the nearest points
const customDist = function (a, b) {
    return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1],2));
}
const points2d = [];
for (let i = 0; i < points.length; i += 3) points2d.push([points[i], points[i + 2], i / 3]);
const tree = new kdTree(points2d, customDist, [0, 1]);
// *************** KD-Tree *************** //


const listenerGroup = new THREE.Group();
scene.add(listenerGroup);


// *************** Torus Audible Range *************** //
const torusGeometry = new THREE.TorusGeometry( 1, 0.01, 16, 100 );
const torusMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
const audibleRangeTorus = new THREE.Mesh( torusGeometry, torusMaterial );
audibleRangeTorus.rotation.x = Math.PI / 2;
audibleRangeTorus.position.x = STARTING_POINT[0];
audibleRangeTorus.position.y = -10;
audibleRangeTorus.position.z = STARTING_POINT[1];
let r = parseFloat(audibleRangeSlider.value);
audibleRangeTorus.scale.set(r, r, r);
audibleRangeTorus.visible = false;
listenerGroup.add( audibleRangeTorus );
// *************** Torus Audible Range *************** //



// *************** Torus Playing Range *************** //
const playingRangeTorusGeometry = new THREE.TorusGeometry( 1, 0.008, 16, 100 );
const playingRangeTorusMaterial = new THREE.MeshBasicMaterial( { color: 0xffffff } );
const playingRangeTorus = new THREE.Mesh( torusGeometry, playingRangeTorusMaterial );
playingRangeTorus.rotation.x = Math.PI / 2;
playingRangeTorus.position.x = STARTING_POINT[0];
playingRangeTorus.position.y = -10;
playingRangeTorus.position.z = STARTING_POINT[1];
let R = r + parseFloat(playingRangeSlider.value);
playingRangeTorus.scale.set(R, R, R);
playingRangeTorus.visible = false;
listenerGroup.add( playingRangeTorus );
// *************** Torus Playing Range *************** //


// *************** Disk Roll-off Shader *************** //
const diskGeometry = new THREE.RingGeometry( 0.0, 1.0, 32, 32 );
// const diskMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
const diskMaterial = new THREE.ShaderMaterial({
    vertexShader: /* glsl */`
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        varying vec2 vUv;
        uniform float slope;
        uniform float minGain;
        uniform float maxGain;
        uniform float rollOffType;
        void main() {
            // float r = pow(pow((vUv.x - 0.5)*2.0, 2.0) + pow((vUv.y  - 0.5)*2.0, 2.0), 2.0);

            float r = 2.0*distance(vUv, vec2(0.5));
            float s = slope;
            if (slope == 0.5) {
                s = 0.51;
            }

            float b = pow((1.0 / s - 1.0), 2.0);
            float a = 1.0 / (b - 1.0);
            float y = 0.0;

            if (rollOffType == 0.0) {
                y = a * (pow(b, 1.0 - r) - 1.0);
            } else if (rollOffType == 1.0) {
                y = 1.0 - r;
            }else if (rollOffType == 2.0) {
                y = 1.0 - pow(r, 2.0);
            }else if (rollOffType == 3.0) {
                y = pow(1.0 - r, 2.0);
            }else if (rollOffType == 4.0) {
                y = 1.0 - pow(r, 3.0);
            }else if (rollOffType == 5.0) {
                y = pow(1.0 - r, 3.0);
            }

            gl_FragColor = vec4(vec3(1.0), minGain + (maxGain - minGain) * y);
        }
    `,
    transparent: true,
    opacity: 1.0,
    // depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    uniforms: {
        slope: { value: parseFloat(logTapperSlopeSlider.value) },
        minGain: { value: parseFloat(minGainSlider.value)},
        maxGain: { value: parseFloat(maxGainSlider.value)},
        rollOffType: { value: 0.0},
    }
});
const disk = new THREE.Mesh( diskGeometry, diskMaterial );
disk.rotation.x = -Math.PI / 2;
disk.position.x = STARTING_POINT[0];
disk.position.y = -0.00001;
disk.position.z = STARTING_POINT[1];
disk.visible = false;
audibleRangeTorus.scale.set(r, r, r);
listenerGroup.add( disk );
logTapperSlopeSlider.addEventListener('input', (event) => {
    diskMaterial.uniforms.slope.value = parseFloat(event.target.value);
})
minGainSlider.addEventListener('input', (event) => {
    diskMaterial.uniforms.minGain.value = parseFloat(event.target.value);
})
maxGainSlider.addEventListener('input', (event) => {
    diskMaterial.uniforms.maxGain.value = parseFloat(event.target.value);
})

gainModeSelect.addEventListener("change", () => {
    let rollOffType = 0.0;
    switch (gainModeSelect.value) {
        case "log-tapper":
            rollOffType = 0.0
            break;
        case "linear":
            rollOffType = 1.0
            break;
        case "square":
            rollOffType = 2.0
            break;
        case "inverse-square":
            rollOffType = 3.0
            break;
        case "power-three":
            rollOffType = 4.0
            break;
        case "inverse-power-three":
            rollOffType = 5.0
            break;
    }
    diskMaterial.uniforms.rollOffType.value = rollOffType;
});

showGradientCheckbox.addEventListener("change", (event) => {
    disk.visible = event.target.checked;
});

// *************** Range Functions *************** //

// Converts the canvas coordinates to the world coordinates using the camera
function canvasToPlaneCoordinates(x, y) {
    const vector = new THREE.Vector3();
    vector.set(
        ( x / 600 ) * 2 - 1,
        - ( y / 600 ) * 2 + 1,
        0.5 );
    vector.unproject(camera);
    const dir = vector.sub(camera.position).normalize();
    const distance = - camera.position.y / dir.y;
    const point = camera.position.clone().add(dir.multiplyScalar(distance));
    return point;
}

// Converts the world coordinates to the canvas coordinates using the camera
function planeToCanvasCoordinates(x, y) {
    const topLeftX = camera.position.x - camera.position.y;
    const topLeftY = camera.position.z - camera.position.y;

    const newX = (x - topLeftX) / (2 * camera.position.y) * 600;
    const newY = (y - topLeftY) / (2 * camera.position.y) * 600;

    return {x: newX, y: newY};
}


function updateAudibleRange(x, y, r) {
    if (!audibleRangeTorus.visible) {
        audibleRangeTorus.visible = true;
        playingRangeTorus.visible = true;
        disk.visible = showGradientCheckbox.checked;
    }

    audibleRangeTorus.position.x = x;
    audibleRangeTorus.position.y = 0;
    audibleRangeTorus.position.z = y;
    audibleRangeTorus.scale.set(r, r, r);

    let R = r + parseFloat(playingRangeSlider.value)
    playingRangeTorus.position.x = x;
    playingRangeTorus.position.y = 0;
    playingRangeTorus.position.z = y;
    playingRangeTorus.scale.set(R, R, R);


    disk.position.x = x;
    disk.position.z = y;
    disk.scale.set(r, r, r);

    if( followListenerCheckbox.checked ) {
        camera.position.x = audibleRangeTorus.position.x;
        camera.position.z = audibleRangeTorus.position.z;
    }
}

followListenerCheckbox.addEventListener("change", (event) => {
    if (event.target.checked) {
        camera.position.x = audibleRangeTorus.position.x;
        camera.position.z = audibleRangeTorus.position.z;
    }
})

function updateVisibleRange() {
    const r = 600 * camera.position.y;
    const x = camera.position.x * 600 - r/2;
    const y = camera.position.z * 600 - r/2;

    if (!visibleRangeDiv.style.display) {
        visibleRangeDiv.style.display = 'block';
    }

    visibleRangeDiv.style.width = `${r}px`;
    visibleRangeDiv.style.height = `${r}px`;
    visibleRangeDiv.style.top = `${y}px`;
    visibleRangeDiv.style.left = `${x}px`;
}

updateVisibleRange();
// *************** Range Functions *************** //




// *************** Audio *************** //
let nearestAudioPoints = [];
let audioEngine;

function loadAudio() {
    if(audioEngine) {
        if(audibleRangeTorus.position.y != -10) nearestAudioPoints = tree.nearest([audibleRangeTorus.position.x, audibleRangeTorus.position.z], searchLimit, parseFloat(audibleRangeSlider.value) + parseFloat(playingRangeSlider.value));
        audioEngine.playNextInQueue(audioEngine.nodeNumber, nearestAudioPoints, audibleRangeSlider.value, maxAudio);
    }
}

setInterval(loadAudio, 100);
// *************** Audio *************** //






// *************** Mouse Interactions *************** //
audibleRangeSlider.addEventListener('input', (event) => {
    updateAudibleRange(audibleRangeTorus.position.x, audibleRangeTorus.position.z, parseFloat(event.target.value));
});

playingRangeSlider.addEventListener('input', (event) => {
    updateAudibleRange(audibleRangeTorus.position.x, audibleRangeTorus.position.z, parseFloat(audibleRangeSlider.value));
});

visibleRangeSlider.addEventListener('input', (event) => {
    const zoomedIn = camera.position.y > parseFloat(event.target.value);

    if (zoomedIn) {
        // Center camera on the audible range
        camera.position.x = audibleRangeTorus.position.x;
        camera.position.z = audibleRangeTorus.position.z;
    }

    updateVisibleRange();

    camera.position.y = parseFloat(event.target.value);
    camera.updateProjectionMatrix();

});

const pointer = new THREE.Vector2();
const autoPath = [];
const autoPathGroup = new THREE.Group();
scene.add(autoPathGroup);
let currentPathIndex = 0;
let progressOnSegment = 0;

canvas.addEventListener('pointerdown', (event) => {
    if (audioEngine == undefined) {
        audioEngine = new AudioEngine(audio_ids);
    }
    if (MODE === 'manual') {
        const point = canvasToPlaneCoordinates(event.offsetX, event.offsetY);
        updateAudibleRange(point.x, point.z, parseFloat(audibleRangeSlider.value));
    } else if (MODE === 'draw') {
        const point = canvasToPlaneCoordinates(event.offsetX, event.offsetY);
        autoPath.push([point.x, 0, point.z]);

        if(autoPath.length > 1) {
            const geometry = new THREE.BufferGeometry();
            const material = new THREE.LineBasicMaterial({color: 0xff0000});
            const vertices = new Float32Array(autoPath.slice(-2).flat());
            geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            const line = new THREE.Line(geometry, material);
            autoPathGroup.add(line);
        }
    }
});

img.addEventListener('pointerdown', (event) => {
    if (!isPressingShift) return;
    camera.position.x = event.offsetX / 600;
    camera.position.z = event.offsetY / 600;
    camera.lookAt(camera.position.x, 0, camera.position.z);

    updateVisibleRange();
});



function moveAlongPath() {
    if (MODE !== 'play') return;
    if (autoPath.length === 0) return;
    if (currentPathIndex >= autoPath.length - 1) return;

    const startPoint = autoPath[currentPathIndex];
    const endPoint = autoPath[currentPathIndex + 1];

    const position = new THREE.Vector3();
    position.x = startPoint[0] + (endPoint[0] - startPoint[0]) * progressOnSegment;
    position.y = startPoint[1] + (endPoint[1] - startPoint[1]) * progressOnSegment;
    position.z = startPoint[2] + (endPoint[2] - startPoint[2]) * progressOnSegment;

    updateAudibleRange(position.x, position.z, parseFloat(audibleRangeSlider.value));

    progressOnSegment += parseFloat(pathSpeedSlider.value) / 100;
    if (progressOnSegment >= 1) {
        currentPathIndex += 1;
        progressOnSegment = 0;

        if (currentPathIndex >= autoPath.length - 1) {
            currentPathIndex = 0;
            progressOnSegment = 0;

            // manualModeButton.click();
        }
    }
}

setInterval(moveAlongPath, 1000 / 60);

function clearPath() {
    autoPath.length = 0;
    autoPathGroup.remove(...autoPathGroup.children);
    currentPathIndex = 0;
    progressOnSegment = 0;
}

function restartPath() {
    currentPathIndex = 0;
    progressOnSegment = 0;
}




let isPressingShift = false;
window.addEventListener('keydown', (event) => {
    const r = parseFloat(audibleRangeSlider.value);
    let moved = false;
    if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'z') {
        updateAudibleRange(audibleRangeTorus.position.x, audibleRangeTorus.position.z - r * 0.01, r);
        moved = true;
    }
    else if (event.key === 'ArrowDown' || event.key === 's') {
        updateAudibleRange(audibleRangeTorus.position.x, audibleRangeTorus.position.z + r * 0.01, r);
        moved = true;
    }
    else if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'q') {
        updateAudibleRange(audibleRangeTorus.position.x - r * 0.01, audibleRangeTorus.position.z, r);
        moved = true;
    }
    else if (event.key === 'ArrowRight' || event.key === 'd') {
        updateAudibleRange(audibleRangeTorus.position.x + r * 0.01, audibleRangeTorus.position.z, r);
        moved = true;
    }
    else if (event.key === 'Shift') {
        isPressingShift = true;
    }

    if (moved) {

        const canvasCoords =  planeToCanvasCoordinates(audibleRangeTorus.position.x, audibleRangeTorus.position.z);


        // Shift the camera if the audible range is at the edge of the screen
        if (canvasCoords.x <= 0) {
            camera.position.x = camera.position.x - camera.position.y;
        } else if (canvasCoords.x >= 600) {
            camera.position.x = camera.position.x + camera.position.y;
        } else if (canvasCoords.y <= 0) {
            camera.position.z = camera.position.z - camera.position.y;
        } else if (canvasCoords.y >= 600) {
            camera.position.z = camera.position.z + camera.position.y;
        }
    }
});

window.addEventListener('keyup', (event) => {
    if (event.key === 'Shift') {
        isPressingShift = false;
    }
});

moveLeftButton.addEventListener('click', () => {
    shiftLeft(camera.position.x - camera.position.y);
});
moveRightButton.addEventListener('click', () => {
    shiftRight(camera.position.x + camera.position.y);
});
moveUpButton.addEventListener('click', () => {
    shiftUp(camera.position.z - camera.position.y);
});
moveDownButton.addEventListener('click', () => {
    shiftDown(camera.position.z + camera.position.y);
});

manualModeButton.addEventListener('click', () => {
    MODE = 'manual';
    if (manualModeButton.classList.contains('selected-button')) return;

    manualModeButton.classList.add('selected-button');
    drawModeButton.classList.remove('selected-button');
    playModeButton.classList.remove('selected-button');
});


drawModeButton.addEventListener('click', () => {
    MODE = 'draw';
    if (drawModeButton.classList.contains('selected-button')) return;

    drawModeButton.classList.add('selected-button');
    manualModeButton.classList.remove('selected-button');
    playModeButton.classList.remove('selected-button');
});

playModeButton.addEventListener('click', () => {
    MODE = 'play';
    if (playModeButton.classList.contains('selected-button')) return;

    playModeButton.classList.add('selected-button');
    manualModeButton.classList.remove('selected-button');
    drawModeButton.classList.remove('selected-button');
});

clearPathButton.addEventListener('click', () => {
    clearPath();

    MODE = 'manual';
    if (manualModeButton.classList.contains('selected-button')) return;

    manualModeButton.classList.add('selected-button');
    drawModeButton.classList.remove('selected-button');
    playModeButton.classList.remove('selected-button');

});

restartPathButton.addEventListener('click', () => {
    restartPath();
});


// Animate the scene
function animate() {
    requestAnimationFrame( animate );

    renderer.render( scene, camera );
}

requestAnimationFrame( animate );


window.addEventListener('resize', () => {
    camera.updateProjectionMatrix();
});
