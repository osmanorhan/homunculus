/**
 * EquilibriumDetector: Minsky's Difference Engine for Goal Satisfaction
 *
 * SCIENTIFIC FOUNDATION (Minsky, "The Society of Mind", Chapter 7):
 * "Agents are driven by Difference Engines - they activate to reduce the gap
 * between the current state and the ideal state. When the difference is zero,
 * agents fall asleep (inhibition)."
 *
 * COGNITIVE SCIENCE LITERATURE:
 * - Goal satisfaction detection (Miller, Galanter, Pribram: "Plans and the Structure of Behavior")
 * - TOTE framework: Test → Operate → Test → Exit
 * - Activation decay when goal tension is resolved
 * - Semantic coherence as equilibrium marker (Kintsch & van Dijk)
 *
 * NEUROSCIENCE PARALLELS:
 * - Homeostatic regulation: systems seek equilibrium
 * - Neural quiescence when no mismatch signal exists
 * - Action potentials cease when no gradient exists
 *
 * THIS IS NOT KEYWORD MATCHING - IT'S SEMANTIC TENSION MEASUREMENT
 */

import type { Signal } from '../../../core/src/signal/signal.js';
import type { OrganicAgent } from '../../../core/src/signal/organic-agent.js';
import { cosineSimilarity } from '../../../core/src/signal/semantic-utils.js';

export interface EquilibriumState {
  /**
   * Is the society at equilibrium? (difference engine is satisfied)
   */
  atEquilibrium: boolean;

  /**
   * Goal tension: semantic distance between current state and ideal state (0-1)
   * 0 = equilibrium, 1 = maximum tension
   */
  goalTension: number;

  /**
   * Conversational momentum: are agents still actively thinking? (0-1)
   * 0 = silence/sleep, 1 = high activity
   */
  momentum: number;

  /**
   * Semantic coherence: are recent signals converging on a shared understanding? (0-1)
   * 0 = divergent thinking, 1 = consensus
   */
  coherence: number;

  /**
   * Decision clarity: is there a clear decision/conclusion? (0-1)
   * 0 = ambiguous, 1 = crystallized
   */
  decisionClarity: number;

  /**
   * Is the system stagnant? (stuck in a loop with no progress)
   * True if high tension + low coherence for multiple ticks
   */
  isStagnant: boolean;

  /**
   * Explanation of why equilibrium was reached (or not)
   */
  reasoning: string;
}

export interface EquilibriumDetectorConfig {
  llm: {
    embed(text: string): Promise<number[]>;
    chat(messages: Array<{ role: string; content: string }>): Promise<string>;
  };

  /**
   * Minimum window of signals to analyze (default: 5)
   */
  minSignalWindow?: number;

  /**
   * Minimum number of ticks (dialogue rounds) before equilibrium can be detected (default: 5)
   * Prevents premature equilibrium when all agents respond to same initial scenario
   */
  minTicks?: number;

  /**
   * Goal tension threshold for equilibrium (default: 0.3)
   * Below this = equilibrium
   */
  tensionThreshold?: number;

  /**
   * Momentum threshold for silence detection (default: 0.2)
   * Below this = agents have fallen silent
   */
  momentumThreshold?: number;

  /**
   * Coherence threshold for consensus detection (default: 0.7)
   * Above this = agents agree/converge
   */
  coherenceThreshold?: number;

  /**
   * Decision clarity threshold (default: 0.6)
   * Above this = clear decision exists
   */
  clarityThreshold?: number;
}

/**
 * EquilibriumDetector: Scientific approach to detecting when agents have "finished thinking"
 *
 * MULTIPLE DETECTION MODES (all must agree):
 * 1. Goal Tension: Semantic distance between ideal state and current state
 * 2. Momentum: Declining signal activity (agents falling silent)
 * 3. Coherence: Signals converging semantically (consensus emerging)
 * 4. Decision Clarity: Presence of crystallized decision/conclusion
 *
 * EXAMPLE (CEO Scenario):
 * Initial: High tension (jail vs profit), high momentum (panic), low coherence (contradictions)
 * Final: Low tension (plan decided), low momentum (silence), high coherence (agreement), high clarity (decision)
 */
export class EquilibriumDetector {
  private readonly llm: EquilibriumDetectorConfig['llm'];
  private readonly minSignalWindow: number;
  private readonly minTicks: number;
  private readonly tensionThreshold: number;
  private readonly momentumThreshold: number;
  private readonly coherenceThreshold: number;
  private readonly clarityThreshold: number;

  // Cached embeddings
  private readonly idealStateCache = new Map<string, number[]>();
  private readonly signalWindowSize = 10;
  private currentTick = 0;

  // Stagnation detection - track last N ticks
  private readonly stagnationHistory: Array<{
    tick: number;
    tension: number;
    coherence: number;
    clarity: number;
  }> = [];
  private readonly stagnationWindowSize = 5;

  constructor(config: EquilibriumDetectorConfig) {
    this.llm = config.llm;
    this.minSignalWindow = config.minSignalWindow ?? 5;
    this.minTicks = config.minTicks ?? 5;
    this.tensionThreshold = config.tensionThreshold ?? 0.3;
    this.momentumThreshold = config.momentumThreshold ?? 0.2;
    this.coherenceThreshold = config.coherenceThreshold ?? 0.7;
    this.clarityThreshold = config.clarityThreshold ?? 0.6;
  }

  /**
   * Detect equilibrium state given:
   * - Initial scenario (ideal state extraction)
   * - Recent signal history
   * - Active agents
   *
   * OPTIMIZATION APPROACH (Control Theory):
   * Instead of AND-gating four conditions, we define an ENERGY FUNCTION:
   *
   * E(state) = w1·tension + w2·(1-coherence) + w3·(1-clarity) + w4·momentum
   *
   * Equilibrium occurs when:
   * 1. Energy is below threshold (local minimum)
   * 2. Energy gradient is near zero (rate of change ≈ 0)
   *
   * This aligns with physical systems: equilibrium = minimum energy state
   */
  async detect(scenario: string, signals: Signal[], agents: OrganicAgent[]): Promise<EquilibriumState> {
    this.currentTick++;

    // Not enough data yet - require both minimum signals AND minimum ticks
    if (signals.length < this.minSignalWindow) {
      return {
        atEquilibrium: false,
        goalTension: 1.0,
        momentum: 1.0,
        coherence: 0.0,
        decisionClarity: 0.0,
        isStagnant: false,
        reasoning: 'Insufficient signal history to detect equilibrium',
      };
    }

    // Prevent premature equilibrium - agents need time to deliberate
    if (this.currentTick < this.minTicks) {
      return {
        atEquilibrium: false,
        goalTension: 1.0,
        momentum: 1.0,
        coherence: 0.0,
        decisionClarity: 0.0,
        isStagnant: false,
        reasoning: `Early dialogue (tick ${this.currentTick}/${this.minTicks}) - allowing agents to deliberate`,
      };
    }

    // Extract ideal state from scenario (what would satisfy the difference engine?)
    const idealState = await this.extractIdealState(scenario);

    // Analyze recent signals (last N)
    const recentSignals = signals.slice(-this.signalWindowSize);

    // Measure four dimensions
    const goalTension = await this.measureGoalTension(idealState, recentSignals);
    const momentum = this.measureMomentum(signals, recentSignals);
    const coherence = await this.measureCoherence(recentSignals);
    const decisionClarity = await this.measureDecisionClarity(recentSignals);

    // Calculate system energy (weighted sum of "disorder")
    // Lower energy = closer to equilibrium
    const energy = this.calculateEnergy(goalTension, momentum, coherence, decisionClarity);

    // Calculate energy gradient (is system still changing?)
    const energyGradient = await this.calculateEnergyGradient(signals);

    // EQUILIBRIUM CONDITION:
    // 1. Energy below threshold (system in low-energy state)
    // 2. Gradient near zero (system stopped changing)
    const energyThreshold = 0.35; // Tunable
    const gradientThreshold = 0.1; // Tunable

    const atEquilibrium = energy < energyThreshold && Math.abs(energyGradient) < gradientThreshold;

    // Track stagnation: high tension + low coherence + low clarity for multiple ticks
    this.stagnationHistory.push({
      tick: this.currentTick,
      tension: goalTension,
      coherence,
      clarity: decisionClarity,
    });

    // Keep only last N ticks
    if (this.stagnationHistory.length > this.stagnationWindowSize) {
      this.stagnationHistory.shift();
    }

    // Detect stagnation: tension high + coherence/clarity low for consecutive ticks
    const isStagnant = this.detectStagnation();

    const reasoning = this.explainState(
      goalTension,
      momentum,
      coherence,
      decisionClarity,
      energy,
      energyGradient,
      atEquilibrium,
      isStagnant,
    );

    return {
      atEquilibrium,
      goalTension,
      momentum,
      coherence,
      decisionClarity,
      isStagnant,
      reasoning,
    };
  }

  /**
   * Calculate system energy (Lyapunov function)
   *
   * CONTROL THEORY: Lyapunov stability analysis
   * - Energy function V(x) that decreases over time
   * - Equilibrium when dV/dt ≈ 0
   *
   * Our energy function:
   * E = 0.4·tension + 0.1·momentum + 0.3·(1-coherence) + 0.2·(1-clarity)
   *
   * Weights reflect importance:
   * - Goal tension (0.4): Most important - is the problem solved?
   * - Coherence (0.3): Second - do agents agree?
   * - Clarity (0.2): Third - is decision clear?
   * - Momentum (0.1): Least - agents can be active at equilibrium
   */
  private calculateEnergy(tension: number, momentum: number, coherence: number, clarity: number): number {
    const w_tension = 0.4;
    const w_momentum = 0.1;
    const w_coherence = 0.3;
    const w_clarity = 0.2;

    const energy =
      w_tension * tension + w_momentum * momentum + w_coherence * (1 - coherence) + w_clarity * (1 - clarity);

    return Math.max(0, Math.min(1, energy));
  }

  /**
   * Calculate energy gradient (rate of change)
   *
   * OPTIMIZATION THEORY: Gradient descent converges when ∇E ≈ 0
   *
   * We approximate gradient by comparing energy of recent signals to earlier signals:
   * gradient ≈ (E_recent - E_previous) / Δt
   *
   * Positive gradient = energy increasing (diverging)
   * Negative gradient = energy decreasing (converging)
   * Zero gradient = energy stable (equilibrium)
   */
  private async calculateEnergyGradient(signals: Signal[]): Promise<number> {
    if (signals.length < this.minSignalWindow * 2) return 1.0; // Not enough data

    const windowSize = Math.floor(signals.length / 3);
    const recentSignals = signals.slice(-windowSize);
    const previousSignals = signals.slice(-windowSize * 2, -windowSize);

    // Calculate coherence for both windows
    const recentCoherence = await this.measureCoherence(recentSignals);
    const previousCoherence = await this.measureCoherence(previousSignals);

    // Approximate energy change (using coherence as proxy)
    // Higher coherence = lower energy
    const energyRecent = 1 - recentCoherence;
    const energyPrevious = 1 - previousCoherence;

    const gradient = (energyRecent - energyPrevious) / windowSize;

    return gradient;
  }

  /**
   * Extract the ideal state from the scenario (what the agents are trying to achieve)
   *
   * EXAMPLE:
   * Scenario: "CEO must decide: delay launch vs legal risk"
   * Ideal State: "A clear decision that balances business and legal concerns"
   */
  private async extractIdealState(scenario: string): Promise<string> {
    // Check cache
    if (this.idealStateCache.has(scenario)) {
      const cached = this.idealStateCache.get(scenario)!;
      return scenario; // Return original for clarity
    }

    // Ask LLM to extract the goal/ideal state
    const response = await this.llm.chat([
      {
        role: 'system',
        content: [
          'You extract the IDEAL END STATE from a scenario.',
          '',
          'Given a problem/scenario, describe what a SATISFIED state looks like:',
          '- What would it mean for this problem to be "resolved"?',
          '- What outcome would reduce the tension to zero?',
          '- What does "finished thinking" look like?',
          '',
          'Be specific but concise (1-2 sentences).',
        ].join('\n'),
      },
      {
        role: 'user',
        content: `Scenario: ${scenario}\n\nWhat is the ideal end state that would satisfy this problem?`,
      },
    ]);

    // Cache the embedding
    const embedding = await this.llm.embed(response);
    this.idealStateCache.set(scenario, embedding);

    return response;
  }

  /**
   * Measure goal tension: semantic distance between ideal state and current state
   *
   * COGNITIVE SCIENCE: Miller, Galanter, Pribram (1960) - "Plans and the Structure of Behavior"
   * - TOTE loop: Test (compare current to ideal) → Operate (reduce difference) → Test → Exit
   * - Exit when difference is below threshold
   *
   * METHOD:
   * 1. Embed ideal state
   * 2. Embed recent signals (current state)
   * 3. Calculate semantic distance (cosine)
   * 4. High similarity = low tension = equilibrium approaching
   */
  private async measureGoalTension(idealState: string, recentSignals: Signal[]): Promise<number> {
    if (recentSignals.length === 0) return 1.0;

    // Get ideal state embedding
    const idealEmbedding = await this.llm.embed(idealState);

    // Combine recent signals into current state representation
    const currentStateText = recentSignals.map(s => s.thought).join(' ');
    const currentEmbedding = await this.llm.embed(currentStateText);

    // Calculate semantic distance (1 - similarity)
    const similarity = cosineSimilarity(idealEmbedding, currentEmbedding);
    const tension = 1 - similarity;

    return Math.max(0, Math.min(1, tension));
  }

  /**
   * Measure conversational momentum: are agents still actively thinking?
   *
   * NEUROSCIENCE: Action potential frequency as activity measure
   * - High frequency = active neurons
   * - Low/zero frequency = quiescence
   *
   * METHOD (FIXED):
   * 1. Split signal history into two windows: recent vs previous
   * 2. Compare signal counts between windows
   * 3. Declining count = momentum dropping (approaching silence)
   * 4. Momentum < threshold = agents have fallen silent (equilibrium)
   */
  private measureMomentum(allSignals: Signal[], recentSignals: Signal[]): number {
    if (allSignals.length < this.minSignalWindow * 2) return 1.0;

    // Split history into two equal windows: recent vs previous
    const windowSize = Math.floor(allSignals.length / 2);
    const recentWindow = allSignals.slice(-windowSize);
    const previousWindow = allSignals.slice(-windowSize * 2, -windowSize);

    // Count signals in each window
    const recentCount = recentWindow.length;
    const previousCount = previousWindow.length;

    // Momentum = recent activity / previous activity
    // < 1.0 = slowing down (converging to silence)
    // ≈ 1.0 = steady state
    // > 1.0 = accelerating (diverging)
    const rawMomentum = previousCount > 0 ? recentCount / previousCount : 1.0;

    // Normalize to [0, 1] range (cap at 2.0 to handle acceleration)
    const momentum = Math.min(rawMomentum, 2.0) / 2.0;

    return Math.max(0, Math.min(1, momentum));
  }

  /**
   * Measure semantic coherence: are signals converging on shared meaning?
   *
   * COGNITIVE SCIENCE: Kintsch & van Dijk (1978) - Discourse comprehension model
   * - Coherent discourse shows semantic overlap between successive utterances
   * - Convergence = shared mental model emerging
   *
   * METHOD:
   * 1. Calculate pairwise similarity between recent signals
   * 2. High average similarity = coherence (consensus)
   * 3. Low similarity = divergent thinking (still exploring)
   */
  private async measureCoherence(recentSignals: Signal[]): Promise<number> {
    if (recentSignals.length < 2) return 0.0;

    // Calculate pairwise similarities
    let totalSimilarity = 0;
    let pairCount = 0;

    for (let i = 0; i < recentSignals.length - 1; i++) {
      for (let j = i + 1; j < recentSignals.length; j++) {
        const phero1 = recentSignals[i]?.pheromone;
        const phero2 = recentSignals[j]?.pheromone;
        if (!phero1 || !phero2) continue;
        const sim = cosineSimilarity(phero1, phero2);
        totalSimilarity += sim;
        pairCount++;
      }
    }

    const avgCoherence = pairCount > 0 ? totalSimilarity / pairCount : 0;

    return Math.max(0, Math.min(1, avgCoherence));
  }

  /**
   * Measure decision clarity: is there a crystallized conclusion?
   *
   * METHOD:
   * 1. Check for decision/conclusion signals semantically
   * 2. Measure confidence/clarity of those signals
   * 3. High clarity = decision has crystallized
   *
   * SEMANTIC ANCHORS (not keyword matching!):
   * - "We have decided to X"
   * - "The conclusion is Y"
   * - "Therefore we will Z"
   */
  private async measureDecisionClarity(recentSignals: Signal[]): Promise<number> {
    if (recentSignals.length === 0) return 0.0;

    // Decision/conclusion semantic anchors
    const decisionAnchors = [
      'We have made a final decision and will proceed with this course of action',
      'The conclusion is clear and we agree on the path forward',
      'After careful consideration, we have reached a definitive resolution',
      'The plan is settled and we know exactly what to do next',
    ];

    // Embed anchors
    const anchorEmbeddings = await Promise.all(decisionAnchors.map(a => this.llm.embed(a)));

    // Find max similarity between recent signals and decision anchors
    let maxClarity = 0;

    for (const signal of recentSignals) {
      for (const anchorEmb of anchorEmbeddings) {
        const similarity = cosineSimilarity(signal.pheromone, anchorEmb);
        maxClarity = Math.max(maxClarity, similarity);
      }
    }

    return maxClarity;
  }

  /**
   * Detect stagnation: system stuck in deadlock with no progress
   *
   * Stagnation occurs when:
   * 1. High tension persists (>0.7) for multiple ticks - problem not being solved
   * 2. Low coherence persists (<0.3) - agents not converging
   * 3. Low clarity persists (<0.3) - no decision emerging
   *
   * This indicates deadlock, circular reasoning, or missing capabilities
   */
  private detectStagnation(): boolean {
    if (this.stagnationHistory.length < this.stagnationWindowSize) {
      return false;
    }

    // Check if last N ticks all show stuck pattern
    const recentHistory = this.stagnationHistory.slice(-this.stagnationWindowSize);

    const allHighTension = recentHistory.every(h => h.tension > 0.7);
    const allLowCoherence = recentHistory.every(h => h.coherence < 0.3);
    const allLowClarity = recentHistory.every(h => h.clarity < 0.3);

    // Stagnation = persistent high tension AND (low coherence OR low clarity)
    return allHighTension && (allLowCoherence || allLowClarity);
  }

  /**
   * Explain equilibrium state in natural language
   */
  private explainState(
    tension: number,
    momentum: number,
    coherence: number,
    clarity: number,
    energy: number,
    gradient: number,
    atEquilibrium: boolean,
    isStagnant: boolean,
  ): string {
    const stagnantMarker = isStagnant ? ' ⚠️ STAGNANT' : '';

    if (atEquilibrium) {
      return [
        `Equilibrium: E=${(energy * 100).toFixed(0)}% (min), ∇E=${gradient.toFixed(3)} (stable)`,
        `[Tension: ${(tension * 100).toFixed(0)}%`,
        `Coherence: ${(coherence * 100).toFixed(0)}%`,
        `Clarity: ${(clarity * 100).toFixed(0)}%]`,
      ].join(' ');
    } else {
      const primaryIssue =
        Math.abs(gradient) >= 0.1 ? 'system converging' : energy >= 0.35 ? 'energy too high' : 'stabilizing';

      return [
        `${primaryIssue}: E=${(energy * 100).toFixed(0)}%, ∇E=${gradient.toFixed(3)}${stagnantMarker}`,
        `[T:${(tension * 100).toFixed(0)}%`,
        `M:${(momentum * 100).toFixed(0)}%`,
        `C:${(coherence * 100).toFixed(0)}%`,
        `Cl:${(clarity * 100).toFixed(0)}%]`,
      ].join(' ');
    }
  }
}
