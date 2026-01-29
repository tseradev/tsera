import lume from "lume/mod.ts";

const site = lume({
  src: "./src",
});
site.copy("assets");

export default site;