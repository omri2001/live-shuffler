import pytest


def pytest_collection_modifyitems(config, items):
    """Skip e2e tests by default unless -m e2e is passed."""
    if "e2e" not in (config.option.markexpr or ""):
        skip_e2e = pytest.mark.skip(reason="e2e tests skipped by default")
        for item in items:
            if "e2e" in item.keywords:
                item.add_marker(skip_e2e)
