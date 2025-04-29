import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcccccc, 50, 500);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 30);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xfff2cc, 1);
directionalLight.position.set(-30, 50, 50);
directionalLight.castShadow = true;
scene.add(directionalLight);

const skyColor = new THREE.Color(0x87ceeb);
scene.background = skyColor;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enabled = false;

const planeGeometry = new THREE.ConeGeometry(0.5, 2, 3);
const planeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
const airplane = new THREE.Mesh(planeGeometry, planeMaterial);
airplane.rotation.x = Math.PI / 2;
scene.add(airplane);

const buildings = new THREE.Group();
for (let i = 0; i < 200; i++) {
  const width = Math.random() * 2 + 1;
  const height = Math.random() * 20 + 10;
  const depth = Math.random() * 2 + 1;
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
  const building = new THREE.Mesh(geometry, material);
  building.position.set((Math.random() - 0.5) * 200, height / 2, (Math.random() - 0.5) * 200);
  buildings.add(building);
}
scene.add(buildings);

const listener = new THREE.AudioListener();
camera.add(listener);

const citySound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();
audioLoader.load(
    'https://cdn.pixabay.com/audio/2022/08/16/audio_d881dcfb61.mp3',
    (buffer) => {
        citySound.setBuffer(buffer);
        citySound.setLoop(true);
        citySound.setVolume(0.3);
        citySound.play();
    },
    (progress) => {
        console.log((progress.loaded / progress.total * 100) + '% loaded');
    },
    (error) => {
        console.error('Error loading audio:', error);
    }
);

const particlesCount = 1000;
const particlesGeometry = new THREE.BufferGeometry();
const posArray = new Float32Array(particlesCount * 3);
for (let i = 0; i < particlesCount * 3; i++) {
  posArray[i] = (Math.random() - 0.5) * 300;
}
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particlesMaterial = new THREE.PointsMaterial({ size: 0.3, color: 0xffffff });
const particles = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particles);

let clock = new THREE.Clock();
let speed = 10;

let animationFrameId;
let lastTime = 0;

function animate(currentTime) {
    animationFrameId = requestAnimationFrame(animate);
    
    const delta = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    if (!delta) return;

    let time = clock.getElapsedTime();

    airplane.position.x = Math.sin(time * 0.6) * 10 + Math.sin(time * 3) * 0.2;
    airplane.position.y = 10 + Math.sin(time * 2) * 2 + Math.sin(time * 1.5) * 0.2;
    airplane.position.z -= speed * delta;
    airplane.rotation.z = Math.sin(time * 2) * 0.2;

    camera.position.lerp(
        new THREE.Vector3(
            airplane.position.x + 5,
            airplane.position.y + 3,
            airplane.position.z + 15
        ),
        0.05
    );
    camera.lookAt(airplane.position);

    buildings.children.forEach(b => {
        b.position.z += speed * delta;
        if (b.position.z > 50) b.position.z -= 200;
    });

    const positions = particles.geometry.attributes.position.array;
    for (let i = 2; i < positions.length; i += 3) {
        positions[i] += 0.1 * delta;
        if (positions[i] > 50) positions[i] = -150;
    }
    particles.geometry.attributes.position.needsUpdate = true;

    controls.update();
    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Clean up function
function cleanup() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    citySound.stop();
    renderer.dispose();
}