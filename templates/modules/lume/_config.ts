import lume from "https://deno.land/x/lume@v3.1.4/mod.ts";

const site = lume({
  src: "./src",
  dest: "./.tsera/.temp_front"
});
site.copy("assets");

export default site;