/**
 * Utility functions for safely parsing URLs.
 */

/**
 * Safely parses a URL string, automatically prepending a dummy protocol
 * if it's missing (e.g., for GitLab component references without a protocol).
 * This prevents TypeError: Invalid URL when parsing hostname/pathname.
 * 
 * @param url The URL string to parse
 * @returns A parsed URL object
 */
export function safeUrlParse(url: string): URL {
  let parseableUrl = url;
  if (!url.includes('://')) {
    parseableUrl = `https://${url}`;
  }
  return new URL(parseableUrl);
}

/**
 * Gets the default GitLab instance to use for component fetching/parsing
 * when an instance is not explicitly provided.
 * It first checks if the user has defined CI_SERVER_FQDN in customVariables.
 * 
 * @returns The fallback GitLab instance FQDN
 */
export function getFallbackGitlabInstance(): string {
  try {
    const vscode = require('vscode');
    const config = vscode.workspace.getConfiguration('gitlabComponentHelper');
    const customVars = config.get<Record<string, string>>('customVariables', {});
    return customVars['CI_SERVER_FQDN'] || 'gitlab.com';
  } catch (error) {
    // If not running in VS Code environment (e.g. tests), default to gitlab.com
    return 'gitlab.com';
  }
}

