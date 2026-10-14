import { prisma } from './prisma';
import { notificationsService } from './notifications-service';
import { AutomationTriggerType, AutomationExecutionStatus } from '@prisma/client';

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface WorkflowAction {
  type: 'CREATE_TASK' | 'UPDATE_TASK' | 'SEND_NOTIFICATION' | 'ADD_COMMENT';
  params: Record<string, any>;
}

export class AutomationService {
  async getAutomations(workspaceId: string) {
    return prisma.automation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        creator: { select: { id: true, displayName: true } },
        executions: {
          orderBy: { executedAt: 'desc' },
          take: 3,
        },
      },
    });
  }

  async createAutomation(
    workspaceId: string,
    creatorId: string,
    data: {
      name: string;
      description?: string;
      triggerType: AutomationTriggerType;
      triggerConfig?: any;
      conditions?: WorkflowCondition[];
      actions: WorkflowAction[];
      isEnabled?: boolean;
    }
  ) {
    return prisma.automation.create({
      data: {
        workspaceId,
        creatorId,
        name: data.name.trim(),
        description: data.description || null,
        triggerType: data.triggerType,
        triggerConfig: data.triggerConfig || null,
        conditions: (data.conditions || []) as any,
        actions: data.actions as any,
        isEnabled: data.isEnabled ?? true,
      },
    });
  }

  async toggleAutomation(automationId: string, workspaceId: string, isEnabled: boolean) {
    const auto = await prisma.automation.findFirst({
      where: { id: automationId, workspaceId },
    });
    if (!auto) throw new Error('Automation not found');

    return prisma.automation.update({
      where: { id: automationId },
      data: { isEnabled },
    });
  }

  async deleteAutomation(automationId: string, workspaceId: string) {
    const auto = await prisma.automation.findFirst({
      where: { id: automationId, workspaceId },
    });
    if (!auto) throw new Error('Automation not found');

    await prisma.automation.delete({ where: { id: automationId } });
    return { deleted: true };
  }

  /**
   * Evaluate conditions against an event payload
   */
  private evaluateConditions(conditions: WorkflowCondition[], payload: any): boolean {
    if (!conditions || conditions.length === 0) return true;

    for (const cond of conditions) {
      const fieldValue = payload[cond.field];

      switch (cond.operator) {
        case 'equals':
          if (String(fieldValue) !== String(cond.value)) return false;
          break;
        case 'not_equals':
          if (String(fieldValue) === String(cond.value)) return false;
          break;
        case 'contains':
          if (!String(fieldValue).toLowerCase().includes(String(cond.value).toLowerCase())) return false;
          break;
        case 'greater_than':
          if (Number(fieldValue) <= Number(cond.value)) return false;
          break;
        case 'less_than':
          if (Number(fieldValue) >= Number(cond.value)) return false;
          break;
        default:
          break;
      }
    }

    return true;
  }

  /**
   * Execute triggered automation workflows
   */
  async triggerWorkflows(
    workspaceId: string,
    triggerType: AutomationTriggerType,
    payload: any
  ) {
    const automations = await prisma.automation.findMany({
      where: {
        workspaceId,
        triggerType,
        isEnabled: true,
      },
    });

    for (const auto of automations) {
      const startTime = Date.now();
      const conditions = (auto.conditions as unknown as WorkflowCondition[]) || [];
      const actions = (auto.actions as unknown as WorkflowAction[]) || [];

      // Check conditions
      const matches = this.evaluateConditions(conditions, payload);
      if (!matches) {
        continue;
      }

      const actionResults: any[] = [];
      let status: AutomationExecutionStatus = 'SUCCESS';
      let errorMessage: string | null = null;

      try {
        for (const action of actions) {
          if (action.type === 'SEND_NOTIFICATION') {
            const recipientId = action.params.recipientId || payload.assigneeId || payload.creatorId;
            if (recipientId) {
              const notif = await notificationsService.createNotification(workspaceId, recipientId, {
                title: action.params.title || 'Automation Notification',
                message: action.params.message || `Automated alert triggered by ${auto.name}`,
                type: 'AUTOMATION_ALERT',
                linkUrl: action.params.linkUrl || (payload.id ? `/tasks` : undefined),
              });
              actionResults.push({ type: 'SEND_NOTIFICATION', notificationId: notif.id });
            }
          } else if (action.type === 'UPDATE_TASK' && payload.id) {
            await prisma.task.update({
              where: { id: payload.id },
              data: action.params.updates || {},
            });
            actionResults.push({ type: 'UPDATE_TASK', taskId: payload.id });
          } else if (action.type === 'ADD_COMMENT' && payload.id) {
            await prisma.taskComment.create({
              data: {
                taskId: payload.id,
                userId: auto.creatorId,
                content: `🤖 Automation (${auto.name}): ${action.params.content || 'Triggered workflow executed.'}`,
              },
            });
            actionResults.push({ type: 'ADD_COMMENT', taskId: payload.id });
          }
        }
      } catch (err: any) {
        status = 'FAILED';
        errorMessage = err.message || 'Execution failed';
        console.error(`Automation ${auto.id} failed:`, err);
      }

      const durationMs = Date.now() - startTime;

      // Log execution record
      await prisma.$transaction([
        prisma.automationExecution.create({
          data: {
            automationId: auto.id,
            triggerEvent: triggerType,
            status,
            actionResults: actionResults as any,
            errorMessage,
            durationMs,
          },
        }),
        prisma.automation.update({
          where: { id: auto.id },
          data: {
            executionCount: { increment: 1 },
            lastRunAt: new Date(),
          },
        }),
      ]);
    }
  }
}

export const automationService = new AutomationService();
