import { FileContext } from "./file-context";
import { isReservedKeyword } from "./reserved-keywords";

export class ScopeContext {
  private readonly fileContext: FileContext;
  private readonly reservedNames: Set<string>;

  constructor(fileContext: FileContext, reservedNames: string[] = []) {
    this.fileContext = fileContext;
    this.reservedNames = new Set(reservedNames);
  }

  getFileContext(): FileContext {
    return this.fileContext;
  }

  /**
   * Returns a name that is not already reserved.
   */
  getFreeName(preferredName: string): string {
    let freeName = this.getSafeName(preferredName);
    let freeSuffix = 2;
    while (this.reservedNames.has(freeName) || this.isImported(freeName)) {
      freeName = `${preferredName}_${freeSuffix++}`;
    }
    return freeName;
  }

  /**
   * Suffixes name if it's a reserved keyword
   */
  getSafeName(name: string): string {
    return isReservedKeyword(name) || this.isImported(name) ? `${name}_` : name;
  }

  /**
   * Checks if there's an import statement with a given name.
   */
  isImported(name: string): boolean {
    return this.fileContext.hasImportName(name);
  }
}
