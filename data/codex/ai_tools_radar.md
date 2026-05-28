# AI Tools Radar

> Generated: 2026-05-25T14:20:01Z
> No trading action was taken.
> Research-only: no trade logs, portfolios, optimizer configs, broker settings, exchange settings, or live routing were changed.

## Summary

- Queue items: 31
- Test now: 10
- Watch: 15
- Ignored: 6
- Archived: 0

## Test Now

- Add agent-native telemetry to Codex routines (tactical_tools; OpenAI Codex safety and OpenTelemetry GenAI observability)
  - Why it matters: OpenAI is emphasizing bounded agent execution plus telemetry for prompts, tool approvals, tool results, MCP usage, and network policy decisions; OpenTelemetry is also framing GenAI observability as a first-class practice.
  - Fit for us: Maps directly to automation health, cache diagnostics, and post-run accountability for paper-only routines.
  - Risks/noise: Could become observability ceremony if we instrument before knowing which failures matter.
  - Tiny experiment: Add a lightweight run-id and event summary to one paper-only routine or automation-health report, then compare whether it explains cache/data-source warnings faster.
  - Decision: High leverage because current pain is knowing whether automations used live data, cache, or skipped for legitimate reasons.
- Add minimal GenAI telemetry fields to automation health (tactical_tools; OpenTelemetry GenAI observability)
  - Why it matters: Recent GenAI semantic conventions make agent/tool latency and token visibility diagnosable.
  - Fit for us: Helps debug cache/fallback behavior and source-quality drift in paper-only routines.
  - Risks/noise: Can create instrumentation overhead if we over-collect before choosing key metrics.
  - Tiny experiment: Track run_id, tool_calls_count, and max_tool_latency in one report artifact only.
  - Decision: Small implementation with clear operational payoff.
- Benchmark Responses API WebSocket mode for tool-loop latency (tactical_tools; OpenAI Responses API)
  - Why it matters: OpenAI introduced persistent WebSocket execution to reduce per-turn overhead in multi-step agent workflows.
  - Fit for us: Could reduce turnaround time for research automations that chain multiple tool calls.
  - Risks/noise: Benefit depends on workflow shape; simple one-shot tasks may see little gain.
  - Tiny experiment: Run one paper-only routine through an A/B harness with request/response vs WebSocket orchestration and compare end-to-end runtime.
  - Decision: Fast, bounded experiment with clear latency KPI.

## Watch

- Broker rule checker for future allocator (strategic_ai_advances; memory/real_account_allocator.md)
  - Why it matters: Day-trading and settlement rules are changing enough that live allocation needs a current checker.
  - Fit for us: Maps to the future real-account allocator promotion gate.
  - Risks/noise: Needs broker-specific details before it can be implemented.
  - Tiny experiment: List broker rule questions before choosing any API integration.
  - Decision: Important but not a code task until live execution work starts.
- Evaluate agent benchmark findings before overfitting tool choices (strategic_ai_advances; Agentick benchmark)
  - Why it matters: Bench evidence suggests scaffold design can dominate model-only comparisons.
  - Fit for us: Supports focusing on workflow scaffolding quality in our routines.
  - Risks/noise: Academic benchmarks may not map directly to trading-research operations.
  - Tiny experiment: Run one internal task with two prompt/scaffold variants and compare completion fidelity.
  - Decision: Useful decision hygiene for model/tool selection.
- Monitor Agents SDK sandbox harness maturity (strategic_ai_advances; OpenAI Agents SDK evolution)
  - Why it matters: OpenAI is standardizing agent infrastructure around sandbox execution, MCP, skills, instructions, shell tools, and apply-patch style edits.
  - Fit for us: Could become the clean way to run future research agents with reproducible sandboxes and audit trails.
  - Risks/noise: Our current Codex desktop workflow already gives much of this; adopting SDK infrastructure too early could duplicate the app.
  - Tiny experiment: Keep this on watch until we need a standalone programmatic agent outside Codex Desktop automations.
  - Decision: Strategically important, but not more valuable than hardening the current Codex automation lane right now.
- Track Claude Managed Agents self-hosted sandbox option (strategic_ai_advances; Anthropic Claude Platform release notes)
  - Why it matters: Self-hosted sandboxes alter control, compliance, and cost tradeoffs for agent execution.
  - Fit for us: Could matter later if we need stronger runtime control for research workflows.
  - Risks/noise: Operational overhead may outweigh gains at current scale.
  - Tiny experiment: Capture decision criteria for hosted vs self-hosted sandboxes in architecture notes.
  - Decision: Material strategic option but premature to adopt now.
- Track FINRA intraday margin transition for allocator design (strategic_ai_advances; SEC SR-FINRA-2025-017 and Investor.gov T+1 bulletin)
  - Why it matters: The SEC approved changes to replace FINRA day-trading margin provisions with intraday margin standards, while U.S. securities settlement remains T+1.
  - Fit for us: The future $10k allocator must check broker-specific buying power, intraday margin, settlement, and day-trade behavior before live use.
  - Risks/noise: Rules and broker implementation dates can diverge, so this must be verified directly with the chosen broker.
  - Tiny experiment: Add a broker-rule questionnaire to `memory/real_account_allocator.md` before any live broker integration.
  - Decision: Allocator-critical, but still watch-only until a broker/account is selected.

## Rejected Or Noise

- Ignore consumer-facing Gemini app agent release for now (strategic_ai_advances; Gemini app release notes)
  - Why it matters: Confirms agent UX direction but does not directly change our developer workflow stack.
  - Fit for us: Low immediate fit compared with API and infrastructure updates.
  - Risks/noise: Consumer feature cadence can distract from core research infrastructure work.
  - Tiny experiment: No experiment this cycle.
  - Decision: Intentional deprioritization to keep tactical focus high.
- Do not chase Alpaca crypto asset expansion yet (tactical_tools; Alpaca crypto offering update)
  - Why it matters: Alpaca added 11 crypto assets for Broker API and Trading API.
  - Fit for us: Could matter later if Alpaca becomes the chosen broker/API, but current paper crypto data and strategy work do not need more symbols.
  - Risks/noise: Asset-list expansion can tempt strategy churn without edge or execution validation.
  - Tiny experiment: No experiment now; revisit only during broker/API selection.
  - Decision: Rejected for now because the bottleneck is reliability and allocator rules, not more tradable assets.
- Generic viral prompt pack (tactical_tools; Social feed)
  - Why it matters: Does not matter for this system.
  - Fit for us: No fit.
  - Risks/noise: Hype-only item.
  - Tiny experiment: No experiment.
  - Decision: Rejected because it does not improve research, reliability, automation, or allocator design.
- Ignore transient broker status incidents as primary roadmap inputs (tactical_tools; Alpaca status page)
  - Why it matters: Short outages are operationally relevant but often too noisy for strategy-level roadmap choices.
  - Fit for us: Prevents overreacting to isolated incidents during paper-only tooling prioritization.
  - Risks/noise: Could underweight recurring reliability patterns if not tracked over time.
  - Tiny experiment: Only escalate if incident class repeats across multiple weeks.
  - Decision: Noise filter for this radar cycle.
- Reject Alpaca CLI endpoint expansion as immediate priority (tactical_tools; Alpaca CLI release)
  - Why it matters: Broad endpoint coverage is attractive for agentic workflows.
  - Fit for us: Current mandate is paper-only research and no broker/exchange credential usage.
  - Risks/noise: High distraction risk because it can pull focus into integration work we cannot run now.
  - Tiny experiment: No implementation test; keep as deferred input for future live-infra project.
  - Decision: Rejected for this cycle due to guardrail conflict and sequencing.

## Internal Opportunities

- Add agent-native telemetry to Codex routines: Maps directly to automation health, cache diagnostics, and post-run accountability for paper-only routines.
- Benchmark Responses API WebSocket mode for tool-loop latency: Could reduce turnaround time for research automations that chain multiple tool calls.
- Pilot MCP protocol-version compliance checks in our MCP clients: Directly improves reliability for any MCP-backed tooling in research automations.
- Pilot OpenAI Docs MCP as default lookup path: Direct fit for automation prompts that reference OpenAI APIs, Codex, and tooling semantics.
- Track cache usage as a reliability signal: Maps directly to automation health and strategy reliability review.

## Sources Reviewed

- https://openai.com/index/speeding-up-agentic-workflows-with-websockets/
- https://openai.com/index/the-next-evolution-of-the-agents-sdk/
- https://blog.google/innovation-and-ai/technology/developers-tools/managed-agents-gemini-api/
- https://platform.claude.com/docs/en/release-notes/overview
- https://support.claude.com/en/articles/12138966-release-notes
- https://modelcontextprotocol.io/specification/2025-06-18/changelog
- https://interactivebrokers.github.io/
- https://alpaca.markets/blog/alpaca-launches-mcp-server-v2/
- https://status.alpaca.markets/
- https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- https://gemini.google/us/release-notes/?hl=en

## Guardrails

- Research-only: no trade logs, portfolios, optimizer configs, broker settings, exchange settings, or live routing were changed.
- A `test_now` decision creates a proposed experiment, not an implementation.
- Live-trading implications remain planning notes until the user starts a separate live-execution project.
