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
let isPlaying = false;
let mousePosition = new THREE.Vector2();
let targetPosition = new THREE.Vector3();
let vehicles = [];
let roads = [];

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

    // Add spotlight that follows the airplane
    const spotlight = new THREE.SpotLight(0x00ffff, 1.5, 100, Math.PI / 6, 0.5, 2);
    spotlight.position.set(10, 50, 10);
    spotlight.castShadow = true;
    scene.add(spotlight);
    scene.add(spotlight.target);


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
        shininess: 150,
        side: THREE.DoubleSide,
        emissive: 0x0044ff,
        emissiveIntensity: 0.8,
        flatShading: true,
        transparent: true,
        opacity: 0.95
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
    airplane.velocity = new THREE.Vector3(0, 0, 0);

    airplane.castShadow = true;
    scene.add(airplane);

    createStarfield();
    createNeonGrid();
    createHolograms();
    createCityscape();
    createRoadNetwork();

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
        hologram.material.emissiveIntensity = 1 + Math.sin(time * 3 + index) *  0.5;
    });
}

function createCityscape() {
    const buildingCount = 30;
    const buildingTypes = [
        {
            colors: [0x000088, 0x000066, 0x000044],
            material: (color) => new THREE.MeshPhongMaterial({
                color: color,
                shininess: 100,
                emissive: 0x0000ff,
                emissiveIntensity: 0.1
            })
        },
        {
            colors: [0x88ccff, 0x66aaff, 0x4488ff],
            material: (color) => new THREE.MeshPhysicalMaterial({
                color: color,
                metalness: 0.9,
                roughness: 0.1,
                transparent: true,
                opacity: 0.8,
                envMapIntensity: 1
            })
        },
        {
            colors: [0x00ffff, 0x00aaff, 0x0088ff],
            material: (color) => new THREE.MeshPhysicalMaterial({
                color: color,
                metalness: 0.1,
                roughness: 0.1,
                transparent: true,
                opacity: 0.6,
                transmission: 0.6
            })
        }
    ];

    const windowColors = [0x00ffff, 0xff00ff, 0x00ff88, 0xff0088, 0xffff00, 0x88ff88];

    for (let i = 0; i < buildingCount; i++) {
        const height = Math.random() * 15 + 5; // Reduced max height to 20 (15 + 5)
        const width = Math.random() * 4 + 1.5;
        const depth = Math.random() * 4 + 1.5;

        let buildingGeometry;
        const geometryType = Math.random();
        
        if (geometryType < 0.6) {
            buildingGeometry = new THREE.BoxGeometry(width, height, depth);
        } else if (geometryType < 0.8) {
            // Pyramid-like building
            buildingGeometry = new THREE.CylinderGeometry(0, width/2, height, 4);
        } else {
            // Cylindrical building
            buildingGeometry = new THREE.CylinderGeometry(width/2, width/2, height, 8);
        }

        const buildingStyle = buildingTypes[Math.floor(Math.random() * buildingTypes.length)];
        const buildingColor = buildingStyle.colors[Math.floor(Math.random() * buildingStyle.colors.length)];
        const building = new THREE.Mesh(buildingGeometry, buildingStyle.material(buildingColor));

        // Add window lights
        const windowGeometry = new THREE.BoxGeometry(0.3, 0.4, 0.1);
        const windowRows = Math.floor(height / 1.2);
        const windowCols = Math.floor((width + depth) / 1.2);

        for (let row = 0; row < windowRows; row++) {
            for (let col = 0; col < windowCols; col++) {
                if (Math.random() > 0.3) {
                    const windowColor = windowColors[Math.floor(Math.random() * windowColors.length)];
                    const windowMaterial = new THREE.MeshPhongMaterial({
                        color: windowColor,
                        emissive: windowColor,
                        emissiveIntensity: Math.random() * 2 + 1
                    });

                    const window = new THREE.Mesh(windowGeometry, windowMaterial);
                    const angle = (col / windowCols) * Math.PI * 2;
                    const radius = Math.min(width, depth) / 2;
                    
                    window.position.y = row * 1.2 - height / 2 + 1;
                    window.position.x = Math.cos(angle) * radius;
                    window.position.z = Math.sin(angle) * radius;
                    window.rotation.y = angle;
                    
                    building.add(window);
                }
            }
        }

        // Add rooftop details
        if (Math.random() > 0.5) {
            const antennaHeight = Math.random() * 3 + 1;
            const antennaGeometry = new THREE.CylinderGeometry(0.05, 0.05, antennaHeight);
            const antennaMaterial = new THREE.MeshPhongMaterial({
                color: 0x888888,
                emissive: 0xff0000,
                emissiveIntensity: 1
            });
            const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
            antenna.position.y = height / 2 + antennaHeight / 2;
            building.add(antenna);

            // Add blinking light
            const blinkingLight = new THREE.PointLight(0xff0000, 1, 3);
            blinkingLight.position.y = height / 2 + antennaHeight;
            building.add(blinkingLight);
            
            // Animate the blinking light
            const startTime = Math.random() * Math.PI * 2;
            blinkingLight.userData.animate = (time) => {
                blinkingLight.intensity = 0.5 + Math.sin(time * 2 + startTime) * 0.5;
            };
        }

        // Position the building
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

function createRoadNetwork() {
    const roadMaterial = new THREE.MeshPhongMaterial({
        color: 0x333333,
        emissive: 0x0000ff,
        emissiveIntensity: 0.2
    });

    // Create main roads
    const roadGeometry = new THREE.PlaneGeometry(100, 4);
    for (let i = -2; i <= 2; i++) {
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.set(i * 20, -4.9, 0);
        road.receiveShadow = true;
        roads.push(road);
        scene.add(road);

        const crossRoad = new THREE.Mesh(roadGeometry, roadMaterial);
        crossRoad.rotation.x = -Math.PI / 2;
        crossRoad.rotation.y = Math.PI / 2;
        crossRoad.position.set(0, -4.9, i * 20);
        crossRoad.receiveShadow = true;
        roads.push(crossRoad);
        scene.add(crossRoad);
    }

    // Add street lights
    const streetLightGeometry = new THREE.CylinderGeometry(0.1, 0.1, 5);
    const streetLightMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
    const lightGeometry = new THREE.SphereGeometry(0.3);
    const lightMaterial = new THREE.MeshPhongMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 1
    });

    for (let x = -40; x <= 40; x += 20) {
        for (let z = -40; z <= 40; z += 20) {
            const streetLight = new THREE.Mesh(streetLightGeometry, streetLightMaterial);
            streetLight.position.set(x, -2.5, z);
            scene.add(streetLight);

            const light = new THREE.Mesh(lightGeometry, lightMaterial);
            light.position.y = 2.5;
            streetLight.add(light);

            const pointLight = new THREE.PointLight(0xffff88, 1, 15);
            pointLight.position.y = 2.5;
            streetLight.add(pointLight);
        }
    }

    // Initialize vehicles
    initializeVehicles();
}

function initializeVehicles() {
    const trailMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.6
    });

    for (let i = 0; i < 20; i++) {
        const direction = Math.random() < 0.5;
        const isVertical = Math.random() < 0.5;
        const lane = Math.floor(Math.random() * 5) - 2;
        const position = new THREE.Vector3(
            isVertical ? lane * 20 : (Math.random() - 0.5) * 100,
            -4.5,
            isVertical ? (Math.random() - 0.5) * 100 : lane * 20
        );

        const trail = new THREE.Mesh(
            new THREE.PlaneGeometry(0.2, 2),
            trailMaterial.clone()
        );
        trail.material.color.setHSL(Math.random(), 0.8, 0.5);
        trail.rotation.x = -Math.PI / 2;
        trail.position.copy(position);

        const vehicle = {
            mesh: trail,
            speed: 0.3 + Math.random() * 0.3,
            direction: direction ? 1 : -1,
            isVertical: isVertical
        };

        vehicles.push(vehicle);
        scene.add(trail);
    }
}

function updateVehicles() {
    vehicles.forEach(vehicle => {
        if (vehicle.isVertical) {
            vehicle.mesh.position.z += vehicle.speed * vehicle.direction;
            if (Math.abs(vehicle.mesh.position.z) > 50) {
                vehicle.mesh.position.z = -50 * Math.sign(vehicle.mesh.position.z);
            }
        } else {
            vehicle.mesh.position.x += vehicle.speed * vehicle.direction;
            if (Math.abs(vehicle.mesh.position.x) > 50) {
                vehicle.mesh.position.x = -50 * Math.sign(vehicle.mesh.position.x);
            }
        }
        
        // Pulse the trail opacity
        vehicle.mesh.material.opacity = 0.4 + Math.sin(Date.now() * 0.005) * 0.2;
    });
}

window.addEventListener('mousemove', (event) => {
    if (isPlaying) {
        mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
        mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }
});

export function setPlayMode(mode) {
    isPlaying = mode;
    if (isPlaying) {
        controls.enabled = false;
        resetGame();
    } else {
        controls.enabled = true;
    }
}

function resetGame() {
    airplane.position.set(0, 30, 0);
    airplane.velocity = new THREE.Vector3(0, 0, 0);
    airplane.rotation.set(0, 0, 0);
    
    // Reset camera position higher and further back
    camera.position.set(150, 100, 0);
    camera.lookAt(airplane.position);
}

function checkCollision() {
    const airplaneBox = new THREE.Box3().setFromObject(airplane);
    
    for (const building of buildings) {
        const buildingBox = new THREE.Box3().setFromObject(building);
        if (airplaneBox.intersectsBox(buildingBox)) {
            // Create explosion effect
            createExplosionEffect(airplane.position);
            return true;
        }
    }
    return false;
}

function createExplosionEffect(position) {
    const particleCount = 50;
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    
    for (let i = 0; i < particleCount; i++) {
        vertices.push(
            position.x + (Math.random() - 0.5) * 2,
            position.y + (Math.random() - 0.5) * 2,
            position.z + (Math.random() - 0.5) * 2
        );
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    
    const material = new THREE.PointsMaterial({
        color: 0xff8844,
        size: 0.5,
        transparent: true
    });
    
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    
    // Animate and remove explosion
    const startTime = Date.now();
    function animateExplosion() {
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > 1000) {
            scene.remove(particles);
            return;
        }
        
        material.opacity = 1 - (elapsedTime / 1000);
        const positions = particles.geometry.attributes.position.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += (Math.random() - 0.5) * 0.2;
            positions[i + 1] += (Math.random() - 0.5) * 0.2;
            positions[i + 2] += (Math.random() - 0.5) * 0.2;
        }
        
        particles.geometry.attributes.position.needsUpdate = true;
        requestAnimationFrame(animateExplosion);
    }
    
    animateExplosion();
}

export function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    if (isPlaying) {
        // Handle airplane movement and collision detection
        handleAirplaneMovement();
        if (checkCollision()) {
            resetGame();
        }
        updateCamera();
    } else {
        handleNonPlayModeMovement(time);
    }

    controls.target.copy(airplane.position);
    controls.update();

    // Pulsing holograms
    holograms.forEach(holo => {
        if (holo.material) {
            holo.material.emissiveIntensity = 0.8 + 0.2 * Math.sin(clock.getElapsedTime() * 5);
        }
    });

    updateVehicles();
    composer.render();
}

function handleAirplaneMovement() {
    airplane.velocity = airplane.velocity || new THREE.Vector3();
    const delta = targetPosition.clone().sub(airplane.position);
    const smoothFactor = 0.88; // Increased smoothing for more fluid movement
    const responsiveness = 0.12; // Increased responsiveness

    airplane.velocity.x = airplane.velocity.x * smoothFactor + delta.x * responsiveness;
    airplane.velocity.y = airplane.velocity.y * smoothFactor + delta.y * responsiveness;
    
    // Add more dynamic forward momentum based on height
    const baseSpeed = -0.3;
    const heightMultiplier = Math.max(0.8, Math.min(1.5, airplane.position.y / 20));
    airplane.velocity.z = baseSpeed * heightMultiplier;

    // Add slight wobble
    airplane.position.add(airplane.velocity);
    airplane.rotation.z = -airplane.velocity.x * 0.4;
    airplane.rotation.x = airplane.velocity.y * 0.4;
    
    // Add gentle rocking motion
    const time = Date.now() * 0.001;
    airplane.rotation.z += Math.sin(time * 2) * 0.01;
    airplane.rotation.x += Math.cos(time * 1.5) * 0.01;
}

function handleNonPlayModeMovement(time) {
    const windStrength = 0.5;
    wind.x = Math.sin(time * 0.1) * windStrength;
    wind.y = Math.cos(time * 0.07) * windStrength * 0.2;
    wind.z = Math.cos(time * 0.05) * windStrength;

    // Create more dynamic swooping motion
    const baseHeight = 35;
    const swoopDepth = 25;
    const swoopSpeed = 0.15;
    
    // Complex movement pattern combining multiple sine waves
    const nextX = Math.sin(time * 0.3) * 20 + Math.cos(time * 0.8) * 10;
    const swoopY = Math.sin(time * swoopSpeed) * swoopDepth;
    const nextY = baseHeight + swoopY + Math.sin(time * 0.5) * 5;
    const nextZ = Math.sin(time * 0.4) * 15;

    // Enhanced building avoidance and interaction
    let ax = 0, ay = 0, az = 0;
    const safeDistance = 10;
    const attractionDistance = 30;
    buildings.forEach(building => {
        const dx = building.position.x - airplane.position.x;
        const dy = building.position.y - airplane.position.y;
        const dz = building.position.z - airplane.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (dist < safeDistance) {
            // Strong avoidance when too close
            const force = (safeDistance - dist) / safeDistance;
            ax -= (dx / dist) * force * 3;
            ay += Math.abs(force) * 4;
            az -= (dz / dist) * force * 3;
        } else if (dist < attractionDistance && airplane.position.y > building.position.y + 10) {
            // Gentle attraction to buildings when above them
            const attractionForce = (dist - safeDistance) / (attractionDistance - safeDistance);
            ax += (dx / dist) * attractionForce * 0.5;
            ay -= attractionForce * 0.8;
            az += (dz / dist) * attractionForce * 0.5;
        }
    });

    const targetPos = new THREE.Vector3(
        nextX + ax + wind.x,
        nextY + ay + wind.y,
        nextZ + az + wind.z
    );

    // Smoother acceleration and movement
    airplane.velocity.lerp(targetPos.sub(airplane.position), 0.03);
    airplane.position.add(airplane.velocity.multiplyScalar(0.15));

    // Enhanced rotation for more fluid banking and pitching
    airplane.rotation.z = -airplane.velocity.x * 0.3;
    airplane.rotation.x = airplane.velocity.y * 0.2;
    airplane.rotation.y = Math.atan2(-airplane.velocity.x, -airplane.velocity.z);

    // Add banking effect during turns
    const turnIntensity = Math.abs(airplane.velocity.x) / 5;
    airplane.rotation.z -= Math.sign(airplane.velocity.x) * turnIntensity;

    // Dynamic camera follow
    const heightFactor = Math.max(0, Math.min(1, (airplane.position.y - 10) / 30));
    const cameraOffset = new THREE.Vector3(
        Math.sin(time * 0.2) * 2,
        4 + heightFactor * 8,
        12 + heightFactor * 4
    );
    const desiredCameraPos = airplane.position.clone().add(cameraOffset);
    camera.position.lerp(desiredCameraPos, 0.05);
    camera.lookAt(airplane.position);
}

function updateCamera() {
    const idealOffset = new THREE.Vector3(0, 40, 30); // Higher Y and further Z offset
    const idealLookat = new THREE.Vector3(0, 0, -20); // Looking further ahead
    
    const offset = idealOffset.clone();
    offset.applyQuaternion(airplane.quaternion);
    offset.add(airplane.position);
    
    const lookat = idealLookat.clone();
    lookat.applyQuaternion(airplane.quaternion);
    lookat.add(airplane.position);
    
    camera.position.lerp(offset, 0.1);
    camera.lookAt(lookat);
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
    onWindowResize,
    setPlayMode
};