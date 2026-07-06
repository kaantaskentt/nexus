# prompts/

The IP. Every agent system prompt (`agents/`), rubric (`rubrics/`), lexicon (`lexicons/`), human-facing copy (`personas/`), and runtime-injected industry calibration (`examples/`). Each file cites its source docs in a header comment — no free-styling; prompts stay domain-neutral with `{{INDUSTRY_CALIBRATION}}` and `{{PRODUCT_NAME}}` resolved at load time by `backend/app/llm.py`. Paths here are contract: `agent_configs.prompt_path` in the DB points at these files.
