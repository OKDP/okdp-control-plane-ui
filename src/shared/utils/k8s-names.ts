const K8S_NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

/** RFC 1123 label validation shared by the resource-create dialogs.
 *  Returns '' when valid; otherwise the message to render under the input. */
export function k8sNameError(name: string): string {
  if (!name) return '';
  if (name.length > 63) return 'Maximum 63 characters';
  if (!K8S_NAME_PATTERN.test(name)) {
    return 'Lowercase letters, numbers and hyphens only (must start/end with alphanumeric)';
  }
  return '';
}
