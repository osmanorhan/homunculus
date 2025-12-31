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

import type { Signal, HomunculusAgent } from '@homunculus-live/core';
import { cosineSimilarity } from '@homunculus-live/core';

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
   * Semantic saturation: are agents repeating themselves? (0-1)
   * 0 = exploring new ideas, 1 = stuck in semantic loop
   *
   * SCIENTIFIC FOUNDATION (Information Theory + Signal Processing):
   * - Shannon entropy: Measures information diversity in signal space
   * - Self-similarity matrix: Detects temporal recurrence patterns
   * - Combined score: saturation = 0.5·(1-entropy) + 0.5·repetition
   *
   * High saturation indicates agents are semantically exhausted
   */
  semanticSaturation: number;

  /**
   * Is the system stagnant? (stuck in a loop with no progress)
   * True if high tension + low coherence for multiple ticks
   */
  isStagnant: boolean;

  /**
   * Explanation of why equilibrium was reached (or not)
   */
  reasoning: string;

  /**
   * Ambient state directive for agent injection
   *
   * This is injected into agent context to give real-time awareness:
   * >>> AMBIENT STATE: DELTA = 12% ↓, SATURATION = 45% (CONVERGING)
   * >>> DIRECTIVE: Consensus is forming. Consider summarizing the decision.
   */
  ambientDirective: string;
}

/**
 * Equilibrium detection mode
 *
 * - 'deliberation': Multi-agent consensus (uses all factors: tension, coherence, clarity, momentum)
 * - 'task-completion': Goal achievement for coding tasks (uses tension + reality-feedback clarity only)
 */
export type EquilibriumMode = 'deliberation' | 'task-completion';

export interface EquilibriumDetectorConfig {
  llm: {
    embed(text: string): Promise<number[]>;
    chat(
      messages: Array<{ role: string; content: string | null; tool_calls?: any[]; tool_call_id?: string }>,
      options?: { tools?: any[] }
    ): Promise<{ role: string; content: string | null; tool_calls?: any[] }>;
  };

  /**
   * Detection mode (default: 'deliberation')
   * - 'deliberation': For multi-agent discussions requiring consensus
   * - 'task-completion': For coding tasks where goal achievement matters most
   */
  mode?: EquilibriumMode;

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

  /**
   * Semantic saturation parameters (Information Theory + Signal Processing)
   */

  /**
   * Window size for entropy calculation (default: 20)
   * Larger window = more stable entropy, slower to detect saturation
   */
  saturationEntropyWindow?: number;

  /**
   * Window size for self-similarity matrix (default: 15)
   * Larger window = more recurrence patterns detected
   */
  saturationSimilarityWindow?: number;

  /**
   * Cosine similarity threshold for clustering/repetition (default: 0.75)
   * Higher = stricter definition of "similar"
   */
  repetitionSimilarityThreshold?: number;

  /**
   * Minimum lag for self-similarity detection (default: 3)
   * Prevents counting adjacent signals as repetition (natural conversation flow)
   */
  repetitionMinLag?: number;
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
  private readonly mode: EquilibriumMode;
  private readonly minSignalWindow: number;
  private readonly minTicks: number;
  private readonly tensionThreshold: number;
  private readonly momentumThreshold: number;
  private readonly coherenceThreshold: number;
  private readonly clarityThreshold: number;

  // Semantic saturation parameters
  private readonly saturationEntropyWindow: number;
  private readonly saturationSimilarityWindow: number;
  private readonly repetitionSimilarityThreshold: number;
  private readonly repetitionMinLag: number;

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
    this.mode = config.mode ?? 'deliberation';
    this.minSignalWindow = config.minSignalWindow ?? 5;
    this.minTicks = config.minTicks ?? 5;
    this.tensionThreshold = config.tensionThreshold ?? 0.3;
    this.momentumThreshold = config.momentumThreshold ?? 0.2;
    this.coherenceThreshold = config.coherenceThreshold ?? 0.7;
    this.clarityThreshold = config.clarityThreshold ?? 0.6;

    // Semantic saturation defaults
    this.saturationEntropyWindow = config.saturationEntropyWindow ?? 20;
    this.saturationSimilarityWindow = config.saturationSimilarityWindow ?? 15;
    this.repetitionSimilarityThreshold = config.repetitionSimilarityThreshold ?? 0.75;
    this.repetitionMinLag = config.repetitionMinLag ?? 3;
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
  async detect(scenario: string, signals: Signal[], agents: HomunculusAgent[]): Promise<EquilibriumState> {
    this.currentTick++;

    // Not enough data yet - require both minimum signals AND minimum ticks
    if (signals.length < this.minSignalWindow) {
      return {
        atEquilibrium: false,
        goalTension: 1.0,
        momentum: 1.0,
        coherence: 0.0,
        decisionClarity: 0.0,
        semanticSaturation: 0.0,
        isStagnant: false,
        reasoning: 'Insufficient signal history to detect equilibrium',
        ambientDirective: '>>> AMBIENT STATE: INITIALIZING\n>>> DIRECTIVE: Begin exploring the problem space.',
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
        semanticSaturation: 0.0,
        isStagnant: false,
        reasoning: `Early dialogue (tick ${this.currentTick}/${this.minTicks}) - allowing agents to deliberate`,
        ambientDirective: '>>> AMBIENT STATE: EARLY DELIBERATION\n>>> DIRECTIVE: Continue exploring. Consensus not yet required.',
      };
    }

    // Extract ideal state from scenario (what would satisfy the difference engine?)
    const idealState = await this.extractIdealState(scenario);

    // Analyze recent signals (last N)
    const recentSignals = signals.slice(-this.signalWindowSize);

    // Measure five dimensions
    const goalTension = await this.measureGoalTension(idealState, recentSignals);
    const momentum = this.measureMomentum(signals, recentSignals);
    const coherence = await this.measureCoherence(recentSignals);
    const decisionClarity = await this.measureDecisionClarity(recentSignals);

    // NEW: Measure semantic saturation (5th dimension)
    const saturationMetrics = await this.measureSemanticSaturation(recentSignals);
    const semanticSaturation = saturationMetrics.saturation;

    // Calculate system energy (weighted sum of "disorder")
    // Lower energy = closer to equilibrium
    const energy = this.calculateEnergy(goalTension, momentum, coherence, decisionClarity, semanticSaturation);

    // Calculate semantic delta (rate of information change)
    const deltaMetrics = await this.calculateSemanticDelta(signals);
    const semanticDelta = deltaMetrics.currentDelta;
    const deltaTrend = deltaMetrics.trend;

    // EQUILIBRIUM CONDITION (Delta-Based):
    // Instead of Lyapunov energy gradient (flawed for multi-agent systems),
    // we use semantic delta to detect when agents stop discovering new information
    //
    // High Delta (> 0.3): Agents discovering facts, changing minds → CONTINUE
    // Low Delta (< 0.15): Agents refining wording, repeating → EQUILIBRIUM
    // Negative trend + high saturation: Agents looping → HARD STOP
    //
    // Combined condition:
    // - Low semantic delta (agents not saying new things)
    // - OR high saturation (agents repeating themselves)
    // - OR low energy (traditional Lyapunov as backup)

    const deltaThreshold = 0.15; // Low delta = equilibrium
    const lowDelta = semanticDelta < deltaThreshold;
    const highSaturation = semanticSaturation > 0.6;
    const lowEnergy = energy < 0.3;

    // Equilibrium when: low delta OR (high saturation AND not discovering)
    const atEquilibrium = lowDelta || (highSaturation && deltaTrend !== 'increasing') || lowEnergy;

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
      semanticDelta,
      deltaTrend,
      atEquilibrium,
      isStagnant,
    );

    // Format ambient directive for agent injection
    const ambientDirective = this.formatAmbientDirective(
      semanticDelta,
      deltaTrend,
      semanticSaturation,
      goalTension,
      coherence,
    );

    return {
      atEquilibrium,
      goalTension,
      momentum,
      coherence,
      decisionClarity,
      semanticSaturation,
      isStagnant,
      reasoning,
      ambientDirective,
    };
  }

  /**
   * Calculate system energy (Lyapunov function)
   *
   * CONTROL THEORY: Lyapunov stability analysis
   * - Energy function V(x) that decreases over time
   * - Equilibrium when dV/dt ≈ 0
   *
   * MODE-AWARE ENERGY FUNCTIONS:
   *
   * DELIBERATION MODE (5 dimensions):
   * E = 0.3·tension + 0.1·momentum + 0.2·(1-coherence) + 0.2·(1-clarity) + 0.2·saturation
   * - Goal tension (0.3): Most important - is the problem solved?
   * - Coherence (0.2): Do agents agree?
   * - Clarity (0.2): Is decision clear?
   * - Saturation (0.2): Are agents repeating themselves?
   * - Momentum (0.1): Least - agents can be active at equilibrium
   *
   * TASK-COMPLETION MODE (3 dimensions):
   * E = 0.6·tension + 0.2·(1-clarity) + 0.2·saturation
   * - Goal tension (0.6): PRIMARY - is the task done?
   * - Clarity (0.2): SECONDARY - are tool results clear?
   * - Saturation (0.2): Are agents repeating?
   * - Ignore momentum/coherence - agents can keep talking/disagreeing after task is done
   */
  private calculateEnergy(
    tension: number,
    momentum: number,
    coherence: number,
    clarity: number,
    saturation: number,
  ): number {
    if (this.mode === 'task-completion') {
      // CODING TASK MODE: tension + clarity + saturation matter
      const w_tension = 0.6;
      const w_clarity = 0.2;
      const w_saturation = 0.2;

      const energy = w_tension * tension + w_clarity * (1 - clarity) + w_saturation * saturation;
      return Math.max(0, Math.min(1, energy));
    } else {
      // DELIBERATION MODE: All 5 factors matter
      const w_tension = 0.3;
      const w_momentum = 0.1;
      const w_coherence = 0.2;
      const w_clarity = 0.2;
      const w_saturation = 0.2;

      const energy =
        w_tension * tension +
        w_momentum * momentum +
        w_coherence * (1 - coherence) +
        w_clarity * (1 - clarity) +
        w_saturation * saturation;

      return Math.max(0, Math.min(1, energy));
    }
  }

  /**
   * Calculate semantic delta: rate of information change between consecutive signals
   *
   * INFORMATION DYNAMICS (Not Lyapunov!):
   * - High Delta (> 0.3): Agents discovering new facts, changing minds → CONTINUE
   * - Low Delta (< 0.15): Agents refining wording, repeating → EQUILIBRIUM
   * - Zero/Negative Delta: Agents looping, stuck → HARD STOP
   *
   * METHOD:
   * 1. Calculate pairwise dissimilarity (1 - similarity) between consecutive signals
   * 2. Average the deltas over recent window
   * 3. Compare to previous window to detect trend
   *
   * This captures: Are agents saying NEW things or just rephrasing?
   */
  private async calculateSemanticDelta(signals: Signal[]): Promise<{
    currentDelta: number;
    deltaRage: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }> {
    if (signals.length < this.minSignalWindow) {
      return { currentDelta: 1.0, deltaRage: 0, trend: 'stable' };
    }

    // Split into recent and previous windows
    const windowSize = Math.min(10, Math.floor(signals.length / 2));
    const recentSignals = signals.slice(-windowSize);
    const previousSignals = signals.slice(-windowSize * 2, -windowSize);

    // Calculate average delta in recent window
    const recentDelta = this.measureWindowDelta(recentSignals);

    // Calculate average delta in previous window
    const previousDelta =
      previousSignals.length >= 2 ? this.measureWindowDelta(previousSignals) : recentDelta;

    // Delta rate: how fast is delta changing?
    const deltaRage = recentDelta - previousDelta;

    // Trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (deltaRage > 0.05) trend = 'increasing';
    else if (deltaRage < -0.05) trend = 'decreasing';

    return { currentDelta: recentDelta, deltaRage, trend };
  }

  /**
   * Measure average semantic delta (dissimilarity) in a window of signals
   *
   * Compares consecutive pairs: signal[i] vs signal[i+1]
   * Returns average dissimilarity (1 - similarity)
   */
  private measureWindowDelta(signals: Signal[]): number {
    if (signals.length < 2) return 1.0;

    let totalDelta = 0;
    let pairCount = 0;

    for (let i = 0; i < signals.length - 1; i++) {
      const phero1 = signals[i]?.pheromone;
      const phero2 = signals[i + 1]?.pheromone;

      if (!phero1 || !phero2 || phero1.length === 0 || phero2.length === 0) {
        continue;
      }

      const similarity = cosineSimilarity(phero1, phero2);
      const delta = 1 - similarity; // Dissimilarity

      totalDelta += delta;
      pairCount++;
    }

    return pairCount > 0 ? totalDelta / pairCount : 1.0;
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

    const idealState = response.content ?? scenario;

    // Cache the embedding
    const embedding = await this.llm.embed(idealState);
    this.idealStateCache.set(scenario, embedding);

    return idealState;
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
    // CRITICAL: Limit length to prevent context overflow in embedding model
    // Use only last few signals and truncate each to reasonable length
    const maxSignalsToEmbed = 5;
    const maxCharsPerSignal = 200;
    const relevantSignals = recentSignals
      .slice(-maxSignalsToEmbed)
      .map(s => s.thought.substring(0, maxCharsPerSignal));

    const currentStateText = relevantSignals.join(' ');

    // Additional safety: truncate combined text if still too long
    const maxTotalChars = 1000; // Safe limit for most embedding models
    const safeText = currentStateText.substring(0, maxTotalChars);

    const currentEmbedding = await this.llm.embed(safeText);

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
   * 1. Check for reality-feedback signals (tool results) - STRONGEST clarity
   * 2. Check for decision/conclusion signals semantically
   * 3. Measure confidence/clarity of those signals
   * 4. High clarity = decision has crystallized
   *
   * ENHANCEMENT: Tool execution results are the STRONGEST clarity signal
   * Reality-feedback signals (from tool execution) indicate concrete outcomes,
   * not agent hallucinations. These get a clarity boost.
   *
   * SEMANTIC ANCHORS (not keyword matching!):
   * - Success: "Task completed successfully", "Files created and saved"
   * - Decision: "We have decided to X", "The conclusion is Y"
   */
  private async measureDecisionClarity(recentSignals: Signal[]): Promise<number> {
    if (recentSignals.length === 0) return 0.0;

    // ENHANCEMENT: Tool execution results provide strongest clarity
    // Filter for reality-feedback signals (tool results)
    const realitySignals = recentSignals.filter(
      s => s.inferredIntent === 'REALITY_FEEDBACK' || s.inferredTags?.includes('tool-result'),
    );

    if (realitySignals.length > 0) {
      // Success pattern anchors for tool results
      const successAnchors = [
        'Task completed successfully without errors',
        'Files created and saved to disk',
        'Command executed with exit code zero',
        'Installation completed successfully',
        'Tests passing with no failures',
        'Application built and ready to run',
      ];

      // Failure pattern anchors - these indicate work is NOT complete
      const failureAnchors = [
        'Command failed with non-zero exit code',
        'Error occurred during execution',
        'Installation failed with errors',
        'Tests failed with errors',
        'Build process encountered errors',
        'Operation completed with exit code 1',
      ];

      const successEmbeddings = await Promise.all(successAnchors.map(a => this.llm.embed(a)));
      const failureEmbeddings = await Promise.all(failureAnchors.map(a => this.llm.embed(a)));

      let maxSuccessClarity = 0;
      let maxFailureClarity = 0;

      for (const signal of realitySignals) {
        // Check success patterns
        for (const anchorEmb of successEmbeddings) {
          const similarity = cosineSimilarity(signal.pheromone, anchorEmb);
          maxSuccessClarity = Math.max(maxSuccessClarity, similarity);
        }

        // Check failure patterns
        for (const anchorEmb of failureEmbeddings) {
          const similarity = cosineSimilarity(signal.pheromone, anchorEmb);
          maxFailureClarity = Math.max(maxFailureClarity, similarity);
        }
      }

      // If we detect strong failure signals, return LOW clarity (task not complete)
      // This prevents equilibrium when commands are failing
      if (maxFailureClarity > 0.5) {
        return Math.max(0, maxSuccessClarity - maxFailureClarity * 0.8);
      }

      // Boost reality-feedback clarity by 1.5x (but cap at 1.0)
      // Tool results are trusted reality, not agent thoughts
      return Math.min(1.0, maxSuccessClarity * 1.5);
    }

    // Fallback: Check for decision/conclusion signals
    const decisionAnchors = [
      'We have made a final decision and will proceed with this course of action',
      'The conclusion is clear and we agree on the path forward',
      'After careful consideration, we have reached a definitive resolution',
      'The plan is settled and we know exactly what to do next',
    ];

    const anchorEmbeddings = await Promise.all(decisionAnchors.map(a => this.llm.embed(a)));

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
    semanticDelta: number,
    deltaTrend: 'increasing' | 'decreasing' | 'stable',
    atEquilibrium: boolean,
    isStagnant: boolean,
  ): string {
    const stagnantMarker = isStagnant ? ' ⚠️ STAGNANT' : '';
    const trendArrow = deltaTrend === 'increasing' ? '↑' : deltaTrend === 'decreasing' ? '↓' : '→';

    if (atEquilibrium) {
      // Determine why equilibrium was reached
      const reason =
        semanticDelta < 0.15
          ? 'low delta (agents converged)'
          : coherence > 0.7
            ? 'high coherence'
            : 'energy minimum';

      return [
        `Equilibrium: ${reason}`,
        `Δ=${(semanticDelta * 100).toFixed(0)}%${trendArrow}`,
        `E=${(energy * 100).toFixed(0)}%`,
        `[T:${(tension * 100).toFixed(0)}%`,
        `C:${(coherence * 100).toFixed(0)}%`,
        `Cl:${(clarity * 100).toFixed(0)}%]`,
      ].join(' ');
    } else {
      // Determine what's preventing equilibrium
      const primaryIssue =
        semanticDelta > 0.3
          ? 'high delta (discovering)'
          : deltaTrend === 'increasing'
            ? 'delta rising (exploring)'
            : tension > 0.5
              ? 'high tension'
              : 'converging';

      return [
        `${primaryIssue}${stagnantMarker}`,
        `Δ=${(semanticDelta * 100).toFixed(0)}%${trendArrow}`,
        `E=${(energy * 100).toFixed(0)}%`,
        `[T:${(tension * 100).toFixed(0)}%`,
        `M:${(momentum * 100).toFixed(0)}%`,
        `C:${(coherence * 100).toFixed(0)}%`,
        `Cl:${(clarity * 100).toFixed(0)}%]`,
      ].join(' ');
    }
  }

  /**
   * Format ambient state directive for agent injection
   *
   * This creates the [BIOSPHERE_INJECTION] message that agents receive
   * to gain awareness of the conversation state.
   *
   * Format inspired by user request:
   * >>> AMBIENT STATE: SATURATION = 95% (STAGNANT)
   * >>> DIRECTIVE: The Council is looping. Do not propose new ideas. Call for a Vote or Synthesize the Plan.
   */
  formatAmbientDirective(
    semanticDelta: number,
    deltaTrend: 'increasing' | 'decreasing' | 'stable',
    semanticSaturation: number,
    goalTension: number,
    coherence: number,
  ): string {
    const deltaPercent = (semanticDelta * 100).toFixed(0);
    const saturationPercent = (semanticSaturation * 100).toFixed(0);
    const trendArrow = deltaTrend === 'increasing' ? '↑' : deltaTrend === 'decreasing' ? '↓' : '→';

    // Determine state label
    let stateLabel = 'ACTIVE';
    if (semanticSaturation > 0.75) stateLabel = 'STAGNANT';
    else if (semanticSaturation > 0.6) stateLabel = 'SATURATED';
    else if (deltaTrend === 'decreasing' && coherence > 0.7) stateLabel = 'CONVERGING';
    else if (deltaTrend === 'increasing') stateLabel = 'EXPLORING';

    // Build ambient state line
    const ambientState = `>>> AMBIENT STATE: DELTA = ${deltaPercent}% ${trendArrow}, SATURATION = ${saturationPercent}% (${stateLabel})`;

    // Build directive based on state
    let directive = '';

    if (semanticSaturation > 0.75 && deltaTrend !== 'increasing') {
      // STAGNANT: Agents are looping, need to wrap up
      directive = '>>> DIRECTIVE: The Council is looping. Do not propose new ideas. Do not spawn agents. You must Call for a Vote or Synthesize the Plan.';
    } else if (semanticSaturation > 0.6 && semanticDelta < 0.2) {
      // SATURATED: Agents repeating themselves
      directive = '>>> DIRECTIVE: You are repeating prior arguments. Do not spawn new agents. Either introduce NEW evidence or move to conclude.';
    } else if (deltaTrend === 'decreasing' && coherence > 0.7 && goalTension < 0.4) {
      // CONVERGING: Agreement forming
      directive = '>>> DIRECTIVE: Consensus is forming. Do not spawn new agents. Consider summarizing the agreed-upon decision.';
    } else if (semanticDelta > 0.3 && deltaTrend === 'increasing') {
      // EXPLORING: Active discovery
      directive = '>>> DIRECTIVE: Active discovery phase. Continue exploring the problem space. Spawn specialized agents if needed.';
    } else {
      // NEUTRAL: No special directive
      directive = '>>> DIRECTIVE: Continue deliberating. Strive for consensus.';
    }

    return `${ambientState}\n${directive}`;
  }

  /**
   * Measure semantic saturation: are agents repeating themselves?
   *
   * SCIENTIFIC FOUNDATION:
   * - Information Theory (Shannon Entropy): Measures information diversity
   * - Signal Processing (Self-Similarity Matrix): Detects temporal recurrence
   *
   * COMBINED APPROACH:
   * - Entropy: Clusters signals and measures distribution diversity
   * - Repetition: Detects similar signals separated by time lag
   * - Saturation = 0.5·(1-entropy) + 0.5·repetition
   *
   * High saturation = agents semantically exhausted (broken record)
   * Low saturation = agents exploring new ideas
   */
  private async measureSemanticSaturation(
    recentSignals: Signal[],
  ): Promise<{
    saturation: number;
    entropy: number;
    repetition: number;
  }> {
    if (recentSignals.length < this.repetitionMinLag + 1) {
      return { saturation: 0, entropy: 1.0, repetition: 0 };
    }

    // Measure entropy (information diversity)
    const entropyMetrics = await this.measureSemanticEntropy(recentSignals, this.saturationEntropyWindow);

    // Measure self-similarity (temporal recurrence)
    const similarityMetrics = await this.measureSelfSimilarity(
      recentSignals,
      this.saturationSimilarityWindow,
      this.repetitionSimilarityThreshold,
      this.repetitionMinLag,
    );

    // Combine: saturation = (1 - entropy) + repetition
    // Low entropy → high saturation
    // High repetition → high saturation
    const entropySaturation = 1 - entropyMetrics.normalizedEntropy;
    const repetitionSaturation = similarityMetrics.repetitionScore;

    const saturation = entropySaturation * 0.5 + repetitionSaturation * 0.5;

    return {
      saturation: Math.max(0, Math.min(1, saturation)),
      entropy: entropyMetrics.normalizedEntropy,
      repetition: repetitionSaturation,
    };
  }

  /**
   * Measure semantic entropy using clustering-based approach
   *
   * SHANNON ENTROPY (Information Theory):
   * H = -Σ p(i) * log₂(p(i))
   *
   * METHOD:
   * 1. Cluster signal embeddings by similarity (threshold: 0.85)
   * 2. Calculate probability distribution over clusters
   * 3. Compute Shannon entropy
   * 4. Normalize to [0,1]
   *
   * High entropy = diverse signals (agents exploring)
   * Low entropy = clustered signals (agents repeating)
   */
  private async measureSemanticEntropy(
    recentSignals: Signal[],
    windowSize: number,
  ): Promise<{
    entropy: number;
    normalizedEntropy: number;
    entropyGradient: number;
  }> {
    const window = recentSignals.slice(-windowSize);

    if (window.length < 3) {
      return { entropy: 1.0, normalizedEntropy: 1.0, entropyGradient: 0 };
    }

    // Extract pheromones (embeddings)
    const embeddings = window.map(s => s.pheromone).filter(p => p && p.length > 0);

    if (embeddings.length < 3) {
      return { entropy: 1.0, normalizedEntropy: 1.0, entropyGradient: 0 };
    }

    // Cluster by similarity (high threshold = same cluster)
    const clusters = this.clusterBySimilarity(embeddings, 0.85);

    // Calculate probability distribution
    const N = embeddings.length;
    const probs = clusters.map(cluster => cluster.length / N);

    // Shannon entropy
    let entropy = 0;
    for (const p of probs) {
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }

    // Normalize to [0, 1]
    const maxEntropy = Math.log2(N);
    const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

    // Gradient (for now, return 0 - can enhance later if needed)
    const entropyGradient = 0;

    return { entropy, normalizedEntropy, entropyGradient };
  }

  /**
   * Measure self-similarity: detect temporal recurrence in signals
   *
   * SIGNAL PROCESSING (Self-Similarity Matrix):
   * - Build NxN similarity matrix of signals
   * - Find high-similarity pairs separated by minimum lag
   * - Repetition score = fraction of repetitive pairs
   *
   * METHOD:
   * 1. For each pair (i, j) where j > i + minLag
   * 2. Calculate cosine similarity
   * 3. Count pairs above threshold
   * 4. Return: count / total_pairs
   *
   * High repetition = agents repeating previous statements
   * Low repetition = each signal is novel
   */
  private async measureSelfSimilarity(
    recentSignals: Signal[],
    windowSize: number,
    similarityThreshold: number,
    minLag: number,
  ): Promise<{
    repetitionScore: number;
    maxRecurrence: number;
    recurrenceCount: number;
  }> {
    const window = recentSignals.slice(-windowSize);

    if (window.length < minLag + 1) {
      return { repetitionScore: 0, maxRecurrence: 0, recurrenceCount: 0 };
    }

    // Build self-similarity matrix
    let recurrenceCount = 0;
    let maxRecurrence = 0;
    let totalPairs = 0;

    for (let i = 0; i < window.length; i++) {
      for (let j = i + minLag; j < window.length; j++) {
        const phero1 = window[i]?.pheromone;
        const phero2 = window[j]?.pheromone;

        if (!phero1 || !phero2 || phero1.length === 0 || phero2.length === 0) {
          continue;
        }

        const similarity = cosineSimilarity(phero1, phero2);

        maxRecurrence = Math.max(maxRecurrence, similarity);

        if (similarity >= similarityThreshold) {
          recurrenceCount++;
        }

        totalPairs++;
      }
    }

    const repetitionScore = totalPairs > 0 ? recurrenceCount / totalPairs : 0;

    return { repetitionScore, maxRecurrence, recurrenceCount };
  }

  /**
   * Cluster embeddings by cosine similarity
   *
   * GREEDY CLUSTERING ALGORITHM:
   * - For each embedding, check if it's similar to existing cluster centroids
   * - If yes: add to cluster, update centroid (running average)
   * - If no: create new cluster
   *
   * Returns: Array of clusters (each cluster is array of indices)
   */
  private clusterBySimilarity(embeddings: number[][], threshold: number): number[][] {
    const clusters: number[][] = []; // Each cluster stores indices
    const centroids: number[][] = [];

    for (let i = 0; i < embeddings.length; i++) {
      const emb = embeddings[i];
      if (!emb || emb.length === 0) continue;

      let assigned = false;

      // Try to assign to existing cluster
      for (let c = 0; c < centroids.length; c++) {
        const centroid = centroids[c];
        const cluster = clusters[c];
        if (!centroid || !cluster) continue;

        const similarity = cosineSimilarity(emb, centroid);
        if (similarity >= threshold) {
          cluster.push(i);
          // Update centroid (running average)
          centroids[c] = this.updateCentroid(centroid, emb, cluster.length);
          assigned = true;
          break;
        }
      }

      // Create new cluster
      if (!assigned) {
        clusters.push([i]);
        centroids.push([...emb]);
      }
    }

    return clusters;
  }

  /**
   * Update cluster centroid using incremental average
   *
   * RUNNING AVERAGE:
   * new_centroid = (old_centroid * (n-1) + new_vector) / n
   *
   * This avoids storing all vectors in memory
   */
  private updateCentroid(currentCentroid: number[], newVector: number[], clusterSize: number): number[] {
    return currentCentroid.map((val, i) => (val * (clusterSize - 1) + (newVector[i] ?? 0)) / clusterSize);
  }
}
