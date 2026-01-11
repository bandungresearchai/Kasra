import { nextDev } from "next/dist/cli/next-dev.js";

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

const hostname = getArg("--hostname") ?? "0.0.0.0";
const portRaw = getArg("--port") ?? process.env.PORT ?? "3001";
const port = Number(portRaw);

if (!Number.isFinite(port) || port <= 0) {
  // eslint-disable-next-line no-console
  console.error(`Invalid port: ${portRaw}`);
  process.exit(1);
}

// Minimal option set needed by nextDev().
// Running this script is a workaround for environments where `next dev` exits
// immediately when invoked from the CLI.
const options = {
  hostname,
  port,
  turbo: false,
  turbopack: false,
  webpack: false,
  disableSourceMaps: false,
  experimentalHttps: false,
  experimentalHttpsKey: undefined,
  experimentalHttpsCert: undefined,
  experimentalHttpsCa: undefined,
  experimentalUploadTrace: undefined,
  experimentalNextConfigStripTypes: false,
  inspect: undefined,
};

// eslint-disable-next-line no-console
console.log("[dev-workaround] starting", { hostname, port, node: process.version });

nextDev(options, "cli", undefined).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

// eslint-disable-next-line no-console
console.log("[dev-workaround] nextDev invoked; keeping process alive");

// Keep the process alive. In Node 22, Next's CLI/dev flow can exit early because
// a pending Promise (including top-level await) does not keep the event loop alive.
setInterval(() => {}, 1 << 30);
