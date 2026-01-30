import fs from "fs";
import path from "path";

const walk = (dir: string, fileList: string[] = []) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walk(filePath, fileList);
        } else {
            if (file === "route.ts") {
                fileList.push(filePath);
            }
        }
    }
    return fileList;
};

const fixFile = (filePath: string) => {
    let content = fs.readFileSync(filePath, "utf-8");
    const originalContent = content;

    // Regex to match:
    // export async function METHOD(
    //   request: Request,
    //   { params }: { params: { ... } }
    // ) {

    const regex = /export async function (\w+)\(\s*(\w+): (NextRequest|Request),\s*\{\s*params\s*\}\s*:\s*\{\s*params\s*:\s*(\{[\s\S]*?\})\s*\}\s*,?\s*\)\s*\{/g;

    content = content.replace(regex, (match, method, reqName, reqType, paramsType) => {
        return `export async function ${method}(
  ${reqName}: ${reqType},
  context: { params: Promise<${paramsType}> },
) {
  const params = await context.params;`;
    });

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, "utf-8");
        console.log(`Fixed: ${filePath}`);
    }
};

const appDir = path.join(process.cwd(), "app");
const files = walk(appDir);

files.forEach(fixFile);
console.log("Done.");
