Deno.test("placeholder", () => {
  const actual = [1].length === 1;
  if (!actual) {
    throw new Error("placeholder should always pass");
  }
});
