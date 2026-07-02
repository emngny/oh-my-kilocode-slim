export interface PendingTaskCall {
  callId: string;
  parentSessionId: string;
  agentType: string;
  label: string;
  resumedTaskId?: string;
}

const MAX_PENDING_TASK_CALLS = 100;

export interface PendingCallTracker {
  add(call: PendingTaskCall): void;
  take(callId?: string, parentSessionId?: string): PendingTaskCall | undefined;
  firstForParent(parentSessionId: string): string | undefined;
  prune(maxSize: number): void;
  clearForSession(sessionId: string): void;
  pendingCallId(sessionID?: string): string;
}

export function createPendingCallTracker(): PendingCallTracker {
  const pendingCalls = new Map<string, PendingTaskCall>();
  const pendingCallOrder: string[] = [];
  let anonymousPendingCallId = 0;

  return {
    add(call: PendingTaskCall) {
      const existingIndex = pendingCallOrder.indexOf(call.callId);
      if (existingIndex >= 0) {
        pendingCallOrder.splice(existingIndex, 1);
      }
      pendingCalls.set(call.callId, call);
      pendingCallOrder.push(call.callId);
      while (pendingCallOrder.length > MAX_PENDING_TASK_CALLS) {
        const evictedCallId = pendingCallOrder.shift();
        if (!evictedCallId) break;
        pendingCalls.delete(evictedCallId);
      }
    },

    take(callId?: string, parentSessionId?: string) {
      const resolvedCallId =
        callId ??
        (parentSessionId ? this.firstForParent(parentSessionId) : undefined);
      if (!resolvedCallId) return undefined;
      const pending = pendingCalls.get(resolvedCallId);
      pendingCalls.delete(resolvedCallId);
      const orderIndex = pendingCallOrder.indexOf(resolvedCallId);
      if (orderIndex >= 0) {
        pendingCallOrder.splice(orderIndex, 1);
      }
      return pending;
    },

    firstForParent(parentSessionId: string) {
      return pendingCallOrder.find(
        (id) => pendingCalls.get(id)?.parentSessionId === parentSessionId,
      );
    },

    prune(maxSize: number) {
      while (pendingCallOrder.length > maxSize) {
        const evicted = pendingCallOrder.shift();
        if (!evicted) break;
        pendingCalls.delete(evicted);
      }
    },

    clearForSession(sessionId: string) {
      for (const [callId, pending] of pendingCalls.entries()) {
        if (pending.parentSessionId !== sessionId) continue;
        this.take(callId);
      }
    },

    pendingCallId(sessionID?: string) {
      return `${sessionID ?? 'unknown'}:anonymous-${++anonymousPendingCallId}`;
    },
  };
}
