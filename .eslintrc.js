module.exports = {
	parser: "typescript",
	plugins: ["@typescript-eslint", "prettier"],
	extends: [
		"plugin:@typescript-eslint/recommended",
		"plugin:prettier/recommended",
		"prettier/@typescript-eslint"
	],
	parserOptions: {
		project: "./tsconfig.json",
		ecmaVersion: 2018,
		sourceType: "module"
	},
	rules: {
		"prettier/prettier": [
			"error",
			{
				singleQuote: false,
				parser: "typescript",
				useTabs: true,
				printWidth: 80,
				trailingCommas: "none"
			}
		]
	},
	env: {
		"jest/globals": true
	}
};
