import { IOS_PLATFORMS } from "../prismjs/constants";

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
