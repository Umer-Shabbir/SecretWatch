const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== TARGET FINDING DEBUG ===");

  const findingId = "cmt7az9hz0001sevrsjh55h33";
  const finding = await prisma.finding.findUnique({
    where: { id: findingId },
    include: { flag: true }
  });

  if (!finding) {
    console.log(`Finding ${findingId} not found in DB!`);
  } else {
    console.log("Finding info:", {
      id: finding.id,
      repoFullName: finding.repoFullName,
      status: finding.status,
      failureReason: finding.failureReason,
      createdAt: finding.createdAt,
      flag: finding.flag
    });
  }

  // Check how many tokens are active
  const activeTokens = await prisma.githubToken.findMany({
    where: { active: true },
    select: {
      id: true,
      maskedIdentifier: true,
      rateLimitRemaining: true,
      lastUsedAt: true
    }
  });
  console.log("Active GitHub Tokens count:", activeTokens.length);
  console.log("Active Tokens details:", activeTokens);

  // Check recent flags
  const recentFlags = await prisma.flag.findMany({
    take: 5,
    orderBy: { postedAt: 'desc' }
  });
  console.log("Recent flags in DB:", recentFlags);

  // Check recent failed flags
  const failedFindings = await prisma.finding.findMany({
    where: { status: 'FAILED' },
    take: 5,
    orderBy: { createdAt: 'desc' }
  });
  console.log("Recent failed findings:", failedFindings.map(f => ({
    id: f.id,
    repoFullName: f.repoFullName,
    failureReason: f.failureReason
  })));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
