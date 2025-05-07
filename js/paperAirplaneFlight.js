import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/UnrealBloomPass.js';

let scene, camera, renderer, controls, composer;
let billboard, rain, rainCount;
let airplane, buildings = [];
let clock = new THREE.Clock();
let wind = new THREE.Vector3();
let holograms = [];
let starField;
let vehicles = [];
let roads = [];
let trail;

let gravity = new THREE.Vector3(0, -0.05, 0);
let airDensity = 0.1;
let wingArea = 2.0;

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

    // Create particle trail
    const trailParticleCount = 100;
    const trailGeometry = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(trailParticleCount * 3);
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));

    const trailMaterial = new THREE.PointsMaterial({ color: 0x00ffff, size: 0.2, transparent: true, opacity: 0.6 });
    trail = new THREE.Points(trailGeometry, trailMaterial);
    scene.add(trail);

    // Neon billboard animation
    const billboardTexture = new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/sprites/spark1.png');
    const billboardMaterial = new THREE.SpriteMaterial({ map: billboardTexture, color: 0x00ffcc, transparent: true, opacity: 1 });
    const billboard = new THREE.Sprite(billboardMaterial);
    billboard.scale.set(10, 5, 1);
    billboard.position.set(0, 20, -20);
    scene.add(billboard);

    // Rain particle system
    createRainSystem();

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
    const starSizes = [];
    const starColors = [];
    const starPulses = [];

    for (let i = 0; i < 8000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        starVertices.push(x, y, z);
        
        // Enhanced star sizes with more variation
        starSizes.push(Math.random() * 3 + 0.2);
        
        // More varied star colors including blue and purple hues
        const colorType = Math.random();
        const color = new THREE.Color();
        if (colorType < 0.3) {
            color.setHSL(0.6 + Math.random() * 0.1, 0.9, 0.8); // Blue stars
        } else if (colorType < 0.6) {
            color.setHSL(0.75 + Math.random() * 0.1, 0.9, 0.8); // Purple stars
        } else {
            color.setHSL(Math.random() * 0.2 + 0.5, 0.8, 0.9); // White/yellow stars
        }
        starColors.push(color.r, color.g, color.b);
        
        // Individual pulse rates for each star
        starPulses.push(Math.random() * Math.PI * 2);
    }

    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    starGeometry.setAttribute('size', new THREE.Float32BufferAttribute(starSizes, 1));
    starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
    starGeometry.setAttribute('pulse', new THREE.Float32BufferAttribute(starPulses, 1));

    const starMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 }
        },
        vertexShader: `
            attribute float size;
            attribute vec3 color;
            attribute float pulse;
            varying vec3 vColor;
            uniform float time;
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                float pulseFactor = sin(time * 2.0 + pulse) * 0.3 + 0.7;
                gl_PointSize = size * (300.0 / -mvPosition.z) * pulseFactor;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            void main() {
                float dist = length(gl_PointCoord - vec2(0.5));
                if (dist > 0.5) discard;
                float intensity = pow(1.0 - dist * 2.0, 2.0);
                gl_FragColor = vec4(vColor, intensity);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);
}

function createRainSystem() {
    rainCount = 5000;
    const rainGeometry = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(rainCount * 3);
    const rainVelocities = new Float32Array(rainCount * 3);
    const rainSizes = new Float32Array(rainCount);

    for (let i = 0; i < rainCount; i++) {
        rainPositions[i * 3] = Math.random() * 400 - 200;
        rainPositions[i * 3 + 1] = Math.random() * 200;
        rainPositions[i * 3 + 2] = Math.random() * 400 - 200;
        
        rainVelocities[i * 3] = (Math.random() - 0.5) * 0.2;
        rainVelocities[i * 3 + 1] = -3 - Math.random() * 2;
        rainVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
        
        rainSizes[i] = Math.random() * 0.2 + 0.1;
    }

    rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    rainGeometry.setAttribute('velocity', new THREE.BufferAttribute(rainVelocities, 3));
    rainGeometry.setAttribute('size', new THREE.BufferAttribute(rainSizes, 1));

    const rainMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 }
        },
        vertexShader: `
            attribute vec3 velocity;
            attribute float size;
            varying float vAlpha;
            uniform float time;
            void main() {
                vec3 pos = position + velocity * time;
                pos.y = mod(pos.y, 200.0);
                vAlpha = 0.6 + sin(time * 10.0 + position.x) * 0.4;
                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying float vAlpha;
            void main() {
                float dist = length(gl_PointCoord - vec2(0.5));
                if (dist > 0.5) discard;
                gl_FragColor = vec4(0.7, 0.8, 1.0, vAlpha * (1.0 - dist * 2.0));
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending
    });

    rain = new THREE.Points(rainGeometry, rainMaterial);
    scene.add(rain);
}

function createNeonGrid() {
    const gridSize = 100;
    const gridDivisions = 50;
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

function createCityscape() {
    const buildingCount = 20;
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

    // Neon billboard animation
    const billboardTexture = new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/sprites/spark1.png');
    const billboardMaterial = new THREE.SpriteMaterial({ map: billboardTexture, color: 0x00ffcc, transparent: true, opacity: 1 });
    const billboard = new THREE.Sprite(billboardMaterial);
    billboard.scale.set(10, 5, 1);
    billboard.position.set(0, 20, -20);
    scene.add(billboard);

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

function checkCollision() {
    const airplaneBox = new THREE.Box3().setFromObject(airplane);
    
    // Check collision with buildings
    for (const building of buildings) {
        const buildingBox = new THREE.Box3().setFromObject(building);
        if (airplaneBox.intersectsBox(buildingBox)) {
            return true;
        }
    }

    // Check if airplane is too low
    if (airplane.position.y < 0.5) {
        return true;
    }

    return false;
}

function calculateAerodynamicForces(velocity, windSpeed, angle) {
    // Calculate relative airspeed
    const relativeAirspeed = new THREE.Vector3().subVectors(velocity, windSpeed);
    const airspeedMagnitude = relativeAirspeed.length();

    // Calculate angle of attack (simplified)
    const angleOfAttack = angle + Math.atan2(relativeAirspeed.y, Math.sqrt(relativeAirspeed.x * relativeAirspeed.x + relativeAirspeed.z * relativeAirspeed.z));
    
    // Calculate lift coefficient based on angle of attack
    const stallAngle = 0.3; // About 17 degrees
    let liftCoefficient = 1.2 * Math.sin(2 * angleOfAttack);
    if (Math.abs(angleOfAttack) > stallAngle) {
        liftCoefficient *= 0.6; // Reduce lift when stalling
    }

    // Calculate drag coefficient (includes induced drag)
    const parasiteDrag = 0.1;
    const inducedDragFactor = 0.05;
    const dragCoefficient = parasiteDrag + inducedDragFactor * liftCoefficient * liftCoefficient;

    // Calculate lift and drag forces
    const dynamicPressure = 0.5 * airDensity * airspeedMagnitude * airspeedMagnitude;
    const liftForce = dynamicPressure * wingArea * liftCoefficient;
    const dragForce = dynamicPressure * wingArea * dragCoefficient;

    // Calculate lift and drag vectors
    const liftDirection = new THREE.Vector3(0, 1, 0);
    const dragDirection = relativeAirspeed.clone().normalize().negate();

    return {
        lift: liftDirection.multiplyScalar(liftForce),
        drag: dragDirection.multiplyScalar(dragForce)
    };
}

function handleNonPlayModeMovement(time) {
    // Dynamic wind influence with more variation
    const windStrength = 0.8 * (1 + Math.sin(time * 0.1));
    wind.x = Math.sin(time * 0.1) * windStrength + Math.sin(time * 0.3) * 0.2;
    wind.y = Math.cos(time * 0.07) * windStrength * 0.3;
    wind.z = Math.cos(time * 0.05) * windStrength + Math.cos(time * 0.4) * 0.2;

    // Enhanced flight path parameters with lower minimum height
    const baseHeight = 20; // Reduced from 35
    const swoopDepth = 15;
    const swoopSpeed = 0.2;

    // Calculate aerodynamic forces
    const forces = calculateAerodynamicForces(
        airplane.velocity,
        wind,
        airplane.rotation.x
    );

    // Calculate base flight path
    const pathX = Math.sin(time * 0.3) * 20 + Math.cos(time * 0.8) * 10;
    const swoopY = Math.sin(time * swoopSpeed) * swoopDepth;
    const baseY = baseHeight + swoopY + Math.sin(time * 0.5) * 5;
    const pathZ = Math.sin(time * 0.4) * 15;

    // Enhanced building avoidance and interaction
    let ax = 0, ay = 0, az = 0;
    const minSafeDistance = 10; // Reduced from 15
    const attractionDistance = 50;
    const maxAvoidanceForce = 5;
    const maxAttractionForce = 2;

    // Calculate distance-based safe radius for each building
    buildings.forEach(building => {
        const dx = building.position.x - airplane.position.x;
        const dy = building.position.y - airplane.position.y;
        const dz = building.position.z - airplane.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        const buildingHeight = building.geometry.parameters.height;
        const safeRadius = minSafeDistance + (buildingHeight / 20); // Reduced safety margin
        
        if (dist < safeRadius) {
            const force = Math.min(maxAvoidanceForce, (safeRadius - dist) / safeRadius);
            
            ax -= (dx / dist) * force * 2.5;
            ay += Math.abs(force) * 3 * (airplane.position.y < building.position.y + buildingHeight + 3 ? 2 : 1);
            az -= (dz / dist) * force * 2.5;
            
            if (airplane.position.y < building.position.y + buildingHeight + 5) {
                ay += force * 4;
            }
        } else if (dist < attractionDistance && airplane.position.y > building.position.y + buildingHeight + 8) {
            const attractionForce = Math.min(maxAttractionForce, 
                (dist - safeRadius) / (attractionDistance - safeRadius));
            ax += (dx / dist) * attractionForce * 0.4;
            ay -= attractionForce * 0.5;
            az += (dz / dist) * attractionForce * 0.4;
        }
    });

    // Apply aerodynamic forces
    ax += forces.lift.x + forces.drag.x;
    ay += forces.lift.y + forces.drag.y;
    az += forces.lift.z + forces.drag.z;

    // Apply gravity with ground effect
    const groundEffectHeight = 5;
    const groundEffect = Math.max(0, 1 - (airplane.position.y / groundEffectHeight));
    ay += gravity.y * (1 - groundEffect * 0.7);

    // Calculate final target position with all influences
    const targetPos = new THREE.Vector3(
        pathX + ax + wind.x,
        baseY + ay + wind.y,
        pathZ + az + wind.z
    );

    // Enhanced movement smoothing with ground proximity consideration
    const proximityToGround = Math.max(0, Math.min(1, airplane.position.y / 10));
    const speedFactor = Math.min(1, airplane.velocity.length() / 2);
    const smoothingFactor = (0.03 + (1 - speedFactor) * 0.05) * (0.7 + proximityToGround * 0.3);
    
    airplane.velocity.lerp(targetPos.sub(airplane.position), smoothingFactor);
    
    // Dynamic speed control based on altitude
    const maxSpeed = 2.0 + proximityToGround;
    if (airplane.velocity.length() > maxSpeed) {
        airplane.velocity.normalize().multiplyScalar(maxSpeed);
    }
    
    airplane.position.add(airplane.velocity.multiplyScalar(0.15));

    // Enhanced rotation handling with ground effect
    const bankingSensitivity = 0.3 * (0.7 + proximityToGround * 0.3);
    const pitchSensitivity = 0.2 * (0.7 + proximityToGround * 0.3);
    airplane.rotation.z = -airplane.velocity.x * bankingSensitivity;
    airplane.rotation.x = airplane.velocity.y * pitchSensitivity;
    
    const targetYaw = Math.atan2(-airplane.velocity.x, -airplane.velocity.z);
    airplane.rotation.y += Math.sin(targetYaw - airplane.rotation.y) * 0.1;

    const turnIntensity = Math.abs(airplane.velocity.x) / 5;
    airplane.rotation.z -= Math.sign(airplane.velocity.x) * turnIntensity;

    // Adaptive camera follow with ground proximity awareness
    const cameraHeightFactor = Math.max(0.3, Math.min(1, (airplane.position.y - 5) / 20));
    const cameraOffset = new THREE.Vector3(
        Math.sin(time * 0.2) * 2,
        3 + cameraHeightFactor * 6,
        8 + cameraHeightFactor * 4
    );
    const desiredCameraPos = airplane.position.clone().add(cameraOffset);
    camera.position.lerp(desiredCameraPos, 0.05);
    camera.lookAt(airplane.position);
}

export function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    checkCollision();
    handleNonPlayModeMovement(time);

    // Animate rain particles
    if (rain && rain.material.uniforms) {
        rain.material.uniforms.time.value = time;
    }

    // Animate neon billboard opacity pulse
    if (billboard && billboard.material) {
        billboard.material.opacity = 0.7 + 0.3 * Math.sin(clock.getElapsedTime() * 4);
    }

    // Pulsing holograms
    holograms.forEach(holo => {
        if (holo.material) {
            holo.material.emissiveIntensity = 0.8 + 0.2 * Math.sin(clock.getElapsedTime() * 5);
        }
    });

    if (starField && starField.material.uniforms) {
        starField.material.uniforms.time.value = time;
    }

    updateVehicles();
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
    onWindowResize,
};