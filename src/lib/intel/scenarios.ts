import type { Scenario } from "./types";
import { SCENARIOS_1 } from "./scenarios-1";
import { SCENARIOS_2 } from "./scenarios-2";
import { SCENARIOS_3 } from "./scenarios-3";

/**
 * The v1 corpus is a synthetic, internally-consistent scenario set rather than
 * a live intelligence feed. Every figure is deterministic and reproducible so
 * that a researcher can audit the model's arithmetic end to end.
 */
export const SCENARIOS: Scenario[] = [
  ...SCENARIOS_1,
  ...SCENARIOS_2,
  ...SCENARIOS_3,
];

export const CORPUS_VERSION = "v1.0.0";
export const CORPUS_LABEL = "Scenario corpus v1.0.0";