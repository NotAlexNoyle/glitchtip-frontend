import { IOS_PLATFORMS } from "../prismjs/constants";
import { Stacktrace } from "./interfaces";

export function isStacktrace(
  stacktrace?: {} | Stacktrace | null,
): stacktrace is Stacktrace {
  return stacktrace ? (stacktrace as Stacktrace).frames !== undefined : false;
}

export function isIosPlatform(platform: string | null): boolean {
  return !!platform && (IOS_PLATFORMS as readonly string[]).includes(platform);
}

export function cleanIosPath(path: string): string {
  const match = path.match(/([^\/]+\.(app|appex|framework|bundle|xctest)\/.+)$/);
  return match ? match[1] : path;
}

export function isSwiftNameMangled(
  functionName: string | null,
  platform: string | null,
): boolean {
  if (!functionName || !isIosPlatform(platform)) {
    return false;
  }
  return functionName.startsWith("$s") || functionName.startsWith("_$s");
}

/**
 * Whether a search could be an issue short ID such as `MY-APP-1A`: a project
 * slug, a hyphen, then a base32 code. Mirrors the backend's parser, so only
 * these searches ask it for a short ID lookup.
 */
export function looksLikeShortId(query: string): boolean {
  return /^[a-z0-9_-]{1,50}-[0-9a-v]{1,7}$/i.test(query.trim());
}
