import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useSpring, animated } from '@react-spring/three';
import { Environment } from '@react-three/drei';

function LockModel({ strengthScore }) {
  const group = useRef();

  // Strength score is 0-4 (from zxcvbn)
  // Determine color based on strength
  const getLockColor = (score) => {
    switch(score) {
      case 0: return '#ef4444'; // Red
      case 1: return '#f97316'; // Orange
      case 2: return '#eab308'; // Yellow
      case 3: return '#84cc16'; // Lime
      case 4: return '#10b981'; // Green
      default: return '#71717a'; // Gray (default)
    }
  };

  const { shackleY, color } = useSpring({
    shackleY: strengthScore >= 3 ? 0.8 : 0,
    color: getLockColor(strengthScore),
    config: { mass: 1, tension: 170, friction: 20 }
  });

  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
    }
  });

  return (
    <group ref={group} position={[0, -0.5, 0]}>
      {/* Lock Body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2, 1.5, 0.8]} />
        <animated.meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Keyhole */}
      <mesh position={[0, 0, 0.41]}>
        <cylinderGeometry args={[0.2, 0.2, 0.1, 32]} />
        <meshStandardMaterial color="#27272a" />
      </mesh>

      {/* Shackle */}
      <animated.mesh position-y={shackleY}>
        <mesh position={[0, 0.75, 0]}>
          <torusGeometry args={[0.7, 0.2, 16, 32, Math.PI]} />
          <meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Shackle legs */}
        <mesh position={[-0.7, 0.375, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.75, 16]} />
          <meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0.7, 0.375, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.75, 16]} />
          <meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.1} />
        </mesh>
      </animated.mesh>
    </group>
  );
}

export default function VaultLock({ strengthScore }) {
  return (
    <div className="w-48 h-48 sm:w-64 sm:h-64 mx-auto mb-4">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        <Environment preset="city" />
        <LockModel strengthScore={strengthScore} />
      </Canvas>
    </div>
  );
}
