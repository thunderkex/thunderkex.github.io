import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/UnrealBloomPass.js';

let scene, camera, renderer, controls, composer;
let airplane, buildings = [];
let clock = new THREE.Clock();
let wind = new THREE.Vector3();
let holograms = [];
let starField;

export function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000066, 0.005);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    renderer.setClearColor(0x000020);
    document.body.appendChild(renderer.domElement);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Post-processing setup
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        2.0,  // Increased bloom strength
        0.5,  // Adjusted bloom radius
        0.1   // Lower threshold for more glow
    );
    composer.addPass(bloomPass);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 20;

    scene.add(new THREE.AmbientLight(0x0000ff, 0.3));

    const directionalLight = new THREE.DirectionalLight(0x4444ff, 1.2);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const hemiLight = new THREE.HemisphereLight(0x7777ff, 0x000044, 0.5);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const airplaneGeometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
        0, 0, -3, -1.5, 0, -1, 1.5, 0, -1, -2, 0, 0.5, 2, 0, 0.5,
        0, 0.4, -2, -0.5, 0.4, -1, 0.5, 0.4, -1, 0, 0.4, 1, 0, 0.8, 0.5,
        0, 1, 0.8, -1.5, 0.2, 1, 1.5, 0.2, 1
    ]);
    const indices = new Uint16Array([
        0, 1, 6, 0, 7, 2, 1, 3, 6, 2, 4, 7,
        0, 6, 7, 6, 8, 7, 8, 9, 10,
        8, 11, 12, 11, 8, 12,
        1, 11, 6, 2, 12, 7
    ]);
    airplaneGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    airplaneGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
    airplaneGeometry.computeVertexNormals();

    const airplaneMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ffff,
        shininess: 100,
        side: THREE.DoubleSide,
        emissive: 0x0044ff,
        emissiveIntensity: 0.5,
        flatShading: true,
        transparent: true,
        opacity: 0.9
    });

    const glowMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            color: { value: new THREE.Color(0x00ffff) }
        },
        vertexShader: `
            varying vec3 vPosition;
            void main() {
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            uniform float time;
            varying vec3 vPosition;
            void main() {
                float intensity = 0.8 - distance(vPosition, vec3(0.0)) * 0.5;
                intensity = pow(intensity, 2.0) * (0.8 + 0.2 * sin(time * 2.0));
                gl_FragColor = vec4(color, intensity);
            }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true
    });

    const glowMesh = new THREE.Mesh(airplaneGeometry, glowMaterial);
    glowMesh.scale.multiplyScalar(1.2);
    airplane = new THREE.Mesh(airplaneGeometry, airplaneMaterial);
    airplane.add(glowMesh);

    airplane.castShadow = true;
    scene.add(airplane);

    createStarfield();
    createNeonGrid();
    createHolograms();
    createCityscape();

    camera.position.set(5, 5, 10);
    camera.lookAt(airplane.position);
}

function createStarfield() {
    const starGeometry = new THREE.BufferGeometry();
    const starVertices = [];
    for (let i = 0; i < 5000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        starVertices.push(x, y, z);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const starMaterial = new THREE.PointsMaterial({
        color: 0xFFFFFF,
        size: 0.5,
        transparent: true
    });
    starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);
}

function createNeonGrid() {
    const gridSize = 100;
    const gridDivisions = 50;
    const gridMaterial = new THREE.LineBasicMaterial({ 
        color: 0x00ff88,
        transparent: true,
        opacity: 0.3
    });
    const grid = new THREE.GridHelper(gridSize, gridDivisions, 0x00ff88, 0x00ff88);
    grid.position.y = -5;
    scene.add(grid);
}

function createHolograms() {
    const hologramCount = 10;
    const hologramGeometry = new THREE.PlaneGeometry(3, 6);
    const hologramTexture = new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/disturb.jpg');
    
    for (let i = 0; i < hologramCount; i++) {
        const hologramMaterial = new THREE.MeshPhongMaterial({
            map: hologramTexture,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            emissive: new THREE.Color(Math.random() * 0.5, Math.random(), Math.random()),
            emissiveIntensity: 2
        });
        
        const hologram = new THREE.Mesh(hologramGeometry, hologramMaterial);
        hologram.position.set(
            Math.random() * 80 - 40,
            Math.random() * 15 + 10,
            Math.random() * 80 - 40
        );
        hologram.rotation.y = Math.random() * Math.PI;
        holograms.push(hologram);
        scene.add(hologram);
    }
}

function updateHolograms(time) {
    holograms.forEach((hologram, index) => {
        hologram.material.opacity = 0.3 + Math.sin(time * 2 + index) * 0.2;
        hologram.rotation.y += 0.005;
        hologram.material.emissiveIntensity = 1 + Math.sin(time * 3 + index) * 0.5;
    });
}

function createCityscape() {
    const buildingCount = 30;
    const buildingColors = [0x000088, 0x000066, 0x000044, 0x000033];

    for (let i = 0; i < buildingCount; i++) {
        const height = Math.random() * 15 + 8;
        const width = Math.random() * 3 + 1.5;
        const depth = Math.random() * 3 + 1.5;

        const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
        const buildingMaterial = new THREE.MeshPhongMaterial({
            color: buildingColors[Math.floor(Math.random() * buildingColors.length)],
            shininess: 100,
            emissive: 0x0000ff,
            emissiveIntensity: 0.1
        });
        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);

        const windowGeometry = new THREE.BoxGeometry(0.3, 0.4, 0.1);
        const windowColors = [0x00ffff, 0xff00ff, 0x00ff88, 0xff0088];
        const windowMaterial = new THREE.MeshPhongMaterial({ 
            color: windowColors[Math.floor(Math.random() * windowColors.length)], 
            emissive: 0x444444,
            emissiveIntensity: Math.random() * 2 + 1
        });

        const rows = Math.floor(height / 1.2);
        const columnsPerSide = Math.floor(width / 0.8);
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < columnsPerSide; col++) {
                if (Math.random() > 0.2) {
                    const window = new THREE.Mesh(windowGeometry, windowMaterial);
                    window.position.y = row * 1.2 - height / 2 + 1;
                    window.position.x = col * 0.8 - width / 2 + 0.4;
                    window.position.z = depth / 2 + 0.1;
                    building.add(window);

                    const windowBack = window.clone();
                    windowBack.position.z = -depth / 2 - 0.1;
                    building.add(windowBack);
                }
            }
        }

        const tryPosition = () => {
            const x = Math.random() * 50 - 25;
            const z = Math.random() * 50 - 25;
            for (const other of buildings) {
                const dx = other.position.x - x;
                const dz = other.position.z - z;
                const minDist = (width + other.geometry.parameters.width) / 2 +
                    (depth + other.geometry.parameters.depth) / 2;
                if (Math.sqrt(dx * dx + dz * dz) < minDist) return null;
            }
            return { x, z };
        };

        let position;
        let attempts = 0;
        while (!position && attempts < 10) {
            position = tryPosition();
            attempts++;
        }

        building.position.x = position ? position.x : Math.random() * 50 - 25;
        building.position.z = position ? position.z : Math.random() * 50 - 25;
        building.position.y = height / 2;
        building.castShadow = true;
        building.receiveShadow = true;

        buildings.push(building);
        scene.add(building);
    }
}

export function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    const windStrength = 0.5;
    wind.x = Math.sin(time * 0.1) * windStrength;
    wind.y = Math.cos(time * 0.07) * windStrength * 0.2;
    wind.z = Math.cos(time * 0.05) * windStrength;

    const nextX = Math.sin(time * 0.3) * 15 + Math.cos(time * 0.8) * 6;
    const nextY = Math.cos(time * 0.2) * 4 + Math.sin(time * 0.5) * 2 + 6;
    const nextZ = Math.sin(time * 0.4) * 10;

    let ax = 0, ay = 0, az = 0;
    const safeDistance = 8;
    const avoidanceStrength = 2.0;
    buildings.forEach(building => {
        const dx = building.position.x - nextX;
        const dy = (building.position.y + building.geometry.parameters.height / 2) - nextY;
        const dz = building.position.z - nextZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < safeDistance) {
            const force = Math.pow((safeDistance - dist) / safeDistance, 2);
            ax -= (dx / dist) * force * avoidanceStrength;
            ay += Math.abs(force) * 3;
            az -= (dz / dist) * force * avoidanceStrength;
        }
    });

    const smoothFactor = 0.95; // Increased for smoother velocity changes
    const responsiveness = 0.03; // Reduced for smoother transitions
    airplane.velocity = airplane.velocity || new THREE.Vector3(0, 0, 0);
    const targetPos = new THREE.Vector3(nextX + ax + wind.x, nextY + ay + wind.y, nextZ + az + wind.z);
    const delta = targetPos.sub(airplane.position);

    airplane.velocity.x = airplane.velocity.x * smoothFactor + delta.x * responsiveness;
    airplane.velocity.y = airplane.velocity.y * smoothFactor + delta.y * responsiveness;
    airplane.velocity.z = airplane.velocity.z * smoothFactor + delta.z * responsiveness;

    airplane.velocity.y -= 0.005; // Reduced gravity effect for smoother descent
    airplane.position.add(airplane.velocity);

    airplane.rotation.set(0, 0, 0); // Keep the airplane's nose always pointing forward

    const camOffset = new THREE.Vector3(0, 3, 10); // Adjusted for a smoother camera follow
    const desiredCameraPos = airplane.position.clone().add(camOffset);
    camera.position.lerp(desiredCameraPos, 0.03); // Reduced lerp factor for smoother camera movement

    buildings.forEach((building, index) => {
        building.position.z += 0.15 + Math.sin(time + index) * 0.05;
        if (building.position.z > 20) {
            building.position.z = -20;
            building.position.x = Math.random() * 40 - 20;
        }
    });

    // Update holograms
    updateHolograms(time);

    // Update building windows
    buildings.forEach((building, index) => {
        building.children.forEach(window => {
            if (Math.random() < 0.001) {
                window.material.emissiveIntensity = Math.random() * 3;
            }
        });
    });

    if (starField) {
        starField.rotation.y += 0.0001;
    }

    controls.target.copy(airplane.position);
    controls.update();

    composer.render();
}

export function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize, false);

init();
animate();

export const paperAirplaneFlight = {
    init,
    animate,
    onWindowResize
};
