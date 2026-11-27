// Sky Courier — Island Run: tuning numbers for the world, the plane and the missions.
// One clear job: every number the game balances lives here, so tuning never means
// hunting through the flight model, the renderer or the mission logic.
export const VIEW = {
  width: 1280,
  height: 720,
  fovDegrees: 68,
  cameraDistance: 15,
  cameraHeight: 4.5,
  lookAhead: 34,
};

export const WORLD = {
  seed: 7,
  // The flyable sea is a square of this half-size in metres; beyond it the sea is empty.
  halfSize: 5200,
  seaLevel: 0,
  maxHill: 130,
  // Island centres (x, z, radius, peak height) that rise out of the sea.
  islands: [
    { x: -1400, z: -900, radius: 1500, peak: 120 },
    { x: 1500, z: -1600, radius: 1300, peak: 96 },
    { x: -200, z: 1500, radius: 1700, peak: 110 },
    { x: 2400, z: 1800, radius: 1100, peak: 78 },
    { x: -2600, z: 2200, radius: 1000, peak: 70 },
  ],
};

// Two grass strips the courier flies between. heading is radians, 0 = north (-z).
export const AIRFIELDS = [
  {
    id: 'north',
    name: 'North Field',
    x: -1400,
    z: -900,
    heading: 0.35,
    length: 620,
    width: 26,
  },
  {
    id: 'south',
    name: 'South Strip',
    x: -200,
    z: 1500,
    heading: -0.5,
    length: 560,
    width: 24,
  },
];

export const PLANE = {
  cruiseSpeed: 48,
  maxSpeed: 72,
  minSpeed: 20,
  stallSpeed: 26,
  takeoffSpeed: 28,
  accel: 14,
  drag: 0.55,
  pitchRate: 0.85,
  rollRate: 1.9,
  maxPitch: 0.5,
  maxRoll: 1.1,
  fuelCapacity: 100,
  // Fuel units per second at idle and at full throttle.
  fuelIdle: 0.03,
  fuelFull: 0.1,
  gearDrag: 4,
  flapDrag: 5,
  flapLift: 1.25,
  // Touchdown is a landing when the sink rate is under this (m/s); harder is damage.
  softSink: 4.5,
  hardSink: 8,
};

export const MISSIONS = [
  {
    id: 'rings',
    name: 'Ring Run',
    blurb: 'Thread all 8 sky rings in order before the fuel runs dry.',
    rings: 8,
    timeLimit: 0,
    wind: 0,
  },
  {
    id: 'hop',
    name: 'Island Hop',
    blurb: 'Lift off from North Field, carry the mailbag, and set her down gently on South Strip.',
    rings: 3,
    timeLimit: 0,
    wind: 0.4,
  },
  {
    id: 'storm',
    name: 'Storm Courier',
    blurb: 'Six rings in a rising crosswind, against the clock. Mind the gusts.',
    rings: 6,
    timeLimit: 240,
    wind: 1,
  },
];

export const RING = {
  radius: 34,
  passScore: 100,
  nearScore: 25,
};

export const SCORING = {
  ring: 100,
  nearMiss: 25,
  smoothLanding: 250,
  roughLanding: 80,
  delivery: 400,
  timeBonusPerSecond: 2,
};

export const COLOURS = {
  skyTop: '#2f6fb4',
  skyMid: '#7fb2dd',
  skyHorizon: '#f6d9a0',
  seaDeep: '#14506e',
  seaShallow: '#2e86a8',
  sand: '#d9c184',
  grass: '#5d9b4a',
  field: '#7fae56',
  forest: '#2f6b34',
  rock: '#8a7f72',
  runway: '#3d4148',
  runwayEdge: '#f2f2e6',
  ring: '#ffd23e',
  ringNext: '#ff9f1c',
};
