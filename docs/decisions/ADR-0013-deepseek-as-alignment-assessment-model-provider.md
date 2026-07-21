# ADR-0013: DeepSeek as the Step 4b alignment_assessment real model provider

## Context

Step 4b's `alignment_assessment` capability requires one real,
non-streaming, structured-output model call alongside its deterministic
test adapter (`docs/AGENT_CONTRACTS.md`, Step 4b scope). The initial
implementation used the official Anthropic Python SDK
(`client.messages.parse(..., output_format=AlignmentAssessmentOutput)`)
against `MODEL_PROVIDER=anthropic`.

Before any of this was committed, the user was unable to complete
billing setup on `console.anthropic.com` (Stripe checkout repeatedly
failed with a generic "Payment failed" error across two different UK
Visa debit cards, multiple browsers, incognito mode, and a separate
mobile device on cellular data -- ruling out card-specific and
device-specific causes). Network-tab inspection of one attempt showed
the underlying Stripe `SetupIntent` actually reaching `status:
"succeeded"` with `last_setup_error: null`, while the Anthropic Console
frontend still reported failure -- consistent with a
`Cross-Origin-Opener-Policy` blocked `window.closed` check breaking the
3D Secure completion detection, or an account-side sync issue. This is
outside the project's control to fix, and the user chose not to keep
retrying against a real Anthropic account before Step 4b's real-call
requirement could be exercised.

Model provider selection is listed under `CLAUDE.md`'s "core technology
choices" change boundary. The user explicitly authorized this change.

## Decision

1. Replace the Anthropic real-provider adapter with a DeepSeek one,
   rather than running both in parallel: `AnthropicAlignmentAssessmentGenerator`
   is removed and replaced by `DeepSeekAlignmentAssessmentGenerator`.
   `DeterministicAlignmentAssessmentGenerator` (the test/dev adapter) is
   unchanged. `MODEL_PROVIDER` now accepts `deterministic` | `deepseek`
   (previously `deterministic` | `anthropic`); `MODEL_API_KEY` /
   `MODEL_NAME` are unchanged, generic field names already reusable
   across providers.
2. DeepSeek has no separate official SDK. Its own documented
   integration path is the official `openai` Python package pointed at
   `base_url="https://api.deepseek.com"` (its OpenAI-compatible
   endpoint) -- confirmed against DeepSeek's live API docs at
   implementation time, including current model IDs (`deepseek-v4-flash`,
   `deepseek-v4-pro`; `deepseek-chat`/`deepseek-reasoner` are deprecated
   and were not used) and JSON-mode behavior.
3. DeepSeek's endpoint has no equivalent of Anthropic's
   `messages.parse(output_format=...)`. Structured output uses DeepSeek's
   documented JSON mode (`response_format={"type": "json_object"}`,
   which requires the word "json" plus an example structure in the
   prompt -- both added to the system prompt), and the returned JSON
   string is validated explicitly against `AlignmentAssessmentOutput`
   via `model_validate_json()`.
4. DeepSeek's docs note JSON mode may occasionally return empty
   content. Per this project's prototype scope ("not enterprise-level
   retries"), an empty response is treated as one explicit
   `AgentGenerationError` -- recorded on the `AgentRun` as a failed run,
   same as any other provider failure -- not as a trigger for a retry
   system.
5. The `AlignmentAssessmentGenerator` Protocol, `generate_alignment_assessment`'s
   snapshot -> run -> generate -> persist -> finalize flow, the
   `alignment_assessments` table/migration, and all three API endpoints
   are unaffected -- this change is scoped entirely to which class
   `_get_generator()` returns for the real-provider branch and which
   package is installed to support it.

## Alternatives considered

- **Keep Anthropic and add DeepSeek as a second real provider** --
  rejected; nothing had been committed yet, and this is a small
  research prototype, not a multi-provider gateway
  (`docs/PRODUCT_SCOPE.md`). Maintaining three parallel real-provider
  implementations (Anthropic, DeepSeek, and whatever comes next) has no
  present justification.
- **Amazon Bedrock or Google Vertex AI Claude access** (billed through
  AWS/GCP instead of Anthropic's own Stripe checkout, keeping the same
  Anthropic SDK/`messages.parse()` code unchanged) -- viable and
  discussed, but not chosen for this pass: it still requires a working
  AWS/GCP billing account, and the user preferred a provider whose
  billing (Alipay/WeChat Pay/domestic card) sidesteps the international
  card-payment issue entirely rather than moving it to a different
  cloud billing system.
- **Switch to OpenAI or Google Gemini's native API** -- a strictly
  larger change (different SDK, different structured-output mechanics,
  no reuse of DeepSeek's OpenAI-compatible surface) with no advantage
  over DeepSeek for this prototype's purposes; not pursued.

## Status

Accepted, per the user's explicit instruction to proceed regardless of
`CLAUDE.md`'s core-technology-choice change-boundary process, given
nothing from the original Anthropic-based Step 4b work had been
committed.
