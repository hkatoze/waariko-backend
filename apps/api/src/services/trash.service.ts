import { db, clients, projects, eq, and, isNotNull, desc } from '@waariko/db'

// ── Lister tous les éléments supprimés de la corbeille ───────────────────────
export async function getTrashItems(companyId: string) {
  const [deletedClients, deletedProjects] = await Promise.all([
    // Clients supprimés
    db.query.clients.findMany({
      where: (c, { and, eq, isNotNull }) =>
        and(eq(c.companyId, companyId), isNotNull(c.deletedAt)),
      orderBy: (c, { desc }) => desc(c.deletedAt),
    }),

    // Projets supprimés (avec nom du client)
    db
      .select({
        id:           projects.id,
        name:         projects.name,
        companyId:    projects.companyId,
        clientId:     projects.clientId,
        deletedAt:    projects.deletedAt,
        clientName:   clients.name,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(and(eq(projects.companyId, companyId), isNotNull(projects.deletedAt)))
      .orderBy(desc(projects.deletedAt)),
  ])

  const items = [
    ...deletedClients.map(c => ({
      id:          c.id,
      type:        'client' as const,
      name:        c.name,
      location:    'CLIENT',
      deletedAt:   c.deletedAt!,
    })),
    ...deletedProjects.map(p => ({
      id:          p.id,
      type:        'project' as const,
      name:        p.name,
      location:    p.clientName ?? 'Client supprimé',
      deletedAt:   p.deletedAt!,
    })),
  ].sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime())

  return items
}

// ── Restaurer un client ───────────────────────────────────────────────────────
export async function restoreClient(companyId: string, clientId: string) {
  const [updated] = await db
    .update(clients)
    .set({ deletedAt: null, deletedBy: null, updatedAt: new Date() })
    .where(and(eq(clients.companyId, companyId), eq(clients.id, clientId)))
    .returning()
  return updated
}

// ── Restaurer un projet ───────────────────────────────────────────────────────
export async function restoreProject(companyId: string, projectId: string) {
  const [updated] = await db
    .update(projects)
    .set({ deletedAt: null, deletedBy: null, updatedAt: new Date() })
    .where(and(eq(projects.companyId, companyId), eq(projects.id, projectId)))
    .returning()
  return updated
}

// ── Suppression définitive d'un client ───────────────────────────────────────
export async function permanentDeleteClient(companyId: string, clientId: string) {
  await db
    .delete(clients)
    .where(and(eq(clients.companyId, companyId), eq(clients.id, clientId), isNotNull(clients.deletedAt)))
}

// ── Suppression définitive d'un projet ───────────────────────────────────────
export async function permanentDeleteProject(companyId: string, projectId: string) {
  await db
    .delete(projects)
    .where(and(eq(projects.companyId, companyId), eq(projects.id, projectId), isNotNull(projects.deletedAt)))
}

// ── Vider la corbeille (tout supprimer définitivement) ────────────────────────
export async function emptyTrash(companyId: string) {
  await Promise.all([
    db.delete(clients).where(and(eq(clients.companyId, companyId), isNotNull(clients.deletedAt))),
    db.delete(projects).where(and(eq(projects.companyId, companyId), isNotNull(projects.deletedAt))),
  ])
}
