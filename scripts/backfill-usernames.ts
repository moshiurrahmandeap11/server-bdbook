import { prisma } from "../src/app/lib/prisma";

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "") // Remove spaces
    .replace(/[^\w-]+/g, "") // Remove non-word chars
    .replace(/--+/g, "-");
}

async function main() {
  console.log("Starting username backfill...");

  const users = await prisma.user.findMany({
    where: {
      username: null,
    },
  });

  console.log(`Found ${users.length} users needing usernames.`);

  for (const user of users) {
    let baseUsername = slugify(user.fullName);
    if (!baseUsername || baseUsername.length < 3) {
      baseUsername = user.email.split("@")[0].toLowerCase().replace(/[^\w]/g, "");
    }
    if (!baseUsername || baseUsername.length < 3) {
      baseUsername = `user${Math.floor(1000 + Math.random() * 9000)}`;
    }

    let username = baseUsername;
    let count = 1;

    // Ensure uniqueness
    while (true) {
      const existing = await prisma.user.findUnique({
        where: { username },
      });
      if (!existing || existing.id === user.id) {
        break;
      }
      username = `${baseUsername}${count}`;
      count++;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { username },
    });

    console.log(`Assigned username "${username}" to user "${user.fullName}" (${user.id})`);
  }

  console.log("Username backfill completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

