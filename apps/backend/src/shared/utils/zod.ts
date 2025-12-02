import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Extend Zod with OpenAPI methods once globally
extendZodWithOpenApi(z);

// Re-export the extended Zod instance
export { z };
