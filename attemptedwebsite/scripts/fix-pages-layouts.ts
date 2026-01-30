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
            if (file.endsWith("page.tsx") || file.endsWith("layout.tsx")) {
                fileList.push(filePath);
            }
        }
    }
    return fileList;
};

const fixFile = (filePath: string) => {
    let content = fs.readFileSync(filePath, "utf-8");
    const originalContent = content;

    // 1. Fix Interface/Type Definitions (Same as before)
    content = content.replace(/(interface|type)\s+\w+\s*(?:=[^;]+)?\{[\s\S]*?(params:\s*)\{([\s\S]*?)\}/g, (match, typeKw, prefix, inner) => {
        if (match.includes("Promise<")) return match;
        return match.replace("params: {", "params: Promise<{").replace(/}(\s*)$/, "}>$1");
    });

    // 2. Fix Function Signatures using "Rename and Await" pattern
    // Matches: export default [async] function Page({ params }: Props)
    // We make 'async ' optional in the regex group 2

    const funcRegex = /export (default )?(async )?function (\w+)\(\s*\{\s*([\s\S]*?)\s*\}\s*:\s*([\w<>]+)\s*\)\s*\{/g;

    content = content.replace(funcRegex, (match, def, isAsync, name, props, typeAnnot) => {
        if (!props.includes("params")) return match; // No params, no touch
        if (props.includes("paramsPromise")) return match; // Already fixed

        // Check if params is merely being passed or used.
        // We rename destructuring: params -> params: paramsPromise

        const newProps = props.replace(/\bparams\b/, "params: paramsPromise");

        // ALWAYS make it async now
        return `export ${def || ""}async function ${name}({ ${newProps} }: ${typeAnnot}) {
  const params = await paramsPromise;`;
    });

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, "utf-8");
        console.log(`Fixed: ${filePath}`);
    }
};

const appDir = path.join(process.cwd(), "app");
const files = walk(appDir);

files.forEach(fixFile);
console.log("Pages/Layouts audit done.");
