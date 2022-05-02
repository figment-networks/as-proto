import * as assert from "assert";
import { CodeGeneratorRequest, CodeGeneratorResponse } from "google-protobuf/google/protobuf/compiler/plugin_pb";
import { FileDescriptorProto } from "google-protobuf/google/protobuf/descriptor_pb";
import prettier from "prettier";

import { FileContext } from "../file-context";
import { GeneratorContext } from "../generator-context";
import { getPathWithoutProto } from "../names";
import { generateEnum } from "./enum";
import { generateMessage } from "./message";

export function processFile(fileDescriptor: FileDescriptorProto, fileContext: FileContext): string {
  const filename = fileDescriptor.getName();
  assert.ok(filename);

  const filePackage = fileDescriptor.getPackage();

  const types: string[] = [];
  for (const messageDescriptor of fileDescriptor.getMessageTypeList()) {
    types.push(generateMessage(messageDescriptor, fileContext));
  }
  for (const enumDescriptor of fileDescriptor.getEnumTypeList()) {
    types.push(generateEnum(enumDescriptor, fileContext));
  }

  return `${fileContext.getImportsCode()}\n\n${types.join("\n\n")}`;
}

export function addFile(filename: string, code: string, codeGenResponse: CodeGeneratorResponse, protoc_version: string): void {
  let formattedCode =
    `// Code generated by protoc-gen-as. DO NOT EDIT.\n` +
    `// versions:\n` +
    `// 	 protoc-gen-as v0.2.3\n` +
    `// 	 protoc        v${protoc_version}\n` +
    `// source: ${filename}"\n\n"` +
    code;

  try {
    formattedCode = prettier.format(code, {
      parser: "typescript",
      printWidth: 130,
    });
  } catch (error) {
    console.error(error);
  }

  const outputFile = new CodeGeneratorResponse.File();
  outputFile.setName(filename);
  outputFile.setContent(formattedCode);
  codeGenResponse.addFile(outputFile);
}

export function generateExport(
  codeGenRequest: CodeGeneratorRequest,
  codeGenResponse: CodeGeneratorResponse,
  generatorContext: GeneratorContext,
  protoc_version: string
) {
  const exports = new Map<string, Set<string>>();
  const indexes = new Map<string, Set<string>>();

  for (const filename of codeGenRequest.getFileToGenerateList()) {
    const packages = generatorContext.getFileDescriptorByFileName(filename)?.getPackage()?.split(".") as string[];
    const filePath = getPathWithoutProto(filename).split("/");

    if (packages.length !== filePath.length - 1) {
      throw new Error(`Cannot generate export for ${filename}. Packages length not equals to path length -1.`);
    }

    for (let i = 1; i < filePath.length; i++) {
      const path = "./" + filePath.slice(0, i).join("/");
      const exportPath = filePath.at(i) as string;
      if (exports.has(path)) {
        exports.get(path)?.add(exportPath);
      } else {
        exports.set(path, new Set<string>().add(exportPath));
      }
    }

    for (let i = 0; i < filePath.length -1; i++) {
      const path = "./" + filePath.slice(0, i+1).join("/");
      const pkg = packages.at(i) as string;
      if (indexes.has(path)) {
        indexes.get(path)?.add(pkg);
      } else {
        indexes.set(path, new Set<string>().add(pkg));
      }
    }
  }

  exports.forEach((exportPath: Set<string>, path: string) => {
    const filename = path + "/_export.ts";
    let code: string = "";
    exportPath.forEach((target) => {
      code += `export * from './${target}';\n`;
    });
    addFile(filename, code, codeGenResponse, protoc_version);
  });

  indexes.forEach((pkgs: Set<String>, path: string) => {
    const filename = path + "/index.ts";
    let code: string = "";
    pkgs.forEach((target) => {
      code += `import * as ${target} from './_export';\n`;
    });
    code += `export { ${[...pkgs].join(', ')} };`
    addFile(filename, code, codeGenResponse, protoc_version);
  });
}
