import "../../tests/mocks/google-apps-script";
import { onFormSubmit } from "./formHandler";
import { SpreadsheetApp, GmailApp, HtmlService } from "../../tests/mocks/google-apps-script";

describe("onFormSubmit", () => {
  let mockSheet: any;
  let mockHtmlTemplate: any;

  // Track setValue calls: { "row,col": value }
  let sheetValues: Record<string, any> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    sheetValues = {};

    // Mock Sheet
    mockSheet = {
      getDataRange: jest.fn().mockReturnValue({
        // Define headers. The code relies on finding column index by header name.
        // We must ensure the headers match the keys used in getRow and updateRow.
        // In onFormSubmit:
        // let { name, surname, troupName, superiorEmail, primaryEmail } = getRow(sheet, row);
        // updateRow(sheet, row, { status: ..., primaryEmail: ..., isUnit: ... });
        //
        // So the headers array must contain:
        // "name", "surname", "troupName", "superiorEmail", "primaryEmail", "status", "isUnit"
        // (Assuming the code uses exact header names as keys, or maps them somehow.
        // Let's check getRow implementation again. It maps headers directly to object keys.)
        getDisplayValues: jest.fn().mockReturnValue([
          ["name", "surname", "troupName", "superiorEmail", "primaryEmail", "status", "isUnit"],
        ]),
      }),
      // Mock getRange to return an object that can get/set values based on row/col
      getRange: jest.fn((row, col) => ({
        getValue: jest.fn(() => {
            // Return initial data for row 2
            // Column indices are 1-based
            if (row === 2) {
                if (col === 1) return "Jan";         // name
                if (col === 2) return "Kowalski";    // surname
                if (col === 3) return "";            // troupName (empty)
                if (col === 4) return "boss@zhr.pl"; // superiorEmail
                if (col === 5) return "";            // primaryEmail (empty initially)
            }
            return sheetValues[`${row},${col}`] || "";
        }),
        setValue: jest.fn((val) => {
            sheetValues[`${row},${col}`] = val;
        }),
      })),
    };

    // Mock SpreadsheetApp
    (SpreadsheetApp.getActiveSpreadsheet as jest.Mock).mockReturnValue({
      getSheetByName: jest.fn().mockReturnValue(mockSheet),
    });

    // Mock HtmlService
    mockHtmlTemplate = {
      evaluate: jest.fn().mockReturnValue({
        getContent: jest.fn().mockReturnValue("<html>content</html>"),
      }),
    };
    // Need to assign property to the mock function so the code can set .title and .content
    (HtmlService.createTemplateFromFile as jest.Mock).mockImplementation(() => mockHtmlTemplate);
  });

  it("should handle form submission for a new user and notify superior", () => {
    // The event object passed to onFormSubmit
    const event = {
      range: {
          getRow: () => 2
      },
    } as any;

    // Run the handler
    onFormSubmit(event);

    // Verify "primaryEmail" (column 5) was set to "jan.kowalski@zhr.pl"
    expect(sheetValues["2,5"]).toBe("jan.kowalski@zhr.pl");

    // Verify "status" (column 6) was set to "Oczekiwanie na opiekuna"
    expect(sheetValues["2,6"]).toBe("Oczekiwanie na opiekuna");

    // Verify "isUnit" (column 7) was set to false
    expect(sheetValues["2,7"]).toBe(false);

    // Verify email sent to superior
    expect(GmailApp.sendEmail).toHaveBeenCalledWith(
      "boss@zhr.pl",
      expect.stringContaining("Założenia konta"),
      "",
      expect.objectContaining({
        htmlBody: expect.stringContaining("<html>content</html>"),
      })
    );
  });
});
