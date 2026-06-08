import { eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  commentTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import createNotification from "../../notification/controllers/create-notification";
import { parseMentionedUserIds } from "../../utils/parse-mentions";

async function createComment(taskId: string, userId: string, content: string) {
  const [task] = await db
    .select({ projectId: taskTable.projectId, title: taskTable.title })
    .from(taskTable)
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  const [comment] = await db
    .insert(commentTable)
    .values({
      taskId,
      userId,
      content,
    })
    .returning();

  if (!comment) {
    throw new HTTPException(500, { message: "Failed to create comment" });
  }

  await publishEvent("comment.created", {
    ...comment,
    taskId: comment.taskId,
    projectId: task.projectId,
    userId,
  });

  // Fire mention notifications for each @mentioned user (skip the commenter)
  const mentionedIds = parseMentionedUserIds(content).filter(
    (id) => id !== userId,
  );

  if (mentionedIds.length > 0) {
    const [commenter] = await db
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

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
          title: `${commenter?.name ?? "Someone"} mentioned you`,
          content: `You were mentioned in a comment on "${task.title ?? "a task"}"`,
          resourceId: taskId,
          resourceType: "task",
          eventData: {
            taskId,
            taskTitle: task.title,
            projectId: task.projectId,
            workspaceId: project?.workspaceId ?? null,
            commenterId: userId,
            commenterName: commenter?.name ?? null,
          },
        }),
      ),
    );
  }

  return comment;
}

export default createComment;
