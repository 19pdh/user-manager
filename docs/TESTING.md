# Testing Strategy

This project uses [Jest](https://jestjs.io/) for testing. Since the code runs in the Google Apps Script (GAS) environment, we use a combination of unit tests for pure logic and integration tests with mocked GAS globals.

## Running Tests

To run the tests, execute:

```bash
npm test
```

This will run all files ending in `.test.ts`.

## Unit Tests

Unit tests are located in `src/lib/*.test.ts` (or alongside the file they test). They focus on pure functions that do not depend on `SpreadsheetApp`, `GmailApp`, etc.

**Example:** `src/lib/utils.test.ts` tests `sanitize` and `proposeEmail` functions.

## Integration Tests & Mocking

Integration tests simulate the execution of handlers (like `onFormSubmit`) by mocking the global objects provided by Google Apps Script.

### Mocks Location

Mocks are defined in `tests/mocks/google-apps-script.ts`. This file exports objects like `SpreadsheetApp`, `GmailApp`, `HtmlService`, etc., with Jest mock functions.

### How to Write a New Integration Test

1.  **Import the Mocks:**
    Import the mock setup *before* importing your handler. This ensures that when your handler is imported, the global variables are already available.

    ```typescript
    import "../../tests/mocks/google-apps-script";
    import { yourHandler } from "./yourHandler";
    import { SpreadsheetApp, GmailApp } from "../../tests/mocks/google-apps-script";
    ```

2.  **Reset Mocks:**
    Use `beforeEach` to clear mocks and set up specific return values for your test case.

    ```typescript
    beforeEach(() => {
      jest.clearAllMocks();
      // Setup specific behavior
      (SpreadsheetApp.getActiveSpreadsheet as jest.Mock).mockReturnValue(...);
    });
    ```

3.  **Mock Complex Interactions:**
    For chained calls like `sheet.getRange(row, col).getValue()`, you may need to implement a mock function that returns an object with its own mocked methods. See `src/handlers/formHandler.test.ts` for a comprehensive example.

4.  **Assertions:**
    Use Jest's `expect` to verify that side effects occurred as expected (e.g., `setValue` was called on a specific cell, or `GmailApp.sendEmail` was triggered).

    ```typescript
    expect(mockRange.setValue).toHaveBeenCalledWith("expected value");
    ```

## CI/CD

Tests are automatically run on every Push and Pull Request to the `main` or `master` branch via GitHub Actions (`.github/workflows/ci.yml`).
