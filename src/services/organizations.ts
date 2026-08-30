import { DataSource, Repository } from 'typeorm';
import { Organization, PublicOrganization, toPublicOrganization } from '../entities/Organization';

function organizationRepository(dataSource: DataSource): Repository<Organization> {
  return dataSource.getRepository(Organization);
}

function slugify(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'organization';
}

export async function createOrganization(
  dataSource: DataSource,
  { name, createdByUserId }: { name: string; createdByUserId: number | null }
): Promise<PublicOrganization> {
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
  return toPublicOrganization(saved)!;
}

export async function getOrganizationById(
  dataSource: DataSource,
  organizationId: number
): Promise<PublicOrganization | null> {
  const organization = await organizationRepository(dataSource).findOne({ where: { id: organizationId } });
  return toPublicOrganization(organization);
}
