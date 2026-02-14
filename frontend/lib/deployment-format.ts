export function projectNameToPathSegment(projectName: string): string {
  const ascii = projectName
    .trim()
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
  const slug = ascii
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "project"
}

export function deploymentNumberToDisplay(deploymentNumber: number): string {
  return `#${deploymentNumber}`
}

export function publicDeploymentIdToDisplay(publicId: string): string {
  if (publicId.startsWith("dpl_")) {
    return `#${publicId.slice(4)}`
  }
  return publicId
}
