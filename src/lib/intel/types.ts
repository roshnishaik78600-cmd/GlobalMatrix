/**
 * Core analytical types for the propagation model.
 *
 * The model is deliberately explainable: every number surfaced in the UI can
 * be traced back to a signal, a pathway or an explicit coefficient below.
 */

export const CHANNELS = ["trade", "energy", "finance", "diplomatic"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABEL: Record<Channel, string> = {
  trade: "Trade",
  energy: "Energy",
  finance: "Finance",
  diplomatic: "Diplomatic",
};

/** Short code used in dense grid cells. */
export const CHANNEL_CODE: Record<Channel, string> = {
  trade: "TRD",
  energy: "NRG",
  finance: "FIN",
  diplomatic: "DIP",
};

export type Stage = "emerging" | "escalating" | "active" | "de-escalating";

export const STAGES: Stage[] = [
  "emerging",
  "escalating",
  "active",
  "de-escalating",
];

export const STAGE_LABEL: Record<Stage, string> = {
  emerging: "Emerging",
  escalating: "Escalating",
  active: "Active",
  "de-escalating": "De-escalating",
};

export type Direction = "escalatory" | "stabilising" | "mixed";

export type SourceClass = "wire" | "official" | "market" | "intel" | "social";

export const SOURCE_CLASS_LABEL: Record<SourceClass, string> = {
  wire: "Wire",
  official: "Official",
  market: "Market",
  intel: "Analytical",
  social: "Open source",
};

/** One observed data point supporting (or contradicting) an event. */
export interface Signal {
  id: string;
  source: string;
  sourceClass: SourceClass;
  observedAt: string; // ISO-8601 date
  channel: Channel;
  headline: string;
  detail: string;
  /** Source trust prior, 0..1. Official filings outrank open social posts. */
  reliability: number;
  /** How much this observation moves the model, 0..1. */
  weight: number;
  /** Independent sources carrying the same observation. */
  corroborations: number;
  /** Deviation from the actor's own 90-day baseline, in sigma. */
  anomalyZ: number;
}

/** A node of the transmission network: an economy, bloc or chokepoint. */
export interface GraphNode {
  id: string;
  label: string;
  short: string;
  kind: "economy" | "bloc" | "chokepoint" | "corridor" | "institution";
  region: string;
  /** How hard a shock to this node propagates outward, 0..1. */
  criticality: number;
  /**
   * Geographic position in degrees, used only for map placement. These are
   * real coordinates, not modelled data. Institutions are abstractions rather
   * than places and are deliberately left undefined so the map excludes them
   * instead of inventing a point for them.
   */
  lat?: number;
  lon?: number;
}

/** One exposed node on one channel, for one event. */
export interface Exposure {
  nodeId: string;
  /** Structural dependency of the node on the channel, 0..1. */
  exposure: number;
  /** Expected realised impact within the stated lag, 0..1. */
  impact: number;
  lagDays: number;
  note: string;
}

/** How an event travels down one channel. */
export interface Pathway {
  channel: Channel;
  direction: Direction;
  /** Pressure this channel is under, 0..1. */
  magnitude: number;
  /** Transmission lag window in days, low..high. */
  lagDays: [number, number];
  confidence: number;
  mechanism: string;
  exposures: Exposure[];
}

export interface Driver {
  id: string;
  label: string;
  channel: Channel;
  /** Share of the composite this driver explains, 0..1. */
  weight: number;
  /** Signed contribution to the 0..100 score. */
  contribution: number;
  note: string;
}

export type RiskBand = "low" | "moderate" | "elevated" | "high" | "severe";

export const RISK_BANDS: RiskBand[] = [
  "low",
  "moderate",
  "elevated",
  "high",
  "severe",
];

export const BAND_LABEL: Record<RiskBand, string> = {
  low: "Low",
  moderate: "Moderate",
  elevated: "Elevated",
  high: "High",
  severe: "Severe",
};

/** A scored, interval-valued near-term risk estimate. */
export interface RiskEstimate {
  horizonDays: number;
  score: number;
  low: number;
  high: number;
  band: RiskBand;
  drivers: Driver[];
}

export interface Scenario {
  id: string;
  reference: string;
  title: string;
  summary: string;
  stage: Stage;
  detectedAt: string;
  firstSignalAt: string;
  confidence: number;
  novelty: number;
  velocity: number;
  actors: string[];
  regions: string[];
  tags: string[];
  signals: Signal[];
  pathways: Pathway[];
  /** Tail scenario written for the risk board. */
  tailScenario: string;
  analystNote: string;
}

/** Everything the UI needs about one event, derived by the engine. */
export interface EventAssessment {
  scenario: Scenario;
  risk: Record<number, RiskEstimate>;
  channelPressure: Record<Channel, number>;
  overall: number;
  band: RiskBand;
  confidence: number;
  /** 0..1 evidence strength after reliability weighting. */
  evidenceStrength: number;
  /** Half-width of the 80% interval on the 30-day horizon, in points. */
  uncertainty: number;
  dominantChannel: Channel;
  /** Cumulative evidence mass over time, for the detection sparkline. */
  velocitySeries: number[];
}