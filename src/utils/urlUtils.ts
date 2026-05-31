import * as vscode from 'vscode';
import { getGitLabInstanceFromLocalFile } from './gitUtils';

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
 * It checks CI_SERVER_FQDN, then local git remote, and finally defaults to gitlab.com.
 * Prompts the user if an inferred host should be trusted.
 * 
 * @param documentUri Optional URI of the file being processed, to read local git origin
 * @returns The fallback GitLab instance FQDN
 */
export async function getFallbackGitlabInstance(documentUri?: vscode.Uri): Promise<string> {
  try {
    const config = vscode.workspace.getConfiguration('gitlabComponentHelper');
    const customVars = config.get<Record<string, string>>('customVariables', {});
    
    // 1. Explicitly configured variable
    if (customVars['CI_SERVER_FQDN']) {
      return customVars['CI_SERVER_FQDN'];
    }

    // 2. Try to infer from git remote
    let inferredHost: string | undefined;
    if (documentUri) {
      // Check privacy setting before reading git directory
      let allowGitRead = config.get<boolean>('visualizer.allowGitOriginRead');
      
      if (allowGitRead === undefined && vscode.window && vscode.window.showInformationMessage) {
        const gitSelection = await vscode.window.showInformationMessage(
          `GitLab Component Helper would like to read your local .git/config to securely determine the correct GitLab instance for this project. Is this allowed?`,
          'Yes',
          'Yes, always',
          'No'
        );
        allowGitRead = (gitSelection === 'Yes' || gitSelection === 'Yes, always');
        
        if (gitSelection === 'Yes, always' || gitSelection === 'No') {
          await config.update('visualizer.allowGitOriginRead', allowGitRead, vscode.ConfigurationTarget.Workspace);
        }
      }

      if (allowGitRead) {
        inferredHost = await getGitLabInstanceFromLocalFile(documentUri.fsPath);
      }
    }
    
    // 3. Fallback to gitlab.com
    const finalHost = inferredHost || 'gitlab.com';
    
    // Ask for permission since it wasn't explicitly configured
    if (vscode.window && vscode.window.showInformationMessage) {
      const selection = await vscode.window.showInformationMessage(
        `GitLab Component Helper is about to request components from ${finalHost}. Is this the correct GitLab instance for this project?`,
        'Yes',
        'Yes, remember this',
        'No'
      );
      
      if (selection === 'Yes' || selection === 'Yes, remember this') {
        if (selection === 'Yes, remember this') {
          // Save it to workspace config so we don't ask again
          const newCustomVars = { ...customVars, 'CI_SERVER_FQDN': finalHost };
          await config.update('customVariables', newCustomVars, vscode.ConfigurationTarget.Workspace);
        }
        return finalHost;
      } else {
        throw new Error(`Component fetch aborted. Please configure CI_SERVER_FQDN in workspace settings.`);
      }
    }
    
    // Fallback for tests or environments where window is missing
    return finalHost;
  } catch (error) {
    if (error instanceof Error && error.message.includes('aborted')) {
      throw error;
    }
    // If not running in VS Code environment (e.g. tests), default to gitlab.com
    return 'gitlab.com';
  }
}

