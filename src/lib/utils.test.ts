import { sanitize, proposeEmail, parseFormUrlEncoded } from "./utils";

describe("sanitize", () => {
  it("should replace Polish characters", () => {
    expect(sanitize("Łukasz")).toBe("lukasz");
    expect(sanitize("Żółw")).toBe("zolw");
    expect(sanitize("Święto")).toBe("swieto");
  });

  it("should remove special characters", () => {
    expect(sanitize("test@example.com")).toBe("testexamplecom");
    expect(sanitize("hello! world?")).toBe("helloworld");
  });

  it("should handle spaces and hyphens", () => {
    expect(sanitize("Jean-Luc")).toBe("jean-luc");
    expect(sanitize("Mary Jane")).toBe("maryjane");
  });

  it("should trim whitespace", () => {
    expect(sanitize("  test  ")).toBe("test");
  });

  it("should normalize multiple hyphens", () => {
    expect(sanitize("a--b")).toBe("a-b");
  });

  it("should remove leading/trailing hyphens", () => {
    expect(sanitize("-test-")).toBe("test");
  });
});

describe("proposeEmail", () => {
  it("should combine name and surname with a dot", () => {
    expect(proposeEmail("Jan", "Kowalski")).toBe("jan.kowalski");
  });

  it("should sanitize inputs", () => {
    expect(proposeEmail("Łukasz", "Nowak-Zdrój")).toBe("lukasz.nowak-zdroj");
  });
});

describe("parseFormUrlEncoded", () => {
  it("should parse simple key-value pairs", () => {
    const input = "key1=value1&key2=value2";
    const expected = { key1: "value1", key2: "value2" };
    expect(parseFormUrlEncoded(input)).toEqual(expected);
  });

  it("should handle URL encoding", () => {
    const input = "name=Jan+Kowalski&city=Bielsko-Bia%C5%82a";
    const expected = { name: "Jan Kowalski", city: "Bielsko-Biała" };
    expect(parseFormUrlEncoded(input)).toEqual(expected);
  });

  it("should handle single pair", () => {
    const input = "foo=bar";
    const expected = { foo: "bar" };
    expect(parseFormUrlEncoded(input)).toEqual(expected);
  });
});
