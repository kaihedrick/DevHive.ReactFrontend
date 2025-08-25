module.exports = {
  extends: [
    "react-app",
    "react-app/jest"
  ],
  overrides: [
    {
      files: ["src/**/*.{ts,tsx,js,jsx}"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              // Disallow importing shared CSS directly in components
              {
                group: ["**/src/styles/**/*.css"],
                message:
                  "Import tokens.css, utilities.css, and resets.css only in app entry. Use CSS Modules next to components."
              }
            ]
          }
        ]
      }
    }
  ]
};
