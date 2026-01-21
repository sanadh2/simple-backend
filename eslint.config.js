import eslint from "@eslint/js"
import tseslint from "typescript-eslint"
import simpleImportSort from "eslint-plugin-simple-import-sort"
import prettier from "eslint-plugin-prettier"

export default [
	{
		ignores: ["dist/**", "node_modules/**", "eslint.config.js"],
	},
	eslint.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	{
		files: ["**/*.ts"],
		plugins: {
			"simple-import-sort": simpleImportSort,
			prettier: prettier,
		},
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			"simple-import-sort/imports": "error",
			"simple-import-sort/exports": "error",
			"prettier/prettier": "error",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/explicit-function-return-type": "off",
			"@typescript-eslint/explicit-module-boundary-types": "off",
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/no-non-null-assertion": "warn",
			"@typescript-eslint/no-deprecated": "error",
			"no-console": "off",
			"prefer-const": "error",
			eqeqeq: ["error", "always"],
			"no-var": "error",
		},
	},
	{
		files: ["**/*.ts"],
		rules: {
			"no-restricted-syntax": [
				"error",
				{
					selector:
						'ImportDeclaration[source.type="Literal"][source.value=/^\\./][source.value!=/\\.js$/]',
					message:
						"Relative imports must include .js extension for ESM compatibility. Use './file.js' instead of './file'",
				},
			],
		},
	},
]
