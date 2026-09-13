import { MongoClient } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../src/app/lib/prisma";

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://bdbook:XHrNs4BPJlePI82S@mdb.26vlivz.mongodb.net/?appName=MDB";

async function main() {
  console.log("🚀 Starting Data Migration from MongoDB (bdbook) to Neon PostgreSQL...");

  const mongoClient = new MongoClient(MONGO_URI);
  await mongoClient.connect();
  console.log("✅ Connected to MongoDB");

  const db = mongoClient.db("bdbook");

  // Map to store mongo ObjectId string -> new PostgreSQL UUID
  const idMap = new Map<string, string>();

  function getOrSetUuid(id: any): string {
    if (!id) return uuidv4();
    const str = id.toString();
    if (!idMap.has(str)) {
      idMap.set(str, uuidv4());
    }
    return idMap.get(str)!;
  }

  // Clear existing test user or tables to prevent email/unique conflicts
  console.log("🧹 Cleaning up test data from PostgreSQL...");
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.postLike.deleteMany();
  await prisma.postRepost.deleteMany();
  await prisma.savedPost.deleteMany();
  await prisma.interestedPost.deleteMany();
  await prisma.notInterestedPost.deleteMany();
  await prisma.post.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.friendRequest.deleteMany();
  await prisma.user.deleteMany();

  // ================= 1. USERS =================
  console.log("📦 Migrating Users...");
  const mongoUsers = await db.collection("users").find({}).toArray();
  console.log(`Found ${mongoUsers.length} users in MongoDB`);

  for (const u of mongoUsers) {
    const newId = getOrSetUuid(u._id);
    const email = (u.email || "").toLowerCase().trim();

    const genderVal =
      u.gender === "male" || u.gender === "female" || u.gender === "other"
        ? u.gender
        : null;

    try {
      await prisma.user.create({
        data: {
          id: newId,
          email,
          password: u.password || "temp_password_123",
          fullName: u.fullName || "User",
          role: u.role === "admin" ? "admin" : "user",
          gender: genderVal,
          dob: u.dob ? new Date(u.dob) : null,
          profilePicUrl: u.profilePicture?.url || null,
          profilePicPublicId: u.profilePicture?.publicId || null,
          profilePicOptimizedUrl: u.profilePicture?.optimizedUrl || null,
          coverPhotoUrl: u.coverPhoto?.url || null,
          coverPhotoPublicId: u.coverPhoto?.publicId || null,
          coverPhotoOptimizedUrl: u.coverPhoto?.optimizedUrl || null,
          isActive: u.isActive !== false,
          isVerified: u.isVerified === true,
          createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
          updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
        },
      });
    } catch (err: any) {
      console.warn(`User ${email} creation warning:`, err.message);
    }
  }
  console.log("✅ Users migrated successfully!");

  // ================= 2. POSTS =================
  console.log("📦 Migrating Posts...");
  const mongoPosts = await db.collection("posts").find({}).toArray();
  console.log(`Found ${mongoPosts.length} posts in MongoDB`);

  // Pass 1: Insert posts
  for (const p of mongoPosts) {
    const postId = getOrSetUuid(p._id);
    const authorId = p.userId ? idMap.get(p.userId.toString()) : null;

    if (!authorId) {
      // Skip posts with orphaned author
      continue;
    }

    try {
      await prisma.post.create({
        data: {
          id: postId,
          userId: authorId,
          description: p.description || "",
          mediaUrl: p.media?.url || null,
          mediaPublicId: p.media?.publicId || null,
          mediaType: p.media?.resourceType || null,
          mediaMimeType: p.media?.mimeType || null,
          mediaSize: p.media?.size || null,
          isShare: p.isShare === true,
          isRepost: p.isRepost === true,
          isActive: p.isActive !== false,
          deletedAt: p.deletedAt ? new Date(p.deletedAt) : null,
          createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
          updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
        },
      });
    } catch (err: any) {
      console.warn(`Post ${postId} warning:`, err.message);
    }
  }

  // Pass 2: Connect shares/reposts originalPostId
  for (const p of mongoPosts) {
    if (p.originalPost?._id) {
      const postId = idMap.get(p._id.toString());
      const origPostId = idMap.get(p.originalPost._id.toString());
      if (postId && origPostId) {
        try {
          await prisma.post.update({
            where: { id: postId },
            data: { originalPostId: origPostId },
          });
        } catch {
          // ignore
        }
      }
    }
  }

  // Pass 3: Post Likes & Comments
  for (const p of mongoPosts) {
    const postId = idMap.get(p._id.toString());
    if (!postId) continue;

    // Likes
    if (Array.isArray(p.likes)) {
      for (const likerMongoId of p.likes) {
        const likerId = idMap.get(likerMongoId.toString());
        if (likerId) {
          try {
            await prisma.postLike.create({
              data: {
                postId,
                userId: likerId,
              },
            });
          } catch {
            // ignore duplicate likes
          }
        }
      }
    }

    // Reposts
    if (Array.isArray(p.reposts)) {
      for (const reposterMongoId of p.reposts) {
        const reposterId = idMap.get(reposterMongoId.toString());
        if (reposterId) {
          try {
            await prisma.postRepost.create({
              data: {
                postId,
                userId: reposterId,
              },
            });
          } catch {
            // ignore
          }
        }
      }
    }

    // Comments
    if (Array.isArray(p.comments)) {
      for (const c of p.comments) {
        const commentId = getOrSetUuid(c._id);
        const commentUserId = c.userId ? idMap.get(c.userId.toString()) : null;

        if (commentUserId && c.text) {
          try {
            await prisma.comment.create({
              data: {
                id: commentId,
                postId,
                userId: commentUserId,
                text: c.text,
                createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
                updatedAt: c.createdAt ? new Date(c.createdAt) : new Date(),
              },
            });

            // Replies
            if (Array.isArray(c.replies)) {
              for (const r of c.replies) {
                const replyId = getOrSetUuid(r._id);
                const replyUserId = r.userId ? idMap.get(r.userId.toString()) : null;
                if (replyUserId && r.text) {
                  try {
                    await prisma.comment.create({
                      data: {
                        id: replyId,
                        postId,
                        userId: replyUserId,
                        parentId: commentId,
                        text: r.text,
                        createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
                        updatedAt: r.createdAt ? new Date(r.createdAt) : new Date(),
                      },
                    });
                  } catch {
                    // ignore
                  }
                }
              }
            }
          } catch (err: any) {
            console.warn("Comment warning:", err.message);
          }
        }
      }
    }
  }
  console.log("✅ Posts, likes, and comments migrated successfully!");

  // ================= 3. SAVED POSTS =================
  for (const u of mongoUsers) {
    const userId = idMap.get(u._id.toString());
    if (userId && Array.isArray(u.savedPosts)) {
      for (const savedPostMongoId of u.savedPosts) {
        const postId = idMap.get(savedPostMongoId.toString());
        if (postId) {
          try {
            await prisma.savedPost.create({
              data: { userId, postId },
            });
          } catch {
            // ignore
          }
        }
      }
    }
  }

  // ================= 4. FRIENDSHIPS & REQUESTS =================
  console.log("📦 Migrating Friends & Friend Requests...");
  const mongoFriends = await db.collection("friends").find({}).toArray();
  for (const f of mongoFriends) {
    const userId = idMap.get(f.userId?.toString());
    const friendId = idMap.get(f.friendId?.toString());
    if (userId && friendId && userId !== friendId) {
      try {
        await prisma.friendship.upsert({
          where: { userId_friendId: { userId, friendId } },
          update: {},
          create: {
            userId,
            friendId,
            createdAt: f.createdAt ? new Date(f.createdAt) : new Date(),
          },
        });
      } catch {
        // ignore
      }
    }
  }

  const mongoRequests = await db.collection("friendRequests").find({}).toArray();
  for (const r of mongoRequests) {
    const senderId = idMap.get(r.senderId?.toString());
    const receiverId = idMap.get(r.receiverId?.toString());
    if (senderId && receiverId && senderId !== receiverId) {
      const statusVal =
        r.status === "accepted" || r.status === "declined" ? r.status : "pending";
      try {
        await prisma.friendRequest.upsert({
          where: { senderId_receiverId: { senderId, receiverId } },
          update: { status: statusVal },
          create: {
            id: getOrSetUuid(r._id),
            senderId,
            receiverId,
            status: statusVal,
            createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
            updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
          },
        });
      } catch {
        // ignore
      }
    }
  }
  console.log("✅ Friends and Friend Requests migrated!");

  // ================= 5. CONVERSATIONS & MESSAGES =================
  console.log("📦 Migrating Messages & Conversations...");
  const mongoMessages = await db.collection("messages").find({}).toArray();

  for (const m of mongoMessages) {
    const senderId = idMap.get(m.senderId?.toString());
    const receiverId = idMap.get(m.receiverId?.toString());

    if (!senderId || !receiverId) continue;

    const messageTypeVal =
      m.messageType === "image" ||
      m.messageType === "video" ||
      m.messageType === "file" ||
      m.messageType === "share"
        ? m.messageType
        : "text";

    try {
      await prisma.message.create({
        data: {
          id: getOrSetUuid(m._id),
          senderId,
          receiverId,
          message: m.message || "",
          messageType: messageTypeVal,
          mediaUrl: m.mediaUrl || null,
          fileName: m.fileName || null,
          fileSize: m.fileSize || null,
          isRead: m.isRead === true,
          isDelivered: m.isDelivered !== false,
          createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
          updatedAt: m.updatedAt ? new Date(m.updatedAt) : new Date(),
        },
      });
    } catch {
      // ignore
    }
  }

  // Rebuild conversations from messages
  const userPairs = new Set<string>();
  for (const m of mongoMessages) {
    const s = idMap.get(m.senderId?.toString());
    const r = idMap.get(m.receiverId?.toString());
    if (s && r) {
      const key = [s, r].sort().join("___");
      userPairs.add(key);
    }
  }

  for (const pair of userPairs) {
    const [u1, u2] = pair.split("___");
    try {
      const lastMsg = await prisma.message.findFirst({
        where: {
          OR: [
            { senderId: u1, receiverId: u2 },
            { senderId: u2, receiverId: u1 },
          ],
        },
        orderBy: { createdAt: "desc" },
      });

      const conv = await prisma.conversation.create({
        data: {
          lastMessage: lastMsg?.message || "Media",
          lastMessageTime: lastMsg?.createdAt || new Date(),
          participants: {
            create: [{ userId: u1 }, { userId: u2 }],
          },
        },
      });

      await prisma.message.updateMany({
        where: {
          OR: [
            { senderId: u1, receiverId: u2 },
            { senderId: u2, receiverId: u1 },
          ],
        },
        data: { conversationId: conv.id },
      });
    } catch {
      // ignore
    }
  }
  console.log("✅ Messages and Conversations migrated!");

  // ================= 6. NOTIFICATIONS =================
  console.log("📦 Migrating Notifications...");
  const mongoNotifs = await db.collection("notifications").find({}).toArray();

  for (const n of mongoNotifs) {
    const userId = idMap.get(n.userId?.toString());
    if (!userId) continue;

    const actorMongoId =
      n.data?.likerId ||
      n.data?.senderId ||
      n.data?.sharerId ||
      n.data?.reposterId ||
      n.data?.commenterId;
    const actorId = actorMongoId ? idMap.get(actorMongoId.toString()) : null;

    let notifType:
      | "post_like"
      | "post_comment"
      | "post_share"
      | "post_repost"
      | "friend_request"
      | "friend_accept" = "post_like";

    if (n.type === "post_comment") notifType = "post_comment";
    else if (n.type === "post_share") notifType = "post_share";
    else if (n.type === "post_repost") notifType = "post_repost";
    else if (n.type === "friend_request") notifType = "friend_request";
    else if (n.type === "friend_accept") notifType = "friend_accept";

    try {
      await prisma.notification.create({
        data: {
          id: getOrSetUuid(n._id),
          userId,
          actorId: actorId || null,
          type: notifType,
          message: n.data?.message || n.message || "New notification",
          postId: n.data?.postId ? idMap.get(n.data.postId.toString()) || null : null,
          commentId: n.data?.commentId ? idMap.get(n.data.commentId.toString()) || null : null,
          requestId: n.data?.requestId ? idMap.get(n.data.requestId.toString()) || null : null,
          isRead: n.isRead === true,
          createdAt: n.createdAt ? new Date(n.createdAt) : new Date(),
          updatedAt: n.updatedAt ? new Date(n.updatedAt) : new Date(),
        },
      });
    } catch {
      // ignore
    }
  }
  console.log("✅ Notifications migrated!");

  await mongoClient.close();
  await prisma.$disconnect();

  console.log("🎉 All MongoDB data successfully migrated to Neon PostgreSQL!");
}

main().catch((err) => {
  console.error("❌ Migration error:", err);
  process.exit(1);
});

