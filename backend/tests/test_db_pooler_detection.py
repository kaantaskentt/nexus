from app.db import _uses_transaction_pooler


def test_detects_supabase_pooler_hostname_and_transaction_port():
    assert _uses_transaction_pooler(
        "postgresql://user:pass@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
    )
    assert _uses_transaction_pooler(
        "postgresql://user:pass@db.example.com:6543/postgres"
    )


def test_ignores_pooler_markers_in_credentials_or_untrusted_hostnames():
    assert not _uses_transaction_pooler(
        "postgresql://pooler.supabase.com:pass%3A6543@db.example.com:5432/postgres"
    )
    assert not _uses_transaction_pooler(
        "postgresql://user:pass@pooler.supabase.com.evil.example:5432/postgres"
    )
