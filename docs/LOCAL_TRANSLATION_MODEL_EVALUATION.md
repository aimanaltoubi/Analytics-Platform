# Local Translation Model Decision

## Decision

The first offline translation release reuses the already packaged Qwen2.5-14B-Instruct-Q4_K_M model. It supports the ten configured targets (Arabic, English, Simplified Chinese, Russian, Spanish, French, German, Portuguese, Italian, and Japanese) and does not add another multi-gigabyte model, runtime, or installation step. Its official model card lists Apache-2.0 and multilingual support.

This is a deployment decision, not a claim that Qwen is the best machine-translation model on every language pair. The current model is an instruction-following LLM rather than a translation-specialist model. The translation endpoint preserves pages and checks that passport/ID numbers, dates, phone numbers, and email addresses survive unchanged; those checks do not prove semantic translation quality.

## Compared Research

| Work | Published result/scope | Deployment consideration |
| --- | --- | --- |
| NLLB-200, Costa-jussà et al. (2022), [arXiv:2207.04672](https://arxiv.org/abs/2207.04672) | Translation benchmarked across 200 languages with FLORES-200 and human evaluation. | The official `facebook/nllb-200-distilled-1.3B` model card declares CC-BY-NC-4.0; it is not appropriate to bundle for unrestricted commercial use. |
| SeamlessM4T, Communication et al. (2023), [arXiv:2308.11596](https://arxiv.org/abs/2308.11596) | Unified multilingual speech/text translation; broader speech tasks than this app requires. | The official `facebook/seamless-m4t-v2-large` model card declares CC-BY-NC-4.0 and would add a large second model/runtime. |
| MADLAD-400, Kudugunta et al. (2023), [arXiv:2309.04662](https://arxiv.org/abs/2309.04662) | A 10.7B translation model trained for more than 450 languages; the paper reports evaluation on a subset. | Apache-2.0 is attractive, but it is a separate T5-style model and is not served by the current bundled llama.cpp runtime. It would materially increase package and memory requirements. |
| Qwen2.5 Technical Report (2024), [arXiv:2412.15115](https://arxiv.org/abs/2412.15115) | General multilingual instruction model; the official model card lists 29 supported languages including Arabic, English, Chinese, and Russian. | Already bundled under Apache-2.0, so it is the lowest-friction offline baseline for the first implementation. |

The app must not describe any of these results as proof of “near-perfect” translation. Specialized research results are language-pair/domain dependent, and the papers themselves use benchmarks and/or human evaluation rather than universal guarantees.

## Evaluation Harness

Run the translation harness in mock mode to verify API, page mapping, saved records, identifier preservation, and failure handling:

```bash
node scripts/evaluate-translation.js --mock
```

For a real local-model run, first start the bundled llama.cpp server and use its loopback URL:

```bash
node scripts/evaluate-translation.js --ai-url http://127.0.0.1:8081 --output /tmp/translation-evaluation.json
```

The harness tests English, Russian, and Simplified Chinese sources translated to Arabic, plus English-to-all ten configured targets. It reports target-script checks, exact preservation of protected identifiers, page/segment mapping, failures, and output text for human review. Script checks and identifier checks are necessary sanity checks, not semantic-quality scores. A production quality claim requires native-hardware runs and bilingual human review (or independently verified reference translations) for every language pair and representative document domain.

## Guardrails

- The source document is never overwritten; each language is saved as a separate local translation record.
- Original page boundaries are retained and displayed beside translated segments.
- Names, dates, email addresses, phone numbers, and ID-like tokens are checked after generation; a missing/changed token rejects the translation instead of silently publishing it.
- The model is instructed to translate rather than summarize, to ignore instructions embedded in the document, and not to add facts.
- Human review is required for legal, identity, financial, or operational decisions.