import {
  declareClassPlugin,
  PluginKind
} from "./tools/node_modules/@stryker-mutator/api/dist/src/plugin/index.js";
import {
  commonTokens,
  tokens
} from "./tools/node_modules/@stryker-mutator/api/dist/src/plugin/tokens.js";
import { writeFileSync, appendFileSync, mkdirSync } from "node:fs";
class Heartbeat {
  static inject = tokens(commonTokens.options);
  constructor(options) {
    this.options = options;
    this.started = new Date();
    this.counts = {};
    this.count = 0;
    mkdirSync("scripts/mutation/.native-generated", { recursive: true });
    this.log = `scripts/mutation/.native-generated/stryker-${process.pid}.jsonl`;
  }
  onMutantTested(result) {
    this.counts[result.status] = (this.counts[result.status] ?? 0) + 1;
    appendFileSync(this.log, JSON.stringify(result) + "\n");
    if (++this.count % 25 === 0)
      console.log("stryker heartbeat: " + this.count + " " + JSON.stringify(this.counts));
  }
  onMutationTestReportReady(report) {
    writeFileSync(
      this.options.jsonReporter.fileName.replace(".json", "-run.json"),
      JSON.stringify({
        package: this.options.mutate[0].split("/")[1],
        command:
          "node scripts/mutation/tools/node_modules/@stryker-mutator/core/bin/stryker.js run " +
          this.options.configFile,
        startedAt: this.started.toISOString(),
        finishedAt: new Date().toISOString(),
        durationSeconds: Math.round((Date.now() - this.started) / 1000),
        exitCode: 0,
        counts: this.counts
      })
    );
  }
}
export const strykerPlugins = [declareClassPlugin(PluginKind.Reporter, "heartbeat", Heartbeat)];
