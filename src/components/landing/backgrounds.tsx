"use client";

import {
  DotOrbit,
  GodRays,
  GrainGradient,
  MeshGradient,
  NeuroNoise,
  SmokeRing,
  Swirl,
  Warp,
} from "@paper-design/shaders-react";
import { Boxes } from "@/components/aceternity/background-boxes";
import Aurora from "@/components/reactbits/Aurora";
import LightRays from "@/components/reactbits/LightRays";
import Particles from "@/components/reactbits/Particles";
import Threads from "@/components/reactbits/Threads";

// Ready-made hero backgrounds, used as they ship and recolored through their
// own props. Paper Shaders (paper.design), React Bits (reactbits.dev) and
// Aceternity UI (ui.aceternity.com).

const INK = "#1b1530";
const PURPLE = "#463077";
const LILAC = "#7a66ad";
const GOLD = "#c99700";
const FILL = { width: "100%", height: "100%" } as const;

export type BackgroundId =
  | "mesh"
  | "grain"
  | "warp"
  | "swirl"
  | "smoke"
  | "neuro"
  | "godrays"
  | "dots"
  | "aurora"
  | "threads"
  | "rays"
  | "particles"
  | "boxes";

type Background = {
  id: BackgroundId;
  label: string;
  source: "Paper Shaders" | "React Bits" | "Aceternity";
  interactive?: boolean; // needs the pointer, so it must sit above the text fade
  render: (speed: number) => React.ReactNode;
};

export const BACKGROUNDS: Background[] = [
  {
    id: "mesh",
    label: "Mesh gradient",
    source: "Paper Shaders",
    render: (speed) => (
      <MeshGradient
        style={FILL}
        colors={[INK, PURPLE, LILAC, GOLD, INK]}
        distortion={0.8}
        swirl={0.3}
        speed={speed * 0.6}
      />
    ),
  },
  {
    id: "grain",
    label: "Grain gradient",
    source: "Paper Shaders",
    render: (speed) => (
      <GrainGradient
        style={FILL}
        colorBack={INK}
        colors={[PURPLE, LILAC, GOLD]}
        softness={0.7}
        intensity={0.35}
        noise={0.3}
        shape="wave"
        speed={speed}
      />
    ),
  },
  {
    id: "warp",
    label: "Warp",
    source: "Paper Shaders",
    render: (speed) => (
      <Warp
        style={FILL}
        colors={[INK, PURPLE, LILAC, GOLD]}
        proportion={0.35}
        softness={1}
        distortion={0.25}
        swirl={0.8}
        swirlIterations={10}
        shapeScale={0.1}
        speed={speed * 0.8}
      />
    ),
  },
  {
    id: "swirl",
    label: "Swirl",
    source: "Paper Shaders",
    render: (speed) => (
      <Swirl
        style={FILL}
        colorBack={INK}
        colors={[PURPLE, LILAC, GOLD]}
        bandCount={4}
        twist={0.2}
        softness={1}
        noise={0.2}
        speed={speed * 0.4}
      />
    ),
  },
  {
    id: "smoke",
    label: "Smoke ring",
    source: "Paper Shaders",
    render: (speed) => (
      <SmokeRing
        style={FILL}
        colorBack={INK}
        colors={[LILAC, GOLD]}
        noiseScale={3}
        thickness={0.5}
        radius={0.45}
        innerShape={0.7}
        scale={1.4}
        speed={speed * 0.5}
      />
    ),
  },
  {
    id: "neuro",
    label: "Neuro noise",
    source: "Paper Shaders",
    render: (speed) => (
      <NeuroNoise
        style={FILL}
        colorFront={GOLD}
        colorMid={LILAC}
        colorBack={INK}
        brightness={0.05}
        contrast={0.3}
        speed={speed * 0.6}
      />
    ),
  },
  {
    id: "godrays",
    label: "God rays",
    source: "Paper Shaders",
    render: (speed) => (
      <GodRays
        style={FILL}
        colorBack={INK}
        colorBloom={LILAC}
        colors={[PURPLE, LILAC, GOLD]}
        offsetY={-0.55}
        intensity={0.7}
        density={0.3}
        spotty={0.3}
        midSize={0.2}
        midIntensity={0.4}
        bloom={0.4}
        speed={speed * 0.75}
      />
    ),
  },
  {
    id: "dots",
    label: "Dot orbit",
    source: "Paper Shaders",
    render: (speed) => (
      <DotOrbit
        style={FILL}
        colorBack={INK}
        colors={[PURPLE, LILAC, GOLD]}
        size={0.5}
        sizeRange={0.4}
        spreading={1}
        stepsPerColor={3}
        scale={0.5}
        speed={speed * 1.5}
      />
    ),
  },
  {
    id: "aurora",
    label: "Aurora",
    source: "React Bits",
    render: (speed) => (
      <Aurora colorStops={[PURPLE, GOLD, LILAC]} amplitude={1.1} blend={0.6} speed={speed * 0.6} />
    ),
  },
  {
    id: "threads",
    label: "Threads",
    source: "React Bits",
    interactive: true,
    render: (speed) => (
      <Threads
        color={[0.63, 0.56, 0.82]}
        amplitude={0.6 + speed * 0.6}
        distance={0.2}
        enableMouseInteraction
      />
    ),
  },
  {
    id: "rays",
    label: "Light rays",
    source: "React Bits",
    render: (speed) => (
      <LightRays
        raysOrigin="top-center"
        raysColor={LILAC}
        raysSpeed={speed * 0.8}
        lightSpread={1.1}
        rayLength={1.6}
        followMouse
        mouseInfluence={0.08}
      />
    ),
  },
  {
    id: "particles",
    label: "Particles",
    source: "React Bits",
    render: (speed) => (
      <Particles
        particleColors={["#ffffff", LILAC, GOLD]}
        particleCount={260}
        particleSpread={10}
        speed={speed * 0.08}
        particleBaseSize={90}
        alphaParticles
      />
    ),
  },
  {
    id: "boxes",
    label: "Background boxes",
    source: "Aceternity",
    interactive: true,
    render: () => <Boxes />,
  },
];

export const DEFAULT_BACKGROUND: BackgroundId = "mesh";
