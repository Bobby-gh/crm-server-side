function organizationRepository(dataSource) {
  return dataSource.getRepository('Organization');
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'organization';
}

function toPublicOrganization(organization) {
  if (!organization) {
    return null;
  }

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    createdByUserId: organization.createdByUserId || null,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt
  };
}

async function createOrganization(dataSource, { name, createdByUserId }) {
  const repository = organizationRepository(dataSource);
  const baseName = typeof name === 'string' && name.trim() ? name.trim() : 'Organization';
  const baseSlug = slugify(baseName);

  let slug = baseSlug;
  let suffix = 1;
  while (await repository.exists({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const organization = repository.create({
    name: baseName,
    slug,
    createdByUserId: createdByUserId || null
  });

  const saved = await repository.save(organization);
  return toPublicOrganization(saved);
}

async function getOrganizationById(dataSource, organizationId) {
  const organization = await organizationRepository(dataSource).findOne({ where: { id: organizationId } });
  return toPublicOrganization(organization);
}

module.exports = {
  createOrganization,
  getOrganizationById,
  toPublicOrganization
};