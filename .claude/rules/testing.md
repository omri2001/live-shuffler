# Testing Rules

Run tests with:

```bash
cd backend && uv run pytest
```

- Mirror the source directory structure under `tests/`. Avoid splitting tests into too many small files.
- Group tests under classes prefixed with `Test` (e.g. `class TestRemoveBackground`).
- Name tests as `test_<what>_on_<condition>_should_<expected>`. Drop `_on_<condition>` when there's no meaningful condition.
- Keep one logical assertion per test. Multiple `assert` statements are fine if they verify the same behavior.
- Tests are either **unit**, **integration**, or **component/e2e**. Unit and integration tests must run offline with no network or external dependencies (databases, APIs, etc.).
- Organize tests by category in subdirectories: `tests/unit/`, `tests/integration/`, `tests/e2e/`, etc. Mirror the source directory structure within each category subdirectory. E2e tests must be marked with `@pytest.mark.e2e` and are skipped by default.
- Use `pytest` and pytest-related libraries only. Do not use `unittest`.
- Avoid redundant tests. Do not write a test whose passing is already implied by another test. Each test should verify a unique behavior or condition; if a stronger test already covers the same logic, the weaker test is unnecessary.
- Try keeping test coverage at 100%.
- Try keeping one test class per file.
- Follow the Arrange-Act-Assert (AAA) pattern. Structure tests with three clearly separated sections marked by comments:
  ```python
  def test_something():
      # Arrange - set up test data and dependencies

      # Act - perform the action being tested

      # Assert - verify the expected outcome
  ```

## After Making Changes

**IMPORTANT**: After making any code changes (adding features, fixing bugs, refactoring), you MUST:

1. Run relevant tests to verify your changes:
   ```bash
   # For unit/integration tests (default, excludes e2e):
   cd backend && uv run pytest tests/unit/ tests/integration/ -v

   # For specific test file:
   cd backend && uv run pytest tests/unit/path/to/test_file.py -v
   ```

2. If tests fail, fix the issues before considering the work complete.

3. Always run pre-commit hooks before finishing:
   ```bash
   uv run pre-commit run --all-files
   ```

4. **ONLY at the very end**, after everything is finalized and all unit/integration tests pass, run e2e tests as a final verification:
   ```bash
   # E2e tests (requires Spotify credentials, run ONLY after everything else passes):
   cd backend && uv run pytest tests/e2e/ -m e2e -v
   ```

**Note**: E2e tests hit the real Spotify API and should be run sparingly, only as a final check when all other tests pass.

**Exception**: You may skip running tests if:
- The change is documentation-only (README, comments)
- The change is to test files themselves
- The user explicitly asks you to skip tests
