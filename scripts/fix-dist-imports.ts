import fs from "fs";
import path from "path";

function fixDir(dir: string): void {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const full = path.join(dir, file);

    if (fs.statSync(full).isDirectory()) {
      fixDir(full);
      continue;
    }

    if (!file.endsWith(".js")) continue;

    let content = fs.readFileSync(full, "utf8");

    let changed = false;
    content = content.replace(
      /from\s+["'](\.\.?\/[^"']+)["']/g,
      (match: string, p1: string) => {
        if (p1.endsWith(".js") || p1.endsWith(".json")) return match;

        const targetPathFull = path.join(path.dirname(full), p1);

        if (fs.existsSync(targetPathFull) && fs.statSync(targetPathFull).isDirectory()) {
          const indexPath = path.join(targetPathFull, "index.js");
          if (fs.existsSync(indexPath)) {
            changed = true;
            return match.replace(p1, `${p1}/index.js`);
          }
        }

        changed = true;
        return match.replace(p1, `${p1}.js`);
      }
    );

    if (changed) {
      fs.writeFileSync(full, content);
    }
  }
}

fixDir("./dist");
console.log("Successfully fixed ESM dist imports!");

