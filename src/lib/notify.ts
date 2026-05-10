import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

export async function createNotification(args: {
  userId: string;
  tipe: NotificationType;
  judul: string;
  pesan: string;
  link?: string | null;
}) {
  try {
    await prisma.notification.create({
      data: {
        userId: args.userId,
        tipe: args.tipe,
        judul: args.judul,
        pesan: args.pesan,
        link: args.link ?? null,
      },
    });
  } catch (e) {
    console.error("createNotification error", e);
  }
}

export async function notifyMany(
  userIds: string[],
  args: Omit<Parameters<typeof createNotification>[0], "userId">
) {
  await Promise.all(
    userIds.filter(Boolean).map((userId) =>
      createNotification({ ...args, userId })
    )
  );
}
