import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  // Ignore build output and dependencies
  {
    ignores: ['dist/**', 'node_modules/**', '*.js', '!eslint.config.js']
  },
  
  // Base ESLint recommended rules
  eslint.configs.recommended,
  
  // TypeScript ESLint recommended rules
  ...tseslint.configs.recommendedTypeChecked,
  
  // Project-specific configuration
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Style preferences
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      
      // Deprecation detection - catch usage of deprecated APIs
      '@typescript-eslint/no-deprecated': 'error',
      
      // Allow console statements (useful for server logging)
      'no-console': 'off',
      
      // Prefer const over let when possible
      'prefer-const': 'error',
      
      // Require === and !== instead of == and !=
      'eqeqeq': ['error', 'always'],
      
      // Disallow var
      'no-var': 'error',
    },
  }
];

