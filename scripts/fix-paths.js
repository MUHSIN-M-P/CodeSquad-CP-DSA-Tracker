// Fix paths in popup.html after build
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const popupPath = path.join(__dirname, '../dist/popup.html');

if (fs.existsSync(popupPath)) {
  let content = fs.readFileSync(popupPath, 'utf8');
  content = content.replace(/src="\.\.\/assets\//g, 'src="./assets/');
  content = content.replace(/href="\.\.\/assets\//g, 'href="./assets/');
  fs.writeFileSync(popupPath, content);
  console.log('✓ Fixed paths in popup.html');
} else {
  console.error('✗ popup.html not found');
  process.exit(1);
}
