import { z } from 'zod';

// Define the schema for environment variables
const envSchema = z.object({
  // Server Configuration
  PORT: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive()),
  
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  
  // Database Configuration
  MONGO_URI: z.url().min(1, 'MONGO_URI is required'),
});

// Export the inferred type
export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables against the schema
 * @throws {Error} If validation fails
 * @returns {Env} Validated environment variables
 */
export const validateEnv = (): Env => {
  try {
    const validated = envSchema.parse(process.env);
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues
        .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
        .join('\n');
      
      console.error('❌ Environment variable validation failed:\n' + errorMessages);
      process.exit(1);
    }
    
    throw error;
  }
};

// Validate and export the environment configuration
export const env = validateEnv();

