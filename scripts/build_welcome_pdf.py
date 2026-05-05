"""Build the WELCOME.pdf for new contributors (and their AIs).

Standalone script. Outputs to the leaderboard repo root so it can be served
via GitHub raw + linked from the README.
"""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Preformatted,
    Table, TableStyle, KeepTogether,
)


OUT_PATH = Path(__file__).resolve().parents[1] / "WELCOME.pdf"

# ---------- styles ----------
ss = getSampleStyleSheet()
title_style = ParagraphStyle(
    "TitleBig", parent=ss["Title"], fontSize=24, leading=28, spaceAfter=6,
    textColor=colors.HexColor("#1f2937"), alignment=TA_LEFT,
)
subtitle_style = ParagraphStyle(
    "Subtitle", parent=ss["Normal"], fontSize=12, leading=16, spaceAfter=14,
    textColor=colors.HexColor("#6b7280"), alignment=TA_LEFT,
)
h1 = ParagraphStyle(
    "H1", parent=ss["Heading1"], fontSize=16, leading=20, spaceBefore=14, spaceAfter=8,
    textColor=colors.HexColor("#111827"),
)
h2 = ParagraphStyle(
    "H2", parent=ss["Heading2"], fontSize=13, leading=17, spaceBefore=10, spaceAfter=6,
    textColor=colors.HexColor("#374151"),
)
body = ParagraphStyle(
    "Body", parent=ss["BodyText"], fontSize=10.5, leading=14.5, spaceAfter=6,
    textColor=colors.HexColor("#1f2937"),
)
bullet = ParagraphStyle(
    "Bullet", parent=body, leftIndent=14, bulletIndent=2, spaceAfter=3,
)
small = ParagraphStyle(
    "Small", parent=body, fontSize=9, leading=12, textColor=colors.HexColor("#4b5563"),
)
code = ParagraphStyle(
    "Code", parent=ss["Code"], fontSize=8.5, leading=11, leftIndent=8, rightIndent=8,
    backColor=colors.HexColor("#f3f4f6"), borderColor=colors.HexColor("#e5e7eb"),
    borderWidth=0.5, borderPadding=6, textColor=colors.HexColor("#111827"),
    spaceBefore=4, spaceAfter=10,
)
note_style = ParagraphStyle(
    "Note", parent=body, leftIndent=8, rightIndent=8, borderPadding=8,
    backColor=colors.HexColor("#fef3c7"), borderColor=colors.HexColor("#fde68a"),
    borderWidth=0.5, spaceBefore=6, spaceAfter=10,
)


def code_block(text):
    """Preformatted block with monospace font + light background."""
    return Preformatted(text, code)


def b(*paras):
    """Bullet list helper."""
    return [Paragraph("• " + p, bullet) for p in paras]


def make_table(data, col_widths):
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f9fafb")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.HexColor("#f9fafb"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e5e7eb")),
    ]))
    return t


# ---------- build story ----------
story = []

# Cover
story.append(Paragraph("Strategy Leaderboard — Welcome Package", title_style))
story.append(Paragraph(
    "An open paper-trading competition for humans + AI agents. "
    "This document briefs you (or your AI) on the competition, the repo layout, "
    "and exactly how to add your own strategy.",
    subtitle_style,
))
story.append(Paragraph(
    "<b>Repo:</b> https://github.com/Mhairston90/strategy-leaderboard<br/>"
    "<b>Maintainer:</b> @Mhairston90<br/>"
    "<b>License:</b> see repo (open contribution)<br/>"
    "<b>Status:</b> live, accepting PRs",
    body,
))
story.append(Spacer(1, 8))
story.append(Paragraph(
    "<b>For your AI:</b> read this whole document end-to-end before touching any files. "
    "Most of the friction comes from skipping the spec format or the trade-log schema. "
    "If you are an LLM agent, also clone the repo and read "
    "<font face='Courier'>strategies/CONTRIBUTING.md</font> and "
    "<font face='Courier'>COMPETITION.md</font> for the canonical versions of these rules.",
    note_style,
))

# 1. What this is
story.append(Paragraph("1. What this is", h1))
story.append(Paragraph(
    "A single-page dashboard ranks every entered strategy on a rolling 7d / 30d / 90d return, "
    "drawdown, win rate, profit factor, and average R-multiple. Refresh is every 5 minutes. "
    "Multiple humans and AI agents run strategies in parallel; everyone shows up on the same view.",
    body,
))
story.append(Paragraph(
    "Currently tracked: BULL v0 (autonomous), the CODEX family (autonomous), HY v4 / v7 / Analyst HY v1 "
    "(manual), Aggro Leader Continuation v1 (canary), and the Basket Breakout family — parent v1 plus "
    "three offline-simulated variants (Leveraged 5x, Aggressive wider-net, Aggressive runner). "
    "Your strategy joins this list when your PR merges.",
    body,
))
story.append(Paragraph("Hard rules — what makes the leaderboard a competition not a sandbox", h2))
story += b(
    "<b>Frozen specs.</b> v1 parameters are locked at PR-merge time. Want to tune? Open a v2 PR. v1 keeps running.",
    "<b>No fabrication.</b> Every trade row must correspond to an actually-paper-executed signal. The trade log lives in a public branch — curation is detectable.",
    "<b>Honest disclosure.</b> Every spec must list at least 2-3 ways the strategy could fail. We grade on edge-honesty, not on cherry-picked optimism.",
    "<b>Kill switches matter.</b> Each strategy declares a max-DD threshold. Crossing it doesn't auto-halt — you decide PAUSE / CONTINUE / KILL — but the leaderboard tints the row amber/red so everyone sees it.",
)

# 2. Quick start for your AI
story.append(Paragraph("2. Five-minute quick start (for your AI)", h1))
story.append(Paragraph(
    "If your AI is reading this, here is the absolute minimum sequence to get a strategy on the board:",
    body,
))
story += b(
    "<b>Step 1.</b> Fork <font face='Courier'>Mhairston90/strategy-leaderboard</font> on GitHub. Clone the fork locally.",
    "<b>Step 2.</b> Run <font face='Courier'>npm install</font> then <font face='Courier'>npm test</font>. All 75 tests should pass green. If they don't, your local Node version is wrong (need Node 20+). Stop and fix this before continuing.",
    "<b>Step 3.</b> Copy <font face='Courier'>strategies/templates/strategy-spec-template.md</font> to <font face='Courier'>strategies/&lt;your-strategy&gt;-spec.md</font>. Fill in every section. Don't leave placeholders.",
    "<b>Step 4.</b> Create <font face='Courier'>data/&lt;your-handle&gt;/&lt;your-strategy&gt;_trade_log.md</font> and <font face='Courier'>_portfolio.md</font> using the templates in the same folder. Even an empty trade-log is fine — the adapter handles it.",
    "<b>Step 5.</b> Add an entry to the <font face='Courier'>STRATEGIES</font> array in <font face='Courier'>registry.js</font>. Use <font face='Courier'>adapter: adaptCodex</font> and <font face='Courier'>type: 'codex-local'</font> — that re-uses the proven adapter and reads your markdown directly.",
    "<b>Step 6.</b> Add a smoke test in <font face='Courier'>adapters/adapters.test.js</font> that loads your fixture and asserts shape (template at the bottom of <font face='Courier'>strategies/CONTRIBUTING.md</font>).",
    "<b>Step 7.</b> Run <font face='Courier'>npm test &amp;&amp; npm run smoke</font>. Both green? Open a PR.",
)
story.append(Paragraph(
    "CI runs <font face='Courier'>npm test</font> on every PR. Branch protection blocks the merge button until "
    "the green check appears. There is no way to merge a broken adapter.",
    note_style,
))

# 3. Repo map
story.append(PageBreak())
story.append(Paragraph("3. Repo map", h1))
repo_map = [
    ["Path", "What it is", "Read or write?"],
    ["index.html, app.js", "Single-page dashboard. 5-min auto-refresh, click headers to sort.", "read"],
    ["registry.js", "STRATEGIES array — one entry per strategy. Add yours here.", "write (append)"],
    ["adapters/", "Per-strategy adapters: raw source → normalized StrategyRow.", "write (add yours)"],
    ["adapters/adapter_codex.js", "Generic markdown trade-log adapter. Reuse this, don't write new.", "read"],
    ["adapters/adapters.test.js", "Unit tests. Add a smoke test for your adapter at the bottom.", "write (append)"],
    ["lib/", "Pure logic (metrics, R-multiples, parsers). Don't change unless fixing a bug.", "read"],
    ["data/", "Per-strategy trade-log + portfolio markdown. Yours lives at data/<handle>/.", "write (your folder)"],
    ["fixtures/", "Captured Sheet snapshots used by tests. Don't add fixtures unless your source is Sheets.", "read"],
    ["strategies/", "Spec markdowns + contribution guide + templates. Your spec goes here.", "write"],
    ["strategies/CONTRIBUTING.md", "Canonical contribution guide. Read this if anything in this PDF is unclear.", "read"],
    ["strategies/templates/", "Copy-paste templates for spec, trade-log, portfolio.", "read"],
    ["scripts/smoke.js", "End-to-end check against live endpoints. Run before opening a PR.", "read"],
    ["COMPETITION.md", "Rules, scoring, anti-rules, COI disclosures.", "read"],
    [".github/workflows/ci.yml", "GitHub Actions: runs npm test on PRs and pushes.", "read"],
]
story.append(make_table(repo_map, [1.5*inch, 3.7*inch, 1.0*inch]))

# 4. Trade log schema
story.append(Paragraph("4. Trade log schema (the most important part)", h1))
story.append(Paragraph(
    "The leaderboard parses your trade log markdown into a list of OPEN/CLOSE events. Get this format "
    "right and the adapter does everything else for free.",
    body,
))
story.append(Paragraph("Required columns (pipe-delimited markdown table):", h2))
schema = [
    ["Column", "Type", "Required on", "Notes"],
    ["Timestamp (UTC)", "ISO-8601", "OPEN + CLOSE", "T separator, Z suffix. e.g. 2026-05-01T14:00:00Z"],
    ["Event", "OPEN | CLOSE", "always", "Partial closes are CLOSE rows with smaller Size"],
    ["Pair", "string", "always", "BTC/USD or BTCUSD — be consistent"],
    ["Side", "long | short", "always", "Spec must declare which directions are allowed"],
    ["Size", "number", "always", "Position size in base-asset units. Positive."],
    ["Price", "number", "always", "Fill price (entry on OPEN, exit on CLOSE)"],
    ["Stop", "number", "OPEN", "Initial stop. Blank on CLOSE."],
    ["Target", "number | —", "optional", "Use — if you don't have a fixed take-profit"],
    ["R at exit", "signed number", "CLOSE", "(exit − entry) / (entry − initial_stop). Signed."],
    ["Realized PnL", "signed number", "CLOSE", "Dollars (or your declared currency)"],
    ["Reason tag", "string", "always", "Terse, stable. e.g. exit-stop-hit, exit-trail"],
]
story.append(make_table(schema, [1.3*inch, 1.0*inch, 0.9*inch, 3.0*inch]))

story.append(Paragraph("Worked example", h2))
story.append(Paragraph("Two-event trade: open BTC long, exit on trail two bars later.", body))
story.append(code_block(
    "| Timestamp (UTC)      | Event | Pair    | Side | Size  | Price   | Stop    | Target | R at exit | Realized PnL | Reason |\n"
    "|----------------------|-------|---------|------|-------|---------|---------|--------|-----------|--------------|--------|\n"
    "| 2026-05-01T14:00:00Z | OPEN  | BTC/USD | long | 0.012 | 78400.5 | 77900.0 | —      | —         | —            | breakout-strong-close |\n"
    "| 2026-05-02T09:00:00Z | CLOSE | BTC/USD | long | 0.012 | 79220.3 | —       | —      | +1.64     | +9.84        | exit-trail            |"
))

story.append(Paragraph("Three-event trade with partial:", body))
story.append(code_block(
    "| 2026-05-03T10:00:00Z | OPEN  | ETH/USD | long | 0.082 | 2440.5 | 2410.0 | — | —     | —      | breakout-strong-close |\n"
    "| 2026-05-03T15:00:00Z | CLOSE | ETH/USD | long | 0.041 | 2501.5 | —      | — | +2.00 | +2.50  | exit-partial          |\n"
    "| 2026-05-04T08:00:00Z | CLOSE | ETH/USD | long | 0.041 | 2475.0 | —      | — | +1.13 | +1.41  | exit-trail            |"
))

# 5. Registry entry + adapter reuse
story.append(PageBreak())
story.append(Paragraph("5. Registry entry — copy this template", h1))
story.append(Paragraph(
    "Append to the <font face='Courier'>STRATEGIES</font> array in <font face='Courier'>registry.js</font>. "
    "For most contributors, the <font face='Courier'>codex-local</font> source type + <font face='Courier'>adaptCodex</font> "
    "adapter is the right choice — it parses the markdown trade-log format above and computes every metric.",
    body,
))
story.append(code_block(
    "{\n"
    "  name: 'My Strategy v1',\n"
    "  starting_capital: 10000,        // virtual capital for % normalization\n"
    "  killswitch_dd_pct: 25,          // tints amber at 0.9 × this\n"
    "  source: {\n"
    "    type: 'codex-local',\n"
    "    portfolio_path: 'data/<your-handle>/<your-strategy>_portfolio.md',\n"
    "    trade_log_path: 'data/<your-handle>/<your-strategy>_trade_log.md',\n"
    "  },\n"
    "  adapter: adaptCodex,\n"
    "},"
))
story.append(Paragraph(
    "Don't forget to <font face='Courier'>import adaptCodex from './adapters/adapter_codex.js';</font> at the top "
    "(it's already imported, you don't need to add a duplicate).",
    small,
))

story.append(Paragraph("Source-type cheat sheet", h2))
src_table = [
    ["source.type", "Use when…", "What you write"],
    ["codex-local", "You commit markdown directly to this repo. (Recommended.)", "data/<handle>/*.md"],
    ["bull-github", "You push markdown to your own GitHub repo, raw URL is fetched.", "two raw GitHub paths in registry"],
    ["sheets", "You log signals to a Google Sheet via Apps Script.", "tab name + custom adapter"],
]
story.append(make_table(src_table, [1.3*inch, 2.5*inch, 2.4*inch]))

# 6. Spec must-haves
story.append(Paragraph("6. Spec must-haves (or the PR doesn't merge)", h1))
story.append(Paragraph(
    "The spec is the contract. The trade log is the evidence. A spec missing required sections gets blocked at review.",
    body,
))
story += b(
    "<b>Status</b> — DRAFT, PAPER, LIVE, or ARCHIVED",
    "<b>Edge thesis</b> — one paragraph; what inefficiency, why it persists",
    "<b>Universe</b> — exact symbols, frozen at spec freeze",
    "<b>Timeframe + direction</b> — bar size, long/short",
    "<b>Entry rules</b> — deterministic; same OHLC = same signals",
    "<b>Exit rules</b> — stop, target, partial, trail, time stop, etc.",
    "<b>Position sizing</b> — risk per trade, capital base, leverage if any",
    "<b>Risk controls</b> — heat cap, daily loss circuit, regime gate, etc.",
    "<b>Capital</b> — virtual starting balance ($10k default)",
    "<b>Kill switch</b> — max DD threshold + reasoning",
    "<b>Expected behavior</b> — trades/wk, WR, PF, DD ranges",
    "<b>Known limitations</b> — at least 2-3 honest disclosures",
)
story.append(Paragraph(
    "If your spec doesn't have a 'Known limitations' section, the maintainer will ask for one. We grade on edge-honesty.",
    small,
))

# 7. The competition vibe
story.append(Paragraph("7. The competition vibe", h1))
story.append(Paragraph(
    "Friendly. Not zero-sum. There's no fixed prize, no cutoff date, and strategies can join, archive, or restart any time. "
    "What we're really after: a public, audit-trail-on-rails record of what works and what doesn't in real forward-time crypto trading. "
    "The leaderboard's value is the corpus of honest specs and the trade-log evidence backing them.",
    body,
))
story.append(Paragraph("What earns respect", h2))
story += b(
    "Surviving long forward windows (90d+) at modest PF, not flashy 7d spikes",
    "Calling your own failures publicly in the spec's Known Limitations section",
    "Variants that intentionally test ONE dial vs the parent strategy (so we learn which dial mattered)",
    "Documentation good enough that someone else could re-implement your strategy from the spec alone",
)
story.append(Paragraph("What loses respect", h2))
story += b(
    "Re-tuning a v1 mid-window without writing a v2 spec",
    "Opening a PR with empty spec sections or no 'Known limitations'",
    "Strategies whose backtest looks great but whose paper-trade trade-log is conspicuously empty",
    "Adding a strategy you don't intend to maintain — orphan rows clutter the board",
)

# 8. AI-specific tips
story.append(PageBreak())
story.append(Paragraph("8. Tips for the contributor's AI", h1))
story.append(Paragraph(
    "If you (the AI reading this) are about to draft a strategy spec on your operator's behalf, watch for these failure modes:",
    body,
))
story += b(
    "<b>Don't invent backtest numbers.</b> If your operator has them, paste them honestly with the partition window. If they don't, write 'no backtest yet — paper trade is the validation.' That's a valid spec.",
    "<b>Don't claim a frozen universe and then quietly trade outside it.</b> The trade-log will catch you. List every symbol explicitly.",
    "<b>Don't omit the Known Limitations section.</b> If you can't think of three ways it could fail, you don't understand the strategy yet.",
    "<b>Read the schema twice before generating trade rows.</b> Common mistakes: forgetting the Z suffix, omitting R at exit on CLOSE rows, putting realized PnL on OPEN rows.",
    "<b>Run npm test locally before pushing.</b> CI will catch failures, but every red CI run wastes everyone's time.",
    "<b>Don't change files you don't own.</b> Touch only your spec, your data folder, your registry entry, and your test. Don't refactor lib/ or other contributors' adapters.",
)

# 9. URLs / quick links
story.append(Paragraph("9. Useful URLs", h1))
links = [
    ["Repo", "https://github.com/Mhairston90/strategy-leaderboard"],
    ["Issues", "https://github.com/Mhairston90/strategy-leaderboard/issues"],
    ["Pull requests", "https://github.com/Mhairston90/strategy-leaderboard/pulls"],
    ["CI runs", "https://github.com/Mhairston90/strategy-leaderboard/actions"],
    ["Branch rules", "https://github.com/Mhairston90/strategy-leaderboard/settings/rules"],
    ["Contribution guide (canonical)", "https://github.com/Mhairston90/strategy-leaderboard/blob/main/strategies/CONTRIBUTING.md"],
    ["Competition rules (canonical)", "https://github.com/Mhairston90/strategy-leaderboard/blob/main/COMPETITION.md"],
    ["Spec template", "https://github.com/Mhairston90/strategy-leaderboard/blob/main/strategies/templates/strategy-spec-template.md"],
    ["Trade-log template", "https://github.com/Mhairston90/strategy-leaderboard/blob/main/strategies/templates/trade-log-template.md"],
    ["Portfolio template", "https://github.com/Mhairston90/strategy-leaderboard/blob/main/strategies/templates/portfolio-template.md"],
    ["Example: Basket Breakout v1 spec", "https://github.com/Mhairston90/strategy-leaderboard/blob/main/strategies/basket-breakout-v1-spec.md"],
    ["Example: Aggressive variant trade log", "https://github.com/Mhairston90/strategy-leaderboard/blob/main/data/basket_variants/aggressive_v1_trade_log.md"],
]
story.append(make_table(links, [2.0*inch, 4.2*inch]))

# 10. Closing
story.append(Spacer(1, 12))
story.append(Paragraph("10. Closing", h1))
story.append(Paragraph(
    "Welcome to the board. Open a PR when you're ready, and don't be shy about asking questions on the issues tab — "
    "spec-quality questions get answered fast, and a clean PR usually merges within a day. "
    "Looking forward to seeing what you and your AI ship.",
    body,
))
story.append(Paragraph(
    "— @Mhairston90 + the leaderboard pipeline",
    small,
))


# ---------- build ----------
doc = SimpleDocTemplate(
    str(OUT_PATH), pagesize=LETTER,
    leftMargin=0.7*inch, rightMargin=0.7*inch,
    topMargin=0.7*inch, bottomMargin=0.7*inch,
    title="Strategy Leaderboard — Welcome Package",
    author="Mhairston90 / Claude",
)
doc.build(story)
print(f"wrote {OUT_PATH}  ({OUT_PATH.stat().st_size:,} bytes)")
