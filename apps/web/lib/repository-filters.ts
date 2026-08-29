import { prisma } from "@/lib/db";
import { RepositoryFilterType } from "@prisma/client";

export interface RepositoryFilterSummary {
  id: string;
  type: RepositoryFilterType;
  pattern: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class InvalidFilterError extends Error {
  constructor(public reason: string) {
    super(`Invalid repository filter: ${reason}`);
    this.name = "InvalidFilterError";
  }
}

export class FilterNotFoundError extends Error {
  constructor(public id: string) {
    super(`Repository filter not found: ${id}`);
    this.name = "FilterNotFoundError";
  }
}

export async function listRepositoryFilters(): Promise<RepositoryFilterSummary[]> {
  return prisma.repositoryFilter.findMany({
    orderBy: [{ type: "asc" }, { createdAt: "desc" }],
  });
}

export async function createRepositoryFilter(params: {
  type: RepositoryFilterType;
  pattern: string;
  enabled?: boolean;
}): Promise<RepositoryFilterSummary> {
  const pattern = params.pattern.trim();
  if (!pattern) {
    throw new InvalidFilterError("pattern cannot be empty");
  }
  if (params.type !== "ALLOW" && params.type !== "BLOCK") {
    throw new InvalidFilterError("type must be ALLOW or BLOCK");
  }

  return prisma.repositoryFilter.create({
    data: {
      type: params.type,
      pattern,
      enabled: params.enabled ?? true,
    },
  });
}

export async function updateRepositoryFilter(
  id: string,
  params: {
    pattern?: string;
    type?: RepositoryFilterType;
    enabled?: boolean;
  }
): Promise<RepositoryFilterSummary> {
  const existing = await prisma.repositoryFilter.findUnique({ where: { id } });
  if (!existing) {
    throw new FilterNotFoundError(id);
  }

  const data: { pattern?: string; type?: RepositoryFilterType; enabled?: boolean } = {};
  if (params.pattern !== undefined) {
    const pattern = params.pattern.trim();
    if (!pattern) {
      throw new InvalidFilterError("pattern cannot be empty");
    }
    data.pattern = pattern;
  }
  if (params.type !== undefined) {
    if (params.type !== "ALLOW" && params.type !== "BLOCK") {
      throw new InvalidFilterError("type must be ALLOW or BLOCK");
    }
    data.type = params.type;
  }
  if (params.enabled !== undefined) {
    data.enabled = params.enabled;
  }

  return prisma.repositoryFilter.update({
    where: { id },
    data,
  });
}

export async function deleteRepositoryFilter(id: string): Promise<void> {
  const existing = await prisma.repositoryFilter.findUnique({ where: { id } });
  if (!existing) {
    throw new FilterNotFoundError(id);
  }

  await prisma.repositoryFilter.delete({
    where: { id },
  });
}
