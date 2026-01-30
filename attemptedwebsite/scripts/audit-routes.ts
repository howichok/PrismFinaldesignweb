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

const checkFile = (filePath: string) => {
    const content = fs.readFileSync(filePath, "utf-8");

    // Find the function signature
    // export async function METHOD(...)
    const methodRegex = /export async function (GET|POST|PUT|DELETE|PATCH)\s*\(([\s\S]*?)\)\s*\{/g;
    let match;
    while ((match = methodRegex.exec(content)) !== null) {
        const args = match[2];
        // Check if second argument exists and mentions params
        const parts = args.split(",");
        if (parts.length > 1) {
            // It has a second argument (context)
            const contextArg = parts.slice(1).join(","); // join rest back
            if (contextArg.includes("params")) {
                // It uses params.
                // Check if the file has "Promise<" in the signature OR "await context.params" in body
                // We look at the matched signature contextArg.
                if (!contextArg.includes("Promise<")) {
                    console.log(`Potential Miss (No Promise): ${filePath}`);
                    console.log(`  Sig: ${match[0].substring(0, 100)}...`);
                }
            }
        }
    }
};

const appDir = path.join(process.cwd(), "app");
const files = walk(appDir);

files.forEach(checkFile);
console.log("Audit done.");
