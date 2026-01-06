// Fix paths in popup.html after build
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, "../dist");
const popupSrcPath = path.join(distPath, "src/popup/index.html");
const popupDestPath = path.join(distPath, "popup.html");

// Move popup.html to root if it's in src/popup/
if (fs.existsSync(popupSrcPath)) {
    let content = fs.readFileSync(popupSrcPath, "utf8");

    // Fix asset paths: change ../../assets/ to ./assets/
    content = content.replace(/src="\.\.\/\.\.\/assets\//g, 'src="./assets/');
    content = content.replace(/href="\.\.\/\.\.\/assets\//g, 'href="./assets/');

    fs.writeFileSync(popupDestPath, content);
    console.log("✓ Moved popup.html to dist root and fixed asset paths");

    // Clean up src folder in dist
    const srcFolder = path.join(distPath, "src");
    if (fs.existsSync(srcFolder)) {
        fs.rmSync(srcFolder, { recursive: true, force: true });
        console.log("✓ Cleaned up src folder from dist");
    }
} else if (fs.existsSync(popupDestPath)) {
    // If already in correct location, just fix paths
    let content = fs.readFileSync(popupDestPath, "utf8");
    content = content.replace(/src="\.\.\/\.\.\/assets\//g, 'src="./assets/');
    content = content.replace(/href="\.\.\/\.\.\/assets\//g, 'href="./assets/');
    fs.writeFileSync(popupDestPath, content);
    console.log("✓ popup.html already in correct location, fixed paths");
} else {
    console.error("✗ popup.html not found in either location");
    process.exit(1);
}
