/**
 * The data-type language.
 *
 * This is the single most consequential label in the product: it is the
 * difference between "this happened" and "we computed this". It therefore lives
 * in its own module with no React dependency, so a Convex query, a formatter
 * and a component can all agree on what `scenario` means without importing
 * each other.
 *
 * Four values, and no fifth. If a surface needs a fifth, it is describing
 * freshness or provenance rather than kind, and that has its own vocabulary.
 */
export type Basis = "observed" | "model" | "scenario" | "ai";

export const BASIS_LABEL: Record<Basis, string> = {
  observed: "OBSERVED",
  model: "MODELLED",
  scenario: "SCENARIO",
  ai: "AI",
};

export const BASIS_COLOUR: Record<Basis, string> = {
  observed: "var(--exec-emerald)",
  model: "var(--exec-cyan)",
  scenario: "var(--exec-amber)",
  ai: "var(--exec-ink-dim)",
};

export const BASIS_HELP: Record<Basis, string> = {
  observed: "Reported verbatim by a named external source.",
  model: "Computed by GlobalMatrix from its own published formula.",
  scenario: "A hypothetical perturbation of the corpus. Nothing here has happened.",
  ai: "A generated interpretation, shown with the evidence it rests on.",
};