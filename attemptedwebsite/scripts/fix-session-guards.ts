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
            if (file.endsWith("route.ts")) {
                fileList.push(filePath);
            }
        }
    }
    return fileList;
};

const fixFile = (filePath: string) => {
    let content = fs.readFileSync(filePath, "utf-8");
    const originalContent = content;

    // Pattern: const { session, response } = await requireAuth();
    // if (response) return response;
    // ... usage of session.userId without checking if session is null

    // We want to change:
    // if (response) return response;
    // to:
    // if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const requireAuthRegex = /(const\s+\{\s*session,\s*response\s*\}\s*=\s*await\s+requireAuth\(\);[\s\S]*?if\s*\(\s*response\s*\)\s*return\s+response;)/g;

    content = content.replace(requireAuthRegex, (match) => {
        // Check if it already has the fix
        if (match.includes("!session")) return match;

        // Replace the if condition
        return match.replace(
            "if (response) return response;",
            'if (response || !session) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });'
        );
    });

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, "utf-8");
        console.log(`Fixed session guard: ${filePath}`);
    }
};

const appDir = path.join(process.cwd(), "app");
const files = walk(appDir);

files.forEach(fixFile);
console.log("Session guard audit done.");
