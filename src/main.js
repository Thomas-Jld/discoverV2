import './assets/main.css'

import * as THREE from 'three';

import { kdTree } from 'kd-tree-javascript';

import { AudioEngine } from './audio.js';

import data from './assets/umap2_pedion.json';
var MAP_IMAGE = "umap2_pedion";
var STARTING_POINT = [0.66944, 0.8356167];







const searchLimit = 30;
const maxAudio = 10;

let MODE = 'manual';






// *************** GUI *************** //
const canvas = document.getElementById('canvas');
const img = document.getElementById("img");
img.src = `./${MAP_IMAGE}.png`;

const audibleRangeSlider = document.getElementById('audible-range-slider');
const playingRangeSlider = document.getElementById('playing-range-slider');
const visibleRangeSlider = document.getElementById('visible-range-slider');
const audibleRangeDiv = document.getElementById('audible-range-div');
const playingRangeDiv = document.getElementById('playing-range-div');
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




// *************** Range Functions *************** //
function planeToCanvasSize(value) {
    return 600 * value / camera.position.y;
}

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

function updatePlayingOffset() {

    if (!playingRangeDiv.style.display) {
        playingRangeDiv.style.display = 'block';
    }
    const arsY = parseFloat(audibleRangeDiv.style.top);
    const arsX = parseFloat(audibleRangeDiv.style.left);
    const arsR = parseFloat(audibleRangeDiv.style.width);

    const prsR = arsR + planeToCanvasSize(parseFloat(playingRangeSlider.value));
    const prsY = arsY + (arsR - prsR) / 2;
    const prsX = arsX + (arsR - prsR) / 2;
    // console.log(prsR, prsY, prsX, arsR, arsY, arsX);
    playingRangeDiv.style.width = `${prsR}px`;
    playingRangeDiv.style.height = `${prsR}px`;
    playingRangeDiv.style.top = `${prsY}px`;
    playingRangeDiv.style.left = `${prsX}px`;
}

function updateAudibleRange(x, y, r) {
    if (!audibleRangeDiv.style.display) {
        audibleRangeDiv.style.display = 'block';
    }

    audibleRangeDiv.style.width = `${r}px`;
    audibleRangeDiv.style.height = `${r}px`;
    audibleRangeDiv.style.top = `${y}px`;
    audibleRangeDiv.style.left = `${x}px`;

    updatePlayingOffset();
}

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
const currentPos = {x: 0, y: -10, z: 0};

function loadAudio() {
    if(audioEngine) {
        if(currentPos.y != -10) nearestAudioPoints = tree.nearest([currentPos.x, currentPos.z], searchLimit, audibleRangeSlider.value);
        // console.log(nearestAudioPoints);
        audioEngine.playNextInQueue(audioEngine.nodeNumber, nearestAudioPoints, maxAudio);
    }
}

// Loading loop: play the next audio in the queue every few seconds, based on the number of simultaneous audio
// let loadingLoop = () => {
//     loadAudio();
//     setTimeout(loadingLoop, 200);
// }
// loadingLoop();
setInterval(loadAudio, 300);
// *************** Audio *************** //






// *************** Mouse Interactions *************** //
audibleRangeSlider.addEventListener('input', (event) => {

    const arsPrevR = parseFloat(audibleRangeDiv.style.width);
    const arsPrevX = parseFloat(audibleRangeDiv.style.left);
    const arsPrevY = parseFloat(audibleRangeDiv.style.top);

    const r = planeToCanvasSize(event.target.value);
    const x = arsPrevX ? (arsPrevX - (r - arsPrevR) / 2) : 300;
    const y = arsPrevY ? (arsPrevY - (r - arsPrevR) / 2) : 300;

    updateAudibleRange(x, y, r);
});

playingRangeSlider.addEventListener('input', (event) => {
    updatePlayingOffset();
});

visibleRangeSlider.addEventListener('input', (event) => {
    camera.position.y = parseFloat(event.target.value);
    camera.updateProjectionMatrix();

    const arsPrevR = parseFloat(audibleRangeDiv.style.width);
    const arsPrevX = parseFloat(audibleRangeDiv.style.left);
    const arsPrevY = parseFloat(audibleRangeDiv.style.top);

    const r = planeToCanvasSize(audibleRangeSlider.value);
    const x = arsPrevX ? (arsPrevX - 300) / (arsPrevR / r) + 300: 300;
    const y = arsPrevY ? (arsPrevY - 300) / (arsPrevR / r) + 300 : 300;

    updateAudibleRange(x, y, r);
    updateVisibleRange();
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
        const arsPrevR = parseFloat(audibleRangeDiv.style.width);
        const ardR = isNaN(arsPrevR) ? planeToCanvasSize(audibleRangeSlider.value) : arsPrevR;

        updateAudibleRange(event.offsetX - ardR / 2, event.offsetY - ardR / 2, ardR);

        pointer.x = ( event.offsetX / 600 ) * 2 - 1;
        pointer.y = - ( event.offsetY / 600 ) * 2 + 1;

        const point = canvasToPlaneCoordinates(event.offsetX, event.offsetY);
        currentPos.x = point.x;
        currentPos.y = 0;
        currentPos.z = point.z;
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
    camera.position.x = event.offsetX / 600;
    camera.position.z = event.offsetY / 600;
    camera.lookAt(camera.position.x, 0, camera.position.z);

    const arsNewPos = planeToCanvasCoordinates(currentPos.x, currentPos.z);
    const arsPrevR = parseFloat(audibleRangeDiv.style.width);
    const arsR = isNaN(arsPrevR) ? planeToCanvasSize(audibleRangeSlider.value) : arsPrevR;

    updateAudibleRange(arsNewPos.x - arsR / 2, arsNewPos.y - arsR / 2, arsR);
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

    const arsPrevR = parseFloat(audibleRangeDiv.style.width);
    const arsR = isNaN(arsPrevR) ? planeToCanvasSize(audibleRangeSlider.value) : arsPrevR;

    const point = planeToCanvasCoordinates(position.x, position.z);
    currentPos.x = position.x;
    currentPos.y = 0;
    currentPos.z = position.z;

    updateAudibleRange(point.x - arsR / 2, point.y - arsR / 2, arsR);

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




function shiftLeft(x) {
    camera.position.x = x;
    camera.lookAt(x, 0, camera.position.z);

    const arsPrevR = parseFloat(audibleRangeDiv.style.width);
    const arsPrevY = parseFloat(audibleRangeDiv.style.top);
    const arsPrevX = parseFloat(audibleRangeDiv.style.left);

    const arsNewX = arsPrevX + 300;

    updateAudibleRange(arsNewX, arsPrevY, arsPrevR);
    updateVisibleRange();
}

function shiftRight(x) {
    camera.position.x = x;
    camera.lookAt(x, 0, camera.position.z);

    const arsPrevR = parseFloat(audibleRangeDiv.style.width);
    const arsPrevY = parseFloat(audibleRangeDiv.style.top);
    const arsPrevX = parseFloat(audibleRangeDiv.style.left);

    const arsNewX = arsPrevX - 300;

    updateAudibleRange(arsNewX, arsPrevY, arsPrevR);
    updateVisibleRange();
}

function shiftUp(z) {
    camera.position.z = z;
    camera.lookAt(camera.position.x, 0, z);

    const arsPrevR = parseFloat(audibleRangeDiv.style.width);
    const arsPrevY = parseFloat(audibleRangeDiv.style.top);
    const arsPrevX = parseFloat(audibleRangeDiv.style.left);

    const arsNewY = arsPrevY + 300;

    updateAudibleRange(arsPrevX, arsNewY, arsPrevR);
    updateVisibleRange();
}

function shiftDown(z) {
    camera.position.z = z;
    camera.lookAt(camera.position.x, 0, z);

    const arsPrevR = parseFloat(audibleRangeDiv.style.width);
    const arsPrevY = parseFloat(audibleRangeDiv.style.top);
    const arsPrevX = parseFloat(audibleRangeDiv.style.left);

    const arsNewY = arsPrevY - 300;

    updateAudibleRange(arsPrevX, arsNewY, arsPrevR);
    updateVisibleRange();
}



window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'z') {

        const arsPrevY = parseFloat(audibleRangeDiv.style.top);
        const arsPrevX = parseFloat(audibleRangeDiv.style.left);
        const arsPrevR = parseFloat(audibleRangeDiv.style.width);

        updateAudibleRange(arsPrevX, arsPrevY - arsPrevR * 0.01, arsPrevR);
    } if (event.key === 'ArrowDown' || event.key === 's') {
        const arsPrevY = parseFloat(audibleRangeDiv.style.top);
        const arsPrevX = parseFloat(audibleRangeDiv.style.left);
        const arsPrevR = parseFloat(audibleRangeDiv.style.width);

        updateAudibleRange(arsPrevX, arsPrevY + arsPrevR * 0.01, arsPrevR);
    }
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'q') {
        const arsPrevY = parseFloat(audibleRangeDiv.style.top);
        const arsPrevX = parseFloat(audibleRangeDiv.style.left);
        const arsPrevR = parseFloat(audibleRangeDiv.style.width);

        updateAudibleRange(arsPrevX - arsPrevR * 0.01, arsPrevY, arsPrevR);
    }
    if (event.key === 'ArrowRight' || event.key === 'd') {
        const arsPrevY = parseFloat(audibleRangeDiv.style.top);
        const arsPrevX = parseFloat(audibleRangeDiv.style.left);
        const arsPrevR = parseFloat(audibleRangeDiv.style.width);

        updateAudibleRange(arsPrevX + arsPrevR * 0.01, arsPrevY, arsPrevR);
    }


    const arsY = parseFloat(audibleRangeDiv.style.top);
    const arsR = parseFloat(audibleRangeDiv.style.width);
    const arsX = parseFloat(audibleRangeDiv.style.left);


    const point = canvasToPlaneCoordinates(arsX + arsR / 2, arsY + arsR / 2);
    currentPos.x = point.x;
    currentPos.y = 0;
    currentPos.z = point.z;

    // Shift the camera if the audible range is at the edge of the screen
    if (arsX + arsR / 2 <= 0) {
        shiftLeft(camera.position.x - camera.position.y);
    } else if (arsX + arsR / 2 >= 600) {
        shiftRight(camera.position.x + camera.position.y);
    } else if (arsY + arsR / 2 <= 0) {
        shiftUp(camera.position.z - camera.position.y);
    } else if (arsY + arsR / 2 >= 600) {
        shiftDown(camera.position.z + camera.position.y);
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
