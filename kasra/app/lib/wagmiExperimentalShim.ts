// Shim for packages that still import from `wagmi/experimental`.
// wagmi v3 moved these APIs to the main `wagmi` export.

export {
  useCallsStatus,
  useSendCalls,
  useShowCallsStatus,
  // Some consumers may also use these:
  useSendCallsSync,
} from "wagmi";

export type {
  UseCallsStatusParameters,
  UseCallsStatusReturnType,
  UseSendCallsParameters,
  UseSendCallsReturnType,
  UseShowCallsStatusParameters,
  UseShowCallsStatusReturnType,
} from "wagmi";
