export interface SourceLocation {
  line: number;
  column: number;
}

export function formatLocation(location?: SourceLocation): string {
  if (!location) {
    return 'desconhecido';
  }
  return `${location.line}:${location.column}`;
}
