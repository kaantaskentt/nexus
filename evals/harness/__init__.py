"""Interviewer eval harness — drives evals/interviewer/*.yaml through the stage7
interviewer (direct prompt today, task #7 runtime via URL swap) and an LLM judge.

Entry point: python -m evals.harness  (see runner.main / README.md).
"""

from .adapters import DirectPromptAdapter, HttpInterviewerAdapter, get_adapter
from .judge import judge_reply

__all__ = ["get_adapter", "DirectPromptAdapter", "HttpInterviewerAdapter", "judge_reply"]
