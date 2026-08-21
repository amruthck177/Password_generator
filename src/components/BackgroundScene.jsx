import React, { Component } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sparkles, Stars } from '@react-three/drei';

class WebGLErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.warn('WebGL or 3D background error, falling back to CSS background:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[-1] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black" />
      );
    }
    return this.props.children;
  }
}

export default function BackgroundScene() {
  return (
    <div className="fixed inset-0 z-[-1] bg-background">
      <WebGLErrorBoundary>
        <Canvas camera={{ position: [0, 0, 1] }} gl={{ powerPreference: 'low-power', antialias: false }}>
          <color attach="background" args={['#09090b']} />
          <ambientLight intensity={0.5} />
          <Sparkles count={80} scale={10} size={2} speed={0.4} opacity={0.3} color="#10b981" />
          <Stars radius={80} depth={50} count={1000} factor={4} saturation={0} fade speed={1} />
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
}
