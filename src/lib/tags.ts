/** Slug from tag name: lowercase, collapse spaces to hyphen, alphanumeric + hyphen only. */
export function tagSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'tag';
}
