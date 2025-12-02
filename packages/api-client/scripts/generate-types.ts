import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openapiPath = path.join(__dirname, '../../../apps/backend/openapi.json');
const outputPath = path.join(__dirname, '../src/types/api.d.ts');

console.log('🔄 Generating types from OpenAPI spec...');

execSync(`npx openapi-typescript ${openapiPath} -o ${outputPath}`, { stdio: 'inherit' });

console.log('✅ Types generated successfully!');
