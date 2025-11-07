import { type Config } from "jsr:@fresh/core@2";

export default {
  build: {
    target: ["chrome99", "firefox99", "safari15"],
  },
} satisfies Config;
