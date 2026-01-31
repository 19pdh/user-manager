export const SpreadsheetApp = {
  getActiveSpreadsheet: jest.fn(),
};

export const GmailApp = {
  sendEmail: jest.fn(),
};

export const HtmlService = {
  createTemplateFromFile: jest.fn(),
};

export const UrlFetchApp = {
  fetch: jest.fn(),
};

export const Logger = {
  log: jest.fn(),
};

export const Utilities = {
  sleep: jest.fn(),
};

// Global assignment for tests
(global as any).SpreadsheetApp = SpreadsheetApp;
(global as any).GmailApp = GmailApp;
(global as any).HtmlService = HtmlService;
(global as any).UrlFetchApp = UrlFetchApp;
(global as any).Logger = Logger;
(global as any).Utilities = Utilities;
