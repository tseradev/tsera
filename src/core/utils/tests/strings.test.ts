import { assertEquals } from "../../../testing/asserts.ts";
import { isPascalCase, pascalToSnakeCase } from "../strings.ts";

Deno.test("isPascalCase - accepts valid PascalCase strings", () => {
  assertEquals(isPascalCase("User"), true);
  assertEquals(isPascalCase("UserProfile"), true);
  assertEquals(isPascalCase("XMLParser"), true);
  assertEquals(isPascalCase("User2"), true);
  assertEquals(isPascalCase("U"), true);
});

Deno.test("isPascalCase - rejects invalid PascalCase strings", () => {
  assertEquals(isPascalCase("user"), false);
  assertEquals(isPascalCase("userProfile"), false);
  assertEquals(isPascalCase("user_profile"), false);
  assertEquals(isPascalCase("User-Profile"), false);
  assertEquals(isPascalCase("2User"), false);
  assertEquals(isPascalCase(""), false);
  assertEquals(isPascalCase("_User"), false);
});

Deno.test("pascalToSnakeCase - converts simple PascalCase", () => {
  assertEquals(pascalToSnakeCase("User"), "user");
  assertEquals(pascalToSnakeCase("Product"), "product");
});

Deno.test("pascalToSnakeCase - converts compound PascalCase", () => {
  assertEquals(pascalToSnakeCase("UserProfile"), "user_profile");
  assertEquals(pascalToSnakeCase("OrderItem"), "order_item");
  assertEquals(pascalToSnakeCase("ProductCategory"), "product_category");
});

Deno.test("pascalToSnakeCase - handles acronyms correctly", () => {
  assertEquals(pascalToSnakeCase("XMLParser"), "xml_parser");
  assertEquals(pascalToSnakeCase("HTTPRequest"), "http_request");
  assertEquals(pascalToSnakeCase("URLPath"), "url_path");
});

Deno.test("pascalToSnakeCase - handles numbers", () => {
  assertEquals(pascalToSnakeCase("User2"), "user2");
  assertEquals(pascalToSnakeCase("Page404"), "page404");
  assertEquals(pascalToSnakeCase("User2Profile"), "user2_profile");
});

Deno.test("pascalToSnakeCase - handles multiple consecutive capitals", () => {
  assertEquals(pascalToSnakeCase("XMLHTTPRequest"), "xmlhttp_request");
  assertEquals(pascalToSnakeCase("HTMLElement"), "html_element");
});

Deno.test("pascalToSnakeCase - handles single letter", () => {
  assertEquals(pascalToSnakeCase("A"), "a");
  assertEquals(pascalToSnakeCase("X"), "x");
});

Deno.test("pascalToSnakeCase - handles edge cases", () => {
  assertEquals(pascalToSnakeCase("AB"), "ab");
  assertEquals(pascalToSnakeCase("ABC"), "abc");
  assertEquals(pascalToSnakeCase("ABc"), "a_bc");
});
