import type { Level } from './physics';

export interface ContactTuning {
  strength: number;
  springMultiplier: number;
  dampingMultiplier: number;
  damageMultiplier: number;
  bodyFatalImpact: number;
}
export interface LandingConditions {
  vertical: number; horizontal: number; angle: number; angularSpeed: number; hold: number;
  allowEmergency: boolean; emergencySpeed: number; emergencyAngle: number; emergencyAngularSpeed: number; emergencyHold: number;
}
export interface Obstacle {
  id: string; kind: 'pillar'; platform: string; along: number; height: number; radius: number;
}
export interface StarThreshold {
  minFuelRatio: number; maxTime: number; minLegHealth: number; minBodyIntegrity: number;
  maxTouchdownSpeed: number; maxTouchdownAngle: number; requireBothLegs: boolean;
}
export interface ScoringRules { two: StarThreshold; three: StarThreshold; baseCoins: number }
export interface Tutorial {
  topic: string; paragraphs: string[]; transfer: string; brake: string; approach: string;
  climbHeight: number; approachRange: number; speedGuide: number;
  showLandingAssist: boolean;
}
export interface RouteWaypoint { x: number; y: number }
export type CampaignLevel = Level & {
  order: number; chapter: string; description: string; objectives: string[];
  ship: { model: 'GL-01'; initialState: 'docked' };
  initialFuel: number; contact: ContactTuning; landing: LandingConditions; obstacles: Obstacle[];
  tutorial: Tutorial; scoring: ScoringRules; unlockNext: string | null;
  verificationRoute: RouteWaypoint[];
};
