import terminalKit from 'terminal-kit';

const term = terminalKit.terminal;

// Types
type LogType = 'thought' | 'decision' | 'recommendation' | 'spawn' | 'system';

type SignalLog = {
  tick: number;
  actor: string;
  text: string;
  type: LogType;
  receivers?: string[];
};

type AgentSnapshot = {
  id: string;
  name: string;
  concerns: string[];
  bornTick: number;
  emergent?: boolean;
  lastActivity?: string;
  lastActivityTick?: number;
};

type SummaryData = {
  agents: AgentSnapshot[];
  decisions: string[];
  recommendations: string[];
  finalDecision: string | null;
  stats: { agents: number; signals: number; ticks: number };
};

export class NeonTui {
  private scenario: string;
  private config: { baseURL: string; model: string; embeddingModel: string };
  private agents = new Map<string, AgentSnapshot>();
  private logs: SignalLog[] = [];
  private tick = 0;
  private signalCount = 0;
  private status = 'booting';
  private bannerMessage = 'Initializing neon grid';
  private createdAt = Date.now();
  private metrics = { decisions: 0, recommendations: 0, spawns: 0, score: 0, chaos: 12 };
  private highlights: { decision: SignalLog | null; recommendation: SignalLog | null; spawn: SignalLog | null } = {
    decision: null,
    recommendation: null,
    spawn: null,
  };
  private summary?: SummaryData;
  private mode: 'scenario' | 'live' | 'complete' = 'scenario';
  private running = true;

  constructor(options: { scenario: string; config: { baseURL: string; model: string; embeddingModel: string } }) {
    this.scenario = options.scenario;
    this.config = options.config;

    // Setup terminal
    term.fullscreen(true);
    term.hideCursor();
    term.grabInput({ mouse: false });

    // Handle exit
    term.on('key', (name: string) => {
      if (name === 'CTRL_C' || name === 'q' || name === 'ESCAPE') {
        this.stop();
        process.exit(0);
      }
    });

    // Initial render
    this.render();
  }

  async awaitScenario(defaultScenario: string): Promise<string> {
    this.mode = 'live';
    this.scenario = defaultScenario;
    this.bannerMessage = 'Scenario locked. Running biosphere...';
    this.render();
    return defaultScenario;
  }

  setStatus(status: string, banner?: string) {
    this.status = status;
    if (banner) this.bannerMessage = banner;
    this.render();
  }

  setTick(tick: number, signalCount: number) {
    this.tick = tick;
    this.signalCount = signalCount;
    this.render();
  }

  setMetrics(update: Partial<typeof this.metrics>) {
    this.metrics = { ...this.metrics, ...update };
    this.render();
  }

  addAgent(agent: AgentSnapshot) {
    this.agents.set(agent.id, agent);
    this.logs.push({
      tick: agent.bornTick,
      actor: agent.name,
      text: agent.emergent ? 'Emergent agent deployed' : 'Agent born',
      type: agent.emergent ? 'spawn' : 'system',
    });
    this.trimLogs();
    this.render();
  }

  addSignal(log: SignalLog) {
    this.logs.push(log);
    this.trimLogs();

    if (log.type === 'decision') this.highlights.decision = log;
    if (log.type === 'recommendation') this.highlights.recommendation = log;
    if (log.type === 'spawn') this.highlights.spawn = log;

    // Update agent's last activity
    const agent = Array.from(this.agents.values()).find(a => a.name === log.actor);
    if (agent) {
      agent.lastActivity = log.text.slice(0, 60);
      agent.lastActivityTick = log.tick;
    }

    this.render();
  }

  showSummary(summary: SummaryData) {
    this.summary = summary;
    this.status = 'complete';
    this.mode = 'complete';
    this.bannerMessage = 'Emergence run complete';
    this.render();
  }

  updateBanner(text: string) {
    this.bannerMessage = text;
    this.render();
  }

  async waitForExit(): Promise<void> {
    return new Promise((resolve) => {
      // Update footer to show exit instructions
      term.moveTo(1, term.height);
      term.eraseLine();
      term.green.bold('Press any key to exit...');

      // Set up one-time key listener
      const keyHandler = () => {
        term.removeListener('key', keyHandler);
        this.stop();
        resolve();
      };

      term.once('key', keyHandler);
    });
  }

  stop() {
    if (this.running) {
      this.running = false;
      term.hideCursor(false); // Show cursor
      term.fullscreen(false);
      term.grabInput(false);
      term('\n');
    }
  }

  private trimLogs() {
    if (this.logs.length > 200) {
      this.logs = this.logs.slice(this.logs.length - 200);
    }
  }

  private truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    if (maxLen <= 3) return text.slice(0, maxLen);
    return text.slice(0, maxLen - 3) + '...';
  }

  render() {
    if (!this.running) return;

    const width = term.width;
    const height = term.height;

    // Clear and position at top
    term.clear();
    term.moveTo(1, 1);

    let line = 1;

    // Header section
    term.magenta.bold('╔═══ HOMUNCULUS // CEO EMERGENCE ═══╗\n');
    line++;

    const uptime = ((Date.now() - this.createdAt) / 1000).toFixed(1);
    term.cyan('Status: ');
    term.white(`${this.status} | `);
    term.cyan('Tick: ');
    term.white(`${this.tick.toString().padStart(3, '0')} | `);
    term.cyan('Signals: ');
    term.white(`${this.signalCount.toString().padStart(3, '0')} | `);
    term.cyan('Uptime: ');
    term.white(`${uptime}s\n`);
    line++;

    term.gray('Model: ');
    term.white(`${this.config.model} | `);
    term.gray('Embed: ');
    term.white(`${this.config.embeddingModel}\n`);
    line++;

    term.gray('Base: ');
    term.white(this.truncate(this.config.baseURL, width - 10) + '\n');
    line++;

    term.green('Metrics: ');
    term.white(`Score ${this.metrics.score} | DEC ${this.metrics.decisions} | REC ${this.metrics.recommendations} | SPN ${this.metrics.spawns} | `);
    term.yellow(`Chaos ${this.metrics.chaos}%\n`);
    line++;

    term.blue('Activity: ');
    term.white(this.truncate(this.bannerMessage, width - 15) + '\n');
    line++;

    term.gray('─'.repeat(width) + '\n');
    line++;

    // Scenario section
    term.cyan.bold('SCENARIO ');
    term.gray(this.mode === 'scenario' ? '(EDITING)' : '(LOCKED)');
    term('\n');
    line++;
    term.white(this.truncate(this.scenario, width - 2) + '\n');
    line++;
    term.gray('─'.repeat(width) + '\n');
    line++;

    // Highlights section (live mode only)
    if (this.mode === 'live') {
      term.green.bold('HIGHLIGHTS\n');
      line++;

      term.yellow('DECISION:  ');
      if (this.highlights.decision) {
        term.white(`t${this.highlights.decision.tick.toString().padStart(3, '0')} ${this.highlights.decision.actor}: ${this.truncate(this.highlights.decision.text, width - 20)}\n`);
      } else {
        term.gray('none yet\n');
      }
      line++;

      term.green('RECOMMEND: ');
      if (this.highlights.recommendation) {
        term.white(`t${this.highlights.recommendation.tick.toString().padStart(3, '0')} ${this.highlights.recommendation.actor}: ${this.truncate(this.highlights.recommendation.text, width - 20)}\n`);
      } else {
        term.gray('none yet\n');
      }
      line++;

      term.color256(208)('SPAWN:     '); // Orange color
      if (this.highlights.spawn) {
        term.white(`t${this.highlights.spawn.tick.toString().padStart(3, '0')} ${this.highlights.spawn.actor}: ${this.truncate(this.highlights.spawn.text, width - 20)}\n`);
      } else {
        term.gray('none yet\n');
      }
      line++;

      term.gray('─'.repeat(width) + '\n');
      line++;
    }

    // Agents section
    const agentList = Array.from(this.agents.values()).sort((a, b) => {
      const aActivity = a.lastActivityTick ?? a.bornTick;
      const bActivity = b.lastActivityTick ?? b.bornTick;
      return bActivity - aActivity;
    });

    const emergentCount = agentList.filter(a => a.emergent).length;
    term.yellow.bold(`AGENTS (${this.agents.size} total, ${emergentCount} emergent)\n`);
    line++;

    const maxAgentLines = Math.min(8, Math.max(1, height - line - 15));
    if (agentList.length === 0) {
      term.gray('No agents yet\n');
      line++;
    } else {
      const visibleAgents = agentList.slice(0, maxAgentLines);
      for (const agent of visibleAgents) {
        const age = this.tick - agent.bornTick;
        const label = agent.emergent ? 'EMG' : 'COR';

        let statusText;
        if (agent.lastActivity && agent.lastActivityTick !== undefined) {
          const activityAge = this.tick - agent.lastActivityTick;
          const freshness = activityAge === 0 ? 'NOW' : `t-${activityAge}`;
          statusText = `${freshness}: ${agent.lastActivity}`;
        } else {
          const concerns = agent.concerns.slice(0, 2).join(', ') || 'initializing';
          statusText = `concerns: ${concerns}`;
        }

        if (agent.emergent) {
          term.color256(208).bold(agent.name); // Orange for emergent
        } else {
          term.cyan.bold(agent.name);
        }
        term.gray(` [${label}|age:${age}] `);
        term.white(this.truncate(statusText, width - agent.name.length - 20) + '\n');
        line++;
      }
    }

    term.gray('─'.repeat(width) + '\n');
    line++;

    // Timeline or Summary section
    if (this.mode === 'complete' && this.summary) {
      term.green.bold('SUMMARY\n');
      line++;
      term.bold('Final Decision: ');
      term.white((this.summary.finalDecision || 'none') + '\n');
      line++;
      term.bold('Stats: ');
      term.white(`Agents: ${this.summary.stats.agents} | Signals: ${this.summary.stats.signals} | Ticks: ${this.summary.stats.ticks}\n`);
      line++;

      if (this.summary.decisions.length > 0 && line < height - 2) {
        term.yellow.bold('Decisions:\n');
        line++;
        for (const decision of this.summary.decisions.slice(0, Math.max(1, height - line - 2))) {
          term.white(`  • ${this.truncate(decision, width - 4)}\n`);
          line++;
        }
      }
    } else {
      term.color256(208).bold('TIMELINE\n'); // Orange
      line++;

      const maxLogLines = Math.max(1, height - line - 2);
      const visibleLogs = this.logs.slice(-maxLogLines);

      if (visibleLogs.length === 0) {
        term.gray('No signals yet\n');
        line++;
      } else {
        for (const log of visibleLogs) {
          const typeColors: Record<LogType, any> = {
            decision: term.yellow,
            recommendation: term.green,
            spawn: term.color256(208), // Orange
            system: term.blue,
            thought: term.cyan,
          };

          const typeLabels: Record<LogType, string> = {
            decision: 'DEC',
            recommendation: 'REC',
            spawn: 'SPN',
            system: 'SYS',
            thought: 'THO',
          };

          const label = typeLabels[log.type];
          const tick = log.tick.toString().padStart(3, '0');

          typeColors[log.type].bold(label);
          term.gray(` t${tick} `);

          if (log.receivers && log.receivers.length > 0) {
            const receiverList = log.receivers.slice(0, 2).join(', ');
            const more = log.receivers.length > 2 ? ` +${log.receivers.length - 2}` : '';
            term.white(log.actor);
            term.gray(' → ');
            term.green(receiverList + more);
            term.white(': ' + this.truncate(log.text, width - 30) + '\n');
          } else {
            term.white(`${log.actor}: ${this.truncate(log.text, width - 20)}\n`);
          }
          line++;
        }
      }
    }

    // Footer
    term.moveTo(1, height);
    term.gray(
      this.mode === 'scenario'
        ? 'Press Enter to start | Ctrl+C: exit'
        : this.mode === 'complete'
          ? 'Run complete | Ctrl+C: exit'
          : 'Live run | Ctrl+C: exit'
    );
  }
}
