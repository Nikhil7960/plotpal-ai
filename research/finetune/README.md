# PlotPal Fine-Tuning Workflow (v3)

This directory contains the **v3** fine-tuning workflow that aligns the
research dataset with the latest production pipeline at
`src/services/{qwenVL,geminiFilter,locationContext}.ts`.

## What changed vs v2

| Concern | v2 | v3 |
|---|---|---|
| Base model | Qwen2.5-VL-7B | **Qwen3-VL-2B-Instruct** (sub-2B, latest April 2025) |
| Prompt format | Generic single prompt per cell | **Production prompt** with Overpass ground-truth context + building type |
| Output schema | Custom (`recommendedTypes`) | **Production schema** (drop-in compatible) |
| Filter step | Full JSON roundtrip (loses fields) | Index-based filter (returns `keepIndices`) |
| Per-cell variants | 1 generic call | 3 random building types per cell |
| Address grounding | None | Reverse-geocoded address in prompt |
| Location context | None | Overpass land use summary in prompt |

## End-to-end pipeline

```text
research pipeline (TypeScript)
   ├── grid generation        (research/grid/)
   ├── tile stitching         (research/imagery/)
   ├── location context       (research/pipeline/location-context.ts)  ← NEW
   ├── Gemini analyze         (research/pipeline/gemini-client.ts)     ← rewritten
   ├── Gemini filter (index-based)
   └── output/results/<cell>__<buildingType>.json

dataset prep (Python)
   └── prepare_mumbai_dataset.py  → output/finetune-data/{conversations.json, images/}

fine-tune (Colab)
   └── colab_finetune_v3.py       → Qwen3-VL-2B + LoRA → adapter zip

local test
   └── test_finetuned_model.py    → 5 cities, validates production schema
```

## Step-by-step

### 1. (Re)generate the research dataset with the new schema

The pipeline now writes one result file per `(cell, buildingType)` pair so it
needs to be re-run after upgrading to v3:

```bash
cd research
rm -rf output/results output/checkpoints   # only if you want a fresh run
npm run grid          # or whichever script generates the grid
tsx scripts/run-full.ts
```

Each cell now produces 3 result files (one per random building type).

### 2. Build the training dataset

```bash
cd research
python finetune/prepare_mumbai_dataset.py
```

This produces `output/finetune-data/`:
- `conversations.json` — three conversation types per row, with the **production
  prompt format** (location context + building type) baked into the user message
- `images/` — copied PNGs
- `metadata.json` — schema version, building-type breakdown, conversation counts

### 3. Fine-tune on Colab

1. Zip `output/finetune-data/`
2. Open `colab_finetune_v3.py` in Colab (paste each snippet as a cell)
3. Pick a T4 / L4 / A100 runtime (4-bit quantized 2B fits on T4)
4. Upload the zip when prompted
5. Training takes ~30-90 min on A100

The notebook also runs **fresh Esri tile tests** on Kharghar / BKC / Thane at
the end of training so you can confirm the model produces the production JSON
schema before downloading.

### 4. Test locally against multiple cities

```bash
pip install unsloth requests pillow peft
python research/finetune/test_finetuned_model.py \
  --adapter ./plotpal-qwen3vl-2b-lora \
  --location kharghar
```

The harness fetches a fresh Esri image, queries Overpass for the same context
the production app uses, builds the production user prompt, generates with the
fine-tuned model, and validates the JSON schema. This is the apples-to-apples
comparison against `test-pipeline.mjs`.

### 5. Drop the LoRA into production (optional path)

Once the fine-tuned model passes the local test harness, you can serve it via
vLLM / Ollama / TGI and replace the `gemini-2.5-flash` calls in
`src/services/qwenVL.ts` with calls to your local endpoint. The prompt format
is identical, so no other code changes are required.

## Why Qwen3-VL-2B?

- **Sub-2B parameters** — fits the user's hard requirement
- **Latest Qwen release** (April 2025) with both Instruct and Thinking variants
- **Same chat-template family** as Qwen2.5-VL → production prompts work as-is
- **Strong benchmarks** vs InternVL3-2B and SmolVLM2-2.2B at the same size
- **Unsloth-supported** → 2× faster training, 60% less VRAM
- **Drop-in option** if production prompts ever change

If you'd rather try a different model, swap the `MODEL_ID` constant in
`colab_finetune_v3.py`. The dataset format is generic enough to work with any
Unsloth-supported VLM.
