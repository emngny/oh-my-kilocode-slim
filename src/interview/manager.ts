import path from 'node:path';
import type { PluginInput } from '@opencode-ai/plugin';
import type { PluginConfig } from '../config';
import { DEFAULT_DASHBOARD_PORT } from './dashboard';
import { createDashboardManager } from './dashboard-manager';
import { createInterviewServer } from './server';
import { createInterviewService } from './service';

export function createInterviewManager(
  ctx: PluginInput,
  config: PluginConfig,
): {
  registerCommand: (config: Record<string, unknown>) => void;
  handleCommandExecuteBefore: (
    input: { command: string; sessionID: string; arguments: string },
    output: { parts: Array<{ type: string; text?: string }> },
  ) => Promise<void>;
  handleEvent: (input: {
    event: { type: string; properties?: Record<string, unknown> };
  }) => Promise<void>;
} {
  const interviewConfig = config.interview;
  const effectivePort = interviewConfig?.port ?? 0;
  const dashboardEnabled =
    interviewConfig?.dashboard === true || effectivePort > 0;
  const outputFolder = interviewConfig?.outputFolder ?? 'interview';

  // ─── Per-session mode (upstream behavior) ───────────────────────
  if (!dashboardEnabled) {
    const service = createInterviewService(ctx, interviewConfig);
    const resolvedOutputPath = path.join(ctx.directory, outputFolder);
    const server = createInterviewServer({
      getState: async (interviewId) => service.getInterviewState(interviewId),
      listInterviewFiles: async () => service.listInterviewFiles(),
      listInterviews: () => service.listInterviews(),
      submitAnswers: async (interviewId, answers) =>
        service.submitAnswers(interviewId, answers),
      submitBlockComment: async (interviewId, section, comment) =>
        service.submitBlockComment(interviewId, section, comment),
      submitChat: async (interviewId, message) =>
        service.submitChat(interviewId, message),
      handleNudgeAction: async (interviewId, action) =>
        service.handleNudgeAction(interviewId, action),
      outputFolder: resolvedOutputPath,
      port: 0, // random port
    });

    service.setBaseUrlResolver(() => server.ensureStarted());

    return {
      registerCommand: (c) => service.registerCommand(c),
      handleCommandExecuteBefore: async (input, output) =>
        service.handleCommandExecuteBefore(input, output),
      handleEvent: async (input) => service.handleEvent(input),
    };
  }

  // ─── Dashboard mode ─────────────────────────────────────────────
  const dashboardPort =
    effectivePort > 0 ? effectivePort : DEFAULT_DASHBOARD_PORT;

  return createDashboardManager(ctx, config, dashboardPort, outputFolder);
}
