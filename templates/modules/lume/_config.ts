import lume from "lume/mod.ts";

const site = lume({
  src: "./",
  dest: "./.tsera/.temp_front",
});
site.copy("assets");

export default site;
