import { eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import createNotification from "../../notification/controllers/create-notification";
import { parseMentionedUserIds } from "../../utils/parse-mentions";

async function createComment(taskId: string, userId: string, content: string) {
  const [activity] = await db
    .insert(activityTable)
    .values({
      taskId,
      type: "comment",
      userId,
      content,
    })
    .returning();

  if (!activity) {
    throw new HTTPException(500, {
      message: "Failed to create activity",
    });
  }

  const [user] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId));

  const [task] = await db
    .select({ projectId: taskTable.projectId, title: taskTable.title })
    .from(taskTable)
    .where(eq(taskTable.id, taskId));

  if (task) {
    await publishEvent("task.comment_created", {
      ...activity,
      comment: `"${user?.name}" commented: ${content}`,
      projectId: task.projectId,
    });

    // Fire mention notifications for each @mentioned user (skip the commenter)
    const mentionedIds = parseMentionedUserIds(content).filter(
      (id) => id !== userId,
    );

    if (mentionedIds.length > 0) {
      const [project] = await db
        .select({ workspaceId: projectTable.workspaceId })
        .from(projectTable)
        .where(eq(projectTable.id, task.projectId))
        .limit(1);

      const mentionedUsers = await db
        .select({ id: userTable.id })
        .from(userTable)
        .where(inArray(userTable.id, mentionedIds));

      await Promise.allSettled(
        mentionedUsers.map((mentioned) =>
          createNotification({
            userId: mentioned.id,
            type: "task_mention",
            title: `${user?.name ?? "Someone"} mentioned you`,
            content: `You were mentioned in a comment on "${task.title ?? "a task"}"`,
            resourceId: taskId,
            resourceType: "task",
            eventData: {
              taskId,
              taskTitle: task.title,
              projectId: task.projectId,
              workspaceId: project?.workspaceId ?? null,
              commenterId: userId,
              commenterName: user?.name ?? null,
            },
          }),
        ),
      );
    }
  }

  return activity;
}

export default createComment;
